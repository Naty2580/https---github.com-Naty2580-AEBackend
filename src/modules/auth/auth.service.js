import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../../infrastructure/database/prisma.client.js';
import { UnauthorizedError, ConflictError, BusinessLogicError, NotFoundError, ForbiddenError } from '../../core/errors/domain.errors.js';
import { AUTH_ERRORS } from '../../core/errors/error.codes.js';
import { generateAccessToken, generateRefreshToken } from '../../core/utils/token.utils.js';
import { emailAdapter } from '../../infrastructure/email/email.adapter.js';


export class AuthService {
  constructor(userRepository, authRepository) {
    this.userRepository = userRepository;
    this.authRepository = authRepository;
  }

  async _generateAndSendOTP(user, type, purpose) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    await this.authRepository.storeVerificationToken(user.id, tokenHash, type);
    await emailAdapter.sendAuthOTP(user.astuEmail, otp, purpose);
  }

  async register(data) {
    const existingUser = await this.userRepository.findByEmail(data.astuEmail);
    if (existingUser) throw new ConflictError('User with this email already exists');

    const hashedPassword = await bcrypt.hash(data.password, 12);

    return await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          telegramId: data.telegramId,
          astuEmail: data.astuEmail,
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          password: hashedPassword,
          gender: data.gender,
          isEmailVerified: false
        }
      });


      await tx.customerProfile.create({ data: { userId: newUser.id } });

      this._generateAndSendOTP(newUser, 'EMAIL_VERIFICATION', 'Account Verification').catch(console.error);


      return { id: newUser.id, astuEmail: newUser.astuEmail, role: newUser.role };
    });
  }

  async login(email, password) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingMinutes = Math.ceil((user.lockedUntil - new Date()) / 60000);
      throw new ForbiddenError(`Account locked due to multiple failed attempts. Try again in ${remainingMinutes} minutes.`);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.authRepository.incrementFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedError(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.authRepository.resetLoginAttempts(user.id);
    }


    if (user.status !== 'ACTIVE') {
      throw new BusinessLogicError(AUTH_ERRORS.USER_BANNED);
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenError(AUTH_ERRORS.ACCOUNT_PENDING);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await this.authRepository.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken, user: { id: user.id, fullName: user.fullName, role: user.role }
    };
  }

  async verifyEmail(astuEmail, otp) {
    const user = await this.userRepository.findByEmail(astuEmail);
    if (!user) throw new NotFoundError('User not found');
    if (user.isEmailVerified) throw new BusinessLogicError('Email already verified');

    const record = await this.authRepository.findVerificationToken(user.id, 'EMAIL_VERIFICATION');
    if (!record || new Date() > record.expiresAt) {
      throw new BusinessLogicError('OTP expired or invalid');
    }

    const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
    if (record.tokenHash !== hashedInput) {
      throw new BusinessLogicError('Invalid OTP');
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true } }),
      prisma.verificationToken.delete({ where: { id: record.id } })
    ]);
  }

  async forgotPassword(astuEmail) {
    const user = await this.userRepository.findByEmail(astuEmail);
    if (!user) return; // Prevent email enumeration attacks by silently succeeding

    await this._generateAndSendOTP(user, 'PASSWORD_RESET', 'Password Reset');
  }

  async resetPassword(astuEmail, otp, newPassword) {
    const user = await this.userRepository.findByEmail(astuEmail);
    if (!user) throw new NotFoundError('User not found');

    const record = await this.authRepository.findVerificationToken(user.id, 'PASSWORD_RESET');
    if (!record || new Date() > record.expiresAt) {
      throw new BusinessLogicError('OTP expired or invalid');
    }

    const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
    if (record.tokenHash !== hashedInput) {
      throw new BusinessLogicError('Invalid OTP');
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: newHashedPassword } }),
      prisma.verificationToken.delete({ where: { id: record.id } })
    ]);

    // Security check: Force logout on all devices after password reset
    await this.authRepository.revokeAllUserTokens(user.id);
  }

  async refreshAccess(token) {
    const storedToken = await this.authRepository.findRefreshToken(token);

    if (!storedToken || new Date() > storedToken.expiresAt) {
      if (storedToken) await this.authRepository.revokeRefreshToken(token);
      throw new UnauthorizedError(AUTH_ERRORS.TOKEN_EXPIRED);
    }

    if (storedToken.isRevoked) {
      console.warn(`[SECURITY ALERT] Token replay attack detected for User ID: ${storedToken.userId}`);

      await this.authRepository.revokeAllUserTokens(storedToken.userId);
      throw new UnauthorizedError(AUTH_ERRORS.UNAUTHORIZED);
    }

    if (storedToken.user.status !== 'ACTIVE') {
      throw new BusinessLogicError(AUTH_ERRORS.USER_BANNED);
    }

    // Token Rotation Strategy: Invalidate old, issue new
    await this.authRepository.revokeRefreshToken(token);

    const newAccessToken = generateAccessToken(storedToken.user);
    const newRefreshToken = generateRefreshToken();

    await this.authRepository.storeRefreshToken(storedToken.userId, newRefreshToken);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(token) {
    await this.authRepository.revokeRefreshToken(token);
  }

  async revokeAllTokens(userId) {
    await this.authRepository.revokeAllUserTokens(userId);
  }

  // Add this method inside the AuthService class

  async resendVerificationEmail(astuEmail) {
    const user = await this.userRepository.findByEmail(astuEmail);
    
    if (!user) {
      return; // Silent success to prevent email enumeration
    }
    
    if (user.isEmailVerified) {
      throw new BusinessLogicError('Account is already verified.');
    }

    // Rate limit check: Prevent spamming the resend button
    const existingToken = await this.authRepository.findVerificationToken(user.id, 'EMAIL_VERIFICATION');
    if (existingToken) {
      const timeSinceCreation = (new Date() - existingToken.createdAt) / 1000; // in seconds
      if (timeSinceCreation < 60) {
        throw new BusinessLogicError('Please wait at least 60 seconds before requesting another email.');
      }
    }

    await this._generateAndSendOTP(user, 'EMAIL_VERIFICATION', 'Account Verification (Resend)');
  }

}