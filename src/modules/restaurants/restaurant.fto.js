import { z } from 'zod';

export const createRestaurantSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    location: z.string().min(5),
    lat: z.number(),
    lng: z.number(),
    mode: z.enum(['VENDOR_MANAGED', 'ADMIN_MANAGED']).default('VENDOR_MANAGED')
  })
});