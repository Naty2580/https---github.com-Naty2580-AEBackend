import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../api/middlewares/validate.middleware.js';
import { loginSchema, registerSchema, verifyEmailSchema, resendVerificationSchema ,forgotPasswordSchema, resetPasswordSchema, registerVendorSchema, verifyPhoneSchema, telegramLoginSchema } from './auth.dto.js';
import { authRateLimiter } from '../../api/middlewares/rate-limiter.js';

const router = Router();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

router.post('/register', validate(registerSchema), authController.register);
router.post('/register/vendor', validate(registerVendorSchema), authController.registerVendor);
router.post('/login', validate(loginSchema), authController.login);
router.post('/login/telegram', validate(telegramLoginSchema), authController.telegramLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/verify-phone', validate(verifyPhoneSchema), authController.verifyPhone);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);

export default router;