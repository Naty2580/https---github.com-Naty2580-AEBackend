import { z } from 'zod';

// Register schema
const registerSchema = z.object({
  body: z.object({
    telegramId: z.string().transform(val => BigInt(val)), // Convert to BigInt
    astuEmail: z.string().email(),
    fullName: z.string().min(1),
    phoneNumber: z.string().min(10),
    password: z.string().min(8), // Increased min length
    role: z.enum(['CUSTOMER', 'DELIVERER', 'VENDOR_STAFF', 'ADMIN']).optional().default('CUSTOMER'),
  }),
});

// Login schema
const loginSchema = z.object({
  body: z.object({
    astuEmail: z.string().email(),
    password: z.string().min(1),
  }),
});

// Refresh token schema
const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

// MFA setup schema
const setupMfaSchema = z.object({
  body: z.object({
    secret: z.string().min(1),
  }),
});

// MFA verify schema
const verifyMfaSchema = z.object({
  body: z.object({
    token: z.string().length(6),
  }),
});

// Change password schema
const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});

// Forgot password schema
const forgotPasswordSchema = z.object({
  body: z.object({
    astuEmail: z.string().email(),
  }),
});

// Reset password schema
const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  }),
});

// Enable MFA schema
const enableMfaSchema = z.object({
  body: z.object({
    method: z.enum(['TOTP', 'SMS', 'EMAIL']),
  }),
});

// Disable MFA schema
const disableMfaSchema = z.object({
  body: z.object({
    code: z.string().min(6),
  }),
});

// Add trusted device schema
const addTrustedDeviceSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1),
    deviceName: z.string().optional(),
  }),
});

export {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  setupMfaSchema,
  verifyMfaSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  enableMfaSchema,
  disableMfaSchema,
  addTrustedDeviceSchema,
};