import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    restaurantId: z.string().uuid(),
    items: z.array(z.object({
      menuId: z.string().uuid(),
      quantity: z.number().int().positive()
    })).min(1),
    tip: z.number().nonnegative().default(0)
  })
});