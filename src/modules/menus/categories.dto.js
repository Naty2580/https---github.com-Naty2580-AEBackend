import { z } from 'zod';

export const createCategorySchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid()
  }),
  body: z.object({
    name: z.string().trim().min(2, "Category name must be at least 2 characters"),
    sortOrder: z.number().int().min(0).default(0)
  })
});

export const updateCategorySchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid(),
    categoryId: z.string().uuid()
  }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    sortOrder: z.number().int().min(0).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  })
});

export const deleteCategorySchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid(),
    categoryId: z.string().uuid()
  })
});

export const reorderCategoriesSchema = z.object({
  params: z.object({
    restaurantId: z.string().uuid()
  }),
  body: z.object({
    categories: z.array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int().min(0)
      })
    ).min(2, "At least two categories required for reordering")
  })
});