import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    restaurantId: z.string().uuid(),
    sortOrder: z.number().int().default(0)
  })
});

export const createMenuItemSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    price: z.number().positive(),
    categoryId: z.string().uuid(),
    prepTimeMins: z.number().int().positive().default(15),
    isAvailable: z.boolean().default(true)
  })
});