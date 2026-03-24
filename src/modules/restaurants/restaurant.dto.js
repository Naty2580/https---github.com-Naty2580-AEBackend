import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ethioPhoneRegex = /^(09|07)\d{8}$/;

export const createRestaurantSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    location: z.string().trim().min(5),
    phone: z.string().regex(ethioPhoneRegex, "Must be a valid Ethiopian phone number"), 
    lat: z.number(),
    lng: z.number(),
    minOrderValue: z.number().nonnegative().default(0),
    tags: z.array(z.string().min(2)).max(5).default([]), 
    mode: z.enum(['VENDOR_MANAGED', 'ADMIN_MANAGED']).default('VENDOR_MANAGED'),
    imageUrl: z.string().url().nullable().optional(),
    openingTime: z.string().regex(timeRegex, " Must be in the format HH:MM").optional(),
    closingTime: z.string().regex(timeRegex, " Must be in the format HH:MM").optional()
  })
});

export const updateRestaurantSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    phone: z.string().regex(ethioPhoneRegex).optional(), 
    location: z.string().trim().min(3).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    minOrderValue: z.number().nonnegative().optional(),
    tags: z.array(z.string().min(2)).max(5).optional(),
    imageUrl: z.string().url().optional(),
    isOpen: z.boolean().optional(),
    openingTime: z.string().regex(timeRegex, " Must be in the format HH:MM").optional(),
    closingTime: z.string().regex(timeRegex, " Must be in the format HH:MM").optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  })
});

export const queryRestaurantSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    isOpen: z.enum(['true', 'false']).optional(),
    search: z.string().trim().optional(),
    tags: z.union([z.string(), z.array(z.string())]).transform(val => 
      Array.isArray(val) ? val : val.split(',')
    ).optional(),
    minRating: z.coerce.number().min(1).max(5).optional(),
    userLat: z.coerce.number().min(-90).max(90).optional(),
    userLng: z.coerce.number().min(-180).max(180).optional(),
    sortBy: z.enum(['distance', 'rating', 'name']).default('name')
  })
});

export const toggleStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    isOpen: z.boolean({ required_error: "isOpen is required" })
  })
});
