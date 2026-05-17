import { z } from "zod";

export const championPoolEntrySchema = z.object({
  championId: z.string().min(1),
  confidence: z.number().int().min(0).max(100).default(50),
  games: z.number().int().min(0).nullable().optional(),
  winRate: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});

export const championPoolRequestSchema = z.object({
  entries: z.array(championPoolEntrySchema).max(30)
});
