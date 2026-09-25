import type { Route } from "next";
import type { Role } from "@/lib/draft/roles";

// A "matchup" is role plus an unordered champion pair. Canonicalized here so
// the app never has to try both orders: "Darius vs Garen" and "Garen vs
// Darius" are the same row, the same URL, the same everything.
export type MatchupKey = { role: Role; championLowId: string; championHighId: string };

export function matchupKey(championAId: string, championBId: string, role: Role): MatchupKey {
  if (championAId === championBId) {
    throw new Error("A matchup needs two different champions.");
  }

  const [championLowId, championHighId] = [championAId, championBId].sort();
  return { role, championLowId, championHighId };
}

// champions.id has no hyphens (scripts/build-seed-data.mjs strips apostrophes,
// dots and spaces but champion ids never contained one to begin with), so
// "-vs-" is an unambiguous separator.
export function pairSegment(key: Pick<MatchupKey, "championLowId" | "championHighId">): string {
  return `${key.championLowId}-vs-${key.championHighId}`;
}

// Returns null for anything that is not exactly two non-empty ids already in
// canonical order -- including the reversed pair, which the page treats as
// unknown (404) rather than redirecting, per the design's "keep the route
// simple and the page cacheable per exact URL".
export function parsePairSegment(segment: string): { championLowId: string; championHighId: string } | null {
  const parts = segment.split("-vs-");
  if (parts.length !== 2) return null;

  const [championLowId, championHighId] = parts;
  if (!championLowId || !championHighId || championLowId >= championHighId) return null;

  return { championLowId, championHighId };
}

export function matchupHref(championAId: string, championBId: string, role: Role): Route {
  const key = matchupKey(championAId, championBId, role);
  return `/duel/${key.role}/${pairSegment(key)}` as Route;
}
