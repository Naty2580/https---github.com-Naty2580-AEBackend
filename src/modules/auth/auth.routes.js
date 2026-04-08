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
 *               telegramId:
 *                 type: number
 *                 example: 123456789
 *               astuEmail:
 *                 type: string
 *                 example: it.natnael.dev@astu.edu.et
 *               fullName:
 *                 type: string
 *                 example: Natnael Dev
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: User registered successfully, OTP sent
 *       400:
 *         description: Validation error
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
 *               fullName:
 *                 type: string
 *                 example: "Delicious Cafe Manager"
 *               telegramId:
 *                 type: number
 *                 example: 987654321
 *               phoneNumber:
 *                 type: string
 *                 example: "0911223344"
 *               email:
 *                 type: string
 *                 example: "contact@deliciouscafe.com"
 *               password:
 *                 type: string
 *                 example: "VendorPass123!"
 *               businessDocumentUrl:
 *                 type: string
 *                 example: "https://aws.s3.com/business-license.pdf"
 *     responses:
 *       201:
 *         description: Vendor registered, pending admin approval
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
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Either an ASTU email or an Ethiopian phone number
 *                 example: it.natnael.dev@astu.edu.et
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful. Returns Tokens.
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validate(loginSchema), authController.login);

router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

/**
 * @openapi
 * /auth/verify-email:
 *   post:
 *     summary: Verify a user's ASTU email with OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - astuEmail
 *               - otp
 *             properties:
 *               astuEmail:
 *                 type: string
 *                 example: it.natnael.dev@astu.edu.et
 *               otp:
 *                 type: string
 *                 description: The 6-digit code sent to the email
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email successfully verified
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/verify-phone', validate(verifyPhoneSchema), authController.verifyPhone);
/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: it.natnael.dev@astu.edu.et
 *     responses:
 *       200:
 *         description: Reset OTP sent
 */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using an OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: it.natnael.dev@astu.edu.et
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 example: "NewStrongPass123!"
 *     responses:
 *       200:
 *         description: Password updated successfully
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     summary: Resend OTP to email or phone
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *                 example: it.natnael.dev@astu.edu.et
 *     responses:
 *       200:
 *         description: OTP Resent
 */
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);

export default router;