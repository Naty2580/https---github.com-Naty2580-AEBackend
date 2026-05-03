import { z } from 'zod';

export const toggleBookmarkSchema = z.object({
  body: z.object({
    type: z.enum(['RESTAURANT', 'MENU_ITEM']),
    targetId: z.string().uuid("Invalid target ID")
  })
});

export const queryBookmarksSchema = z.object({
  query: z.object({
    type: z.enum(['RESTAURANT', 'MENU_ITEM']).optional()
  })
});