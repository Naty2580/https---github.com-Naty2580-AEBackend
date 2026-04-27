import { z } from 'zod';

const astuEmailValidator = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._%+-]+@astu\.edu\.et$/,
    { message: "Must be a valid @astu.edu.et university email address" }
  );
const ethioPhoneRegex = /^(09|07)\d{8}$/;

const identifierValidator = z.string().trim().toLowerCase()
  .refine(val => 
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || // Is standard email
    ethioPhoneRegex.test(val),                // Or is valid phone
    { message: "Must be a valid email or Ethiopian phone number" }
  );

export const loginSchema = z.object({
  body: z.object({
    identifier: identifierValidator, 
    password: z.string().min(1)
  })
});

export const telegramLoginSchema = z.object({
  body: z.object({
    initData: z.string().min(10, "Telegram initData is required")
  })
});

export const registerSchema = z.object({
  body: z.object({
    telegramId: z.coerce.bigint(),
    astuEmail: astuEmailValidator,
    fullName: z.string().min(3),
    password: z.string().min(8 , "Password must be at least 8 characters")
  })
});

export const registerVendorSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(3, "Full name or Business contact name required"),
    telegramId: z.coerce.bigint(),
    phoneNumber: z.string().trim().regex(ethioPhoneRegex, "Valid Ethiopian phone number required"),
    email: z.email("Standard email required for business communications").toLowerCase(),
    password: z.string().min(8),
    businessDocumentUrl: z.url("Must provide a valid link to business registration documents")
  })
});

export const verifyPhoneSchema = z.object({
  body: z.object({
    phoneNumber: z.string().regex(ethioPhoneRegex),
    otp: z.string().length(6)
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
     identifier: identifierValidator
  })
});

export const resendVerificationSchema = z.object({
  body: z.object({
    identifier: identifierValidator
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    identifier: identifierValidator,
    otp: z.string().length(6),
    newPassword: z.string().min(8 , "Password must be at least 8 characters")
  })
});