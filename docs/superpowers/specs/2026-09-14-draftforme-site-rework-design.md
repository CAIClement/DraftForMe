# DraftForMe Site Rework Design

Date: 2026-09-14

## Summary

Rework the DraftForMe web surface along three axes: visual direction, front-end code quality, and the user journey. The landing page and the coach workspace merge into a single page where the tool is the first thing on screen, pre-filled with an example and already solved.

The visual direction moves from dark neon to a light editorial style. The recommendation display moves from a three-card summary to an open dossier on the top pick, showing the weighted factors and the real numbers behind them.

Responsive and mobile layout are explicitly out of scope for this spec.

## Current Context

The app is Next.js App Router with Supabase and a TypeScript recommendation engine.

Two surfaces exist:

- `src/app/page.tsx` — marketing landing, 838 lines in one file, including hand-written SVG champion silhouettes, role icons, and a hex grid pattern.
- `src/app/draft/page.tsx` → `src/components/coach/coach-workspace.tsx` (239 lines) → `src/components/coach/decision-space.tsx` (582 lines) — the tool, behind a form.

Styling is inline `style={{}}` objects throughout. A token object named `C` is copy-pasted into three files. Tailwind is installed and configured, but its palette (`ink`, `panel`, `line`, `gold`, `teal`, `danger`) matches nothing that renders; the code uses a different palette (`jade`, `cyan`, `gold`) defined in the duplicated `C` objects.

### Problems this rework addresses

Three problems, in the user's own framing:

1. **Not credible.** The site does not convey that real data and real computation sit behind it.
2. **Too generic.** Dark mode plus a neon accent reads as any SaaS product, with no identity of its own.
3. **Unclear what to do.** A visitor lands and does not know where to start or what they will get.

### Data-layer findings

Tracing the data path surfaced issues that constrain what the redesign can honestly display.

**Enemy picks currently have no effect on the ranking.** The `matchups` table exists in `supabase/migrations/0001_initial_schema.sql` and `recommendChampions` accepts `input.matchups`, but the table is never seeded (`supabase/seed.sql` inserts only `champions` and `champion_stats`) and `src/app/api/recommend/route.ts` never queries it. With `matchups = []`, `counterScore` finds no matchup for any candidate, averages `0`, and returns `clamp(50 + 0)` = `50` — the same constant for every champion. Because the counter term is constant across candidates, it cannot reorder them. The only real effect of adding an enemy pick is that the champion is excluded from the candidate list through `alreadyPickedChampionIds`.

**Sample sizes are discarded.** `games_played` is present in the source JSON (for example 733 028 for Yasuo in `data/champion_stats_euw_emerald_plus_mid.json`), but `scripts/build-seed-data.mjs:49` writes `null` into the `games` column.

**No matchup data exists anywhere in the project.** Not in `data/`, and not in the ML model: the feature list in `ml/artifacts/champion_recommender_metadata.json` includes `enemy_pick_count`, a count, but no feature identifying which champions the enemy picked.

Sourcing matchup data is deliberately deferred to a separate spec. This spec displays only what the data can support.

## Goals

- The visitor understands what the product does and sees a real result without taking any action.
- Every number on screen comes from real data. Nothing is fabricated to fill a layout.
- One definition of the design tokens, consumed through Tailwind.
- No component file large enough that it cannot be held in context and tested on its own.

## Non-Goals

- Responsive and mobile layout.
- Sourcing, scraping, or seeding matchup win rates.
- Changing the scoring formula in `computeWeights`, `metaScore`, or `playerScore`.
- Authentication flow changes. `src/app/auth/*` is untouched.
- Any change to `ml/`.

## Visual Direction

Light editorial. Warm off-white ground, near-black text, a single accent, generous space, heavy tight-tracked display type for headings, and fine-ruled cards.

The reasoning: every competing League of Legends tool is dark. A light surface is the cheapest way to stop looking generic, and it makes dense numeric content more legible, which serves the credibility goal at the same time.

Tokens, defined once as custom properties:

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#f7f4ef` | page ground |
| `--surface` | `#ffffff` | cards, the tool |
| `--surface-sunk` | `#f2efe9` | secondary blocks |
| `--ink` | `#14171a` | primary text, trust bar ground |
| `--ink-muted` | `#5e574c` | body copy |
| `--ink-faint` | `#8a8378` | labels, metadata |
| `--rule` | `#e0dbd2` | borders |
| `--rule-soft` | `#efece6` | internal separators |
| `--accent` | `#0f766e` | selection, scores, emphasis |
| `--accent-wash` | `#f2faf8` | the top pick's ground |

No dark mode in this spec. The page commits to the light palette and paints `body` explicitly.

## Page Structure

A single page at `/`. `src/app/draft/page.tsx` becomes a redirect to `/`.

1. **Header** — wordmark, a link to the explainer section, and the data context (`Patch 16.10 · EUW · Emerald+`) as quiet metadata rather than a badge.
2. **Promise** — one heading, one sentence. Short, because the tool is directly underneath.
3. **The tool, pre-filled and already solved.** Role selector with `mid` selected, two enemy picks present, and the resulting dossier rendered. The visitor sees the output before interacting with anything.
4. **The dossier of the top pick**, expanded: weighted factors, the champion's real numbers, and the prose explanation.
5. **The two alternatives**, collapsed to one line each.
6. **Refine with your pool** — an optional affordance offering to weight results against the player's own champion pool.
7. **Explainer** — three short columns: what is measured, why three options, who it is for. Placed *after* the tool, not before it.
8. **Trust bar** — indexed games, patch, region and tier, last update. Real figures, on the dark ink ground.
9. **Footer.**

### Journey changes

- **Riot ID leaves the critical path.** Today it is the first field in the sidebar. It becomes an optional refinement offered *after* a result exists.
- **The "meta priority" slider leaves the input.** Today the user is asked to set a weight before knowing what it does. Instead the computed weights are *displayed* in the dossier. The control that sets `priority` moves into the dossier, next to the weights it changes, so it is only reachable once a result exists. It is the same `priority` value the API already takes; no scoring change.

### Removals

- The `LIVE BETA / v2026.05.17 / 5 ROLES INDEXED / OPERATIONAL` status bar. It is decoration shaped like data, which works directly against the credibility goal.
- The hand-drawn SVG champion silhouettes, role icons, and hex grid (roughly 250 lines), replaced by real Data Dragon champion art.
- The separate `/draft` page, which becomes a redirect to `/`.

## Component Architecture

One responsibility per file.

```
src/app/page.tsx                        assembles sections, resolves the default example
src/app/draft/page.tsx                  redirect("/")

src/components/draft/draft-tool.tsx     client component, owns the interactive state
src/components/draft/role-selector.tsx
src/components/draft/enemy-picks.tsx    chips plus champion search
src/components/draft/verdict.tsx        the expanded dossier for the top pick
src/components/draft/factor-bars.tsx    weighted factor rows
src/components/draft/alternatives.tsx   the two collapsed picks
src/components/draft/refine-prompt.tsx  the optional Riot ID affordance

src/components/marketing/hero.tsx
src/components/marketing/explainer.tsx
src/components/marketing/trust-bar.tsx
src/components/marketing/site-header.tsx
src/components/marketing/site-footer.tsx

src/components/ui/chip.tsx
src/components/ui/champion-avatar.tsx
src/components/ui/score.tsx
```

`src/components/coach/` is removed. `champion-picker.tsx` is superseded by `enemy-picks.tsx`; `recommendation-card.tsx` and `decision-space.tsx` are superseded by `verdict.tsx` plus `alternatives.tsx`.

### Interfaces

- `draft-tool.tsx` takes `{ champions, initialRole, initialEnemyPicks, initialRecommendations }` and owns role, enemy picks, results, loading, and error state. It is the only stateful component.
- `verdict.tsx` takes a single `Recommendation` and renders it. No fetching, no state.
- `factor-bars.tsx` takes `RecommendationFactor[]` and renders only the factors marked available.
- Every `ui/` component is presentational and takes plain props.

## Styling Approach

- `src/app/globals.css` declares the tokens as custom properties on `:root`. Single source of truth.
- `tailwind.config.ts` maps those variables into the Tailwind palette, replacing the current unused `ink`/`panel`/`line`/`gold`/`teal`/`danger` entries.
- Components use Tailwind utility classes. The three duplicated `C` objects are deleted.

This unlocks `:hover`, `:focus-visible`, and media queries, none of which inline styles can express — which is also what makes the deferred responsive work possible later without another rewrite.

## Data Flow

`/` is a Server Component. It resolves the default example by calling `recommendChampions` **directly**, not by fetching its own API route over HTTP. The HTML arrives already populated: no empty flash, and the result is indexable.

Subsequent interaction posts to `/api/recommend`, as today.

The default example lives in one module, `src/lib/draft/default-example.ts`, exporting `{ role: "mid", enemyPicks: ["zed", "caitlyn"] }`. A test asserts those champion ids exist in the seeded `mid` stats, so the example can never render empty without the suite failing.

## Required Data Changes

These are the minimum changes needed for the dossier to display real values rather than blanks.

1. **Carry sample sizes through the seed.** `scripts/build-seed-data.mjs` writes `games_played` from the source JSON into the `games` column instead of `null`.
2. **Carry champion facts through to the client.** `Recommendation` in `src/lib/recommendation/types.ts` gains `rank`, `winRate`, `pickRate`, `banRate`, and `games`, populated by `recommendChampions` from the `ChampionStats` row it already holds. Without this the dossier has nothing to show.
3. **Mark the counter factor unavailable.** `RecommendationFactor` gains `available: boolean`. `recommendChampions` sets `available: false` on the counter factor when `input.matchups` is empty or incomplete for the current enemy picks — the condition `hasCompleteMatchupData` already computes.

On point 3, `factor-bars.tsx` renders only available factors, and `verdict.tsx` renders one honest line stating that the matchup is not yet part of the score. A fabricated "Counter 50" bar inside a dossier whose entire purpose is to demonstrate rigour would undercut the goal it exists to serve. The scoring formula itself is unchanged; only the display is affected.

## Error and Empty States

| Condition | Behaviour |
| --- | --- |
| No stats for the selected role | Explicit message naming the role. Not a blank panel. |
| `/api/recommend` fails | The previous result **stays on screen** with an error banner above it. The screen is never emptied. |
| Supabase unreachable at render | Visible degraded state. Replaces the silent `catch {}` in `src/app/draft/page.tsx`. |
| Data Dragon image fails | Initials fallback, as `decision-space.tsx` already does. |
| A champion fact is null | The row is omitted. Never rendered as `0` or `—%`. |

## Testing

Vitest plus Testing Library, already configured.

Existing tests to carry over or adapt: `src/lib/recommendation/engine.test.ts`, `src/lib/data/normalize.test.ts`, both API route tests. `src/components/coach/coach-workspace.test.tsx` is replaced by `draft-tool.test.tsx`.

New coverage:

- `engine.test.ts` — the counter factor is `available: false` when `matchups` is empty; it is `available: true` when complete matchups are supplied; `rank`, `winRate`, `games` are carried into the `Recommendation`.
- `draft-tool.test.tsx` — the default example renders resolved on first paint with no fetch; changing role triggers a request; a failed request keeps the previous result visible and shows a banner.
- `verdict.test.tsx` — displayed weights sum to 100%; a null champion fact renders no row rather than `0`; only available factors render.
- `alternatives.test.tsx` — exactly two alternatives render.
- A redirect test for `/draft` → `/`.
- `build-seed-data` — generated SQL carries `games_played` into the `games` column.

## Risks

- **The dossier is more honest than the current UI, and shows less.** Hiding the counter factor makes visible that the matchup is not yet scored. This is intentional: the alternative is a fabricated number in the one place meant to prove rigour.
- **Removing `src/components/coach/` is a wide change.** It is a rewrite of the tool surface, not a refactor. The recommendation engine, API routes, and schemas are untouched, which bounds the blast radius to presentation.
- **The light palette is a sharp departure.** It is the deliberate answer to "too generic", but it is the decision most likely to be revisited after seeing it at full scale rather than in a mockup.

## Follow-Up Work

Out of scope here, and worth their own specs:

1. **Matchup data source.** Populate the `matchups` table and query it in `/api/recommend`, so enemy picks actually influence the ranking. This is the largest outstanding gap between the product's promise and its behaviour.
2. **Responsive and mobile layout.** Deliberately deferred by the user. The Tailwind migration in this spec is what makes it tractable.
