export const ROLES = ["top", "jungle", "mid", "adc", "support"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "ADC",
  support: "Support"
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
