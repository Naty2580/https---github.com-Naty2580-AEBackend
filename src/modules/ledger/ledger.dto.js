import { z } from 'zod';

export const resolveDisputeSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    resolution: z.enum(['REFUND_CUSTOMER', 'PAY_DELIVERER']),
    notes: z.string().trim().min(5, "Resolution notes required for audit")
  })
});

export const retryPayoutSchema = z.object({
  params: z.object({ orderId: z.string().uuid() })
});