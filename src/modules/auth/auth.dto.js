import { z } from 'zod';

const astuEmailValidator = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._%+-]+@astu\.edu\.et$/,
    { message: "Must be a valid @astu.edu.et university email address" }
  );

export const loginSchema = z.object({
  body: z.object({
    astuEmail: astuEmailValidator,
    password: z.string().min(8 , "Password must be at least 8 characters")
  })
});

export const registerSchema = z.object({
  body: z.object({
    telegramId: z.coerce.bigint(),
    astuEmail: astuEmailValidator,
    fullName: z.string().min(3),
    phoneNumber: z.string().trim().regex(/^(09|07)\d{8}$/, { message: "Must be a valid Ethiopian phone number" }),
    password: z.string().min(8 , "Password must be at least 8 characters")
  })
});

export const sendOtpSchema = z.object({
  body: z.object({
    astuEmail: astuEmailValidator
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    astuEmail: astuEmailValidator,
    otp: z.string().length(6)
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    astuEmail: astuEmailValidator
  })
});

export const resendVerificationSchema = z.object({
  body: z.object({
    astuEmail: astuEmailValidator
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    astuEmail: astuEmailValidator,
    otp: z.string().length(6),
    newPassword: z.string().min(8 , "Password must be at least 8 characters")
  })
});