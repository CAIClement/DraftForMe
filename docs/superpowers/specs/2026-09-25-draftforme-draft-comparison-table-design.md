# DraftForMe Draft Tool Comparison Table Design

Date: 2026-09-25

## Summary

The draft tool (`/draft`) shows every recommendation side by side instead of one big verdict and three thin cards. A comparison table lists the four champions the engine already returns, each column header carries an "i" that explains what it measures, and clicking a row opens that champion's full detail and puts it on your lane on the map.

Around it, the two team columns switch to larger portraits without names, the "Vous ?" text button becomes a player-silhouette icon, and a map bug that left stray rings next to every placed champion is fixed.

The engine, the API, Supabase and the home page are untouched.

## Current Context

- `DraftBoard` (`src/components/draft/draft-board.tsx`) requests `topN: 4`. It renders the first recommendation through `Verdict` (factor bars, facts, counter text, community link) and the other three through `Alternatives`: one card each with name, score, winrate and games. Hovering an alternative previews it on your lane; clicking it promotes it to first place.
- The owner's feedback: there is not enough information, and it looks as if there is only one proposal.
- `Verdict` and `Alternatives` are also rendered on the home page (`src/components/home/hero.tsx`, `src/components/home/signals-section.tsx`).
- `DraftSlot` shows a 34 px portrait, the lane label and the champion's name. Allied lanes other than yours carry a "Vous ?" text button that sets your role.
- `RiftMap` pins carry a circular `ring-2` around a square (`rounded-lg`) portrait, plus a `pin-ping` span. That span is centred only by the `pin-ping` keyframes' `translate(-50%, -50%)` and faded only by their `opacity`. The animation has no fill mode, so when it ends the span falls back to no transform and full opacity. It stays on screen, offset down and to the right by half its size. The owner reported these as "cibles".

## Decisions

| Question | Decision |
|---|---|
| How to show more than one proposal | Comparison table of the four recommendations (owner chose "C" over a podium and an expandable list) |
| What a row click does | Opens that row's detail below it and puts the champion on your lane on the map |
| Where the "i" go | On every column header, not only Matchup |
| How an "i" opens | On click/tap, closes on Escape, outside click or second click. Not hover-only, so it works on touch and keyboard |
| Icon replacing "Vous ?" | Player silhouette (owner chose "A" over a star and a gamepad) |
| Team columns | Portrait only, 48 px, no visible name; role label kept |
| Scope | One branch, table built for `/draft` only; home page keeps `Verdict` and `Alternatives` unchanged |

## The Comparison Table

A new client component, `src/components/draft/comparison-table.tsx`, replaces `Verdict` + `Alternatives` inside `DraftBoard`. `PriorityControl` / `PriorityUnavailable` and `RefinePrompt` stay below it, unchanged.

### Columns

| Column | Content | Source |
|---|---|---|
| (champion) | 40 px portrait; name in a `title` tooltip and in the row's accessible name | `championName`, `championImageUrl` |
| Score | Rounded total | `totalScore` |
| Force dans le patch | Rounded factor score | factor `meta` |
| Matchup | Rounded factor score | factor `counter` |
| Winrate | `52.4 %`, same `toFixed(1)` format as `Verdict` | `winRate` |
| Parties | `12 400` (fr-FR grouping) | `games` |

There is no "Votre pool" column: the player factor is unavailable for every visitor until accounts ship.

**A missing value leaves its cell empty**, never `0`, never a dash (the site's rule, same as `Alternatives`' `Facts`). Concretely: an unavailable factor (`available: false`, e.g. Matchup before any enemy is placed) and a `null` `winRate` or `games` render an empty cell.

### Selection and detail

- The selected row has a gold border and background (`accent`, `accent-wash`). Row 1 is selected on load and after every new server response (see below).
- Directly under the selected row, a detail panel spans the table's width with:
  - the factor bars (`FactorBars`, reused as is, with weights);
  - the facts `Verdict` shows today: winrate rank (`#rank / totalRanked`), pick / ban;
  - the counter text (`counter.detail`) and the "Avis de la communauté" link, under the same conditions as `Verdict` today.

  To avoid copying `Verdict`'s body, its lower part (bars, facts, counter text, link) is extracted into a `VerdictDetail` component that both `Verdict` and the table render. `Verdict`'s output on the home page must stay identical.
- Clicking a row calls `onSelect(championId)`. **The table keeps the server's order**: rows never jump. `DraftBoard` stops reordering `recommendations` and holds a `selectedId` instead, reset to `null` (meaning row 1) whenever a new response arrives. The table receives `selectedId` as a prop. What the map and the "your lane" slot show becomes `previewed ?? selected ?? top`. No new request is made.
- Hover and focus on a row call `onPreview` exactly like `Alternatives` does today (preview on the map, nothing committed), and leaving calls `onPreview(null)`.
- Keyboard and assistive tech: the first cell of each row holds a `<button>` (portrait inside) with accessible name `"<Champion>, score <n>"` and `aria-expanded` for its detail. The `<tr>` also handles `onClick` so a mouse click anywhere on the row works; the button is the only focusable element per row.

### The "i" explanations

Each header has a small button (`aria-label="Qu'est-ce que <colonne> ?"`) that toggles a popover with `role="tooltip"`-style text linked by `aria-describedby`. Only one is open at a time. Escape, a click outside, or a second click closes it. No library.

Texts (French, and true to the engine as of this spec):

- **Score**: « Note sur 100 qui combine la force dans le patch et le matchup, selon les poids affichés dans le détail. Sans pick adverse, seule la force dans le patch compte. »
- **Force dans le patch**: « Place du champion dans le classement au winrate à ce rôle, ramenée sur 100 : le premier a 100, le dernier environ 10. »
- **Matchup**: « Comment ce champion s'en sort face aux picks adverses déjà posés. On part de 50 (neutre) : chaque adversaire qu'il contre fait monter le score, chaque adversaire qui le contre le fait baisser, et votre adversaire direct compte double. Basé sur les relations de counter connues entre champions, pas sur un winrate de matchup. »
- **Winrate**: « Part des parties gagnées par ce champion à ce rôle, dans les données du patch actuel. »
- **Parties**: « Nombre de parties sur lesquelles reposent ces statistiques. »

Sources checked: `metaScore` (`100 - (rank - 1) / total * 90`), `computeWeights` (Matchup weighs 40 % once an enemy is placed, 0 before; the pool gets 5 % without an account), `scoreCounter` (`NEUTRAL = 50`, `EDGE = 35`, `DIRECT_OPPONENT_WEIGHT = 2`). The Score text says "force dans le patch et le matchup" because the pool's 5 % is not assessable for visitors and is not shown; if accounts ship, this text changes with them. If the engine changes, these texts change in the same commit.

### Mobile

The table keeps its columns and scrolls horizontally inside its own `overflow-x-auto` container. The page itself never scrolls horizontally at 375 px.

## The Team Columns

In `DraftSlot`:

- The portrait grows from 34 to **48 px**. The champion's name is no longer rendered as visible text.
- The role label stays, small (`TOP`, `JUNGLE`...). On your lane it reads `MID · VOUS` in gold.
- The name remains available through a `title` tooltip and the unchanged accessible names (`"Retirer Zed"`, `"Top adverse, vide"`), which existing tests rely on.
- An empty slot shows a 48 px square with a `+` instead of the role written inside the square.
- An occupied slot shows it can be removed: on hover/focus the portrait darkens and a cross appears. Its tooltip reads `Retirer <Champion>`.

The "Vous ?" button in `DraftBoard` becomes a 26 px square button with an inline SVG player silhouette (head circle + shoulders, `currentColor`, `aria-hidden`). Its accessible name (`"Jouer top"`) is unchanged, and its `title` repeats it.

The column width goes from `186px` to `170px` in the board's grid template.

All colours go through the existing tokens (`accent`, `accent-wash`, `rule`, `surface`, `ink-*`, `team-ally`, `team-enemy`). A new token is added to `globals.css` only if the darkened-portrait overlay needs one.

## The Map Fix

In `rift-map.tsx` and `globals.css`:

- `.pin-ping` gets its centring from its own classes (`-translate-x-1/2 -translate-y-1/2`) or from a resting `transform` in its rule, and a resting `opacity: 0`. When the animation ends, the ring stays centred and invisible.
- The pin's ring and the ping follow the portrait's shape: `rounded-lg`-like corners instead of `rounded-full`, scaled to the pin size.
- The dashed round anchors for empty lanes are unchanged.
- Reduced motion: the existing global block collapses the animation; with a resting `opacity: 0` the ping simply never shows.

## Testing

Vitest, next to the code:

- `comparison-table.test.tsx`: four rows render; row 1 is selected and its detail shown; clicking row 3 selects it and calls `onSelect`; hover/focus call `onPreview` and leaving calls it with `null`; an unavailable Matchup factor and a `null` winrate leave empty cells (no `0`, no dash); an "i" opens its text and Escape closes it.
- `verdict.test.tsx`: stays green unchanged, proving the `VerdictDetail` extraction leaves `Verdict` as it was.
- `draft-board.test.tsx` / `draft-board.requests.test.tsx`: tests that used the alternatives' `data-testid="alternative"` move to the table's rows; selecting a row puts that champion on your lane on the map, keeps the row order, and makes no extra request; a new response resets the selection to row 1.
- `draft-slot.test.tsx`: the name is not rendered as text but the accessible names are unchanged; the silhouette button keeps `"Jouer <role>"`.
- `rift-map.test.tsx`: the ping carries its centring class.
- `npm run ci` green at every commit.

Manual check in the browser on `npm run dev`: the stray rings are gone after a pick lands, the table's "i" open and close, the row click updates the map, and the page has no horizontal scroll at 375 px.

## Out of Scope

- Home page: `Verdict`, `Alternatives`, `hero.tsx`, `signals-section.tsx` render exactly as before.
- Engine scoring, `/api/recommend`, `load-example.ts` queries, Supabase, seed, `ml/`.
- No new data, no new dependency.
