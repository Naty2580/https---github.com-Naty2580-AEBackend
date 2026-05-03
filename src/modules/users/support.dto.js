import { z } from 'zod';

export const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().trim().min(5).max(100),
    description: z.string().trim().min(10).max(1000)
  })
});

export const resolveTicketSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    resolution: z.string().trim().min(5).optional()
  })
});