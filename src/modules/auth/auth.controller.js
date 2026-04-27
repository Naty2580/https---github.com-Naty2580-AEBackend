import { AuthService } from './auth.service.js';
import { AuthRepository } from './auth.repository.js';
import { UserRepository } from '../users/users.repository.js';
import { UnauthorizedError } from '../../core/errors/domain.errors.js';
import { AUTH_ERRORS } from '../../core/errors/error.codes.js';
import { registerVendorSchema, verifyPhoneSchema } from './auth.dto.js';

const userRepository = new UserRepository();
const authRepository = new AuthRepository();
// Exported for testing interception
export const authService = new AuthService(userRepository, authRepository);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days  
};

export const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const registerVendor = async (req, res, next) => {
  try {
    const user = await authService.registerVendor(req.body);
    res.status(201).json({ 
      success: true, 
      message: 'Vendor application submitted. Please verify your phone number.',
      data: user 
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPhone = async (req, res, next) => {
  try {
    const { phoneNumber, otp } = req.body;
    await authService.verifyPhone(phoneNumber, otp);
    res.status(200).json({ success: true, message: 'Phone number verified successfully. Awaiting Admin approval.' });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const { accessToken, refreshToken, user } = await authService.login(identifier, password);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: { accessToken, user }
    });
  } catch (error) {
    next(error);
  }
};

export const telegramLogin = async (req, res, next) => {
  try {
    const { initData } = req.body;
    const { accessToken, refreshToken, user, isProfileComplete } = await authService.telegramLogin(initData);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: { accessToken, user, isProfileComplete }
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new UnauthorizedError(AUTH_ERRORS.UNAUTHORIZED);

    const { accessToken, refreshToken } = await authService.refreshAccess(token);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: { accessToken }
    });
  } catch (error) {
    // Clear cookie if refresh fails (e.g., revoked or expired)
    res.clearCookie('refreshToken', { ...COOKIE_OPTIONS, maxAge: 0 });
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await authService.logout(token);
    }

    res.clearCookie('refreshToken', { ...COOKIE_OPTIONS, maxAge: 0 });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { astuEmail, otp } = req.body;
    await authService.verifyEmail(astuEmail, otp);
    res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    await authService.forgotPassword(identifier);
    res.status(200).json({ success: true, message: 'If the account exists, an OTP has been sent.' });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    await authService.resetPassword(identifier, otp, newPassword);
    res.status(200).json({ success: true, message: 'Password reset successfully. Please login again.' });
  } catch (error) {
    next(error);
  }
};


export const resendVerification = async (req, res, next) => {
  try {
    const { identifier } = req.body;
    await authService.resendVerification(identifier);
    res.status(200).json({ success: true, message: 'If the account exists and is unverified, a new OTP has been sent.' });
  } catch (error) {
    next(error);
  }
};