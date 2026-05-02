import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { loginSchema, registerSchema, verifyEmailSchema, resendVerificationSchema ,forgotPasswordSchema, resetPasswordSchema, registerVendorSchema, verifyPhoneSchema } from './auth.dto.js';
import { authRateLimiter } from '../../api/middlewares/rate-limiter.js';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new Customer or Deliverer
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - telegramId
 *               - astuEmail
 *               - fullName
 *               - password
 *             properties:
 *               telegramId: { type: number, example: 123456789 }
 *               astuEmail: { type: string, example: it.natnael.dev@astu.edu.et }
 *               fullName: { type: string, example: Natnael Dev }
 *               password: { type: string, example: SecurePass123! }
 *     responses:
 *       201: { description: User registered successfully }
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @openapi
 * /auth/register/vendor:
 *   post:
 *     summary: Register a new Restaurant Vendor
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string, example: "Delicious Cafe Manager" }
 *               telegramId: { type: number, example: 987654321 }
 *               phoneNumber: { type: string, example: "0911223344" }
 *               email: { type: string, example: "contact@cafe.com" }
 *               password: { type: string, example: "VendorPass123!" }
 *               businessDocumentUrl: { type: string, example: "https://example.com/license.pdf" }
 *     responses:
 *       201: { description: Vendor registered }
 */
router.post('/register/vendor', validate(registerVendorSchema), authController.registerVendor);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login for all users
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, example: admin.seed@astu.edu.et }
 *               password: { type: string, example: Password123! }
 *     responses:
 *       200: { description: Login successful }
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Token refreshed }
 */
router.post('/refresh', authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: Logged out successfully }
 */
router.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     summary: Verify ASTU email with OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [astuEmail, otp]
 *             properties:
 *               astuEmail: { type: string, example: it.natnael.dev@astu.edu.et }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Verified }
 */
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);

/**
 * @openapi
 * /auth/verify-phone:
 *   post:
 *     summary: Verify phone number with OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber, otp]
 *             properties:
 *               phoneNumber: { type: string, example: "0911223344" }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Verified }
 */
router.post('/verify-phone', validate(verifyPhoneSchema), authController.verifyPhone);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset (sends OTP to email)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [astuEmail]
 *             properties:
 *               astuEmail: { type: string, example: [EMAIL_ADDRESS] }
 *     responses:
 *       200: { description: OTP sent successfully }
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string, example: [EMAIL_ADDRESS] }
 *               otp: { type: string, example: "123456" }
 *               newPassword: { type: string, example: NewSecurePass123! }
 *     responses:
 *       200: { description: Password reset successfully }
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: [EMAIL_ADDRESS] }
 *     responses:
 *       200: { description: OTP resent successfully }
 */
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);

export default router;