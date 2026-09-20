# DraftForMe Draft Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-shaped draft tool on `/` with a dark champion-select board — teams down the sides, Summoner's Rift in the middle, every pick standing on its lane — and make the enemy on your lane weigh double in the matchup score.

**Architecture:** A pure reducer (`src/lib/draft/draft-state.ts`) owns the draft; one stateful component (`draft-board.tsx`) drives it and the network; three presentational components render the map, the slots and the picker. The engine keeps its three-term blend and gains only a weighted average inside `scoreCounter`. The dark palette is achieved by redeclaring the existing CSS custom properties inside a scoped block, so `Verdict`, `FactorBars` and `Alternatives` invert without edits.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind 3 (tokens as CSS custom properties), Zod, Supabase, Vitest + @testing-library/react in jsdom.

**Spec:** `docs/superpowers/specs/2026-09-20-draftforme-draft-board-design.md`

---

## Conventions this repo already has — follow them

Read this once before Task 1. Deviating from it is the main way these tasks go wrong.

- **Tests import vitest globals explicitly** even though `globals: true`: `import { describe, expect, it, vi } from "vitest";`
- **No shared test fixtures exist.** Every test file defines its own local factory. Duplicate the factory; do not extract one.
- **No `vi.useFakeTimers` anywhere.** The 250 ms debounce is tested with real timers and, where a surviving timer must be ruled out, a real sleep wrapped in `act`.
- **No `@testing-library/user-event`.** Use `fireEvent` only.
- **Fetch is stubbed with `vi.spyOn(globalThis, "fetch")`**, never `vi.stubGlobal`, and every component test file ends its preamble with `afterEach(() => { vi.restoreAllMocks(); });`
- **Imports:** relative for the module under test (`./draft-state`), `@/` alias across directories (`@/lib/recommendation/types`).
- **UI copy is French.** Labels are matched in tests with case-insensitive regex where accents are involved.
- **Comments explain why, not what.** Several existing files carry prose explaining what a naive implementation would get wrong. Match that register.

Commands:

```bash
npm test
```

```bash
npx vitest run src/lib/draft/draft-state.test.ts
```

There is **no typecheck script**, and several breakages in this plan are compile errors rather than test failures. Add this to `package.json` scripts in Task 1 and run it at every verification step:

```bash
npm run typecheck
```

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/lib/draft/roles.ts` | The five role ids, their labels, and a type guard. One definition, replacing the `ROLES` const that dies with `role-selector.tsx`. |
| `src/lib/draft/draft-state.ts` | `DraftState`, its reducer, its selectors. No React, no fetch. |
| `src/lib/draft/draft-state.test.ts` | Reducer invariants and selectors. |
| `src/components/draft/draft-board.tsx` | The only stateful component: reducer + network. |
| `src/components/draft/draft-board.test.tsx` | Behaviour, ported from `draft-tool.test.tsx`. |
| `src/components/draft/draft-board.requests.test.tsx` | The two guards, ported from `draft-tool.requests.test.tsx`. |
| `src/components/draft/rift-map.tsx` | The map image and its ten anchors. Holds the lane coordinate table. |
| `src/components/draft/rift-map.test.tsx` | Ten anchors, accessible names. |
| `src/components/draft/draft-slot.tsx` | One slot row, both sides. |
| `src/components/draft/champion-picker.tsx` | Search + grid over the board. |
| `src/components/draft/champion-picker.test.tsx` | Search by name and id, exclusions, Escape. |
| `public/map/rift.png` | The Data Dragon minimap, vendored. |

**Modified**

| File | Change |
|---|---|
| `src/lib/recommendation/types.ts` | `EnemyPick` type; `RecommendInput.enemyPicks` reshaped; `draftingRole` added. |
| `src/lib/recommendation/counter.ts` | Weighted average; new signature. |
| `src/lib/recommendation/engine.ts` | Pass `draftingRole`; direct opponent named first; weighting disclosed. |
| `src/app/api/recommend/schema.ts` | `enemyPicks` reshaped, `allyPicks` added, `role` becomes an enum. |
| `src/app/api/recommend/route.ts` | Id extraction for the insert; ally∪enemy exclusion union. |
| `src/lib/draft/default-example.ts` | Enemy picks gain lanes; `as const` dropped. |
| `src/app/page.tsx` | Builds the initial draft; wraps the board in the dark band. |
| `src/app/globals.css` | Motion tokens; the `[data-surface="draft"]` block. |
| `tailwind.config.ts` | `team-ally`, `team-enemy`. |
| Six existing test files | Updated for the new shapes. Listed per task. |

**Deleted**

`src/components/draft/draft-tool.tsx`, `draft-tool.test.tsx`, `draft-tool.requests.test.tsx`, `enemy-picks.tsx`, `role-selector.tsx`, `src/components/ui/chip.tsx` (its only consumer was `enemy-picks.tsx`).

---

## Task 1: Roles module and a typecheck script

**Files:**
- Create: `src/lib/draft/roles.ts`
- Create: `src/lib/draft/roles.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

`src/lib/draft/roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRole, ROLE_LABELS, ROLES } from "./roles";

describe("roles", () => {
  it("lists the five roles in draft order", () => {
    expect(ROLES).toEqual(["top", "jungle", "mid", "adc", "support"]);
  });

  it("labels every role", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("rejects a string that is not a role", () => {
    expect(isRole("mid")).toBe(true);
    expect(isRole("botlane")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/draft/roles.test.ts
```

Expected: FAIL, `Failed to resolve import "./roles"`.

- [ ] **Step 3: Write the module**

`src/lib/draft/roles.ts`:

```ts
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
```

- [ ] **Step 4: Add the typecheck script**

In `package.json`, inside `"scripts"`, after `"lint"`:

```json
    "typecheck": "tsc --noEmit",
```

- [ ] **Step 5: Run both**

```bash
npx vitest run src/lib/draft/roles.test.ts && npm run typecheck
```

Expected: 3 passing tests, and `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/draft/roles.ts src/lib/draft/roles.test.ts package.json
git commit -m "feat: add a shared roles module and a typecheck script"
```

---

## Task 2: The draft state reducer

The three invariants below are the reason this file exists separately from React. Each gets a test.

**Files:**
- Create: `src/lib/draft/draft-state.ts`
- Create: `src/lib/draft/draft-state.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/draft/draft-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createDraftState,
  directOpponent,
  draftReducer,
  enemyPicksWithRoles,
  excludedChampionIds
} from "./draft-state";

const base = createDraftState({
  yourRole: "mid",
  enemyPicks: [{ championId: "zed", role: "mid" }]
});

describe("draftReducer", () => {
  it("places a champion on the requested lane", () => {
    const next = draftReducer(base, { type: "place", side: "enemy", role: "top", championId: "darius" });

    expect(next.enemy.top).toBe("darius");
  });

  // Your own lane is where the recommendation is rendered. Accepting a value
  // there would store something no view can ever show.
  it("refuses to fill your own lane", () => {
    const next = draftReducer(base, { type: "place", side: "ally", role: "mid", championId: "ahri" });

    expect(next.ally.mid).toBeNull();
    expect(next).toBe(base);
  });

  // Without this, moving from mid to top leaves the old ally pick stranded on
  // a lane the recommendation now occupies.
  it("empties the incoming lane when your role changes", () => {
    const withTop = draftReducer(base, { type: "place", side: "ally", role: "top", championId: "malphite" });
    const moved = draftReducer(withTop, { type: "setYourRole", role: "top" });

    expect(moved.yourRole).toBe("top");
    expect(moved.ally.top).toBeNull();
  });

  // The picker filters placed champions out, but the reducer is the guard that
  // survives a future caller that forgets to.
  it("refuses a champion already placed anywhere", () => {
    const next = draftReducer(base, { type: "place", side: "ally", role: "top", championId: "zed" });

    expect(next).toBe(base);
  });

  it("clears a lane", () => {
    const next = draftReducer(base, { type: "clear", side: "enemy", role: "mid" });

    expect(next.enemy.mid).toBeNull();
  });

  it("opens and closes the picker without touching the draft", () => {
    const open = draftReducer(base, { type: "openPicker", side: "enemy", role: "adc" });
    expect(open.picker).toEqual({ side: "enemy", role: "adc" });

    const closed = draftReducer(open, { type: "closePicker" });
    expect(closed.picker).toBeNull();
    expect(closed.enemy).toEqual(open.enemy);
  });
});

describe("selectors", () => {
  it("excludes every placed champion, both sides", () => {
    const withAlly = draftReducer(base, { type: "place", side: "ally", role: "top", championId: "malphite" });

    expect(excludedChampionIds(withAlly).sort()).toEqual(["malphite", "zed"]);
  });

  it("reports the enemy picks with their lanes", () => {
    expect(enemyPicksWithRoles(base)).toEqual([{ championId: "zed", role: "mid" }]);
  });

  it("reports the champion on your own lane as the direct opponent", () => {
    expect(directOpponent(base)).toBe("zed");
    expect(directOpponent(draftReducer(base, { type: "clear", side: "enemy", role: "mid" }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/draft/draft-state.test.ts
```

Expected: FAIL, `Failed to resolve import "./draft-state"`.

- [ ] **Step 3: Write the reducer**

`src/lib/draft/draft-state.ts`:

```ts
import type { EnemyPick } from "@/lib/recommendation/types";
import { ROLES, type Role } from "./roles";

export type Side = "ally" | "enemy";

export type DraftState = {
  yourRole: Role;
  ally: Record<Role, string | null>;
  enemy: Record<Role, string | null>;
  priority: number;
  picker: { side: Side; role: Role } | null;
};

export type DraftAction =
  | { type: "place"; side: Side; role: Role; championId: string }
  | { type: "clear"; side: Side; role: Role }
  | { type: "setYourRole"; role: Role }
  | { type: "setPriority"; priority: number }
  | { type: "openPicker"; side: Side; role: Role }
  | { type: "closePicker" };

function emptyLanes(): Record<Role, string | null> {
  return { top: null, jungle: null, mid: null, adc: null, support: null };
}

export function createDraftState({
  yourRole,
  enemyPicks = [],
  priority = 50
}: {
  yourRole: Role;
  enemyPicks?: EnemyPick[];
  priority?: number;
}): DraftState {
  const enemy = emptyLanes();
  for (const pick of enemyPicks) {
    if (isRoleKey(pick.role)) enemy[pick.role] = pick.championId;
  }

  return { yourRole, ally: emptyLanes(), enemy, priority, picker: null };
}

function isRoleKey(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "place": {
      // Your own lane holds the recommendation, not a stored pick.
      if (action.side === "ally" && action.role === state.yourRole) return state;
      if (excludedChampionIds(state).includes(action.championId)) return state;

      return {
        ...state,
        [action.side]: { ...state[action.side], [action.role]: action.championId },
        picker: null
      };
    }

    case "clear":
      return { ...state, [action.side]: { ...state[action.side], [action.role]: null } };

    case "setYourRole":
      return { ...state, yourRole: action.role, ally: { ...state.ally, [action.role]: null } };

    case "setPriority":
      return { ...state, priority: action.priority };

    case "openPicker":
      return { ...state, picker: { side: action.side, role: action.role } };

    case "closePicker":
      return { ...state, picker: null };
  }
}

export function excludedChampionIds(state: DraftState): string[] {
  return [...Object.values(state.ally), ...Object.values(state.enemy)].filter(
    (championId): championId is string => championId !== null
  );
}

export function enemyPicksWithRoles(state: DraftState): EnemyPick[] {
  return ROLES.flatMap((role) => {
    const championId = state.enemy[role];
    return championId === null ? [] : [{ championId, role }];
  });
}

export function allyPickIds(state: DraftState): string[] {
  return ROLES.flatMap((role) => {
    const championId = state.ally[role];
    return championId === null ? [] : [championId];
  });
}

export function directOpponent(state: DraftState): string | null {
  return state.enemy[state.yourRole];
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/lib/draft/draft-state.test.ts
```

Expected: PASS, 9 tests. `EnemyPick` does not exist yet, so `npm run typecheck` will fail here — Task 3 adds it. That is the only step in this plan where the two disagree.

- [ ] **Step 5: Commit**

```bash
git add src/lib/draft/draft-state.ts src/lib/draft/draft-state.test.ts
git commit -m "feat: add the draft state reducer and its selectors"
```

---

## Task 3: Weight the direct lane opponent

`scoreCounter` currently takes the plain average of a per-enemy verdict. The verdict itself does not change — only how the enemies are averaged.

**Files:**
- Modify: `src/lib/recommendation/types.ts:21-32` and `:76-88`
- Modify: `src/lib/recommendation/counter.ts:15-52`
- Modify: `src/lib/recommendation/counter.test.ts` (whole file)

- [ ] **Step 1: Add the types**

In `src/lib/recommendation/types.ts`, after the `CounterRelation` block:

```ts
export type EnemyPick = {
  championId: string;
  /** The lane this champion was placed on. Not narrowed to the `Role` union
   *  here: this module is consumed by the engine, which has no reason to
   *  depend on the draft UI's vocabulary. The API schema does the narrowing. */
  role: string;
};
```

and in `RecommendInput`, replace `enemyPicks: string[];` with:

```ts
  enemyPicks: EnemyPick[];
  /** The role being drafted for. The enemy standing on it counts double in
   *  `scoreCounter`. Optional: callers that have no draft context (tests, and
   *  any future batch use) get the previous flat weighting. */
  draftingRole?: string;
```

- [ ] **Step 2: Rewrite the counter tests**

Replace `src/lib/recommendation/counter.test.ts` entirely:

```ts
import { describe, expect, it } from "vitest";
import { scoreCounter } from "./counter";
import type { CounterRelation } from "./types";

// zed is countered by galio; diana is countered by zed; galio is countered by darius.
const relations: CounterRelation[] = [
  { championId: "zed", counteredByChampionId: "galio", role: "mid" },
  { championId: "diana", counteredByChampionId: "zed", role: "mid" },
  { championId: "galio", counteredByChampionId: "darius", role: "mid" }
];

const mid = (championId: string) => ({ championId, role: "mid" });

describe("scoreCounter", () => {
  it("is unavailable and neutral when there are no enemy picks", () => {
    const verdict = scoreCounter("galio", [], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("is unavailable when no relation is known for any enemy pick", () => {
    const verdict = scoreCounter("galio", [mid("orianna")], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("scores above neutral when the candidate counters the enemy", () => {
    const verdict = scoreCounter("galio", [mid("zed")], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeGreaterThan(50);
    expect(verdict.beats).toEqual(["zed"]);
  });

  it("scores below neutral when the enemy counters the candidate", () => {
    const verdict = scoreCounter("diana", [mid("zed")], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeLessThan(50);
    expect(verdict.losesTo).toEqual(["zed"]);
  });

  it("averages across enemy picks, so a known edge is diluted by an unknown", () => {
    const both = scoreCounter("galio", [mid("zed"), mid("orianna")], relations);
    const only = scoreCounter("galio", [mid("zed")], relations);

    expect(both.available).toBe(true);
    expect(both.score).toBeGreaterThan(50);
    expect(both.score).toBeLessThan(only.score);
  });

  // The decisive test. galio beats the enemy mid and loses to the enemy top.
  // Flat, those cancel to exactly neutral. Weighted, the lane opponent wins.
  it("counts the enemy on the drafting role twice", () => {
    const enemies = [
      { championId: "zed", role: "mid" },
      { championId: "darius", role: "top" }
    ];

    expect(scoreCounter("galio", enemies, relations).score).toBe(50);
    expect(scoreCounter("galio", enemies, relations, "mid").score).toBeGreaterThan(50);
  });

  it("falls back to flat weighting when no enemy stands on the drafting role", () => {
    const enemies = [
      { championId: "zed", role: "mid" },
      { championId: "darius", role: "top" }
    ];

    expect(scoreCounter("galio", enemies, relations, "adc").score).toBe(50);
  });

  // One enemy cannot be diluted by itself, so doubling its weight must be a
  // no-op. This is what keeps the single-enemy tests above stable.
  it("is unchanged by the weighting when there is a single enemy", () => {
    const flat = scoreCounter("galio", [mid("zed")], relations);
    const weighted = scoreCounter("galio", [mid("zed")], relations, "mid");

    expect(weighted.score).toBe(flat.score);
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

```bash
npx vitest run src/lib/recommendation/counter.test.ts
```

Expected: FAIL. The two new tests fail on the arity, and the reshaped calls fail to type-check.

- [ ] **Step 4: Rewrite `scoreCounter`**

Replace the body of `src/lib/recommendation/counter.ts` from `export function scoreCounter` to the end:

```ts
export function scoreCounter(
  championId: string,
  enemyPicks: EnemyPick[],
  relations: CounterRelation[],
  draftingRole?: string
): CounterVerdict {
  if (enemyPicks.length === 0) {
    return { score: NEUTRAL, available: false, beats: [], losesTo: [] };
  }

  const beats: string[] = [];
  const losesTo: string[] = [];

  const weighted = enemyPicks.map((pick) => {
    const candidateCountersEnemy = relations.some(
      (relation) => relation.championId === pick.championId && relation.counteredByChampionId === championId
    );
    const enemyCountersCandidate = relations.some(
      (relation) => relation.championId === championId && relation.counteredByChampionId === pick.championId
    );

    // The lane duel is the one the player is actually about to play. The
    // factor of two is a judgement call, not a measurement -- which is why
    // the engine states it in the factor's own wording.
    const weight = draftingRole !== undefined && pick.role === draftingRole ? DIRECT_OPPONENT_WEIGHT : 1;

    if (candidateCountersEnemy && !enemyCountersCandidate) {
      beats.push(pick.championId);
      return { delta: EDGE, weight };
    }

    if (enemyCountersCandidate && !candidateCountersEnemy) {
      losesTo.push(pick.championId);
      return { delta: -EDGE, weight };
    }

    return { delta: 0, weight };
  });

  const available = beats.length > 0 || losesTo.length > 0;
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const average = weighted.reduce((sum, entry) => sum + entry.delta * entry.weight, 0) / totalWeight;

  return { score: NEUTRAL + average, available, beats, losesTo };
}
```

Add the constant next to `EDGE` at the top of the file:

```ts
const DIRECT_OPPONENT_WEIGHT = 2;
```

and extend the import on line 1:

```ts
import type { CounterRelation, CounterVerdict, EnemyPick } from "./types";
```

Update the doc comment's last sentence to say the average is weighted:

```ts
 * with no known relation count as neutral, which dilutes the average rather
 * than being dropped — a single known edge should not read as certainty. The
 * average is weighted: the enemy on `draftingRole` counts twice.
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/lib/recommendation/counter.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recommendation/counter.ts src/lib/recommendation/counter.test.ts src/lib/recommendation/types.ts
git commit -m "feat: weigh the direct lane opponent twice in the counter score"
```

---

## Task 4: Wire the engine, and disclose the weighting on screen

**Files:**
- Modify: `src/lib/recommendation/engine.ts:80-86`, `:92`, `:118-126`, `:155-172`
- Modify: `src/lib/recommendation/engine.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to the `describe("counter relations in recommendations", ...)` block in `src/lib/recommendation/engine.test.ts`:

```ts
  it("names the direct opponent first in the matchup detail", () => {
    const [top] = recommendChampions({
      stats: counterStats,
      playerPool: [],
      enemyPicks: [
        { championId: "ahri", role: "top" },
        { championId: "zed", role: "mid" }
      ],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 1,
      counterRelations: relations,
      draftingRole: "mid"
    });

    const counter = top.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.detail).toMatch(/zed/);
    expect(counter?.detail).toContain("compte double");
  });

  it("says nothing about doubling when no enemy stands on the drafted lane", () => {
    const [top] = recommendChampions({
      stats: counterStats,
      playerPool: [],
      enemyPicks: [{ championId: "zed", role: "top" }],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 1,
      counterRelations: relations,
      draftingRole: "mid"
    });

    const counter = top.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.detail).not.toContain("compte double");
  });
```

- [ ] **Step 2: Migrate the existing calls in the same file**

Change the `run` helper's signature (currently `src/lib/recommendation/engine.test.ts:145`):

```ts
  function run(enemyPicks: EnemyPick[]) {
```

and add the type import at the top of the file:

```ts
import type { CounterRelation, EnemyPick } from "./types";
```

Then rewrite every literal, in place:

| Call site | Was | Becomes |
|---|---|---|
| `run([])` (lines 179, 250) | `[]` | `[]` — unchanged |
| `run(["orianna"])` (186, 257, 267) | `["orianna"]` | `[{ championId: "orianna", role: "mid" }]` |
| `run(["zed"])` (194, 205, 234, 242) | `["zed"]` | `[{ championId: "zed", role: "mid" }]` |
| `enemyPicks: []` (50, 64, 82, 98, 112, 161) | `[]` | `[]` — unchanged |
| `enemyPicks: ["kassadin"]` (218) | `["kassadin"]` | `[{ championId: "kassadin", role: "mid" }]` |
| `enemyPicks: ["zed"]` (282) | `["zed"]` | `[{ championId: "zed", role: "mid" }]` |

None of these pass `draftingRole`, so every one of them keeps flat weighting and every existing score assertion — including the exact `74.05` / `63.15` arithmetic at lines 193-202 — must still hold. If one of those two numbers moves, the weighting has leaked into the flat path; fix that rather than the expectation.

The loop test at line 303 interpolates the picks into its failure message and would print `[object Object]`. Rewrite those three lines:

```ts
  it("never produces an empty detail for a factor it marks available", () => {
    const cases: EnemyPick[][] = [
      [],
      [{ championId: "zed", role: "mid" }],
      [{ championId: "orianna", role: "mid" }],
      [
        { championId: "zed", role: "mid" },
        { championId: "orianna", role: "mid" }
      ],
      [{ championId: "unknown", role: "mid" }]
    ];

    for (const enemyPicks of cases) {
      const label = enemyPicks.map((pick) => pick.championId).join(", ");

      for (const recommendation of run(enemyPicks)) {
        const counter = recommendation.explanation.factors.find((factor) => factor.key === "counter");

        expect(counter?.detail, `${recommendation.championId} vs [${label}]`).not.toBe("");
      }
    }
  });
```

- [ ] **Step 3: Run and watch the two new tests fail**

```bash
npx vitest run src/lib/recommendation/engine.test.ts
```

Expected: the two new tests FAIL (no `compte double` in the detail); every pre-existing test PASSES. If a pre-existing one fails, stop and fix the migration before going on.

- [ ] **Step 4: Implement in the engine**

In `src/lib/recommendation/engine.ts`, replace `counterDetail` (lines 80-86):

```ts
// Champion display names, not ids: this string is rendered verbatim in the
// dossier, and `beats`/`losesTo` never reach `Recommendation`, so the surface
// layer has no way to recover a name we drop here.
//
// The direct opponent leads the sentence, because it is the matchup the board
// puts under the player's nose -- and because it is the one that was weighted.
function counterDetail(
  counter: CounterVerdict,
  names: Map<string, string>,
  directOpponentId: string | null
): string {
  const label = (championId: string) => names.get(championId) ?? championId;
  const first = (ids: string[]) =>
    directOpponentId !== null && ids.includes(directOpponentId)
      ? [directOpponentId, ...ids.filter((id) => id !== directOpponentId)]
      : ids;

  const parts: string[] = [];
  if (counter.beats.length > 0) parts.push(`Prend l'avantage sur ${first(counter.beats).map(label).join(", ")}.`);
  if (counter.losesTo.length > 0) parts.push(`En difficulté contre ${first(counter.losesTo).map(label).join(", ")}.`);

  // The factor of two is a modelling choice, not something the data measured.
  // It is stated wherever its effect is visible.
  if (directOpponentId !== null) {
    parts.push(`${label(directOpponentId)}, votre adversaire direct, compte double dans ce calcul.`);
  }

  return parts.join(" ");
}
```

After line 92 (`const hasEnemy = ...`), add:

```ts
  const directOpponentId =
    input.draftingRole === undefined
      ? null
      : (input.enemyPicks.find((pick) => pick.role === input.draftingRole)?.championId ?? null);
```

In the `scoreCounter` call (lines 122-126), pass the role through:

```ts
      const counter = scoreCounter(
        champion.championId,
        input.enemyPicks,
        relationsByRole.get(champion.role) ?? [],
        input.draftingRole
      );
```

The bucketing at lines 111-116 stays keyed on the **candidate's** role, unchanged. Enemies now carry a role of their own, but it selects a *weight*, not a relation bucket; mixing the two would silently change which relations apply.

Finally, in the counter factor's `detail` (around line 168), pass the new argument:

```ts
              detail: counter.available
                ? counterDetail(counter, names, directOpponentId)
```

- [ ] **Step 5: Run the whole suite**

```bash
npx vitest run src/lib/recommendation && npm run typecheck
```

Expected: engine and counter tests all PASS. `typecheck` still fails in `route.ts`, `page.tsx` and `draft-tool.tsx` — those are Tasks 5 and 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recommendation/engine.ts src/lib/recommendation/engine.test.ts
git commit -m "feat: name the direct opponent first and disclose its double weight"
```

---

## Task 5: Reshape the API contract

The dangerous line here is the Supabase insert: it is cast `as never`, so sending objects into a `text[]` column would compile cleanly and fail only at runtime.

**Files:**
- Modify: `src/app/api/recommend/schema.ts` (whole file)
- Modify: `src/app/api/recommend/route.ts:78-101`
- Modify: `src/app/api/recommend/route.test.ts:18-42`, `:70-83`

- [ ] **Step 1: Write the failing tests**

In `src/app/api/recommend/route.test.ts`, replace the two schema tests and add three:

```ts
  it("accepts a valid guest recommendation request", () => {
    const parsed = recommendationRequestSchema.parse({
      role: "mid",
      region: "euw",
      tier: "emerald_plus",
      enemyPicks: [{ championId: "zed", role: "mid" }],
      allyPicks: ["malphite"],
      bans: [],
      priority: 50
    });

    expect(parsed.role).toBe("mid");
    expect(parsed.enemyPicks[0].role).toBe("mid");
    expect(parsed.allyPicks).toEqual(["malphite"]);
  });

  it("defaults allyPicks to empty so an older client still parses", () => {
    const parsed = recommendationRequestSchema.parse({
      role: "mid",
      region: "euw",
      tier: "emerald_plus",
      enemyPicks: [],
      bans: []
    });

    expect(parsed.allyPicks).toEqual([]);
  });

  it("rejects an enemy pick on a lane that does not exist", () => {
    expect(() =>
      recommendationRequestSchema.parse({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [{ championId: "zed", role: "botlane" }],
        bans: []
      })
    ).toThrow();
  });

  it("rejects an invalid priority", () => {
    expect(() =>
      recommendationRequestSchema.parse({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [],
        bans: [],
        priority: 101
      })
    ).toThrow();
  });
```

Then update the integration test at line 70 and add the two assertions that pin the route's two real decisions:

```ts
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [{ championId: "zed", role: "mid" }],
        allyPicks: ["malphite"],
        bans: []
      })
    });

    await POST(request);

    expect(recommendChampionsMock).toHaveBeenCalledTimes(1);
    const input = recommendChampionsMock.mock.calls[0][0];
    expect(input.counterRelations).toEqual([
      { championId: "zed", counteredByChampionId: "galio", role: "mid" }
    ]);
    // Allies are excluded from the candidates and nothing else.
    expect(input.alreadyPickedChampionIds.sort()).toEqual(["malphite", "zed"]);
    expect(input.draftingRole).toBe("mid");
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/app/api/recommend/route.test.ts
```

Expected: FAIL — `allyPicks` is not in the schema, `botlane` is accepted, `draftingRole` is undefined.

- [ ] **Step 3: Rewrite the schema**

`src/app/api/recommend/schema.ts`, whole file:

```ts
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
```

- [ ] **Step 4: Update the route**

In `src/app/api/recommend/route.ts`, immediately before the `recommendChampions` call, add:

```ts
  // The column behind `enemy_picks` is `text[]`, and the insert below is cast
  // `as never`, so a shape mistake here would compile and only fail against
  // the live database. Extract once, use for both.
  const enemyChampionIds = parsed.data.enemyPicks.map((pick) => pick.championId);
```

Then change three lines in the call:

```ts
    enemyPicks: parsed.data.enemyPicks,
    draftingRole: parsed.data.role,
    bannedChampionIds: parsed.data.bans,
    alreadyPickedChampionIds: [...parsed.data.allyPicks, ...enemyChampionIds],
```

and one line in the insert:

```ts
      enemy_picks: enemyChampionIds,
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/app/api/recommend/route.test.ts
```

Expected: PASS, all tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/recommend/schema.ts src/app/api/recommend/route.ts src/app/api/recommend/route.test.ts
git commit -m "feat: carry enemy lanes and ally picks through the recommend API"
```

---

## Task 6: Give the pre-filled example its lanes

Without this the home page would ship a board demonstrating the flat path — the very case this feature is not about.

**Files:**
- Modify: `src/lib/draft/default-example.ts` (whole file)
- Modify: `src/lib/draft/default-example.test.ts` (whole file)
- Modify: `src/app/page.tsx:103-116`

- [ ] **Step 1: Rewrite the test**

`src/lib/draft/default-example.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_EXAMPLE } from "./default-example";
import { isRole } from "./roles";

describe("DEFAULT_EXAMPLE", () => {
  it("references champions that exist in the seed, so the example is never empty", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    for (const { championId } of DEFAULT_EXAMPLE.enemyPicks) {
      expect(seed, `${championId} is missing from the seeded champions`).toContain(
        `insert into public.champions (id, riot_key, slug, name, image_url, tags, ddragon_version) values ('${championId}'`
      );
    }
  });

  it("uses a role the stats are seeded for", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    expect(seed).toContain(`'${DEFAULT_EXAMPLE.role}', '${DEFAULT_EXAMPLE.region}', '${DEFAULT_EXAMPLE.tier}'`);
  });

  it("places every enemy on a real lane", () => {
    for (const { championId, role } of DEFAULT_EXAMPLE.enemyPicks) {
      expect(isRole(role), `${championId} sits on ${role}, which is not a lane`).toBe(true);
    }
  });

  // The landing page is the product demo. If nobody faces the drafted role,
  // it silently demonstrates the flat-weighting path instead of the feature.
  it("puts an enemy on the drafted lane", () => {
    const opponent = DEFAULT_EXAMPLE.enemyPicks.find((pick) => pick.role === DEFAULT_EXAMPLE.role);

    expect(opponent).toBeDefined();
  });

  it("places at most one enemy per lane", () => {
    const lanes = DEFAULT_EXAMPLE.enemyPicks.map((pick) => pick.role);

    expect(new Set(lanes).size).toBe(lanes.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/draft/default-example.test.ts
```

Expected: FAIL — destructuring `{ championId }` from a string yields `undefined`.

- [ ] **Step 3: Rewrite the example**

`src/lib/draft/default-example.ts`, whole file. The `as const` goes: it made the picks deeply readonly, which every consumer then had to spread away.

```ts
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
```

- [ ] **Step 4: Update the server-side call in `src/app/page.tsx`**

Replace lines 106 and 108 inside `recommendChampions({ ... })`:

```ts
    enemyPicks: DEFAULT_EXAMPLE.enemyPicks,
    draftingRole: DEFAULT_EXAMPLE.role,
    bannedChampionIds: [],
    alreadyPickedChampionIds: DEFAULT_EXAMPLE.enemyPicks.map((pick) => pick.championId),
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run src/lib/draft/default-example.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/draft/default-example.ts src/lib/draft/default-example.test.ts src/app/page.tsx
git commit -m "feat: put the pre-filled example's enemies on lanes"
```

---

## Task 7: The dark scope and the motion scale

Redefining the tokens is not enough on its own. Three things have to be handled explicitly; each is commented in the CSS so the next reader does not undo them.

**Files:**
- Modify: `src/app/globals.css` (whole file)
- Modify: `tailwind.config.ts`
- Create: `public/map/rift.png`

- [ ] **Step 1: Vendor the map**

```bash
curl -o public/map/rift.png https://ddragon.leagueoflegends.com/cdn/16.3.1/img/map/map11.png
```

Create the directory first if needed. Verify it is roughly 67 kB and a PNG:

```bash
ls -l public/map/rift.png
```

- [ ] **Step 2: Rewrite `src/app/globals.css`**

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
  --team-ally: #1d4ed8;
  --team-enemy: #b91c1c;

  --motion-fast: 140ms;
  --motion: 240ms;
  --motion-slow: 380ms;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-overshoot: cubic-bezier(0.22, 1.4, 0.4, 1);
}

/* The draft board redeclares the same token names rather than introducing a
   parallel palette, so Verdict, FactorBars and Alternatives invert without a
   single class being touched. */
[data-surface="draft"] {
  --paper: #0c1013;
  --surface: #141c22;
  --surface-sunk: #0f161b;
  --ink: #f3f0ea;
  --ink-muted: #aab3ba;
  --ink-faint: #7d8993;
  --rule: #232c33;
  --rule-soft: #1b232a;
  --accent: #e3c179;
  --accent-wash: rgba(200, 167, 90, 0.14);
  --team-ally: #2f6fd0;
  --team-enemy: #c0392b;

  /* `body` below resolves `var(--ink)` once, against :root. Descendants
     inherit that computed near-black; they do not re-resolve the variable.
     Every element in here with no text colour class -- the champion name in
     Verdict, the fact values, the alternative names -- would render dark on
     dark. Re-resolving it here fixes all of them at once. */
  color: var(--ink);

  /* Governs UA-drawn control chrome: the priority slider's empty track, the
     picker input's placeholder and clear affordance, scrollbars, focus rings.
     Without it they stay light against the dark board. */
  color-scheme: dark;

  background: var(--paper);
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

@media (prefers-reduced-motion: reduce) {
  [data-surface="draft"] *,
  [data-surface="draft"] *::before,
  [data-surface="draft"] *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

- [ ] **Step 3: Extend the Tailwind palette**

In `tailwind.config.ts`, inside `colors`, after `"accent-wash"`:

```ts
        "team-ally": "var(--team-ally)",
        "team-enemy": "var(--team-enemy)"
```

Note the existing tokens are bare `var(--x)` with no `<alpha-value>` channel, so `bg-accent/14` does not work anywhere in this codebase. `--accent-wash` is a literal translucent value for exactly that reason; do not try to replace it with an opacity modifier.

- [ ] **Step 4: Verify the build still compiles**

```bash
npm run typecheck && npx vitest run
```

Expected: `typecheck` still reports errors in `draft-tool.tsx` and `page.tsx` (both die in Task 12); no *new* errors. Tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tailwind.config.ts public/map/rift.png
git commit -m "feat: add the dark draft scope, the motion scale and the vendored minimap"
```

---

## Task 8: The Rift map

**Files:**
- Create: `src/components/draft/rift-map.tsx`
- Create: `src/components/draft/rift-map.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/draft/rift-map.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiftMap } from "./rift-map";
import { createDraftState } from "@/lib/draft/draft-state";

const champions = [
  { id: "zed", name: "Zed" },
  { id: "malphite", name: "Malphite" }
];

const state = createDraftState({ yourRole: "mid", enemyPicks: [{ championId: "zed", role: "mid" }] });

describe("RiftMap", () => {
  it("renders one anchor per lane per side", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    expect(screen.getAllByRole("button")).toHaveLength(10);
  });

  // The map is a convenience layer. Its buttons must say the same thing the
  // side columns say, or keyboard users get a different product.
  it("names an occupied anchor by side, lane and champion", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Mid adverse : Zed" })).toBeInTheDocument();
  });

  it("names an empty anchor as empty", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Top adverse, vide" })).toBeInTheDocument();
  });

  it("marks your own lane rather than offering it as a slot", () => {
    render(
      <RiftMap
        state={state}
        champions={champions}
        recommended={{ championId: "ahri", championName: "Ahri", championImageUrl: undefined }}
        onSlotClick={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Votre lane, mid : Ahri recommandé" })).toBeInTheDocument();
  });

  it("reports which slot was clicked", () => {
    const onSlotClick = vi.fn();
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={onSlotClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Top adverse, vide" }));

    expect(onSlotClick).toHaveBeenCalledWith("enemy", "top");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/draft/rift-map.test.tsx
```

Expected: FAIL, `Failed to resolve import "./rift-map"`.

- [ ] **Step 3: Write the component**

`src/components/draft/rift-map.tsx`:

```tsx
"use client";

import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { DraftState, Side } from "@/lib/draft/draft-state";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/draft/roles";

export type MapChampion = { id: string; name: string; imageUrl?: string };

export type RecommendedPin = {
  championId: string;
  championName: string;
  championImageUrl?: string;
};

// Percentages of the frame, not of the image: a missing asset costs the
// background and leaves every anchor exactly where it was.
const LANE_POSITIONS: Record<Side, Record<Role, { x: number; y: number }>> = {
  ally: {
    top: { x: 14, y: 36 },
    jungle: { x: 26, y: 52 },
    mid: { x: 40, y: 62 },
    support: { x: 56, y: 92 },
    adc: { x: 72, y: 90 }
  },
  enemy: {
    top: { x: 30, y: 14 },
    jungle: { x: 47, y: 27 },
    mid: { x: 63, y: 37 },
    support: { x: 78, y: 82 },
    adc: { x: 87, y: 69 }
  }
};

function sideLabel(side: Side): string {
  return side === "ally" ? "allié" : "adverse";
}

export function anchorLabel(
  side: Side,
  role: Role,
  championName: string | null,
  isYourLane: boolean,
  recommendedName: string | null
): string {
  if (isYourLane) {
    return recommendedName === null
      ? `Votre lane, ${role}`
      : `Votre lane, ${role} : ${recommendedName} recommandé`;
  }

  const lane = `${ROLE_LABELS[role]} ${sideLabel(side)}`;
  return championName === null ? `${lane}, vide` : `${lane} : ${championName}`;
}

export function RiftMap({
  state,
  champions,
  recommended,
  onSlotClick
}: {
  state: DraftState;
  champions: MapChampion[];
  recommended: RecommendedPin | null;
  onSlotClick: (side: Side, role: Role) => void;
}) {
  const byId = new Map(champions.map((champion) => [champion.id, champion]));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-paper ring-1 ring-rule">
      <img
        src="/map/rift.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {(["ally", "enemy"] as const).map((side) =>
        ROLES.map((role) => {
          const isYourLane = side === "ally" && role === state.yourRole;
          const championId = state[side][role];
          const champion = championId === null ? undefined : byId.get(championId);
          const position = LANE_POSITIONS[side][role];

          const pinName = isYourLane ? (recommended?.championName ?? null) : (champion?.name ?? championId);
          const pinImage = isYourLane ? recommended?.championImageUrl : champion?.imageUrl;

          const ring = isYourLane
            ? "ring-2 ring-accent"
            : side === "ally"
              ? "ring-2 ring-team-ally"
              : "ring-2 ring-team-enemy";

          return (
            <button
              key={`${side}-${role}`}
              type="button"
              onClick={() => onSlotClick(side, role)}
              aria-label={anchorLabel(side, role, champion?.name ?? championId, isYourLane, recommended?.championName ?? null)}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                pinName === null ? "border-2 border-dashed border-ink-faint bg-paper/70 p-2" : ring
              }`}
            >
              {pinName === null ? (
                <span aria-hidden="true" className="block h-4 w-4 text-center text-xs leading-4 text-ink-faint">
                  +
                </span>
              ) : (
                <ChampionAvatar name={pinName} imageUrl={pinImage} size={isYourLane ? 40 : 32} />
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/components/draft/rift-map.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/rift-map.tsx src/components/draft/rift-map.test.tsx
git commit -m "feat: add the Rift map with one anchor per lane per side"
```

---

## Task 9: The slot row

**Files:**
- Create: `src/components/draft/draft-slot.tsx`
- Create: `src/components/draft/draft-slot.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/draft/draft-slot.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftSlot } from "./draft-slot";

describe("DraftSlot", () => {
  it("offers an empty slot for filling", () => {
    const onOpen = vi.fn();
    render(<DraftSlot side="enemy" role="top" champion={null} isYourLane={false} onOpen={onOpen} onClear={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Top adverse, vide" }));

    expect(onOpen).toHaveBeenCalledWith("enemy", "top");
  });

  it("offers to clear an occupied slot", () => {
    const onClear = vi.fn();
    render(
      <DraftSlot
        side="enemy"
        role="top"
        champion={{ id: "darius", name: "Darius" }}
        isYourLane={false}
        onOpen={vi.fn()}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retirer Darius" }));

    expect(onClear).toHaveBeenCalledWith("enemy", "top");
  });

  // Your own lane holds the recommendation. Offering a picker there would
  // invite the player to answer the question they came to have answered.
  it("does not offer a picker on your own lane", () => {
    render(<DraftSlot side="ally" role="mid" champion={null} isYourLane onOpen={vi.fn()} onClear={vi.fn()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/vous/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/draft/draft-slot.test.tsx
```

Expected: FAIL, unresolved import.

- [ ] **Step 3: Write the component**

`src/components/draft/draft-slot.tsx`:

```tsx
"use client";

import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { Side } from "@/lib/draft/draft-state";
import { ROLE_LABELS, type Role } from "@/lib/draft/roles";

export function DraftSlot({
  side,
  role,
  champion,
  isYourLane,
  onOpen,
  onClear
}: {
  side: Side;
  role: Role;
  champion: { id: string; name: string; imageUrl?: string } | null;
  isYourLane: boolean;
  onOpen: (side: Side, role: Role) => void;
  onClear: (side: Side, role: Role) => void;
}) {
  const lane = `${ROLE_LABELS[role]} ${side === "ally" ? "allié" : "adverse"}`;
  const edge = side === "ally" ? "border-l-2 border-l-team-ally" : "border-r-2 border-r-team-enemy";

  if (isYourLane) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-accent bg-accent-wash p-1.5">
        <ChampionAvatar name={champion?.name ?? ROLE_LABELS[role]} imageUrl={champion?.imageUrl} size={34} />
        <span className="min-w-0">
          <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-accent">
            {ROLE_LABELS[role]} · vous
          </span>
          <span className="block truncate text-[13px] font-bold text-ink">{champion?.name ?? "Recommandation"}</span>
        </span>
      </div>
    );
  }

  if (champion === null) {
    return (
      <button
        type="button"
        onClick={() => onOpen(side, role)}
        aria-label={`${lane}, vide`}
        className={`flex items-center gap-2.5 rounded-lg border border-dashed border-rule bg-surface-sunk p-1.5 text-left ${edge}`}
      >
        <span
          aria-hidden="true"
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-surface text-[8.5px] font-extrabold uppercase text-ink-faint"
        >
          {ROLE_LABELS[role]}
        </span>
        <span className="min-w-0">
          <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">{lane}</span>
          <span className="block truncate text-[13px] font-semibold text-ink-faint">À placer</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClear(side, role)}
      aria-label={`Retirer ${champion.name}`}
      className={`flex items-center gap-2.5 rounded-lg border border-rule bg-surface p-1.5 text-left ${edge}`}
    >
      <ChampionAvatar name={champion.name} imageUrl={champion.imageUrl} size={34} />
      <span className="min-w-0">
        <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">{lane}</span>
        <span className="block truncate text-[13px] font-bold text-ink">{champion.name}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/components/draft/draft-slot.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/draft-slot.tsx src/components/draft/draft-slot.test.tsx
git commit -m "feat: add the draft slot row"
```

---

## Task 10: The champion picker

The id-matching behaviour is carried over from `enemy-picks.tsx`, which is deleted in Task 12. It exists because a search for "kaisa" must find Kai'Sa.

**Files:**
- Create: `src/components/draft/champion-picker.tsx`
- Create: `src/components/draft/champion-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/draft/champion-picker.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChampionPicker } from "./champion-picker";

const champions = [
  { id: "zed", name: "Zed" },
  { id: "caitlyn", name: "Caitlyn" },
  { id: "kaisa", name: "Kai'Sa" }
];

function renderPicker(overrides: Partial<Parameters<typeof ChampionPicker>[0]> = {}) {
  const props = {
    champions,
    excludedIds: [] as string[],
    target: { side: "enemy" as const, role: "mid" as const },
    onPick: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };

  render(<ChampionPicker {...props} />);
  return props;
}

describe("ChampionPicker", () => {
  it("says which lane it is filling", () => {
    renderPicker();

    expect(screen.getByText(/mid adverse/i)).toBeInTheDocument();
  });

  // Punctuated names are searched by their slug, which is what a player types.
  it("finds a punctuated champion by its slug", () => {
    renderPicker();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "kaisa" } });

    expect(screen.getByRole("button", { name: "Kai'Sa" })).toBeInTheDocument();
  });

  it("hides champions already placed elsewhere", () => {
    renderPicker({ excludedIds: ["zed"] });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "z" } });

    expect(screen.queryByRole("button", { name: "Zed" })).not.toBeInTheDocument();
  });

  it("reports the picked champion", () => {
    const props = renderPicker();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cait" } });
    fireEvent.click(screen.getByRole("button", { name: "Caitlyn" }));

    expect(props.onPick).toHaveBeenCalledWith("caitlyn");
  });

  it("takes the first match on Enter", () => {
    const props = renderPicker();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "cait" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onPick).toHaveBeenCalledWith("caitlyn");
  });

  it("closes on Escape", () => {
    const props = renderPicker();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    expect(props.onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/components/draft/champion-picker.test.tsx
```

Expected: FAIL, unresolved import.

- [ ] **Step 3: Write the component**

`src/components/draft/champion-picker.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { Side } from "@/lib/draft/draft-state";
import { ROLE_LABELS, type Role } from "@/lib/draft/roles";

export type PickerChampion = { id: string; name: string; imageUrl?: string };

const MAX_RESULTS = 12;

export function ChampionPicker({
  champions,
  excludedIds,
  target,
  onPick,
  onClose
}: {
  champions: PickerChampion[];
  excludedIds: string[];
  target: { side: Side; role: Role };
  onPick: (championId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  // Matched against the id as well as the display name: ids are the
  // punctuation-stripped slugs, so a search for "kaisa" finds Kai'Sa, which
  // matching on the name alone never would.
  const needle = query.trim().toLowerCase();
  const matches = champions
    .filter(
      (champion) =>
        !excludedIds.includes(champion.id) &&
        (needle === "" ||
          champion.name.toLowerCase().includes(needle) ||
          champion.id.includes(needle))
    )
    .slice(0, MAX_RESULTS);

  const lane = `${ROLE_LABELS[target.role]} ${target.side === "ally" ? "allié" : "adverse"}`;

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-center gap-2 rounded-xl bg-paper/90 p-3 backdrop-blur-sm">
      <div className="flex items-baseline justify-between">
        <label htmlFor="champion-picker" className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-accent">
          {lane}
        </label>
        <button type="button" onClick={onClose} className="text-[11px] text-ink-faint underline">
          Fermer
        </button>
      </div>

      <input
        id="champion-picker"
        type="search"
        role="combobox"
        autoFocus
        aria-expanded={matches.length > 0}
        aria-controls="champion-picker-results"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Enter" && matches[0] !== undefined) onPick(matches[0].id);
        }}
        placeholder="Rechercher un champion"
        className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-ink"
      />

      <ul id="champion-picker-results" className="grid grid-cols-6 gap-1.5">
        {matches.map((champion) => (
          <li key={champion.id}>
            <button
              type="button"
              onClick={() => onPick(champion.id)}
              aria-label={champion.name}
              className="block w-full rounded-lg border border-rule p-0.5 hover:border-accent"
            >
              <ChampionAvatar name={champion.name} imageUrl={champion.imageUrl} size={34} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/components/draft/champion-picker.test.tsx
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/champion-picker.tsx src/components/draft/champion-picker.test.tsx
git commit -m "feat: add the champion picker"
```

---

## Task 11: The board

This is where the two guards from `draft-tool.tsx` move. They are the reason `draft-tool.requests.test.tsx` exists: every other test passes against an implementation with neither.

**Files:**
- Create: `src/components/draft/draft-board.tsx`
- Create: `src/components/draft/draft-board.requests.test.tsx`
- Create: `src/components/draft/draft-board.test.tsx`

- [ ] **Step 1: Port the guard tests first**

`src/components/draft/draft-board.requests.test.tsx`. This is `draft-tool.requests.test.tsx` with the props and the interactions changed; the fetch choreography and the real-timer sleep are copied exactly, because they are what make the guards observable.

```tsx
// These pin the two invariants the behaviour tests cannot see: that only the
// newest request may write state, and that a slider drag issues one request
// rather than one per tick. Both survive a rewrite only if something fails
// loudly when they are removed.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftBoard } from "./draft-board";
import { createDraftState } from "@/lib/draft/draft-state";
import type { Recommendation } from "@/lib/recommendation/types";

function rec(name: string, score: number, { withPool = false } = {}): Recommendation {
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
        { key: "player", label: "Votre pool", score: 50, weight: 0, detail: "", available: withPool },
        { key: "counter", label: "Matchup", score: 80, weight: 40, detail: "Prend l'avantage.", available: true }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

const champions = [
  { id: "zed", name: "Zed" },
  { id: "darius", name: "Darius" }
];

const initialDraft = createDraftState({ yourRole: "mid" });
const initial = [rec("Galio", 88)];
const initialWithPool = [rec("Galio", 88, { withPool: true })];

function ok(name: string) {
  return new Response(JSON.stringify({ recommendations: [rec(name, 90)] }), { status: 200 });
}

// Two placements, so two requests, without depending on the picker's internals.
function placeTwoEnemies() {
  fireEvent.click(screen.getByRole("button", { name: "Top adverse, vide" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "darius" } });
  fireEvent.click(screen.getByRole("button", { name: "Darius" }));

  fireEvent.click(screen.getByRole("button", { name: "Mid adverse, vide" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "zed" } });
  fireEvent.click(screen.getByRole("button", { name: "Zed" }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftBoard request handling", () => {
  it("discards a superseded request even when it resolves last", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        })
    );

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initial} />);

    placeTwoEnemies();

    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The newest request settles first; the stale one settles last and must lose.
    resolvers[1](ok("Briar"));
    resolvers[0](ok("Anivia"));

    await waitFor(() => expect(screen.getByText("Briar")).toBeInTheDocument());
    expect(screen.queryByText("Anivia")).not.toBeInTheDocument();
  });

  it("does not leave a stale error banner over a newer success", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        })
    );

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initial} />);

    placeTwoEnemies();

    await waitFor(() => expect(resolvers).toHaveLength(2));

    resolvers[1](ok("Briar"));
    resolvers[0](new Response("", { status: 500 }));

    await waitFor(() => expect(screen.getByText("Briar")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("collapses a slider drag into a single request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Briar"));

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initialWithPool} />);

    const slider = screen.getByLabelText(/priorité/i);
    for (const value of ["55", "62", "71", "80", "90"]) {
      fireEvent.change(slider, { target: { value } });
    }

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).priority).toBe(90);
  });

  it("does not let a pending slider request carry a draft the user has since changed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Briar"));

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initialWithPool} />);

    // The draft changes inside the debounce window. The pending timer closed
    // over the old draft and would be issued last, so it would also take the
    // highest request id and win.
    fireEvent.change(screen.getByLabelText(/priorité/i), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Top adverse, vide" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "darius" } });
    fireEvent.click(screen.getByRole("button", { name: "Darius" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    // Long enough that a surviving timer would have fired.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.enemyPicks).toEqual([{ championId: "darius", role: "top" }]);
    expect(body.priority).toBe(90);
  });
});
```

- [ ] **Step 2: Write the behaviour tests**

`src/components/draft/draft-board.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftBoard } from "./draft-board";
import { createDraftState } from "@/lib/draft/draft-state";
import type { Recommendation } from "@/lib/recommendation/types";

function rec(name: string, score: number, { withPool = false } = {}): Recommendation {
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
        { key: "player", label: "Votre pool", score: 50, weight: 0, detail: "", available: withPool },
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

const solved = createDraftState({ yourRole: "mid", enemyPicks: [{ championId: "zed", role: "mid" }] });
const initial = [rec("Galio", 88), rec("Lissandra", 81), rec("Diana", 74)];

function ok(name: string) {
  return new Response(JSON.stringify({ recommendations: [rec(name, 90)] }), { status: 200 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftBoard", () => {
  it("renders the pre-solved example on first paint without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    expect(screen.getByText("Galio")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends a placed enemy with its lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Orianna"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "ADC adverse, vide" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "caitlyn" } });
    fireEvent.click(screen.getByRole("button", { name: "Caitlyn" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.enemyPicks).toEqual([
      { championId: "zed", role: "mid" },
      { championId: "caitlyn", role: "adc" }
    ]);
    expect(body.role).toBe("mid");
  });

  // Allies exist to be excluded. If they stopped being sent, the only symptom
  // would be a champion recommended while sitting in your own team's list.
  it("sends allied picks so they leave the candidate list", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Orianna"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Top allié, vide" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "galio" } });
    fireEvent.click(screen.getByRole("button", { name: "Galio" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).allyPicks).toEqual(["galio"]);
  });

  it("sends the reduced list when an enemy is removed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Orianna"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Retirer Zed" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).enemyPicks).toEqual([]);
  });

  it("requests again when you change lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Darius"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Jouer top" }));

    await waitFor(() => expect(screen.getByText("Darius")).toBeInTheDocument());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).role).toBe("top");
  });

  it("does not offer the priority slider when the player factor could not be assessed", () => {
    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    expect(screen.queryByLabelText(/priorité/i)).not.toBeInTheDocument();
    expect(screen.getByText(/le classement est entièrement méta/i)).toBeInTheDocument();
  });

  it("keeps the previous result on screen when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Retirer Zed" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Galio")).toBeInTheDocument();
  });

  it("clears the error banner once a later request succeeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 500 }));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Retirer Zed" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    fetchSpy.mockResolvedValue(ok("Darius"));
    fireEvent.click(screen.getByRole("button", { name: "Jouer top" }));

    await waitFor(() => expect(screen.getByText("Darius")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run both and watch them fail**

```bash
npx vitest run src/components/draft/draft-board.test.tsx src/components/draft/draft-board.requests.test.tsx
```

Expected: FAIL, unresolved import `./draft-board`.

- [ ] **Step 4: Write the board**

`src/components/draft/draft-board.tsx`:

```tsx
"use client";

import { useReducer, useRef, useState } from "react";
import { Alternatives } from "./alternatives";
import { ChampionPicker } from "./champion-picker";
import { DraftSlot } from "./draft-slot";
import { PriorityControl, PriorityUnavailable } from "./priority-control";
import { RefinePrompt } from "./refine-prompt";
import { RiftMap } from "./rift-map";
import { Verdict } from "./verdict";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import {
  allyPickIds,
  createDraftState,
  draftReducer,
  enemyPicksWithRoles,
  excludedChampionIds,
  type DraftState,
  type Side
} from "@/lib/draft/draft-state";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/draft/roles";
import type { Recommendation } from "@/lib/recommendation/types";

export type BoardChampion = { id: string; name: string; imageUrl?: string };

const PRIORITY_DEBOUNCE_MS = 250;

export function DraftBoard({
  champions,
  initialDraft,
  initialRecommendations
}: {
  champions: BoardChampion[];
  initialDraft: DraftState;
  initialRecommendations: Recommendation[];
}) {
  const [draft, dispatch] = useReducer(draftReducer, initialDraft);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the newest request may write state. Without this, two in-flight
  // requests resolve in arbitrary order and the slower one wins, leaving a
  // recommendation on screen that does not match the visible board.
  const requestId = useRef(0);

  // The slider fires on every tick of a drag, not on release, so one drag
  // would otherwise be dozens of POSTs against a database-backed route.
  const priorityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = new Map(champions.map((champion) => [champion.id, champion]));

  // The previous result deliberately stays on screen while a request is in
  // flight and after a failure: emptying it would punish the user for a
  // transient error and undo the "already solved" premise of the page.
  async function refresh(next: DraftState) {
    // A pending slider request closed over an older draft, and because it
    // would be issued last it would also carry the highest request id -- so
    // the guard below would hand the stale one the win.
    if (priorityTimer.current) clearTimeout(priorityTimer.current);

    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: next.yourRole,
          region: DEFAULT_EXAMPLE.region,
          tier: DEFAULT_EXAMPLE.tier,
          enemyPicks: enemyPicksWithRoles(next),
          allyPicks: allyPickIds(next),
          bans: [],
          priority: next.priority,
          topN: 4
        })
      });

      if (id !== requestId.current) return;

      if (!response.ok) {
        setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
        return;
      }

      const payload = (await response.json()) as { recommendations: Recommendation[] };
      if (id !== requestId.current) return;
      setRecommendations(payload.recommendations);
    } catch {
      if (id !== requestId.current) return;
      setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }

  // Every mutator computes the next state itself and hands it to both the
  // reducer and the request, so the request never reads a stale render.
  function apply(action: Parameters<typeof draftReducer>[1]) {
    const next = draftReducer(draft, action);
    dispatch(action);
    if (next !== draft) void refresh(next);
  }

  function changePriority(priority: number) {
    const next = draftReducer(draft, { type: "setPriority", priority });
    dispatch({ type: "setPriority", priority });
    if (priorityTimer.current) clearTimeout(priorityTimer.current);
    priorityTimer.current = setTimeout(() => {
      void refresh(next);
    }, PRIORITY_DEBOUNCE_MS);
  }

  const [top, ...rest] = recommendations;
  const playerFactor = top?.explanation.factors.find((factor) => factor.key === "player");

  const recommended =
    top === undefined
      ? null
      : {
          championId: top.championId,
          championName: top.championName,
          championImageUrl: top.championImageUrl
        };

  function column(side: Side) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={`text-[9.5px] font-extrabold uppercase tracking-[0.18em] ${side === "ally" ? "text-team-ally" : "text-team-enemy"}`}>
          {side === "ally" ? "Votre équipe" : "En face"}
        </span>
        {ROLES.map((role) => {
          const isYourLane = side === "ally" && role === draft.yourRole;
          const championId = draft[side][role];
          const champion = isYourLane
            ? (recommended === null
                ? null
                : { id: recommended.championId, name: recommended.championName, imageUrl: recommended.championImageUrl })
            : (championId === null ? null : (byId.get(championId) ?? { id: championId, name: championId }));

          return (
            <div key={role}>
              <DraftSlot
                side={side}
                role={role}
                champion={champion}
                isYourLane={isYourLane}
                onOpen={(openSide, openRole) => dispatch({ type: "openPicker", side: openSide, role: openRole })}
                onClear={(clearSide, clearRole) => apply({ type: "clear", side: clearSide, role: clearRole })}
              />
              {side === "ally" && !isYourLane && (
                <button
                  type="button"
                  onClick={() => apply({ type: "setYourRole", role })}
                  className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-faint underline"
                >
                  {`Jouer ${ROLE_LABELS[role].toLowerCase()}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div data-surface="draft" className="rounded-xl border border-rule bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-[186px_1fr_186px]">
        {column("ally")}

        <div className="relative">
          <RiftMap
            state={draft}
            champions={champions}
            recommended={recommended}
            onSlotClick={(side, role) => {
              if (side === "ally" && role === draft.yourRole) return;
              if (draft[side][role] === null) dispatch({ type: "openPicker", side, role });
              else apply({ type: "clear", side, role });
            }}
          />
          {draft.picker !== null && (
            <ChampionPicker
              champions={champions}
              excludedIds={excludedChampionIds(draft)}
              target={draft.picker}
              onPick={(championId) =>
                apply({
                  type: "place",
                  side: draft.picker!.side,
                  role: draft.picker!.role,
                  championId
                })
              }
              onClose={() => dispatch({ type: "closePicker" })}
            />
          )}
        </div>

        {column("enemy")}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-rule bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
          {error}
        </p>
      )}

      <div aria-busy={isLoading} className="mt-4 border-t border-rule-soft pt-4">
        {top ? (
          <>
            <Verdict recommendation={top} />
            {playerFactor?.available ? (
              <PriorityControl value={draft.priority} onChange={changePriority} />
            ) : (
              <PriorityUnavailable />
            )}
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

`createDraftState` is imported for the tests' benefit only if unused here — remove the import if your editor flags it; the tests build their own initial state.

- [ ] **Step 5: Run both test files**

```bash
npx vitest run src/components/draft/draft-board.test.tsx src/components/draft/draft-board.requests.test.tsx
```

Expected: PASS, 8 + 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/draft/draft-board.tsx src/components/draft/draft-board.test.tsx src/components/draft/draft-board.requests.test.tsx
git commit -m "feat: add the draft board, carrying over the request guards"
```

---

## Task 12: Swap the board in and delete the old tool

**Files:**
- Modify: `src/app/page.tsx:192-226`
- Delete: `src/components/draft/draft-tool.tsx`, `draft-tool.test.tsx`, `draft-tool.requests.test.tsx`, `enemy-picks.tsx`, `role-selector.tsx`, `src/components/ui/chip.tsx`

- [ ] **Step 1: Rewrite the render block in `src/app/page.tsx`**

The dark band has to escape the padded `max-w-5xl` container, and it has to enclose **both** arms of the ternary — the degraded-state paragraph uses the same tokens and would otherwise render light inside a dark band.

```tsx
  return (
    <main>
      <SiteHeader context={headerContext} />

      <div className="mx-auto max-w-5xl px-6 pt-7">
        <Hero />
      </div>

      <div data-surface="draft" className="w-full bg-paper py-7">
        <div className="mx-auto max-w-5xl px-6">
          {example.recommendations.length === 0 ? (
            <p className="rounded-xl border border-rule bg-surface p-6 text-center text-sm text-ink-muted">
              Les données de draft ne sont pas disponibles pour le moment. Réessayez dans un instant.
            </p>
          ) : (
            <DraftBoard
              champions={example.champions}
              initialDraft={createDraftState({
                yourRole: DEFAULT_EXAMPLE.role,
                enemyPicks: DEFAULT_EXAMPLE.enemyPicks
              })}
              initialRecommendations={example.recommendations}
            />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-7">
        <Explainer />
        {example.rankedChampions !== null && (
          <TrustBar
            appearances={example.appearances}
            rankedChampions={example.rankedChampions}
            patch={example.patch}
            context={CONTEXT}
            updatedAt={example.fetchedAt}
          />
        )}
      </div>

      <SiteFooter />
    </main>
  );
```

Update the imports at the top of the file: drop `DraftTool`, add

```tsx
import { DraftBoard } from "@/components/draft/draft-board";
import { createDraftState } from "@/lib/draft/draft-state";
```

Also raise `topN` in `loadExample` from `3` to `4`, so the server-rendered example carries the same number of alternatives the board requests.

- [ ] **Step 2: Delete the superseded files**

```bash
git rm src/components/draft/draft-tool.tsx src/components/draft/draft-tool.test.tsx src/components/draft/draft-tool.requests.test.tsx src/components/draft/enemy-picks.tsx src/components/draft/role-selector.tsx src/components/ui/chip.tsx
```

- [ ] **Step 3: Confirm nothing still imports them**

```bash
grep -rn "draft-tool\|enemy-picks\|role-selector\|ui/chip" src/
```

Expected: no output. If `ROLES` is still imported from `role-selector` anywhere, repoint it at `@/lib/draft/roles`.

- [ ] **Step 4: Run everything**

```bash
npm run typecheck && npx vitest run
```

Expected: `tsc` exits 0 — this is the first step in the plan where it does — and the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: put the draft board on the home page and remove the old tool"
```

---

## Task 13: The CSS animations

Four of the five are pure CSS and need no test; the reduced-motion rule added in Task 7 already covers them.

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/draft/rift-map.tsx`
- Modify: `src/components/draft/draft-board.tsx`

- [ ] **Step 1: Add the keyframes to `src/app/globals.css`**

Append:

```css
/* 1 -- a pick lands on its lane. Keyed by champion id at the call site, so it
   replays whenever the occupant changes and never on an unrelated rerender. */
@keyframes pin-drop {
  0% {
    transform: translate(-50%, -50%) scale(2.1);
    opacity: 0;
  }
  60% {
    transform: translate(-50%, -50%) scale(0.94);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

@keyframes pin-ping {
  0% {
    transform: translate(-50%, -50%) scale(0.7);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.4);
    opacity: 0;
  }
}

/* 5 -- the slots arrive in sequence. `backwards` matters: the resting state is
   the visible one, so a stylesheet that never loads leaves a readable board
   rather than a blank one. */
@keyframes slot-rise {
  from {
    opacity: 0;
    transform: translateY(9px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 4 -- a sweep instead of a spinner. The stale result stays legible beneath. */
@keyframes board-sweep {
  from {
    transform: translateX(-120%);
  }
  to {
    transform: translateX(320%);
  }
}

[data-surface="draft"] .pin-drop {
  animation: pin-drop var(--motion) var(--ease-overshoot);
}

[data-surface="draft"] .pin-ping {
  animation: pin-ping var(--motion-slow) var(--ease-out);
}

[data-surface="draft"] .slot-rise {
  animation: slot-rise var(--motion) var(--ease-out) backwards;
}

[data-surface="draft"] .board-sweep::after {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 38%;
  background: linear-gradient(90deg, transparent, var(--accent-wash), transparent);
  animation: board-sweep 1.1s var(--ease-out) infinite;
  pointer-events: none;
}

/* 2 -- the factor bars slide to their new value rather than jumping. */
[data-surface="draft"] .factor-bar-fill {
  transition: width var(--motion) var(--ease-out);
}
```

- [ ] **Step 2: Apply them in `rift-map.tsx`**

On the `<button>`, add `pin-drop` and a key that changes with the occupant:

```tsx
              key={`${side}-${role}-${championId ?? "empty"}`}
```

and append `pin-drop` to the `className` template. Inside an occupied anchor, before the avatar, add the ring:

```tsx
                  <span aria-hidden="true" className="pin-ping absolute left-1/2 top-1/2 h-full w-full rounded-full ring-2 ring-current" />
```

- [ ] **Step 3: Apply them in `draft-board.tsx`**

On the map's wrapper `<div className="relative">`, make the loading state visible:

```tsx
        <div className={`relative ${isLoading ? "board-sweep opacity-80 saturate-[0.6] transition-[opacity,filter]" : ""}`}>
```

On each slot wrapper in `column`, stagger the entry:

```tsx
            <div key={role} className="slot-rise" style={{ animationDelay: `${ROLES.indexOf(role) * 40}ms` }}>
```

- [ ] **Step 4: Add the transition class to the factor bars**

In `src/components/draft/factor-bars.tsx`, line 43, append `factor-bar-fill` to the filled bar's `className`.

- [ ] **Step 5: Verify nothing regressed**

```bash
npm run typecheck && npx vitest run
```

Expected: all green. Then look at it:

```bash
npm run dev
```

Open `http://localhost:3000`, place an enemy, and confirm the pin lands, the sweep runs during the request, and the bars slide. Then set the OS "reduce motion" preference and confirm everything snaps instantly.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/draft/rift-map.tsx src/components/draft/draft-board.tsx src/components/draft/factor-bars.tsx
git commit -m "feat: animate pick landing, recalculation and board entry"
```

---

## Task 14: The alternative preview

The only animation with logic behind it, so the only one with tests. What is tested is the state, never the pixels.

**Files:**
- Modify: `src/components/draft/alternatives.tsx`
- Modify: `src/components/draft/draft-board.tsx`
- Modify: `src/components/draft/alternatives.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/components/draft/alternatives.test.tsx`:

```tsx
  it("previews an alternative on hover and withdraws it on leave", () => {
    const onPreview = vi.fn();
    render(<Alternatives recommendations={[build("Viktor")]} onPreview={onPreview} onSelect={vi.fn()} />);

    const card = screen.getByRole("button", { name: /viktor/i });

    fireEvent.mouseEnter(card);
    expect(onPreview).toHaveBeenLastCalledWith("viktor");

    fireEvent.mouseLeave(card);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  // Hover-only would make this a mouse feature. Focus has to do the same.
  it("previews on keyboard focus too", () => {
    const onPreview = vi.fn();
    render(<Alternatives recommendations={[build("Viktor")]} onPreview={onPreview} onSelect={vi.fn()} />);

    fireEvent.focus(screen.getByRole("button", { name: /viktor/i }));

    expect(onPreview).toHaveBeenLastCalledWith("viktor");
  });

  it("selects an alternative on click", () => {
    const onSelect = vi.fn();
    render(<Alternatives recommendations={[build("Viktor")]} onPreview={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /viktor/i }));

    expect(onSelect).toHaveBeenCalledWith("viktor");
  });
```

Add a local `build(name)` factory at the top of that file if it does not already have one, following the shape used in `verdict.test.tsx`.

And in `src/components/draft/draft-board.test.tsx`, the invariant that matters most:

```tsx
  // A preview is a look, not a decision. If it fired a request, hovering the
  // alternatives list would hammer the API and could even reorder itself.
  it("fires no request when an alternative is previewed", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: /lissandra/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/components/draft/alternatives.test.tsx src/components/draft/draft-board.test.tsx
```

Expected: FAIL — `Alternatives` takes no `onPreview`, and its cards are not buttons.

- [ ] **Step 3: Make the alternatives interactive**

In `src/components/draft/alternatives.tsx`, change the signature and turn each card into a button:

```tsx
export function Alternatives({
  recommendations,
  onPreview,
  onSelect
}: {
  recommendations: Recommendation[];
  onPreview: (championId: string | null) => void;
  onSelect: (championId: string) => void;
}) {
  if (recommendations.length === 0) return null;

  return (
    <div className="mt-2 flex gap-2">
      {recommendations.map((recommendation) => (
        <button
          key={recommendation.championId}
          type="button"
          data-testid="alternative"
          onMouseEnter={() => onPreview(recommendation.championId)}
          onMouseLeave={() => onPreview(null)}
          onFocus={() => onPreview(recommendation.championId)}
          onBlur={() => onPreview(null)}
          onClick={() => onSelect(recommendation.championId)}
          className="flex-1 rounded-lg border border-rule bg-surface px-3 py-2.5 text-left hover:border-accent"
        >
          <b className="block text-sm font-bold tracking-tight text-ink">
            {recommendation.championName}{" "}
            <span className="font-extrabold text-accent">{Math.round(recommendation.totalScore)}</span>
          </b>
          <Facts recommendation={recommendation} />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Hold the preview in the board**

In `src/components/draft/draft-board.tsx`, add the state:

```tsx
  // Ephemeral by design: a preview changes what the map shows and nothing
  // else. It never enters the draft and never triggers a request.
  const [previewId, setPreviewId] = useState<string | null>(null);
```

Compute the pin from it, replacing the `recommended` binding:

```tsx
  const previewed = previewId === null ? undefined : recommendations.find((entry) => entry.championId === previewId);
  const shown = previewed ?? top;

  const recommended =
    shown === undefined
      ? null
      : {
          championId: shown.championId,
          championName: shown.championName,
          championImageUrl: shown.championImageUrl
        };
```

and pass the handlers:

```tsx
            <Alternatives
              recommendations={rest}
              onPreview={setPreviewId}
              onSelect={(championId) => {
                setPreviewId(null);
                setRecommendations((current) => {
                  const chosen = current.find((entry) => entry.championId === championId);
                  if (chosen === undefined) return current;
                  return [chosen, ...current.filter((entry) => entry.championId !== championId)];
                });
              }}
            />
```

Selecting reorders what is already on screen; it asks the server for nothing, because the server has already answered.

- [ ] **Step 5: Add the travel**

In `rift-map.tsx`, give your own lane's avatar a transition so a changed preview slides rather than cuts:

```tsx
                className="transition-transform duration-[var(--motion)] ease-[var(--ease-overshoot)]"
```

Under reduced motion the rule from Task 7 collapses it to an instant swap, which is the specified degradation.

- [ ] **Step 6: Run the tests**

```bash
npx vitest run && npm run typecheck
```

Expected: everything green.

- [ ] **Step 7: Commit**

```bash
git add src/components/draft/alternatives.tsx src/components/draft/alternatives.test.tsx src/components/draft/draft-board.tsx src/components/draft/draft-board.test.tsx src/components/draft/rift-map.tsx
git commit -m "feat: preview an alternative on your lane without committing to it"
```

---

## Task 15: Full verification

- [ ] **Step 1: The whole suite and the compiler**

```bash
npm run typecheck && npx vitest run && npm run lint
```

Expected: all three exit 0. Paste the failures rather than adjusting expectations if any do not.

- [ ] **Step 2: A real build**

```bash
npm run build
```

Expected: succeeds. `/` is `force-dynamic`, so no page is prerendered against a missing `.env.local`.

- [ ] **Step 3: Look at it**

```bash
npm run dev
```

Walk the checklist at `http://localhost:3000`:

- The board arrives already solved, dark, with Zed on enemy mid and Caitlyn on enemy ADC.
- The matchup sentence names Zed first and says he counts double.
- Placing an enemy on **your** lane moves the recommendation more than placing one elsewhere.
- Placing an ally removes that champion from the alternatives.
- Tab through the board without touching the mouse: every slot is reachable, the picker opens, Escape closes it and returns focus.
- The champion name in the verdict is light, not near-black. If it is dark, the `color: var(--ink)` line in the scoped block is missing.
- The priority slider still shows `PriorityUnavailable`, because no account exists.

- [ ] **Step 4: Commit any fixes, then stop**

Do not open a pull request or push. Report what passed and what did not.

---

## Self-Review

**Spec coverage.** Layout → Tasks 8-12. Ally slots display-and-exclude → Tasks 2, 5, 11. Enemy roles and double weight → Tasks 3-6. Picker-on-click → Task 10. Dark scope and its three traps → Task 7. Motion 1/2/4/5 → Task 13; motion 6 → Task 14. Accessibility → Tasks 8-11 (accessible names, combobox, focus, keyboard-reachable columns). Degraded states → inherited and re-tested in Task 11; the missing-asset case is covered by positioning anchors against the frame in Task 8. The pre-filled example → Task 6. Every listed existing test file is updated by a named task. Bans, mobile and URL state stay out, as specified.

**Naming consistency.** `createDraftState`, `draftReducer`, `excludedChampionIds`, `enemyPicksWithRoles`, `allyPickIds`, `directOpponent` are defined in Task 2 and used under those exact names in Tasks 5, 11 and 12. `EnemyPick` and `draftingRole` are introduced in Task 3 and used unchanged in 4, 5 and 6. `anchorLabel`'s strings in Task 8 are the ones the Task 11 tests query by.

**One deliberate ordering wrinkle.** Task 2 ships a reducer that imports `EnemyPick`, a type Task 3 creates. Its own tests pass, but `npm run typecheck` does not go green until Task 3. This is called out in Task 2 Step 4. The alternative — defining the type twice and reconciling later — is worse.

---

## Deviations, recorded during execution

Written as the plan was carried out, so the next reader sees where the map and the territory parted.

**Before Task 3 — a stray worktree was failing the suite.** A leftover agent worktree under `.claude/` carries its own `node_modules`, so a bare `vitest run` collected a second copy of this suite against a second copy of React and failed five files on duplicate hooks. Nothing to do with the working tree, but every "run the whole suite" step in this plan would have tripped over it. `vitest.config.ts` now excludes `**/.claude/**` (commit `a9a6225`).

**Task 4 — the plan's own test was wrong.** It asserted `toMatch(/zed/)`, but `counterDetail` renders the *display name*, "Zed". A case-sensitive match could never pass against a correct implementation. Changed to `/zed/i`. The implementer flagged it instead of bending the engine to fit a broken expectation, which is the right instinct.

**Task 4 — the "first" test did not test "first".** Review neutralised `first()` into an identity function and the test stayed green: with that fixture the winning candidate's `beats` had a single element, so there was nothing to reorder. Replaced with a fixture where the direct opponent is pushed onto `beats` *second*, targeting the candidate by id rather than destructuring the top result, so the assertion no longer rides on the fixture's overall ranking. Verified to fail when the reordering is removed.

**Task 4 — the disclosure sentence could overclaim.** As planned, "X, votre adversaire direct, compte double dans ce calcul." was appended whenever a direct opponent existed. But `counterDetail` runs when *any* enemy has a known relation, so a candidate could name the direct opponent only in that closing sentence, with no clause saying whether that matchup is good, bad, or unmeasured. Never false — the weight really does apply to a zero delta — but it reads as a claim the data does not support, which is the one thing this site does not do. The clause is now gated on the direct opponent actually appearing in that candidate's `beats` or `losesTo`.

**Task 5 — the dangerous line got a test after all.** The plan accepted that the `recommendation_sessions` insert could not be covered, because the Supabase stub returns `user: null`. Review showed covering it was cheap: stub a signed-in user, capture the insert payload, assert `enemy_picks` is `["zed"]`. It fails with a precise diff if the reshaped objects are passed through. Added.

**Noted, not acted on.** `recommendation_sessions` stores enemy champion ids without their lanes, and stores no ally picks at all. That was already true before this work, and changing it is a migration decision rather than a route-reshape one. Anyone later trying to reconstruct a draft from that table should know it is a lossy summary.

**Task 8 — `bg-paper/70` was inert, as suspected, and the fix belongs on the button.** Confirmed with a Tailwind CLI probe against this project's own config: an opacity modifier on a bare `var(--x)` token emits no rule at all, silently. The arbitrary value `bg-[color-mix(in_srgb,var(--paper)_70%,transparent)]` does emit, and keeps the tint on the element the design put it on. This trap recurred in Task 10 and was handled the same way.

**Task 8 — the plan shipped an "adc" bug.** `anchorLabel`'s your-lane branch interpolated the raw role key while every other branch used `ROLE_LABELS`, so an ADC player read "Votre lane, adc". Fixed before Task 11 could bake the string into more tests, with a test on the one role whose label is not merely its id capitalised.

**Task 11 — the plan's own tests were unrunnable.** `RiftMap` and `DraftSlot` deliberately give the same slot the same accessible name, so that a keyboard user gets the same product from the columns that a mouse user gets from the map. The moment the board renders both, `getByRole("button", { name: "Top adverse, vide" })` matches two elements and throws. Rather than rename the buttons — the matching names are the feature — the columns, the map and the results panel each became a labelled `role="group"`, and the ambiguous queries are scoped with `within()`.

A third collision surfaced only once the tests ran: the recommended champion's name appears both in your own lane's slot and in the `Verdict` header, so `getByText("Galio")` was ambiguous too. Same remedy.

**Task 11 — the excluded-ids wiring was correct but unpinned.** `excludedChampionIds` had unit tests and `ChampionPicker` had unit tests, but nothing exercised the line connecting them. Dropping it would have left every test green while the board offered to recommend a champion already standing on the map. Now covered end to end.

**`npm run lint` does not run in this repository.** There is no ESLint config, so `next lint` drops into its interactive setup wizard — which a non-interactive agent cannot answer and must not answer on the user's behalf. Task 15's verification step should skip it, or the project should configure ESLint first. Not done here; that is a decision for the repository owner.

**Task 12 — the board had never actually been looked at.** There is no `.env.local` in this checkout, so `/` renders its degraded state and the board never appears. Rather than sign off three visual tasks blind, a throwaway harness at `src/app/board-preview/page.tsx` fed the board fixtures. It was kept untracked for the duration and deleted in Task 15. Seeing it rendered immediately caught two things no test could: the lane-claim control sat as a row of its own under each ally slot, so five lanes read as ten and the column ran taller than the map beside it; and the "+" on an empty map anchor was too faint to read as an invitation.

**Task 13 — the plan's `pin-ping` wiring was wrong twice over.** It used `ring-current`, which inherits a colour the button never sets, and it claimed the button needed `position: relative` — but the button is already `position: absolute`, any positioned element establishes a containing block, and adding `relative` alongside `absolute` would have silently overridden the anchor's own map positioning, since Tailwind emits `.relative` after `.absolute`.

**Task 13 — the landing animation would never have replayed on the one anchor that changes most.** The plan keyed the anchor on `championId`, but your own lane's `championId` is always `null` by design: its occupant is the recommendation, not a stored pick. Keyed that way the animation fired for every manually placed pick and never for a changed recommendation. Now keyed on the actual occupant.

**Task 14 — the measured flight was dropped, deliberately.** The plan called for a FLIP: measure the alternative card and the lane anchor, then animate a transform. But the anchor is keyed by occupant, so a changed preview unmounts and remounts it — a CSS transition has no "from" value to interpolate from on a node that was just created, and the code would have been inert. The honest simpler thing ships instead: the portrait swaps and the existing landing animation replays, which is the substance of the effect. Requirement unchanged — hover *and* keyboard focus both preview, the preview never mutates the draft and never fires a request, and reduced motion collapses it to an instant swap.

**Task 15 — a sequencing mistake worth remembering.** Running `npm run build` while `next dev` is serving the same checkout clobbers `.next`, and the dev server then serves blank pages with `Cannot find module './331.js'`. It looks exactly like a catastrophic regression and is nothing of the sort. Stop the dev server, clear `.next`, and rebuild.

---

## Integration with a moved `main`

`main` gained 18 commits while this branch was being built, and three of them cut against the spec's own premises. Recorded here because anyone reading the spec afterwards will otherwise wonder why the shipped code does not match it.

**The dark scope is gone.** The spec's central visual decision — a dark band for the board inside a light page — existed because the Riot minimap is dark and the site was warm paper. `main` switched the whole site to a Hextech palette: deep navy grounds, gold accent, parchment ink. The board's reason for its own scope disappeared with that, so `[data-surface="draft"]` was removed and the board simply inherits the page's tokens. Its gold accent was already within a shade of the site's. Only `--team-ally` and `--team-enemy` had to be re-picked: stock blue and red sink into navy, so they were lifted to `#4f9bf5` and `#e05a4a`.

**The board lives at `/draft`, not `/`.** `main` rebuilt `/` as a sectioned home page and moved the tool to its own route. The spec assumed the opposite and had `/draft` redirecting to `/`. The board went where the tool now lives.

**The alternatives list is shared with a read-only surface.** `main`'s home page renders `Alternatives` beside a panel labelled "Lecture seule". Task 14 had made those cards buttons with required handlers, which would have put pressable controls on a sample with nothing to press. `onPreview` and `onSelect` are optional now; without them the cards render as plain elements. A button that does nothing is worse than no button.

**The loader moved.** `main` extracted the example query into `src/lib/draft/load-example.ts`, shared by both routes. The enemy lanes, the drafting role and `topN: 4` were ported into it.

The merge itself touched four overlapping files: `src/app/page.tsx`, `src/app/globals.css`, `tailwind.config.ts`, and `src/components/draft/role-selector.tsx` (which this branch deleted and `main` still used — its `ROLES` consumer was repointed at `@/lib/draft/roles`).
