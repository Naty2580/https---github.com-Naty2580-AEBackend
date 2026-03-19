// import { z } from 'zod';

// export const createUserSchema = z.object({
//   body: z.object({
//     fullName: z.string().min(3, "Full name is required"),
//     email: z.email("Invalid email address").optional(),
//     password: z.string().min(6, "Password must be at least 6 characters"),
//     studentId: z.string().min(5, "Valid ASTU ID is required"),
//     phoneNumber: z.string().startsWith("09", "Phone must start with 09 or 07"),
//     telegramId: z.number().optional(), // Can be null if they sign up on web
//     gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
//     avatarUrl: z.url().optional()
//   })
// });