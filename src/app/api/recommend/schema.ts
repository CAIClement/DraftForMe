import { z } from "zod";
import { ROLES } from "@/lib/draft/roles";

const roleSchema = z.enum(ROLES);

export const recommendationRequestSchema = z.object({
  role: roleSchema,
  region: z.string().min(1),
  tier: z.string().min(1),
  enemyPicks: z.array(z.object({ championId: z.string().min(1), role: roleSchema })).default([]),
  // Champion ids only. The engine uses allies for exclusion and nothing else,
  // and sending their lanes would imply otherwise.
  allyPicks: z.array(z.string().min(1)).default([]),
  bans: z.array(z.string()).default([]),
  priority: z.number().int().min(0).max(100).default(50),
  topN: z.number().int().min(1).max(20).default(10)
});
