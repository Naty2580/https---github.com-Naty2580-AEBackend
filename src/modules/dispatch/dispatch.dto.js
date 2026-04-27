import { z } from 'zod';

export const acceptOrderSchema = z.object({
  params: z.object({
    orderId: z.string().uuid()
  })
});

export const liveLocationSchema = z.object({
  body: z.object({
    lat: z.number().min(-90).max(90, "Valid latitude required"),
    lng: z.number().min(-180).max(180, "Valid longitude required"),
    orderId: z.string().uuid().optional() // Provided if currently on an active delivery
  })
});