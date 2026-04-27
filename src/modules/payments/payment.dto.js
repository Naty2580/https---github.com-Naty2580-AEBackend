import { z } from 'zod';

export const initializePaymentSchema = z.object({
  body: z.object({
    orderId: z.string().uuid("Valid Order ID is required")
  })
});