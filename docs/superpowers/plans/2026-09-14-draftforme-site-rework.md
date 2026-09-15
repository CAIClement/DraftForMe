# DraftForMe Site Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the landing page and the coach workspace into a single light-editorial page whose tool is pre-filled and already solved, and wire the repo's unused counter relations into scoring so enemy picks actually reorder recommendations.

**Architecture:** Design tokens move to CSS custom properties consumed through Tailwind, replacing three duplicated inline `C` objects. The recommendation engine gains a counter-relation input and carries champion facts through to the client. `/` becomes a Server Component that resolves a default example by calling `recommendChampions` directly, then hands it to a client `draft-tool` for interaction. `src/components/coach/` is replaced by focused components under `src/components/draft/`, `src/components/marketing/`, and `src/components/ui/`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript (strict), Tailwind CSS 3.4, Supabase (`@supabase/ssr`), Zod, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-14-draftforme-site-rework-design.md`

---

## Conventions for every task

- Run tests with `npm test` (Vitest, single run). A single file: `npm test -- src/path/to/file.test.ts`.
- Type-check with `npx tsc --noEmit`.
- Tests live next to the code they test, as `<name>.test.ts` / `<name>.test.tsx`. This matches the existing repo layout.
- `strict: true` is on. No `any`. No non-null assertions.
- Commit after every task. The working tree must be green (`npm test` passing) at every commit.

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `supabase/migrations/0002_counter_relations.sql` | The `counter_relations` table, RLS policy, index |
| `src/lib/recommendation/counter.ts` | Counter scoring from the relation |
| `src/lib/recommendation/counter.test.ts` | Counter scoring tests |
| `src/lib/draft/default-example.ts` | The pre-filled example shown on first paint |
| `src/lib/draft/default-example.test.ts` | Asserts the example's champions exist in the seed |
| `src/lib/data/counter-relations.test.ts` | Direction guard against known lane matchups |
| `src/components/ui/champion-avatar.tsx` | Champion portrait with initials fallback |
| `src/components/ui/chip.tsx` | Removable champion chip |
| `src/components/ui/score.tsx` | Large score readout |
| `src/components/draft/draft-tool.tsx` | The only stateful component |
| `src/components/draft/role-selector.tsx` | Five-role selector |
| `src/components/draft/enemy-picks.tsx` | Chips plus champion search |
| `src/components/draft/factor-bars.tsx` | Weighted factor rows |
| `src/components/draft/verdict.tsx` | The expanded dossier |
| `src/components/draft/alternatives.tsx` | Two collapsed picks |
| `src/components/draft/refine-prompt.tsx` | Optional Riot ID affordance |
| `src/components/draft/priority-control.tsx` | The weight control, shown beside the weights it changes |
| `src/components/marketing/site-header.tsx` | Header |
| `src/components/marketing/site-footer.tsx` | Footer |
| `src/components/marketing/hero.tsx` | Heading and one sentence |
| `src/components/marketing/explainer.tsx` | Three explanatory columns |
| `src/components/marketing/trust-bar.tsx` | Indexed games, patch, region, freshness |

**Modified**

| File | Change |
| --- | --- |
| `src/lib/recommendation/types.ts` | `CounterRelation`; champion facts and `available` on existing types |
| `src/lib/recommendation/engine.ts` | Consume relations, carry facts through |
| `src/lib/data/normalize.ts` | Map `games`, map counter-relation rows |
| `src/app/api/recommend/route.ts` | Select `games`, query relations |
| `src/lib/supabase/types.ts` | Declare `counter_relations` on the `Database` type |
| `scripts/build-seed-data.mjs` | Join sample sizes, emit counter relations |
| `tailwind.config.ts` | Map CSS variables into the palette |
| `src/app/globals.css` | Token definitions |
| `src/app/page.tsx` | Rewritten as the single page |
| `src/app/draft/page.tsx` | Redirect to `/` |

**Deleted**

`src/components/coach/coach-workspace.tsx`, `coach-workspace.test.tsx`, `champion-picker.tsx`, `decision-space.tsx`, `recommendation-card.tsx`.

---

## Task 1: Seed the counter relations

**Files:**
- Create: `supabase/migrations/0002_counter_relations.sql`
- Modify: `scripts/build-seed-data.mjs`
- Create: `scripts/build-seed-data.test.mjs`

The `counters` array in `data/tierlist_*.json` lists **the champions that beat the champion carrying the array**. The column is named `countered_by_champion_id` so that direction is unmistakable at every call site.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_counter_relations.sql`:

```sql
create table public.counter_relations (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  countered_by_champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, countered_by_champion_id, role, source),
  check (champion_id <> countered_by_champion_id)
);

alter table public.counter_relations enable row level security;

create policy "counter_relations_read_all" on public.counter_relations for select using (true);

create index counter_relations_lookup_idx on public.counter_relations (role, countered_by_champion_id);
create index counter_relations_champion_idx on public.counter_relations (role, champion_id);
```

- [ ] **Step 2: Write the failing seed test**

Create `scripts/build-seed-data.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { buildSeedLines } from "./build-seed-data.mjs";

const champions = {
  Ahri: { id: "Ahri", key: "103", image: "cdn/16.3.1/img/champion/Ahri.png", tags: ["Mage"] },
  Kennen: { id: "Kennen", key: "85", image: "cdn/16.3.1/img/champion/Kennen.png", tags: ["Mage"] }
};

const tierlists = [
  {
    region: "euw",
    tier: "emerald_plus",
    role: "mid",
    rows: [
      { rank: 1, name: "Ahri", slug: "ahri", role: "mid", win_rate: 52.55, pick_rate: 12.93, ban_rate: 4.08, counters: ["kennen"] }
    ]
  }
];

const stats = [
  { region: "euw", tier: "emerald_plus", role: "mid", rows: [{ name: "Ahri", games_played: "714379" }] }
];

describe("buildSeedLines", () => {
  it("writes the sample size joined from the stats file", () => {
    const sql = buildSeedLines({ champions, tierlists, stats }).join("\n");

    expect(sql).toContain("insert into public.champion_stats");
    expect(sql).toMatch(/'ahri', 'mid', 'euw', 'emerald_plus', 52\.55, 12\.93, 4\.08, 714379, 'opgg_cache'/);
  });

  it("writes null games when the champion is absent from the stats file", () => {
    const sql = buildSeedLines({ champions, tierlists, stats: [] }).join("\n");

    expect(sql).toMatch(/4\.08, null, 'opgg_cache'/);
  });

  it("emits one counter relation per counters entry, in the countered-by direction", () => {
    const sql = buildSeedLines({ champions, tierlists, stats }).join("\n");

    expect(sql).toContain(
      "insert into public.counter_relations (champion_id, countered_by_champion_id, role, source) values ('ahri', 'kennen', 'mid', 'opgg_cache')"
    );
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- scripts/build-seed-data.test.mjs`
Expected: FAIL — `buildSeedLines` is not exported by `build-seed-data.mjs`.

- [ ] **Step 4: Refactor the seed script into a pure function plus a thin entry point**

Replace the whole of `scripts/build-seed-data.mjs` with:

```js
import fs from "node:fs";
import path from "node:path";

function sql(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function numberOrNull(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "null";
}

export function championIdFromName(value) {
  return String(value).toLowerCase().replaceAll("'", "").replaceAll(".", "").replaceAll(" ", "");
}

// stats entries are keyed by champion id derived from the name: the stats files
// carry no slug, and their role lives in the filename rather than in the rows.
function gamesIndex(stats) {
  const index = new Map();
  for (const entry of stats) {
    for (const row of entry.rows) {
      index.set(`${entry.region}|${entry.tier}|${entry.role}|${championIdFromName(row.name)}`, row.games_played);
    }
  }
  return index;
}

export function buildSeedLines({ champions, tierlists, stats }) {
  const lines = ["-- Generated by scripts/build-seed-data.mjs", "begin;"];
  const games = gamesIndex(stats);

  for (const [name, champion] of Object.entries(champions)) {
    const id = String(champion.id).toLowerCase();
    const tags = `{${(champion.tags ?? []).map((tag) => `"${String(tag).replaceAll('"', '\\"')}"`).join(",")}}`;
    const versionMatch = String(champion.image).match(/cdn\/([^/]+)\/img/);
    const version = versionMatch?.[1] ?? "unknown";
    lines.push(
      `insert into public.champions (id, riot_key, slug, name, image_url, tags, ddragon_version) values (` +
        `${sql(id)}, ${sql(String(champion.key))}, ${sql(id)}, ${sql(name)}, ${sql(champion.image)}, ${sql(tags)}, ${sql(version)}` +
        `) on conflict (id) do update set name = excluded.name, image_url = excluded.image_url, tags = excluded.tags, ddragon_version = excluded.ddragon_version;`
    );
  }

  for (const { region, tier, role, rows } of tierlists) {
    for (const row of rows) {
      const championId = row.slug ? String(row.slug).toLowerCase() : championIdFromName(row.name);
      const played = games.get(`${region}|${tier}|${role}|${championIdFromName(row.name)}`);

      lines.push(
        `insert into public.champion_stats (champion_id, role, region, tier, win_rate, pick_rate, ban_rate, games, source) values (` +
          `${sql(championId)}, ${sql(role)}, ${sql(region)}, ${sql(tier)}, ${numberOrNull(row.win_rate)}, ${numberOrNull(row.pick_rate)}, ${numberOrNull(row.ban_rate)}, ${numberOrNull(played)}, 'opgg_cache'` +
          `) on conflict (champion_id, role, region, tier, source) do update set win_rate = excluded.win_rate, pick_rate = excluded.pick_rate, ban_rate = excluded.ban_rate, games = excluded.games, fetched_at = now();`
      );

      // `counters` lists the champions that BEAT this one, hence countered_by_champion_id.
      for (const counter of row.counters ?? []) {
        const counterId = String(counter).toLowerCase();
        if (counterId === championId) continue;
        lines.push(
          `insert into public.counter_relations (champion_id, countered_by_champion_id, role, source) values (` +
            `${sql(championId)}, ${sql(counterId)}, ${sql(role)}, 'opgg_cache'` +
            `) on conflict (champion_id, countered_by_champion_id, role, source) do update set fetched_at = now();`
        );
      }
    }
  }

  lines.push("commit;");
  return lines;
}

export function readSources(dataDir) {
  const champions = JSON.parse(fs.readFileSync(path.join(dataDir, "ddragon_champions.json"), "utf8"));
  const tierlists = [];
  const stats = [];

  for (const fileName of fs.readdirSync(dataDir)) {
    const tierMatch = fileName.match(/^tierlist_([^_]+)_(.+)_(top|jungle|mid|adc|support)\.json$/);
    if (tierMatch) {
      const [, region, tier, role] = tierMatch;
      tierlists.push({ region, tier, role, rows: JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8")) });
      continue;
    }

    const statsMatch = fileName.match(/^champion_stats_([^_]+)_(.+)_(top|jungle|mid|adc|support)\.json$/);
    if (statsMatch) {
      const [, region, tier, role] = statsMatch;
      stats.push({ region, tier, role, rows: JSON.parse(fs.readFileSync(path.join(dataDir, fileName), "utf8")) });
    }
  }

  return { champions, tierlists, stats };
}

const isEntryPoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href;

if (isEntryPoint) {
  const root = process.cwd();
  const outFile = path.join(root, "supabase", "seed.sql");
  const lines = buildSeedLines(readSources(path.join(root, "data")));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${lines.join("\n")}\n`);
  console.log(`Wrote ${outFile}`);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- scripts/build-seed-data.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 6: Regenerate the seed and check the counters landed**

Run: `npm run seed:build`
Expected: `Wrote .../supabase/seed.sql`

Run: `grep -c "insert into public.counter_relations" supabase/seed.sql`
Expected: `725`

Run: `grep -c ", null, 'opgg_cache'" supabase/seed.sql`
Expected: a number well below 242 — most champions now carry a sample size. If it prints 242, the join key is wrong; fix `gamesIndex` before continuing.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0002_counter_relations.sql scripts/build-seed-data.mjs scripts/build-seed-data.test.mjs supabase/seed.sql
git commit -m "feat: seed counter relations and champion sample sizes"
```

---

## Task 2: Direction guard on the counter relations

**Files:**
- Create: `src/lib/data/counter-relations.test.ts`

This test exists to fail loudly if the relation is ever loaded backwards. It reads the generated `seed.sql`, so it guards the real artifact rather than a fixture.

- [ ] **Step 1: Write the test**

Create `src/lib/data/counter-relations.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lane matchups whose outcome is not seriously disputed: the second champion
// beats the first. If `counters` were read backwards, these would invert.
const KNOWN: Array<{ role: string; loser: string; winner: string }> = [
  { role: "top", loser: "fiora", winner: "malphite" },
  { role: "top", loser: "darius", winner: "quinn" }
];

function parseRelations(): Array<{ championId: string; counteredBy: string; role: string }> {
  const sql = readFileSync("supabase/seed.sql", "utf8");
  const pattern =
    /insert into public\.counter_relations \(champion_id, countered_by_champion_id, role, source\) values \('([^']+)', '([^']+)', '([^']+)'/g;

  return [...sql.matchAll(pattern)].map((match) => ({
    championId: match[1],
    counteredBy: match[2],
    role: match[3]
  }));
}

describe("counter relations", () => {
  const relations = parseRelations();

  it("seeds every counter pair from the tierlists", () => {
    expect(relations).toHaveLength(725);
  });

  it("never lists a champion as its own counter", () => {
    expect(relations.filter((relation) => relation.championId === relation.counteredBy)).toHaveLength(0);
  });

  it("points from the champion that loses the lane to the one that wins it", () => {
    for (const { role, loser, winner } of KNOWN) {
      const forward = relations.some(
        (relation) => relation.role === role && relation.championId === loser && relation.counteredBy === winner
      );
      const backward = relations.some(
        (relation) => relation.role === role && relation.championId === winner && relation.counteredBy === loser
      );

      expect(forward, `${winner} should be recorded as countering ${loser} in ${role}`).toBe(true);
      expect(backward, `${loser} must not be recorded as countering ${winner} in ${role}`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/lib/data/counter-relations.test.ts`
Expected: PASS, 3 tests. If the third test fails, the direction in Task 1 is inverted — fix the seed script, do not adjust this test.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/counter-relations.test.ts
git commit -m "test: guard the direction of seeded counter relations"
```

---

## Task 3: Counter scoring from the relation

**Files:**
- Create: `src/lib/recommendation/counter.ts`
- Create: `src/lib/recommendation/counter.test.ts`
- Modify: `src/lib/recommendation/types.ts`

The data is a relation, not a percentage, so this does not reuse `counterScore`'s win-rate arithmetic. Neutral is 50, matching the existing 0–100 range so `computeWeights` is untouched.

- [ ] **Step 1: Add the types**

In `src/lib/recommendation/types.ts`, add:

```ts
export type CounterRelation = {
  championId: string;
  counteredByChampionId: string;
  role: string;
};

export type CounterVerdict = {
  score: number;
  available: boolean;
  beats: string[];
  losesTo: string[];
};
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/recommendation/counter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoreCounter } from "./counter";
import type { CounterRelation } from "./types";

// zed is countered by galio; diana is countered by zed.
const relations: CounterRelation[] = [
  { championId: "zed", counteredByChampionId: "galio", role: "mid" },
  { championId: "diana", counteredByChampionId: "zed", role: "mid" }
];

describe("scoreCounter", () => {
  it("is unavailable and neutral when there are no enemy picks", () => {
    const verdict = scoreCounter("galio", [], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("is unavailable when no relation is known for any enemy pick", () => {
    const verdict = scoreCounter("galio", ["orianna"], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("scores above neutral when the candidate counters the enemy", () => {
    const verdict = scoreCounter("galio", ["zed"], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeGreaterThan(50);
    expect(verdict.beats).toEqual(["zed"]);
  });

  it("scores below neutral when the enemy counters the candidate", () => {
    const verdict = scoreCounter("diana", ["zed"], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeLessThan(50);
    expect(verdict.losesTo).toEqual(["zed"]);
  });

  it("averages across enemy picks, so a known edge is diluted by an unknown", () => {
    const both = scoreCounter("galio", ["zed", "orianna"], relations);
    const only = scoreCounter("galio", ["zed"], relations);

    expect(both.available).toBe(true);
    expect(both.score).toBeGreaterThan(50);
    expect(both.score).toBeLessThan(only.score);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/lib/recommendation/counter.test.ts`
Expected: FAIL — cannot resolve `./counter`.

- [ ] **Step 4: Implement**

Create `src/lib/recommendation/counter.ts`:

```ts
import type { CounterRelation, CounterVerdict } from "./types";

const NEUTRAL = 50;
const EDGE = 35;

/**
 * Scores a candidate against the enemy picks using the seeded counter relations.
 *
 * The relation carries no win rate, only direction: `championId` is beaten by
 * `counteredByChampionId`. So a candidate that appears as the counter of an
 * enemy pick gains an edge, and one the enemy counters loses it. Enemy picks
 * with no known relation count as neutral, which dilutes the average rather
 * than being dropped — a single known edge should not read as certainty.
 */
export function scoreCounter(
  championId: string,
  enemyPicks: string[],
  relations: CounterRelation[]
): CounterVerdict {
  if (enemyPicks.length === 0) {
    return { score: NEUTRAL, available: false, beats: [], losesTo: [] };
  }

  const beats: string[] = [];
  const losesTo: string[] = [];

  const deltas = enemyPicks.map((enemyId) => {
    const candidateCountersEnemy = relations.some(
      (relation) => relation.championId === enemyId && relation.counteredByChampionId === championId
    );
    const enemyCountersCandidate = relations.some(
      (relation) => relation.championId === championId && relation.counteredByChampionId === enemyId
    );

    if (candidateCountersEnemy && !enemyCountersCandidate) {
      beats.push(enemyId);
      return EDGE;
    }

    if (enemyCountersCandidate && !candidateCountersEnemy) {
      losesTo.push(enemyId);
      return -EDGE;
    }

    return 0;
  });

  const available = beats.length > 0 || losesTo.length > 0;
  const average = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;

  return { score: NEUTRAL + average, available, beats, losesTo };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/lib/recommendation/counter.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recommendation/counter.ts src/lib/recommendation/counter.test.ts src/lib/recommendation/types.ts
git commit -m "feat: score counters from the seeded relation"
```

---

## Task 4: Carry counters and champion facts through the engine

**Files:**
- Modify: `src/lib/recommendation/types.ts`
- Modify: `src/lib/recommendation/engine.ts`
- Modify: `src/lib/recommendation/engine.test.ts`

- [ ] **Step 1: Extend the types**

In `src/lib/recommendation/types.ts`:

Add `games` to `ChampionStats`:

```ts
export type ChampionStats = {
  championId: string;
  name: string;
  imageUrl?: string;
  role: string;
  rank: number;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
  games: number | null;
};
```

Add `available` to `RecommendationFactor`:

```ts
export type RecommendationFactor = {
  key: "meta" | "player" | "counter";
  label: string;
  score: number;
  weight: number;
  detail: string;
  /** Whether the factor could be assessed at all. For `player` this is global —
   *  true when the user has any pooled champion, even one scoring low here —
   *  while for `counter` it is per-champion. */
  available: boolean;
};
```

Add the champion facts to `Recommendation`, after `counterScore`:

```ts
  rank: number;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
  games: number | null;
  totalRanked: number;
```

`totalRanked` is `input.stats.length`, **not** the filtered candidate count. `rank` comes from `normalize.ts` as a position in the unfiltered role list, so the denominator has to be that same list or the pair renders nonsense — `#60 / 55` once bans and enemy picks shrink the candidates.

Replace `matchups?: Matchup[]` in `RecommendInput` with:

```ts
  counterRelations?: CounterRelation[];
```

Delete the now-unused `Matchup` type.

- [ ] **Step 2: Replace the two obsolete matchup tests**

`src/lib/recommendation/engine.test.ts` currently ends with two tests built on the removed `matchups` input — `"uses matchup data when enemy picks are present"` and `"reports low confidence when matchup data is missing"`. Both reference `matchups` and the warning string `"Matchup data is incomplete for the current enemy picks."`, neither of which exists after this task. **Delete both tests.** They are replaced by the counter-relation tests below.

- [ ] **Step 3: Write the failing tests**

In `src/lib/recommendation/engine.test.ts`, add `games` to every entry of the existing `stats` fixture (`games: 200000` for `ahri`, `150000` for `zed`, `90000` for `orianna`) so it still satisfies `ChampionStats`, then append the block below. Note it declares its own fixture rather than reusing `stats`; the comment explains why. Make sure `ChampionStats` is in the file's type imports.



```ts
import type { CounterRelation } from "./types";

const relations: CounterRelation[] = [
  { championId: "zed", counteredByChampionId: "orianna", role: "mid" },
  { championId: "ahri", counteredByChampionId: "zed", role: "mid" }
];

// A local fixture with adjacent meta ranks. The shared `stats` fixture puts
// orianna at rank 8 out of 3 champions, which clamps its meta score to 0 — a
// 57-point weighted deficit that no counter edge could overcome, making the
// ranking assertion below untestable against it.
const counterStats: ChampionStats[] = [
  { championId: "ahri", name: "Ahri", role: "mid", rank: 1, winRate: 52, pickRate: 12, banRate: 4, games: 200000 },
  { championId: "orianna", name: "Orianna", role: "mid", rank: 2, winRate: 50, pickRate: 7, banRate: 2, games: 90000 },
  { championId: "zed", name: "Zed", role: "mid", rank: 3, winRate: 51, pickRate: 10, banRate: 18, games: 150000 }
];

describe("counter relations in recommendations", () => {
  function run(enemyPicks: string[]) {
    return recommendChampions({
      stats: counterStats,
      playerPool: [],
      enemyPicks,
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 10,
      counterRelations: relations
    });
  }

  it("carries champion facts through, with the denominator of the ranked list", () => {
    const result = recommendChampions({
      stats: counterStats,
      playerPool: [],
      enemyPicks: [],
      bannedChampionIds: ["zed"],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 10,
      counterRelations: relations
    });
    const ahri = result.find((entry) => entry.championId === "ahri");

    expect(ahri?.rank).toBe(1);
    expect(ahri?.games).toBe(200000);
    // The ban removes zed from the candidates but not from the ranked list, so
    // the denominator stays 3. Using the candidate count here would let `rank`
    // exceed it once bans and enemy picks pile up.
    expect(ahri?.totalRanked).toBe(3);
  });

  it("marks the counter factor unavailable when there are no enemy picks", () => {
    const [top] = run([]);
    const counter = top.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.available).toBe(false);
  });

  it("marks the counter factor unavailable when no relation is known", () => {
    const result = run(["orianna"]);
    const ahri = result.find((entry) => entry.championId === "ahri");
    const counter = ahri?.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.available).toBe(false);
  });

  it("ranks a champion that counters the enemy above one the enemy counters", () => {
    const result = run(["zed"]);
    const orianna = result.findIndex((entry) => entry.championId === "orianna");
    const ahri = result.findIndex((entry) => entry.championId === "ahri");

    // orianna counters zed (counter 85); zed counters ahri (counter 15). Ahri
    // has the better meta rank, so this asserts the matchup can overturn a
    // one-rank meta deficit: orianna 74.05 against ahri 63.15.
    expect(orianna).toBeLessThan(ahri);
  });

  it("gives the countering champion a counter score above neutral", () => {
    const result = run(["zed"]);
    const orianna = result.find((entry) => entry.championId === "orianna");

    expect(orianna?.counterScore).toBeGreaterThan(50);
  });

  it("names the countered champion in the factor detail, not its id", () => {
    const result = run(["zed"]);
    const orianna = result.find((entry) => entry.championId === "orianna");
    const counter = orianna?.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.detail).toBe("Prend l'avantage sur Zed.");
  });

  it("warns when no counter relation covers the enemy picks", () => {
    const result = run(["orianna"]);
    const ahri = result.find((entry) => entry.championId === "ahri");

    expect(ahri?.explanation.warnings).toContain(
      "No counter relation is known for the current enemy picks."
    );
  });

  // The seeded data has no mutual pair inside a single role, but three exist
  // across roles (kennen/sylas, chogath/masteryi, teemo/zac). A relation from
  // another role must never influence a mid recommendation.
  it("ignores relations belonging to another role", () => {
    const result = recommendChampions({
      stats: counterStats,
      playerPool: [],
      enemyPicks: ["zed"],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 10,
      counterRelations: [{ championId: "zed", counteredByChampionId: "orianna", role: "top" }]
    });
    const orianna = result.find((entry) => entry.championId === "orianna");
    const counter = orianna?.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.available).toBe(false);
    expect(orianna?.counterScore).toBe(50);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npm test -- src/lib/recommendation/engine.test.ts`
Expected: FAIL — `counterRelations` is not a known property, and `available` is missing on factors.

- [ ] **Step 5: Update the engine**

In `src/lib/recommendation/engine.ts`:

Replace the `Matchup` import with `CounterRelation`, and delete the local `counterScore` and `hasCompleteMatchupData` functions. Add at the top:

```ts
import { scoreCounter } from "./counter";
```

Replace the body of `recommendChampions` down to the `.map(...)` with:

```ts
export function recommendChampions(input: RecommendInput): Recommendation[] {
  const banned = new Set(input.bannedChampionIds);
  const picked = new Set(input.alreadyPickedChampionIds);
  const relations = input.counterRelations ?? [];
  const hasEnemy = input.enemyPicks.length > 0;
  const hasPool = input.playerPool.some((entry) => (entry.games ?? 0) >= MIN_GAMES_FOR_POOL);
  const weights = computeWeights(input.priority, hasEnemy, hasPool);

  const candidates = input.stats.filter(
    (champion) => !banned.has(champion.championId) && !picked.has(champion.championId)
  );

  const names = new Map(input.stats.map((champion) => [champion.championId, champion.name]));

  // Bucket once rather than re-filtering the whole relation list per candidate.
  // Every candidate shares a role in practice, so the filter inside the loop
  // read as though role varied when it does not.
  const relationsByRole = new Map<string, CounterRelation[]>();
  for (const relation of relations) {
    const bucket = relationsByRole.get(relation.role);
    if (bucket) bucket.push(relation);
    else relationsByRole.set(relation.role, [relation]);
  }

  const recommendations = candidates
    .map((champion) => {
      const meta = metaScore(champion, input.stats.length);
      const player = playerScore(champion.championId, input.playerPool);
      const counter = scoreCounter(
        champion.championId,
        input.enemyPicks,
        relationsByRole.get(champion.role) ?? []
      );
      const total = meta * weights.meta + player * weights.player + counter.score * weights.counter;
      const warnings: string[] = [];

      if (hasEnemy && !counter.available) {
        warnings.push("No counter relation is known for the current enemy picks.");
      }

      return {
        championId: champion.championId,
        championName: champion.name,
        championImageUrl: champion.imageUrl,
        totalScore: round(total),
        metaScore: round(meta),
        playerScore: round(player),
        counterScore: round(counter.score),
        rank: champion.rank,
        winRate: champion.winRate,
        pickRate: champion.pickRate,
        banRate: champion.banRate,
        games: champion.games,
        totalRanked: input.stats.length,
        explanation: {
          summary: buildSummary(meta, player, counter.score, hasEnemy),
          factors: [
            {
              key: "meta" as const,
              label: "Force dans le patch",
              score: round(meta),
              weight: round(weights.meta * 100),
              detail: `Rang #${champion.rank} sur ${input.stats.length} en ${champion.role}.`,
              available: true
            },
            {
              key: "player" as const,
              label: "Votre pool",
              score: round(player),
              weight: round(weights.player * 100),
              detail:
                player > 5
                  ? "Ce champion fait partie de vos habitudes."
                  : "Ce champion n'est pas établi dans votre pool.",
              available: hasPool
            },
            {
              key: "counter" as const,
              label: "Matchup",
              score: round(counter.score),
              weight: round(weights.counter * 100),
              detail: counter.available
                ? counterDetail(counter, names)
                : "Aucun counter connu pour les picks adverses actuels.",
              available: counter.available
            }
          ],
          warnings,
          alternatives: []
        }
      };
    })
```

Add this helper above `recommendChampions`:

```ts
// Champion display names, not ids: this string is rendered verbatim in the
// dossier, and `beats`/`losesTo` never reach `Recommendation`, so the surface
// layer has no way to recover a name we drop here.
function counterDetail(counter: CounterVerdict, names: Map<string, string>): string {
  const label = (championId: string) => names.get(championId) ?? championId;
  const parts: string[] = [];
  if (counter.beats.length > 0) parts.push(`Prend l'avantage sur ${counter.beats.map(label).join(", ")}.`);
  if (counter.losesTo.length > 0) parts.push(`En difficulté contre ${counter.losesTo.map(label).join(", ")}.`);
  return parts.join(" ");
}
```

Import `CounterVerdict` alongside the other types.

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/lib/recommendation/engine.test.ts`
Expected: PASS, including the 8 new tests. If anything still mentions `matchups`, Step 2 was skipped.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: exactly one error, `src/lib/data/normalize.ts:29` (`games` missing from `ChampionStats`). That line is Task 5 Step 3's work and closing it here would pre-empt that task's red step, so leave it. Any *other* error is yours and must be fixed now.

- [ ] **Step 8: Commit**

```bash
git add src/lib/recommendation/
git commit -m "feat: rank recommendations using counter relations"
```

---

## Task 5: Wire the relations through the API

**Files:**
- Modify: `src/lib/data/normalize.ts`
- Modify: `src/lib/data/normalize.test.ts`
- Modify: `src/app/api/recommend/route.ts`

- [ ] **Step 1: Write the failing normalizer test**

Append to `src/lib/data/normalize.test.ts`:

```ts
import { mapCounterRelationRows } from "./normalize";

describe("mapCounterRelationRows", () => {
  it("maps rows and preserves the countered-by direction", () => {
    const result = mapCounterRelationRows([
      { champion_id: "zed", countered_by_champion_id: "galio", role: "mid" }
    ]);

    expect(result).toEqual([{ championId: "zed", counteredByChampionId: "galio", role: "mid" }]);
  });
});
```

The existing `"joins champion rows and stats rows into engine input"` test asserts with an exact `toEqual`, so it breaks the moment the mapper emits a new field. Add `games: 1000` to its input row **and** `games: 1000` to its expected object. Then add:

```ts
it("carries the sample size through", () => {
  const [first] = mapStatsRowsToChampionStats([
    {
      champion_id: "ahri",
      role: "mid",
      win_rate: 52,
      pick_rate: 12,
      ban_rate: 4,
      games: 714379,
      champions: { id: "ahri", name: "Ahri", image_url: null }
    }
  ]);

  expect(first.games).toBe(714379);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/lib/data/normalize.test.ts`
Expected: FAIL — `mapCounterRelationRows` is not exported, and `games` is not on `StatsRow`.

- [ ] **Step 3: Update the normalizer**

In `src/lib/data/normalize.ts`, add `games: number | null;` to the `StatsRow` type, add `games: row.games` to the object returned by `mapStatsRowsToChampionStats`, and append:

```ts
type CounterRelationRow = {
  champion_id: string;
  countered_by_champion_id: string;
  role: string;
};

export function mapCounterRelationRows(rows: CounterRelationRow[]): CounterRelation[] {
  return rows.map((row) => ({
    championId: row.champion_id,
    counteredByChampionId: row.countered_by_champion_id,
    role: row.role
  }));
}
```

Import `CounterRelation` from `@/lib/recommendation/types`.

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/lib/data/normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Declare the table in the generated Database type**

The Supabase client is typed (`createServerClient<Database>` in `src/lib/supabase/server.ts`), so `.from("counter_relations")` will not compile until the table exists in `src/lib/supabase/types.ts`. `champion_stats` there already carries `games`, so nothing else in that file needs touching. Add, beside the other tables:

```ts
      counter_relations: TableDefinition<
        {
          id: string;
          champion_id: string;
          countered_by_champion_id: string;
          role: string;
          source: string;
          fetched_at: string;
        },
        {
          champion_id: string;
          countered_by_champion_id: string;
          role: string;
          source: string;
          id?: string;
          fetched_at?: string;
        },
        Partial<{
          id: string;
          champion_id: string;
          countered_by_champion_id: string;
          role: string;
          source: string;
          fetched_at: string;
        }>
      >;
```

- [ ] **Step 6: Query the relations in the route**

In `src/app/api/recommend/route.ts`, add `games` to the stats select:

```ts
    .select("champion_id, role, win_rate, pick_rate, ban_rate, games, champions(id, name, image_url)")
```

After the pool query, add:

```ts
  const { data: relationRows } = await supabase
    .from("counter_relations")
    .select("champion_id, countered_by_champion_id, role")
    .eq("role", parsed.data.role);
```

Import `mapCounterRelationRows` and pass the result into `recommendChampions`:

```ts
    counterRelations: mapCounterRelationRows((relationRows ?? []) as unknown as CounterRelationRowType[]),
```

where `CounterRelationRowType` is declared beside the existing row aliases:

```ts
type CounterRelationRowType = Parameters<typeof mapCounterRelationRows>[0][number];
```

- [ ] **Step 7: Type-check and run the suite**

Run: `npx tsc --noEmit`
Expected: **clean, no output.** Task 4 left exactly one error, `src/lib/data/normalize.ts:29`, and Step 3 closes it. Earlier drafts of this plan predicted errors in `src/components/coach/*` and `src/app/page.tsx`; that prediction was wrong — every change to `Recommendation` and `RecommendationFactor` is additive and those files only read the shape. Any error at all here is a real problem to fix.

Run: `npm test`
Expected: PASS, every file, `coach-workspace.test.tsx` included.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/ src/lib/supabase/types.ts src/app/api/recommend/route.ts
git commit -m "feat: pass counter relations and sample sizes through the API"
```

---

## Task 6: Design tokens

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;

  --paper: #f7f4ef;
  --surface: #ffffff;
  --surface-sunk: #f2efe9;
  --ink: #14171a;
  --ink-muted: #5e574c;
  --ink-faint: #8a8378;
  --rule: #e0dbd2;
  --rule-soft: #efece6;
  --accent: #0f766e;
  --accent-wash: #f2faf8;
}

body {
  min-height: 100vh;
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body, system-ui, sans-serif);
}

button,
input,
select {
  font: inherit;
}
```

- [ ] **Step 2: Replace the `colors` block in `tailwind.config.ts`**

```ts
      colors: {
        paper: "var(--paper)",
        surface: "var(--surface)",
        "surface-sunk": "var(--surface-sunk)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "ink-faint": "var(--ink-faint)",
        rule: "var(--rule)",
        "rule-soft": "var(--rule-soft)",
        accent: "var(--accent)",
        "accent-wash": "var(--accent-wash)"
      }
```

- [ ] **Step 3: Verify Tailwind actually emits the new utilities**

`npx tsc --noEmit` says nothing about CSS, so it cannot verify this step. Compile the stylesheet against a scratch file that uses the new classes and confirm the custom properties reach the output:

```bash
mkdir -p .scratch
printf '<div class="bg-paper text-ink-muted border-rule bg-accent-wash text-accent"></div>' > .scratch/tokens-probe.html
npx tailwindcss -i src/app/globals.css -o .scratch/tokens-probe.css --content .scratch/tokens-probe.html 2>&1 | tail -3
grep -c "var(--paper)\|var(--ink-muted)\|var(--rule)\|var(--accent-wash)\|var(--accent)" .scratch/tokens-probe.css
```

Expected: the grep prints **5**. If it prints fewer, a token name in `tailwind.config.ts` does not match the custom property in `globals.css`.

Then remove the scratch directory: `rm -rf .scratch`. Do not commit it.

**Known and accepted:** `src/components/coach/champion-picker.tsx` and `recommendation-card.tsx` use the old palette (`bg-panel`, `border-line`, `text-teal`, `bg-danger`). Removing those colours leaves them referencing utilities Tailwind no longer generates, so that screen renders unstyled from here until Task 9 deletes both files. Tailwind drops unknown classes silently and no test asserts styling, so nothing will fail — this is a deliberate transient state, not a regression to investigate.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "refactor: define design tokens once as CSS variables"
```

---

## Task 7: Presentational UI primitives

**Files:**
- Create: `src/components/ui/champion-avatar.tsx`, `src/components/ui/chip.tsx`, `src/components/ui/score.tsx`
- Create: `src/components/ui/champion-avatar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/champion-avatar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChampionAvatar } from "./champion-avatar";

describe("ChampionAvatar", () => {
  it("renders the portrait when an image is supplied", () => {
    render(<ChampionAvatar name="Ahri" imageUrl="https://example.test/ahri.png" />);

    expect(screen.getByAltText("Portrait de Ahri")).toBeInTheDocument();
  });

  it("falls back to initials when the image fails", () => {
    render(<ChampionAvatar name="Ahri" imageUrl="https://example.test/broken.png" />);

    fireEvent.error(screen.getByAltText("Portrait de Ahri"));

    expect(screen.getByText("Ah")).toBeInTheDocument();
  });

  it("renders initials when no image is supplied", () => {
    render(<ChampionAvatar name="Kai'Sa" />);

    expect(screen.getByText("Ka")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/components/ui/champion-avatar.test.tsx`
Expected: FAIL — cannot resolve `./champion-avatar`.

- [ ] **Step 3: Implement the three primitives**

`src/components/ui/champion-avatar.tsx`:

```tsx
"use client";

import { useState } from "react";

export function ChampionAvatar({
  name,
  imageUrl,
  size = 38
}: {
  name: string;
  imageUrl?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!imageUrl || failed) {
    return (
      <span
        style={style}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-surface-sunk text-xs font-semibold text-ink-faint"
      >
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`Portrait de ${name}`}
      style={style}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-lg object-cover"
    />
  );
}
```

`src/components/ui/chip.tsx`:

```tsx
import { ChampionAvatar } from "./champion-avatar";

export function Chip({
  name,
  imageUrl,
  onRemove
}: {
  name: string;
  imageUrl?: string;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-rule bg-surface py-1 pl-1 pr-3 text-sm font-semibold">
      <ChampionAvatar name={name} imageUrl={imageUrl} size={22} />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Retirer ${name}`}
          className="text-ink-faint hover:text-ink"
        >
          ×
        </button>
      )}
    </span>
  );
}
```

`src/components/ui/score.tsx`:

```tsx
export function Score({ value }: { value: number }) {
  return (
    <span className="text-right">
      <b className="block text-3xl font-extrabold leading-none tracking-tight text-accent">
        {Math.round(value)}
      </b>
      <span className="text-[10px] font-semibold text-ink-faint">/ 100</span>
    </span>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/components/ui/champion-avatar.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add presentational UI primitives"
```

---

## Task 8: The dossier

**Files:**
- Create: `src/components/draft/factor-bars.tsx`, `src/components/draft/verdict.tsx`, `src/components/draft/alternatives.tsx`
- Create: `src/components/draft/verdict.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/draft/verdict.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Verdict } from "./verdict";
import type { Recommendation } from "@/lib/recommendation/types";

function build(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    championId: "galio",
    championName: "Galio",
    championImageUrl: undefined,
    totalScore: 88,
    metaScore: 72,
    playerScore: 84,
    counterScore: 91,
    rank: 7,
    winRate: 51.3,
    pickRate: 4.1,
    banRate: 2.8,
    games: 204556,
    totalRanked: 64,
    explanation: {
      summary: "Recommandé pour son matchup.",
      factors: [
        { key: "meta", label: "Force dans le patch", score: 72, weight: 36, detail: "Rang #7 sur 64 en mid.", available: true },
        { key: "player", label: "Votre pool", score: 84, weight: 24, detail: "Dans vos habitudes.", available: true },
        { key: "counter", label: "Matchup", score: 91, weight: 40, detail: "Prend l'avantage sur zed.", available: true }
      ],
      warnings: [],
      alternatives: []
    },
    ...overrides
  };
}

describe("Verdict", () => {
  it("shows the champion, the score and the sample size", () => {
    render(<Verdict recommendation={build()} />);

    expect(screen.getByText("Galio")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("204 556")).toBeInTheDocument();
  });

  it("omits a fact rather than rendering it as zero when it is null", () => {
    render(<Verdict recommendation={build({ games: null })} />);

    expect(screen.queryByText("Parties analysées")).not.toBeInTheDocument();
  });

  it("renders only the available factors", () => {
    const recommendation = build();
    recommendation.explanation.factors[2].available = false;

    render(<Verdict recommendation={recommendation} />);

    expect(screen.getByText("Force dans le patch")).toBeInTheDocument();
    expect(screen.queryByText("Matchup")).not.toBeInTheDocument();
  });

  it("says plainly when the matchup could not be assessed", () => {
    const recommendation = build();
    recommendation.explanation.factors[2].available = false;

    render(<Verdict recommendation={recommendation} />);

    expect(screen.getByText(/matchup n'a pas pu être évalué/i)).toBeInTheDocument();
  });

  it("shows weights that sum to 100", () => {
    render(<Verdict recommendation={build()} />);

    const weights = screen.getAllByTestId("factor-weight").map((node) => Number(node.textContent?.replace(/\D/g, "")));

    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/components/draft/verdict.test.tsx`
Expected: FAIL — cannot resolve `./verdict`.

- [ ] **Step 3: Implement the three components**

`src/components/draft/factor-bars.tsx`:

```tsx
import type { RecommendationFactor } from "@/lib/recommendation/types";

export function FactorBars({ factors }: { factors: RecommendationFactor[] }) {
  const available = factors.filter((factor) => factor.available);

  return (
    <div>
      {available.map((factor) => (
        <div key={factor.key} className="mb-2 flex items-center gap-2 text-[11px] text-ink-muted">
          <em className="w-24 not-italic font-semibold">{factor.label}</em>
          <span className="relative h-[5px] flex-1 rounded-full bg-rule">
            <i
              className="absolute inset-y-0 left-0 block rounded-full bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, factor.score))}%` }}
            />
          </span>
          <u className="w-6 text-right font-bold not-underline text-ink tabular-nums">
            {Math.round(factor.score)}
          </u>
          <s data-testid="factor-weight" className="w-12 text-right text-[10px] no-underline text-ink-faint">
            ×{Math.round(factor.weight)} %
          </s>
        </div>
      ))}
    </div>
  );
}
```

`src/components/draft/verdict.tsx`:

```tsx
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { Score } from "@/components/ui/score";
import { FactorBars } from "./factor-bars";
import type { Recommendation } from "@/lib/recommendation/types";

function Fact({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null;

  return (
    <div className="flex justify-between border-t border-rule-soft py-1 first:border-0">
      <span className="text-ink-faint">{label}</span>
      <b className="tabular-nums">{value}</b>
    </div>
  );
}

const number = new Intl.NumberFormat("fr-FR");

export function Verdict({ recommendation }: { recommendation: Recommendation }) {
  const counter = recommendation.explanation.factors.find((factor) => factor.key === "counter");

  return (
    <div className="overflow-hidden rounded-xl border border-accent">
      <div className="flex items-center gap-3 bg-accent-wash p-3.5">
        <ChampionAvatar name={recommendation.championName} imageUrl={recommendation.championImageUrl} />
        <span>
          <span className="block text-lg font-bold tracking-tight">{recommendation.championName}</span>
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-accent">Votre pick</span>
        </span>
        <span className="ml-auto">
          <Score value={recommendation.totalScore} />
        </span>
      </div>

      <div className="grid gap-4 border-t border-rule-soft p-3.5 sm:grid-cols-2">
        <FactorBars factors={recommendation.explanation.factors} />

        <div className="text-[11.5px]">
          <Fact
            label="Winrate"
            value={recommendation.winRate === null ? null : `${recommendation.winRate.toFixed(1)} %`}
          />
          <Fact
            label="Parties analysées"
            value={recommendation.games === null ? null : number.format(recommendation.games)}
          />
          <Fact label="Rang méta" value={`#${recommendation.rank} / ${recommendation.totalRanked}`} />
          <Fact
            label="Pick / ban"
            value={
              recommendation.pickRate === null || recommendation.banRate === null
                ? null
                : `${recommendation.pickRate.toFixed(1)} % · ${recommendation.banRate.toFixed(1)} %`
            }
          />
        </div>

        <p className="col-span-full border-t border-rule-soft pt-2.5 text-xs leading-relaxed text-ink-muted">
          {counter?.available
            ? counter.detail
            : "Le matchup n'a pas pu être évalué : aucun counter connu pour les picks adverses actuels."}
        </p>
      </div>
    </div>
  );
}
```

`src/components/draft/alternatives.tsx`:

```tsx
import type { Recommendation } from "@/lib/recommendation/types";

const number = new Intl.NumberFormat("fr-FR");

export function Alternatives({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="mt-2 flex gap-2">
      {recommendations.map((recommendation) => (
        <div key={recommendation.championId} className="flex-1 rounded-lg border border-rule bg-surface px-3 py-2.5">
          <b className="block text-sm font-bold tracking-tight">
            {recommendation.championName}{" "}
            <em className="not-italic font-extrabold text-accent">{Math.round(recommendation.totalScore)}</em>
          </b>
          <span className="text-[10.5px] text-ink-faint">
            {recommendation.winRate === null ? "—" : `${recommendation.winRate.toFixed(1)} %`}
            {recommendation.games !== null && ` · ${number.format(recommendation.games)} parties`}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write the alternatives test**

Create `src/components/draft/alternatives.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alternatives } from "./alternatives";
import type { Recommendation } from "@/lib/recommendation/types";

function build(name: string, games: number | null): Recommendation {
  return {
    championId: name.toLowerCase(),
    championName: name,
    championImageUrl: undefined,
    totalScore: 81,
    metaScore: 70,
    playerScore: 50,
    counterScore: 60,
    rank: 12,
    winRate: 51,
    pickRate: 3,
    banRate: 1,
    games,
    totalRanked: 64,
    explanation: { summary: "", factors: [], warnings: [], alternatives: [] }
  };
}

describe("Alternatives", () => {
  it("renders one entry per alternative", () => {
    render(<Alternatives recommendations={[build("Lissandra", 142000), build("Diana", 98000)]} />);

    expect(screen.getByText("Lissandra")).toBeInTheDocument();
    expect(screen.getByText("Diana")).toBeInTheDocument();
  });

  it("renders nothing when there are no alternatives", () => {
    const { container } = render(<Alternatives recommendations={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("omits the sample size when it is unknown", () => {
    render(<Alternatives recommendations={[build("Lissandra", null)]} />);

    expect(screen.queryByText(/parties/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/components/draft/`
Expected: PASS, 8 tests across `verdict.test.tsx` and `alternatives.test.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/draft/
git commit -m "feat: add the recommendation dossier"
```

---

## Task 9: The draft tool

**Files:**
- Create: `src/lib/draft/default-example.ts`, `src/lib/draft/default-example.test.ts`
- Create: `src/components/draft/role-selector.tsx`, `src/components/draft/enemy-picks.tsx`, `src/components/draft/refine-prompt.tsx`, `src/components/draft/priority-control.tsx`, `src/components/draft/draft-tool.tsx`
- Create: `src/components/draft/draft-tool.test.tsx`
- Delete: `src/components/coach/`

- [ ] **Step 1: Write the default example and its guard**

Create `src/lib/draft/default-example.ts`:

```ts
export const DEFAULT_EXAMPLE = {
  role: "mid",
  region: "euw",
  tier: "emerald_plus",
  enemyPicks: ["zed", "caitlyn"]
} as const;
```

Create `src/lib/draft/default-example.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_EXAMPLE } from "./default-example";

describe("DEFAULT_EXAMPLE", () => {
  it("references champions that exist in the seed, so the example is never empty", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    for (const championId of DEFAULT_EXAMPLE.enemyPicks) {
      expect(seed, `${championId} is missing from the seeded champions`).toContain(
        `insert into public.champions (id, riot_key, slug, name, image_url, tags, ddragon_version) values ('${championId}'`
      );
    }
  });

  it("uses a role the stats are seeded for", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    expect(seed).toContain(`'${DEFAULT_EXAMPLE.role}', '${DEFAULT_EXAMPLE.region}', '${DEFAULT_EXAMPLE.tier}'`);
  });
});
```

Run: `npm test -- src/lib/draft/default-example.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 2: Write the failing tool test**

Create `src/components/draft/draft-tool.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftTool } from "./draft-tool";
import type { Recommendation } from "@/lib/recommendation/types";

function rec(name: string, score: number): Recommendation {
  return {
    championId: name.toLowerCase(),
    championName: name,
    championImageUrl: undefined,
    totalScore: score,
    metaScore: 70,
    playerScore: 50,
    counterScore: 80,
    rank: 3,
    winRate: 51,
    pickRate: 4,
    banRate: 2,
    games: 1000,
    totalRanked: 60,
    explanation: {
      summary: "",
      factors: [
        { key: "meta", label: "Force dans le patch", score: 70, weight: 60, detail: "", available: true },
        { key: "player", label: "Votre pool", score: 50, weight: 0, detail: "", available: false },
        { key: "counter", label: "Matchup", score: 80, weight: 40, detail: "Prend l'avantage.", available: true }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

const champions = [
  { id: "zed", name: "Zed" },
  { id: "caitlyn", name: "Caitlyn" },
  { id: "galio", name: "Galio" }
];

const initial = [rec("Galio", 88), rec("Lissandra", 81), rec("Diana", 74)];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftTool", () => {
  it("renders the pre-solved example on first paint without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    expect(screen.getByText("Galio")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests new recommendations when the role changes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ recommendations: [rec("Darius", 90)] }), { status: 200 })
    );

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Top" }));

    await waitFor(() => expect(screen.getByText("Darius")).toBeInTheDocument());
  });

  it("adjusts the weighting from inside the dossier, not before it", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ recommendations: [rec("Orianna", 85)] }), { status: 200 }));

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.change(screen.getByLabelText(/priorité/i), { target: { value: "90" } });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.priority).toBe(90);
  });

  it("keeps the previous result on screen when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Top" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Galio")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- src/components/draft/draft-tool.test.tsx`
Expected: FAIL — cannot resolve `./draft-tool`.

- [ ] **Step 4: Implement the remaining components**

`src/components/draft/role-selector.tsx`:

```tsx
export const ROLES = [
  { id: "top", label: "Top" },
  { id: "jungle", label: "Jungle" },
  { id: "mid", label: "Mid" },
  { id: "adc", label: "ADC" },
  { id: "support", label: "Support" }
] as const;

export function RoleSelector({ role, onChange }: { role: string; onChange: (role: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {ROLES.map((entry) => (
        <button
          key={entry.id}
          type="button"
          aria-pressed={entry.id === role}
          onClick={() => onChange(entry.id)}
          className={
            entry.id === role
              ? "flex-1 rounded-lg border border-accent bg-accent py-2 text-xs font-semibold text-white"
              : "flex-1 rounded-lg border border-rule py-2 text-xs font-semibold text-ink-muted hover:border-ink-faint"
          }
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}
```

`src/components/draft/enemy-picks.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";

export type Champion = { id: string; name: string; imageUrl?: string };

export function EnemyPicks({
  champions,
  selectedIds,
  onAdd,
  onRemove
}: {
  champions: Champion[];
  selectedIds: string[];
  onAdd: (championId: string) => void;
  onRemove: (championId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const selected = selectedIds
    .map((id) => champions.find((champion) => champion.id === id))
    .filter((champion): champion is Champion => champion !== undefined);

  const matches =
    query.trim() === ""
      ? []
      : champions
          .filter(
            (champion) =>
              !selectedIds.includes(champion.id) &&
              champion.name.toLowerCase().includes(query.trim().toLowerCase())
          )
          .slice(0, 6);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {selected.map((champion) => (
          <Chip
            key={champion.id}
            name={champion.name}
            imageUrl={champion.imageUrl}
            onRemove={() => onRemove(champion.id)}
          />
        ))}
      </div>

      <label htmlFor="enemy-search" className="sr-only">
        Rechercher un pick ennemi
      </label>
      <input
        id="enemy-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ajouter un champion adverse"
        className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm"
      />

      {matches.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {matches.map((champion) => (
            <li key={champion.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(champion.id);
                  setQuery("");
                }}
                className="rounded-full border border-dashed border-rule px-3 py-1 text-sm text-ink-muted hover:border-accent hover:text-accent"
              >
                {champion.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`src/components/draft/refine-prompt.tsx`:

```tsx
"use client";

import { useState } from "react";

export function RefinePrompt() {
  const [riotId, setRiotId] = useState("");

  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-rule bg-surface-sunk px-3.5 py-2.5 text-xs text-ink-muted">
      <label htmlFor="riot-id">
        Affinez avec <b className="text-ink">votre</b> pool : on pondère selon les champions que vous jouez vraiment.
      </label>
      <input
        id="riot-id"
        type="text"
        value={riotId}
        onChange={(event) => setRiotId(event.target.value)}
        placeholder="Nom#TAG"
        autoComplete="username"
        className="ml-auto w-36 rounded-md border border-rule bg-surface px-2.5 py-1.5"
      />
    </div>
  );
}
```

`src/components/draft/priority-control.tsx`:

```tsx
"use client";

/**
 * Sets the same `priority` the API already accepts. It lives next to the factor
 * bars rather than above the tool: asking someone to weight meta against their
 * own pool before they have seen either score is a question they cannot answer.
 */
export function PriorityControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-muted">
      <label htmlFor="priority" className="font-semibold">
        Priorité : votre pool ↔ la méta
      </label>
      <input
        id="priority"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="w-8 text-right tabular-nums font-bold text-ink">{value}</span>
    </div>
  );
}
```

`src/components/draft/draft-tool.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import type { Recommendation } from "@/lib/recommendation/types";
import { Alternatives } from "./alternatives";
import { EnemyPicks, type Champion } from "./enemy-picks";
import { PriorityControl } from "./priority-control";
import { RefinePrompt } from "./refine-prompt";
import { RoleSelector } from "./role-selector";
import { Verdict } from "./verdict";

export function DraftTool({
  champions,
  initialRole,
  initialEnemyPicks,
  initialRecommendations
}: {
  champions: Champion[];
  initialRole: string;
  initialEnemyPicks: string[];
  initialRecommendations: Recommendation[];
}) {
  const [role, setRole] = useState(initialRole);
  const [enemyPicks, setEnemyPicks] = useState<string[]>(initialEnemyPicks);
  const [priority, setPriority] = useState(50);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The previous result deliberately stays on screen while a request is in
  // flight and after a failure: emptying it would punish the user for a
  // transient error and undo the "already solved" premise of the page.
  async function refresh(nextRole: string, nextEnemyPicks: string[], nextPriority: number) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: nextRole,
          region: DEFAULT_EXAMPLE.region,
          tier: DEFAULT_EXAMPLE.tier,
          enemyPicks: nextEnemyPicks,
          bans: [],
          priority: nextPriority,
          topN: 3
        })
      });

      if (!response.ok) {
        setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
        return;
      }

      const payload = (await response.json()) as { recommendations: Recommendation[] };
      setRecommendations(payload.recommendations);
    } catch {
      setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
    } finally {
      setIsLoading(false);
    }
  }

  function changeRole(nextRole: string) {
    setRole(nextRole);
    void refresh(nextRole, enemyPicks, priority);
  }

  function addEnemy(championId: string) {
    const next = [...enemyPicks, championId];
    setEnemyPicks(next);
    void refresh(role, next, priority);
  }

  function removeEnemy(championId: string) {
    const next = enemyPicks.filter((id) => id !== championId);
    setEnemyPicks(next);
    void refresh(role, next, priority);
  }

  function changePriority(nextPriority: number) {
    setPriority(nextPriority);
    void refresh(role, enemyPicks, nextPriority);
  }

  const [top, ...rest] = recommendations;

  return (
    <div className="rounded-xl border border-rule bg-surface p-4 shadow-sm">
      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-faint">
            1 · Votre rôle
          </span>
          <RoleSelector role={role} onChange={changeRole} />
        </div>
        <div>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-faint">
            2 · Déjà pické en face
          </span>
          <EnemyPicks champions={champions} selectedIds={enemyPicks} onAdd={addEnemy} onRemove={removeEnemy} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-2.5 rounded-lg border border-rule bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
          {error}
        </p>
      )}

      <div aria-busy={isLoading} className="border-t border-rule-soft pt-3.5">
        {top ? (
          <>
            <Verdict recommendation={top} />
            <PriorityControl value={priority} onChange={changePriority} />
            <Alternatives recommendations={rest} />
            <RefinePrompt />
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">
            Aucune recommandation disponible pour ce rôle.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- src/components/draft/draft-tool.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Delete the superseded components**

```bash
git rm -r src/components/coach
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/draft/ src/components/draft/
git commit -m "feat: add the draft tool and retire the coach workspace"
```

---

## Task 10: The single page

**Files:**
- Create: `src/components/marketing/site-header.tsx`, `site-footer.tsx`, `hero.tsx`, `explainer.tsx`, `trust-bar.tsx`
- Modify: `src/app/page.tsx`, `src/app/draft/page.tsx`
- Create: `src/app/draft/page.test.ts`

- [ ] **Step 1: Write the failing redirect test**

Create `src/app/draft/page.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

describe("/draft", () => {
  it("redirects to the single page", async () => {
    const { default: DraftPage } = await import("./page");

    DraftPage();

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/app/draft/page.test.ts`
Expected: FAIL — the current page is an async Supabase component, not a redirect.

- [ ] **Step 3: Replace `src/app/draft/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function DraftPage() {
  redirect("/");
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/app/draft/page.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the marketing components**

`src/components/marketing/site-header.tsx`:

```tsx
export function SiteHeader({ context }: { context: string }) {
  return (
    <header className="flex items-center justify-between border-b border-rule px-6 py-3.5 text-sm text-ink-muted">
      <span className="text-base font-bold tracking-tight text-ink">DraftForMe</span>
      <span className="flex items-center gap-4">
        <a href="#comment-ca-marche" className="hover:text-ink">
          Comment ça marche
        </a>
        <span className="text-[11.5px] text-ink-faint">{context}</span>
      </span>
    </header>
  );
}
```

`src/components/marketing/hero.tsx`:

```tsx
export function Hero() {
  return (
    <div className="mb-5">
      <h1 className="mb-2 max-w-[13ch] text-4xl font-extrabold leading-none tracking-tighter">
        Sachez quoi <em className="not-italic text-accent">pick</em>.
      </h1>
      <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
        Votre rôle, qui est déjà pické en face. On vous rend trois champions tenables — et on vous
        montre exactement pourquoi.
      </p>
    </div>
  );
}
```

`src/components/marketing/explainer.tsx`:

```tsx
const COLUMNS = [
  {
    title: "Ce qu'on regarde",
    body: "Trois signaux : la force du champion dans le patch, sa lecture du matchup, et votre aisance dessus. Le poids de chacun est affiché."
  },
  {
    title: "Trois options, pas une",
    body: "Le pick principal, puis deux alternatives. À vous de choisir votre niveau de risque."
  },
  {
    title: "Pour qui",
    body: "Si vous jouez quelques games par semaine et que la draft vous perd, c'est fait pour vous."
  }
];

export function Explainer() {
  return (
    <section id="comment-ca-marche" className="mt-7 border-t border-rule pt-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h4 className="mb-1.5 text-sm font-bold tracking-tight">{column.title}</h4>
            <p className="text-xs leading-relaxed text-ink-muted">{column.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

`src/components/marketing/trust-bar.tsx`:

```tsx
const number = new Intl.NumberFormat("fr-FR");

export function TrustBar({
  indexedGames,
  patch,
  context
}: {
  indexedGames: number | null;
  patch: string;
  context: string;
}) {
  return (
    <div className="mt-5 flex gap-7 rounded-xl bg-ink px-4 py-3.5 text-[#cdd6d3]">
      {indexedGames !== null && (
        <div>
          <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Parties indexées</span>
          <b className="text-base font-bold tracking-tight text-white">{number.format(indexedGames)}</b>
        </div>
      )}
      <div>
        <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Patch</span>
        <b className="text-base font-bold tracking-tight text-white">{patch}</b>
      </div>
      <div>
        <span className="block text-[9.5px] uppercase tracking-widest text-[#7d8a86]">Région / élo</span>
        <b className="text-base font-bold tracking-tight text-white">{context}</b>
      </div>
    </div>
  );
}
```

`src/components/marketing/site-footer.tsx`:

```tsx
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-rule px-6 py-6 text-xs text-ink-faint">
      DraftForMe · Projet non affilié à Riot Games
    </footer>
  );
}
```

- [ ] **Step 6: Replace `src/app/page.tsx`**

```tsx
import { Explainer } from "@/components/marketing/explainer";
import { Hero } from "@/components/marketing/hero";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { TrustBar } from "@/components/marketing/trust-bar";
import { DraftTool } from "@/components/draft/draft-tool";
import { mapCounterRelationRows, mapStatsRowsToChampionStats } from "@/lib/data/normalize";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import { recommendChampions } from "@/lib/recommendation/engine";
import type { Recommendation } from "@/lib/recommendation/types";
import { createClient } from "@/lib/supabase/server";

type StatsRow = Parameters<typeof mapStatsRowsToChampionStats>[0][number];
type RelationRow = Parameters<typeof mapCounterRelationRows>[0][number];

const PATCH = "16.10";
const CONTEXT = "EUW · Emerald+";

// Resolved on the server so the page arrives already populated: no empty flash,
// and the example is indexable. Calls the engine directly rather than fetching
// this app's own API route over HTTP.
async function loadExample() {
  const supabase = await createClient();

  const [{ data: statsRows }, { data: relationRows }, { data: championRows }] = await Promise.all([
    supabase
      .from("champion_stats")
      .select("champion_id, role, win_rate, pick_rate, ban_rate, games, champions(id, name, image_url)")
      .eq("role", DEFAULT_EXAMPLE.role)
      .eq("region", DEFAULT_EXAMPLE.region)
      .eq("tier", DEFAULT_EXAMPLE.tier)
      .order("win_rate", { ascending: false }),
    supabase
      .from("counter_relations")
      .select("champion_id, countered_by_champion_id, role")
      .eq("role", DEFAULT_EXAMPLE.role),
    supabase.from("champions").select("id, name, image_url").order("name")
  ]);

  const stats = mapStatsRowsToChampionStats((statsRows ?? []) as unknown as StatsRow[]);

  const recommendations = recommendChampions({
    stats,
    playerPool: [],
    enemyPicks: [...DEFAULT_EXAMPLE.enemyPicks],
    bannedChampionIds: [],
    alreadyPickedChampionIds: [...DEFAULT_EXAMPLE.enemyPicks],
    priority: 50,
    topN: 3,
    counterRelations: mapCounterRelationRows((relationRows ?? []) as unknown as RelationRow[])
  });

  const champions = ((championRows ?? []) as { id: string; name: string; image_url: string | null }[]).map(
    (row) => ({ id: row.id, name: row.name, imageUrl: row.image_url ?? undefined })
  );

  const indexedGames = stats.reduce<number | null>(
    (sum, champion) => (champion.games === null ? sum : (sum ?? 0) + champion.games),
    null
  );

  return { recommendations, champions, indexedGames };
}

export default async function HomePage() {
  let example: { recommendations: Recommendation[]; champions: { id: string; name: string; imageUrl?: string }[]; indexedGames: number | null };

  try {
    example = await loadExample();
  } catch {
    example = { recommendations: [], champions: [], indexedGames: null };
  }

  return (
    <main>
      <SiteHeader context={`Patch ${PATCH} · ${CONTEXT}`} />

      <div className="mx-auto max-w-5xl px-6 py-7">
        <Hero />

        {example.recommendations.length === 0 ? (
          <p className="rounded-xl border border-rule bg-surface p-6 text-center text-sm text-ink-muted">
            Les données de draft ne sont pas disponibles pour le moment. Réessayez dans un instant.
          </p>
        ) : (
          <DraftTool
            champions={example.champions}
            initialRole={DEFAULT_EXAMPLE.role}
            initialEnemyPicks={[...DEFAULT_EXAMPLE.enemyPicks]}
            initialRecommendations={example.recommendations}
          />
        )}

        <Explainer />
        <TrustBar indexedGames={example.indexedGames} patch={PATCH} context={CONTEXT} />
      </div>

      <SiteFooter />
    </main>
  );
}
```

- [ ] **Step 7: Run the whole suite and type-check**

Run: `npm test`
Expected: PASS, every file.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/ src/components/marketing/
git commit -m "feat: merge the landing and the tool into a single page"
```

---

## Task 11: Final verification

- [ ] **Step 1: Full suite**

Run: `npm test`
Expected: all tests pass. Record the count.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds. `/` builds as a dynamic route (it reads Supabase per request) and `/draft` as a redirect.

- [ ] **Step 4: Confirm the old surface is gone**

Run: `git status --porcelain && ls src/components/coach 2>&1`
Expected: clean tree, and `ls` reports the directory does not exist.

Run: `grep -rn "const C = {" src/ || echo "no duplicated token objects"`
Expected: `no duplicated token objects`.

- [ ] **Step 5: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: complete the site rework" || echo "nothing to commit"
```
