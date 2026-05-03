import { z } from 'zod';

export const resolveAnomalySchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    resolutionNotes: z.string().trim().min(5, "Notes required to resolve an anomaly flag")
  })
});