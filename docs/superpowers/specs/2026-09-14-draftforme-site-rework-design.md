# DraftForMe Site Rework Design

Date: 2026-09-14

## Summary

Rework the DraftForMe web surface along three axes: visual direction, front-end code quality, and the user journey. The landing page and the coach workspace merge into a single page where the tool is the first thing on screen, pre-filled with an example and already solved.

The visual direction moves from dark neon to a light editorial style. The recommendation display moves from a three-card summary to an open dossier on the top pick, showing the weighted factors and the real numbers behind them.

The counter relations already sitting unused in `data/tierlist_*.json` are seeded and wired into scoring, so that enemy picks finally reorder the results.

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

**Sample sizes are discarded, and live in a different file from the rows that are seeded.** `scripts/build-seed-data.mjs` seeds `champion_stats` from `data/tierlist_*.json`, whose entries carry `rank`, `slug`, `role`, `win_rate`, `pick_rate`, `ban_rate` and `counters` — but no sample size. `games_played` lives in `data/champion_stats_*.json` (733 028 for Yasuo, for instance), which has no `slug` and no role field, the role being encoded in the filename. Line 49 of the seed script therefore writes `null` into the `games` column. Recovering sample sizes means joining the two files on the normalised champion name.

**Counter relations already exist in the repo, unused.** Every entry in `data/tierlist_*.json` carries a `counters` array of champion slugs: 725 pairs, covering all 242 champions across the five roles, every slug resolving to a real champion in `data/ddragon_champions.json`. The relation is strictly asymmetric (no reciprocal pair). `scripts/build-seed-data.mjs` already reads these files and discards the column.

The direction of the relation was established empirically, because the scraper that produced the files was removed during the repo cleanup:

| Measure | Result |
| --- | --- |
| Listed counters whose win rate exceeds the champion listing them | 65.0% (460/708) |
| Random same-role baseline | 49.9% (σ = 1.5) |
| Listed counters better *ranked* in the meta than the champion | 49.0% — chance |

At roughly ten standard deviations above baseline, `counters[X]` means *the champions that beat X*. The meta-rank result is what makes this conclusive: if the field simply listed strong patch champions, they would also be better ranked. They are not. They are better specifically against the champion that lists them, which is a genuine matchup signal.

**There are no per-pair win rates.** The data is a relation, not a percentage, so `counterScore` is reworked to consume the relation directly rather than being fed a fabricated win rate.

**No true matchup win-rate source exists.** Not in `data/`, and not in the ML model: the feature list in `ml/artifacts/champion_recommender_metadata.json` includes `enemy_pick_count`, a count, but no feature identifying which champions the enemy picked. Sourcing real per-pair win rates stays deferred to a separate spec.

## Goals

- The visitor understands what the product does and sees a real result without taking any action.
- Every number on screen comes from real data. Nothing is fabricated to fill a layout.
- Adding an enemy pick visibly changes the recommendation.
- One definition of the design tokens, consumed through Tailwind.
- No component file large enough that it cannot be held in context and tested on its own.

## Non-Goals

- Responsive and mobile layout.
- Sourcing or scraping per-pair matchup win rates. Seeding the existing counter relations is in scope; obtaining real win-rate percentages is not.
- Changing `computeWeights`, `metaScore`, or `playerScore`. `counterScore` is rewritten, and is the only scoring change in this spec.
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

1. **Carry sample sizes through the seed.** `scripts/build-seed-data.mjs` joins `data/champion_stats_<region>_<tier>_<role>.json` onto the `tierlist` rows it already reads, matching on the champion id derived from the name through the existing `championIdFromName`, and writes `games_played` into the `games` column instead of `null`. Champions absent from the stats file keep `null`, and the dossier omits the row rather than showing a zero.
2. **Carry champion facts through to the client.** `Recommendation` in `src/lib/recommendation/types.ts` gains `rank`, `winRate`, `pickRate`, `banRate`, and `games`, populated by `recommendChampions` from the `ChampionStats` row it already holds. Without this the dossier has nothing to show.
3. **Seed the counter relations.** A new table `counter_relations (champion_id, countered_by_champion_id, role, source)` is added by migration, and `scripts/build-seed-data.mjs` fills it from the `counters` arrays it currently discards.

   The table is deliberately *not* `matchups`. `matchups` is keyed for per-pair win rates, which this data does not have, and its column names do not encode direction. An explicit `countered_by_champion_id` makes the direction unmistakable at every call site, which is the main long-term risk: reading the relation backwards would make the product recommend the opposite of what it should.

4. **Rework `counterScore` to consume the relation.** It takes `counterRelations` instead of `matchups`. For a candidate `C` against enemy pick `E`:

   - `C` counters `E` → bonus
   - `E` counters `C` → penalty
   - neither → neutral

   The per-enemy results are averaged and mapped onto the existing 0–100 range, so `computeWeights` and the blending are untouched. No fabricated win rate is introduced anywhere.

5. **Mark the counter factor unavailable when it has nothing to say.** `RecommendationFactor` gains `available: boolean`. The counter factor is `available: false` when there are no enemy picks, or when no relation is known for any of them. `factor-bars.tsx` renders only available factors; `verdict.tsx` states plainly when the matchup could not be assessed, rather than showing a neutral bar that looks like a measurement.

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

- `engine.test.ts` — a candidate that counters an enemy pick outranks an otherwise identical candidate that does not; a candidate countered *by* an enemy pick ranks below it; the counter factor is `available: false` with no enemy picks and with unknown enemies, `available: true` when a relation exists; `rank`, `winRate`, `games` are carried into the `Recommendation`.
- `counter-relations.test.ts` — a direction guard. Asserts against known lane matchups drawn from the seeded data that the champion listed in `countered_by_champion_id` is the one that wins the lane. This test exists specifically to fail loudly if the relation is ever loaded backwards.
- `draft-tool.test.tsx` — the default example renders resolved on first paint with no fetch; changing role triggers a request; a failed request keeps the previous result visible and shows a banner.
- `verdict.test.tsx` — displayed weights sum to 100%; a null champion fact renders no row rather than `0`; only available factors render.
- `alternatives.test.tsx` — exactly two alternatives render.
- A redirect test for `/draft` → `/`.
- `build-seed-data` — generated SQL carries `games_played` into the `games` column, and emits one `counter_relations` row per `counters` entry with the champion and its counter in the correct columns.

## Risks

- **The counter relation's direction rests on statistical inference, not documentation.** The evidence is strong (65.0% versus a 49.9% baseline at σ = 1.5, with meta rank at chance), but the source scraper is gone and no upstream documentation confirms it. Reading it backwards would invert the product's advice. This is why the column is named `countered_by_champion_id` and why the direction is asserted by a dedicated test against known lane matchups.
- **Counter coverage is sparse.** Roughly three counters per champion, so most enemy picks yield no relation and the factor is correctly marked unavailable. The dossier must read as deliberate in that case, not broken.
- **Removing `src/components/coach/` is a wide change.** It is a rewrite of the tool surface, not a refactor. The recommendation engine, API routes, and schemas are untouched, which bounds the blast radius to presentation.
- **The light palette is a sharp departure.** It is the deliberate answer to "too generic", but it is the decision most likely to be revisited after seeing it at full scale rather than in a mockup.

## Follow-Up Work

Out of scope here, and worth their own specs:

1. **Real per-pair win rates.** The counter relations seeded here are a binary signal covering roughly three opponents per champion. A true matchup win-rate source would replace the bonus/penalty mapping with measured percentages, fill the `matchups` table that already exists in the schema, and let the dossier show a per-matchup table.
2. **Responsive and mobile layout.** Deliberately deferred by the user. The Tailwind migration in this spec is what makes it tractable.
