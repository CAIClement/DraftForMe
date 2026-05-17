import { z } from "zod";

export const recommendationRequestSchema = z.object({
  role: z.string().min(1),
  region: z.string().min(1),
  tier: z.string().min(1),
  enemyPicks: z.array(z.string()).default([]),
  bans: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(100).default(50),
  topN: z.number().int().min(1).max(20).default(10)
});
