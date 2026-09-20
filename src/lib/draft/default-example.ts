import type { EnemyPick } from "@/lib/recommendation/types";
import type { Role } from "./roles";

export const DEFAULT_EXAMPLE: {
  role: Role;
  region: string;
  tier: string;
  enemyPicks: EnemyPick[];
} = {
  role: "mid",
  region: "euw",
  tier: "emerald_plus",
  enemyPicks: [
    { championId: "zed", role: "mid" },
    { championId: "caitlyn", role: "adc" }
  ]
};
