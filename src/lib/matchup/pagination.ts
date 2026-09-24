// "Voir plus" on the matchup page is a plain link carrying ?offset= (see the
// matchup-reviews plan, deviation 4), so the offset arrives as untrusted text.
export const COMMENTS_PER_PAGE = 20;

// Anything that is not a plain non-negative integer (negative, decimal,
// "1e3", repeated param, too large to be exact) falls back to the first page.
export function parseOffset(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  const offset = Number(value);
  return Number.isSafeInteger(offset) ? offset : 0;
}
