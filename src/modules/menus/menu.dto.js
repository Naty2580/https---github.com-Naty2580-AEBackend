
import { z } from 'zod';

export const createMenuItemSchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid()
  }),
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID"),
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    description: z.string().trim().optional(),
    price: z.number().positive("Price must be a positive number"),
    isFasting: z.boolean().default(false),
    imageUrl: z.string().url().optional(),
    isAvailable: z.boolean().default(true),
    prepTimeMins: z.number().int().min(5).max(120).positive().default(15)
  })
});

export const updateMenuItemSchema = z.object({
  params: z.object({
    restaurantId: z.uuid(),
    itemId: z.uuid()
  }),
  body: z.object({
    categoryId: z.uuid().optional(),
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().optional(),
    price: z.number().positive().optional(),
    isFasting: z.boolean().optional(),
    imageUrl: z.url().nullable().optional(),
    prepTimeMins: z.number().int().min(5).max(120).positive().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  })
});

export const toggleItemAvailabilitySchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid(),
    itemId: z.string().uuid()
  }),
  body: z.object({
    isAvailable: z.boolean({ required_error: "Availability status is required" }),
    reason:  z.string().trim().max(50).optional()
  })
});

export const deleteMenuItemSchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid(),
    itemId: z.string().uuid()
  })
});

export const queryMenuItemsSchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid()
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    search: z.string().trim().optional(),
    categoryId: z.uuid().optional(),
    includeArchived: z.enum(['true', 'false']).default('false'), // Critical for Vendor Dashboard
    isAvailable: z.enum(['true', 'false']).optional(),
    isFasting: z.enum(['true', 'false']).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    sortBy: z.enum(['price_asc', 'price_desc', 'name']).default('name'),
    tag: z.string().optional() 
  })
});

export const bulkToggleAvailabilitySchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid()
  }),
  body: z.object({
    itemIds: z.array(z.string().uuid()).min(1, "Must provide at least one item ID"),
    isAvailable: z.boolean({ required_error: "Availability status is required" })
  })
});