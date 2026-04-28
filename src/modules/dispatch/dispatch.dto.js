import { z } from 'zod';

export const acceptOrderSchema = z.object({
  params: z.object({
    orderId: z.string().uuid()
  })
});