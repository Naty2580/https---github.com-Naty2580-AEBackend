import express from 'express';
import { register, login, setupMfa, verifyMfa, changePassword, refreshToken, logout } from '../controllers/auth.controller.js';
import { registerSchema, loginSchema, refreshTokenSchema, setupMfaSchema, verifyMfaSchema, changePasswordSchema } from '../schemas/auth.schema.js';
import validate from '../../core/middlewares/validate.middleware.js';
import { protect } from '../../core/middlewares/auth.middleware.js';
import { authLimiter } from '../../core/middlewares/rateLimit.middleware.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);

// Protected routes
router.use(protect); // All below require auth
router.post('/setup-mfa', validate(setupMfaSchema), setupMfa);
router.post('/verify-mfa', validate(verifyMfaSchema), verifyMfa);
router.post('/change-password', validate(changePasswordSchema), changePassword);
router.post('/logout', logout);

export default router;