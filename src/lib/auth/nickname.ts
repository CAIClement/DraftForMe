import { z } from "zod";

// Mirrors the check constraint in supabase/migrations/0004_accounts.sql;
// change both together.
export const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Le pseudo doit faire au moins 3 caractères.")
  .max(20, "Le pseudo doit faire au plus 20 caractères.")
  .regex(/^[A-Za-z0-9_-]+$/, "Utilisez seulement des lettres sans accent, des chiffres, « _ » et « - ».");

export type NicknameResult = { ok: true; nickname: string } | { ok: false; error: string };

export function validateNickname(value: string): NicknameResult {
  const parsed = nicknameSchema.safeParse(value);
  return parsed.success ? { ok: true, nickname: parsed.data } : { ok: false, error: parsed.error.issues[0].message };
}
