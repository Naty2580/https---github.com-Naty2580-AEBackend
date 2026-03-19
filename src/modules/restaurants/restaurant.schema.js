// import { z } from 'zod';

// export const createRestaurantSchema = z.object({
//   body: z.object({
//     name: z.string().min(3, "Name too short"),
//     location: z.string().min(3, "Location required"),
//     imageUrl: z.string().url().optional()
//   })
// });

// export const createCategorySchema = z.object({
//   body: z.object({
//     name: z.string().min(2, "Category name required"),
//     sortOrder: z.number().optional()
//   })
// });

// export const createProductSchema = z.object({
//   body: z.object({
//     name: z.string().min(2, "Product name required"),
//     price: z.number().positive("Price must be positive"),
//     categoryId: z.string().uuid("Invalid Category ID"),
//     description: z.string().optional(),
//     imageUrl: z.string().url().optional()
//   })
// });