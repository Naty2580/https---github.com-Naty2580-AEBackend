import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import zxcvbn from 'zxcvbn';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { PrismaClient } from '@prisma/client';
import logger from '../../core/logger.js';

const prisma = new PrismaClient();

// Email transporter
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Twilio client
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

// Helper: Generate JWT
const generateToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

// Helper: Verify Telegram ID (mock implementation - replace with real Telegram API call)
const verifyTelegramId = async (telegramId) => {
  // In production, call Telegram API to verify user
  // For now, assume valid if provided
  return true; // Mock: always true
};

// Helper: Check password strength
const checkPasswordStrength = (password) => {
  const result = zxcvbn(password);
  return result.score >= 3; // Require strong password
};

// Helper: Check if account is locked
const isAccountLocked = (user) => {
  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    return true;
  }
  return false;
};

// Helper: Send MFA code
const sendMfaCode = async (user, method) => {
  const code = speakeasy.totp({ secret: user.mfaSecret, encoding: 'base32' });
  if (method === 'SMS') {
    await twilioClient.messages.create({
      body: `Your MFA code is: ${code}`,
      from: process.env.TWILIO_PHONE,
      to: user.phoneNumber,
    });
  } else if (method === 'EMAIL') {
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.astuEmail,
      subject: 'Your MFA Code',
      text: `Your MFA code is: ${code}`,
    });
  }
  return code;
};

// Service: Register user
const registerUser = async (userData, req) => {
  const { telegramId, astuEmail, fullName, phoneNumber, password, role } = userData;

  // Check password strength
  if (!checkPasswordStrength(password)) {
    throw new Error('Password is too weak. Please choose a stronger password.');
  }

  // Check if Telegram ID is verified
  const isTelegramVerified = await verifyTelegramId(telegramId);
  if (!isTelegramVerified) {
    throw new Error('Invalid Telegram ID');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { telegramId },
        { astuEmail },
        { phoneNumber },
      ],
    },
  });
  if (existingUser) {
    throw new Error('User already exists');
  }

  // Hash password with Argon2
  const hashedPassword = await argon2.hash(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      telegramId,
      astuEmail,
      fullName,
      phoneNumber,
      password: hashedPassword,
      role,
    },
  });

  // Create profile based on role
  if (role === 'CUSTOMER') {
    await prisma.customerProfile.create({
      data: { userId: user.id },
    });
  } else if (role === 'DELIVERER') {
    await prisma.delivererProfile.create({
      data: { userId: user.id },
    });
  }

  await logAuthEvent(user.id, 'register', true, {}, req);
  return { user: { id: user.id, fullName: user.fullName, role: user.role } };
};

// Service: Login user
const loginUser = async (astuEmail, password, deviceId, req) => {
  // Find user
  const user = await prisma.user.findUnique({
    where: { astuEmail },
    include: {
      customerProfile: true,
      delivererProfile: true,
      vendorProfile: true,
      trustedDevices: true,
    },
  });
  if (!user) {
    await logAuthEvent(null, 'login', false, { astuEmail }, req);
    throw new Error('Invalid credentials');
  }

  // Check if account is locked
  if (isAccountLocked(user)) {
    await logAuthEvent(user.id, 'login', false, { reason: 'account_locked' }, req);
    throw new Error('Account is locked due to too many failed attempts');
  }

  // Check password
  const isPasswordValid = await argon2.verify(user.password, password);
  if (!isPasswordValid) {
    // Increment failed attempts
    const newAttempts = user.failedAttempts + 1;
    const lockoutUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // Lock for 15 min after 5 attempts

    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: newAttempts, lockoutUntil },
    });

    await logAuthEvent(user.id, 'login', false, { failedAttempts: newAttempts }, req);
    throw new Error('Invalid credentials');
  }

  // Reset failed attempts on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockoutUntil: null, lastLoginAt: new Date() },
  });

  // Check if device is trusted
  const isTrustedDevice = user.trustedDevices.some(d => d.deviceId === deviceId && d.isActive);

  if (user.mfaEnabled && !isTrustedDevice) {
    // Send MFA code
    await sendMfaCode(user, user.mfaMethod);
    return { requiresMfa: true, userId: user.id };
  }

  // Generate tokens
  const payload = { userId: user.id, role: user.role };
  const accessToken = generateToken(payload, process.env.JWT_SECRET, '15m');
  const refreshToken = generateToken(payload, process.env.JWT_REFRESH_SECRET, '7d');

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  await logAuthEvent(user.id, 'login', true, { deviceId }, req);
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      activeMode: user.activeMode,
    },
    accessToken,
    refreshToken,
  };
};

// Service: Verify MFA
const verifyMfaLogin = async (userId, code, deviceId, req) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  let verified = false;
  if (user.mfaMethod === 'TOTP') {
    verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
  } else {
    // For SMS/Email, code is sent, but for simplicity, assume code matches
    verified = true; // In production, store and verify sent code
  }

  if (!verified) {
    await logAuthEvent(userId, 'mfa_verify', false, {}, req);
    throw new Error('Invalid MFA code');
  }

  // Add to trusted devices if not already
  const existingDevice = await prisma.trustedDevice.findUnique({
    where: { userId_deviceId: { userId, deviceId } },
  });
  if (!existingDevice) {
    await prisma.trustedDevice.create({
      data: {
        userId,
        deviceId,
        deviceName: req?.get('User-Agent')?.substring(0, 50),
        ipAddress: req?.ip,
      },
    });
  }

  const payload = { userId: user.id, role: user.role };
  const accessToken = generateToken(payload, process.env.JWT_SECRET, '15m');
  const refreshToken = generateToken(payload, process.env.JWT_REFRESH_SECRET, '7d');

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await logAuthEvent(userId, 'mfa_verify', true, { deviceId }, req);
  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      activeMode: user.activeMode,
    },
    accessToken,
    refreshToken,
  };
};

// Service: Verify MFA
const verifyMfa = async (userId, token) => {
  // In production, retrieve user's secret
  const secret = 'USER_SECRET'; // Placeholder
  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2, // Allow 2 steps tolerance
  });
  if (!verified) {
    throw new Error('Invalid MFA token');
  }
  return true;
};

// Service: Change password
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await argon2.verify(user.password, currentPassword);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Check new password strength
  if (!checkPasswordStrength(newPassword)) {
    throw new Error('New password is too weak');
  }

  // Hash new password
  const hashedPassword = await argon2.hash(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  await logAuthEvent(userId, 'password_change', true);
  return { message: 'Password changed successfully' };
};

// Service: Refresh access token
const refreshAccessToken = async (refreshToken) => {
  // Verify refresh token
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  // Check if token exists and is not revoked
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });
  if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt < new Date()) {
    await logAuthEvent(decoded.userId, 'refresh_token', false);
    throw new Error('Invalid refresh token');
  }

  // Generate new access token
  const payload = { userId: decoded.userId, role: decoded.role };
  const newAccessToken = generateToken(payload, process.env.JWT_SECRET, '15m');

  await logAuthEvent(decoded.userId, 'refresh_token', true);
  return { accessToken: newAccessToken };
};

// Service: Logout (revoke refresh token)
const logoutUser = async (refreshToken) => {
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { isRevoked: true },
  });
  // In production, revoke all sessions for security
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  await logAuthEvent(decoded.userId, 'logout', true);
};

export {
  registerUser,
  loginUser,
  setupMfa,
  verifyMfa,
  changePassword,
  refreshAccessToken,
  logoutUser,
};