import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../../infrastructure/database/prisma.client.js';
import { UnauthorizedError, ConflictError, BusinessLogicError, NotFoundError, ForbiddenError } from '../../core/errors/domain.errors.js';
import { AUTH_ERRORS } from '../../core/errors/error.codes.js';
import { generateAccessToken, generateRefreshToken } from '../../core/utils/token.utils.js';
import { emailAdapter } from '../../infrastructure/email/email.adapter.js';
import { TelegramAdapter } from '../../infrastructure/telegram/telegram.adapter.js';

const mockSendSMS = async (phone, otp) => {
  console.log(`[SMS MOCK] To: ${phone} | OTP: ${otp}`);
};

export class AuthService {
  constructor(userRepository, authRepository) {
    this.userRepository = userRepository;
    this.authRepository = authRepository;
  }

    async _generateAndSendPhoneOTP(tx, user) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    await this.authRepository.storeVerificationToken(tx,user.id, tokenHash, 'PHONE_VERIFICATION');
    await mockSendSMS(user.phoneNumber, otp);
  }
  

  async _generateAndSendOTP(tx,user, type, purpose) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    await this.authRepository.storeVerificationToken(tx, user.id, tokenHash, type);
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
          password: hashedPassword,
          isEmailVerified: false
        }
      });

      await tx.customerProfile.create({ data: { userId: newUser.id } });
      await this._generateAndSendOTP(tx, newUser, 'EMAIL_VERIFICATION', 'Account Verification');
      return { id: newUser.id, astuEmail: newUser.astuEmail, role: newUser.role };
    });
  }

   async registerVendor(data) {
    // 1. Uniqueness Checks
    const existingPhone = await prisma.user.findUnique({ where: { phoneNumber: data.phoneNumber } });
    if (existingPhone) throw new ConflictError('User with this phone number already exists');

    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) throw new ConflictError('User with this email already exists');

    const hashedPassword = await bcrypt.hash(data.password, 12);

    return await prisma.$transaction(async (tx) => {
      // 2. Create User as VENDOR_STAFF, but unverified
      const newUser = await tx.user.create({
        data: {
          fullName: data.fullName,
          phoneNumber: data.phoneNumber,
          telegramId: data.telegramId,
          email: data.email,
          password: hashedPassword,
          role: 'VENDOR_STAFF',
          status: 'PENDING',
          activeMode: 'CUSTOMER',
          isEmailVerified: true, 
          isPhoneVerified: false
        }
      });

      // 3. Create Pending Vendor Profile
      await tx.vendorProfile.create({
        data: {
          userId: newUser.id,
          businessDocumentUrl: data.businessDocumentUrl,
          isOwner: true,
          verificationStatus: 'PENDING'
        }
      });

      // 4. Trigger SMS OTP
      this._generateAndSendPhoneOTP(tx, newUser).catch(console.error);

      return { id: newUser.id, phoneNumber: newUser.phoneNumber, role: newUser.role };
    });
  }

  async verifyPhone(phoneNumber, otp) {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) throw new NotFoundError('User not found');
    if (user.isPhoneVerified) throw new BusinessLogicError('Phone already verified'); // Reusing flag for simplicity

    const record = await this.authRepository.findVerificationToken(user.id, 'PHONE_VERIFICATION');
    if (!record || new Date() > record.expiresAt) {
      throw new BusinessLogicError('OTP expired or invalid');
    }

    const hashedInput = crypto.createHash('sha256').update(otp).digest('hex');
    if (record.tokenHash !== hashedInput) throw new BusinessLogicError('Invalid OTP');

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { isPhoneVerified: true } }),
      prisma.verificationToken.delete({ where: { id: record.id } })
    ]);
  }

  async login(identifier, password) {
    const user = await this.userRepository.findByIdentifier(identifier);
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
    // console.log('Sent token !!!!!!!!!!!!!!!!');
    
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.authRepository.resetLoginAttempts(user.id);
    }
    

    if (user.status !== 'ACTIVE') {
      throw new BusinessLogicError(AUTH_ERRORS.USER_BANNED);
    }

   if (!user.isEmailVerified ) {
      throw new ForbiddenError(AUTH_ERRORS.EMAIL_NOT_VERIFIED);
    }

    if (user.role === "VENDOR_STAFF" && !user.isPhoneVerified) {
  throw new ForbiddenError(AUTH_ERRORS.PHONE_NOT_VERIFIED);
}

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await this.authRepository.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken, user 
    };
  }

  async telegramLogin(initData) {
    let telegramUser;
    try {
      // 1. Cryptographically verify the payload belongs to our specific Bot
      telegramUser = TelegramAdapter.verifyInitData(initData);
    } catch (error) {
      throw new UnauthorizedError(`Telegram Authentication Failed: ${error.message}`);
    }

    if (!telegramUser || !telegramUser.id) {
      throw new UnauthorizedError('Telegram user data could not be extracted.');
    }

    // 2. Find user in Database
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramUser.id) }
    });

    // 3. Auto-Registration (If user doesn't exist, create a skeleton CUSTOMER profile)
    if (!user) {
      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            telegramId: BigInt(telegramUser.id),
            // Placeholder fields until they complete profile via /users/me/profile
            fullName: `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim(),
            phoneNumber: `UNKNOWN_${telegramUser.id}`, 
            password: 'NO_PASSWORD_TELEGRAM_OAUTH', // Impossible to login via standard route
            role: 'CUSTOMER',
            activeMode: 'CUSTOMER',
            isEmailVerified: false,
            isPhoneVerified: false,
          }
        });

        await tx.customerProfile.create({ data: { userId: newUser.id } });
        return newUser;
      });
    }

    // 4. Standard Status Checks
    if (user.status !== 'ACTIVE') throw new BusinessLogicError(AUTH_ERRORS.USER_BANNED);

    // 5. Issue Standard Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await this.authRepository.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, role: user.role },
      isProfileComplete: user.phoneNumber !== `UNKNOWN_${telegramUser.id}` // Hint to frontend to prompt for details
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

  async forgotPassword(identifier) {
    const user = await this.userRepository.findByIdentifier(identifier);
    if (!user) return; // Prevent email enumeration attacks by silently succeeding

    if (user.role === 'VENDOR_STAFF') {
      await this._generateAndSendPhoneOTP(user); // Vendors use SMS for recovery
    } else {
      await this._generateAndSendOTP(user, 'PASSWORD_RESET', 'Password Reset');
    }
  }

  async resetPassword(identifier, otp, newPassword) {
    const user = await this.userRepository.findByIdentifier(identifier);
    if (!user) throw new NotFoundError('User not found');

    const tokenType = user.role === 'VENDOR_STAFF' ? 'PHONE_VERIFICATION' : 'PASSWORD_RESET';

    const record = await this.authRepository.findVerificationToken(user.id, tokenType);
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

  async resendVerification(identifier) {
    const user = await this.userRepository.findByIdentifier(identifier);

    if (!user) {
      return; // Silent success to prevent email enumeration
    }

    if (user.isEmailVerified || user.isPhoneVerified) {
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

if (user.role === 'VENDOR_STAFF') {
      await this._generateAndSendPhoneOTP(user);
    } else {
      await this._generateAndSendOTP(user, 'EMAIL_VERIFICATION', 'Account Verification (Resend)');
    }  }

}