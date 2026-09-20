# DraftForMe Draft Board Design

Date: 2026-09-20

## Summary

The draft tool on `/` is replaced by a draft board: your team down the left, the enemy team down the right, and Summoner's Rift in the middle with every pick standing on its lane. The recommendation appears on your own lane rather than only in a panel underneath.

The board is dark. It occupies a full-width band inside the otherwise light page.

Two behavioural changes come with it. Enemy picks carry a role, and the champion facing you on your lane weighs double in the matchup term. Allied picks can be placed, and their only effect is to remove those champions from the candidate list.

## Current Context

`/` renders `DraftTool`, a client component holding role, enemy picks, priority and results. Its inputs are a five-button role selector and a text search that appends champion ids to a flat `enemyPicks: string[]`. The result is a dossier on the top pick plus two alternatives.

The engine (`src/lib/recommendation/engine.ts`) blends three terms — meta, player pool, counter — with weights from `computeWeights`. `scoreCounter` (`src/lib/recommendation/counter.ts`) takes the plain average of a per-enemy verdict drawn from the seeded `counter_relations`.

### Problems this rework addresses

In the user's framing: the tool is not attractive enough, and not intuitive enough. Concretely:

1. **It reads as a form.** A role radio group and a search field. Nothing on screen resembles the moment it serves, which is champion select.
2. **Enemy picks are position-less.** The board's central claim — "this is your lane opponent" — cannot be made, because the engine only receives a bag of champion ids.
3. **Nothing moves.** State changes land instantly and silently, so it is not visible that a recalculation happened.

### Constraints found in the code

- **`scoreCounter` already buckets relations by the *candidate's* role.** A Darius placed against a mid candidate finds no relation in the `mid` bucket and scores neutral. Cross-lane enemies therefore already contribute close to nothing; giving enemies a role makes that honest rather than accidental.
- **`playerPool` is empty for every visitor.** `src/app/auth/login/route.ts` is a stub, so `computeWeights` fixes meta at 0.95 and the priority slider is replaced by `PriorityUnavailable`. That stays true here; the board does not change it.
- **`DraftTool` holds two non-obvious guards** that must survive the rewrite: a monotonic request id so only the newest response writes state, and a 250 ms debounce on the priority slider. Both have tests today (`draft-tool.requests.test.tsx`).
- **No synergy data exists anywhere in the repo.** Not in `data/`, not in Supabase, not in the ML artifacts. Any ally-aware scoring would have to be invented.

## Decisions

| Question | Decision |
|---|---|
| Central element | The official Riot minimap (Data Dragon `map11.png`), unmodified |
| Palette | The whole tool goes dark; the rest of the page stays light |
| Ally slots | Placeable, displayed, and excluded from candidates — no effect on scoring |
| Enemy roles | Placed on a lane, and the direct lane opponent weighs double |
| Placing a champion | Click a lane or a slot, a picker opens over the board |
| Motion | Pick landing, verdict recomposition, recalculation sweep, entry stagger, alternative preview |
| Bans | Out of scope |
| Responsive | Out of scope |

### Why these choices

- **The official minimap, not a redrawn one.** A hand-drawn Rift in the site palette was mocked up and rejected: it loses the instant recognition that makes the board work at a glance. The project already renders Riot champion art from Data Dragon, so the asset class is not new.
- **Dark tool, light page.** The minimap is dark. Sitting it on warm paper puts a hole in the page. Rather than fight the asset, the tool commits to a dark band; the surrounding page is untouched in this spec.
- **Allies display only.** Scoring allies would mean inventing rules (engage, AD/AP balance, frontline) or fabricating synergy numbers. Both contradict the site's standing rule that every figure on screen comes from real data. Exclusion is a real, useful effect that needs no new data.
- **The direct opponent weighs double.** This is a modelling choice, not a measurement — nothing in the data says the lane duel is worth exactly twice a cross-lane matchup. It is therefore stated in the matchup factor's own text on screen, in the same register as the site's other honesty notes.

## Goals

- The tool looks like champion select and is understood without instructions.
- Placing an enemy on your lane visibly changes the recommendation more than placing one elsewhere.
- Nothing displayed is fabricated, and every modelling assumption is stated on screen.
- No component file large enough that it cannot be held in context and tested on its own.
- The draft state is testable without a browser.

## Non-Goals

- Bans. The engine accepts `bans` and will keep doing so; no UI exposes them.
- Responsive and mobile layout. Still out of scope, as in the previous rework.
- Any change to `metaScore`, `playerScore` or `computeWeights`.
- Any change to the light palette of the hero, explainer, trust bar or footer.
- Authentication, the player pool, and therefore the priority slider's availability.
- Sharing a draft by URL. Considered and deferred; see Deferred.
- Any change to `ml/`.

## Layout

A full-width dark band inside the page, containing one board:

```
┌──────────────────────────────────────────────────────────────┐
│  YOUR TEAM          ┌────────────────┐           ENEMY       │
│  ┌───────────┐      │                │      ┌───────────┐    │
│  │ Top       │      │   Summoner's   │      │ Top       │    │
│  │ Jungle    │      │      Rift      │      │ Jungle    │    │
│  │ Mid · you │      │  with 10 pins  │      │ Mid       │    │
│  │ ADC       │      │                │      │ ADC       │    │
│  │ Support   │      └────────────────┘      │ Support   │    │
│  └───────────┘                              └───────────┘    │
│                                                              │
│  ┌────────────────── the top pick's dossier ──────────────┐  │
│  └────────────────────────────────────────────────────────┘  │
│  [ alternative ]  [ alternative ]  [ alternative ]           │
└──────────────────────────────────────────────────────────────┘
```

Two rules that make the board more than decoration:

- **Your role is chosen on the board.** Each allied slot carries a small "you" marker; exactly one is active. It defaults to the pre-filled example's role (`mid`), so the page still arrives already solved.
- **Your slot is not an input.** It is where the recommendation appears — the recommended champion stands on your lane, on the map, ringed in the accent colour. Clicking an alternative projects it there instead.

## Component Architecture

Removed: `draft-tool.tsx`, `enemy-picks.tsx`, `role-selector.tsx`.

```
src/lib/draft/draft-state.ts              state, reducer, selectors. No React.
src/components/draft/draft-board.tsx      the only stateful component
src/components/draft/rift-map.tsx         the map and its ten anchors
src/components/draft/draft-slot.tsx       one slot, used by both columns
src/components/draft/champion-picker.tsx  search and grid, opened over the board
```

Unchanged in behaviour, restyled only: `verdict.tsx`, `alternatives.tsx`, `factor-bars.tsx`, `priority-control.tsx`, `refine-prompt.tsx`, `ui/champion-avatar.tsx`, `ui/score.tsx`. `ui/chip.tsx` loses its only consumer with `enemy-picks.tsx` and is deleted.

### Interfaces

- `draft-board.tsx` takes `{ champions, initialDraft, initialRecommendations }`. It owns the reducer and the fetch, and carries over the request-id guard and the slider debounce verbatim.
- `rift-map.tsx` takes `{ slots, activeSlot, recommended, preview, onSlotClick }` and renders. It holds the lane coordinate table and nothing else.
- `draft-slot.tsx` takes one slot and emits click/clear. Same component for both sides, mirrored by a `side` prop.
- `champion-picker.tsx` takes `{ champions, excludedIds, target, onPick, onClose }`. It holds only its query string.

## Draft State

```ts
type Role = "top" | "jungle" | "mid" | "adc" | "support";
type Side = "ally" | "enemy";

type DraftState = {
  yourRole: Role;
  ally: Record<Role, string | null>;    // champion ids
  enemy: Record<Role, string | null>;
  priority: number;
  picker: { side: Side; role: Role } | null;
};
```

Actions: `placeChampion(side, role, championId)`, `clearSlot(side, role)`, `setYourRole(role)`, `setPriority(n)`, `openPicker(side, role)`, `closePicker()`.

Invariants, each with a test:

- `ally[yourRole]` is always `null`. `placeChampion("ally", yourRole, …)` is a no-op; the reducer does not silently accept a value the UI will never show.
- `setYourRole` clears the incoming slot and leaves the outgoing one empty. Moving from mid to top does not leave a stale champion on mid.
- A champion already placed anywhere cannot be placed a second time; the picker filters it out, and the reducer rejects it as a second guard.

Selectors, which are the whole API surface the network call consumes:

- `excludedChampionIds(state)` — every placed champion, both sides.
- `enemyPicksWithRoles(state)` — `{ championId, role }[]`.
- `directOpponent(state)` — `enemy[yourRole] ?? null`.

A recalculation is requested when a champion is placed or cleared, when `yourRole` changes, and — debounced — when `priority` changes. Opening or closing the picker requests nothing.

## API and Engine Changes

### Request schema

`src/app/api/recommend/schema.ts`:

```ts
enemyPicks: z.array(z.object({ championId: z.string().min(1), role: roleEnum })).default([])
allyPicks:  z.array(z.string().min(1)).default([])
```

`enemyPicks` changes shape; `allyPicks` is new. Ally *roles* are deliberately not sent: exclusion needs only ids, and sending more would imply the engine uses more than it does.

`role`, `region`, `tier`, `bans`, `priority` and `topN` are unchanged.

### Route

`src/app/api/recommend/route.ts` passes `alreadyPickedChampionIds` as the union of ally ids and enemy ids, instead of the enemy picks alone. The `recommendation_sessions` insert keeps writing `enemy_picks` as an array of champion ids, extracted from the new shape, so the existing column type still holds.

### Engine

`RecommendInput.enemyPicks` becomes `{ championId; role }[]`, and a new `draftingRole` field carries the role being drafted for. The engine has no `role` field today — candidates all share one by construction — so this is an addition, not a rename.

`scoreCounter` takes a weighted average instead of a plain one: the enemy whose role equals `draftingRole` counts 2, every other enemy counts 1. With no enemy on that lane, every weight is 1 and the behaviour is identical to today's. The per-enemy verdict itself (counters / is countered / neither) is unchanged, as are the bonus and penalty magnitudes.

`counterDetail` names the direct opponent first when there is one, so the sentence matches what the board emphasises.

The matchup factor's `detail` states the weighting in plain language when a direct opponent is present, for example: *"Syndra, votre adversaire direct, compte double dans ce calcul."* This is the on-screen disclosure of the modelling assumption.

Nothing else in the engine changes.

### The pre-filled example

`src/lib/draft/default-example.ts` currently exports `enemyPicks: ["zed", "caitlyn"]`, a flat list. The board needs lanes, so it becomes:

```ts
enemyPicks: [
  { championId: "zed", role: "mid" },
  { championId: "caitlyn", role: "adc" }
]
```

`src/app/page.tsx` builds `initialDraft` from it and keeps calling `recommendChampions` directly, so `/` still arrives already solved and server-rendered.

`default-example.test.ts` today asserts those ids exist in the seeded `mid` stats. It gains an assertion that each pick's role is one of the five, and that the example's own `role` has an enemy facing it — otherwise the pre-filled board would silently demonstrate the flat-weighting path rather than the feature this spec adds.

## Visual Direction

The board redeclares **the same token names** the site already uses, scoped to `[data-surface="draft"]`, with dark values. `Verdict`, `FactorBars` and `Alternatives` therefore invert without a single class being touched, and the tokens still have one definition point.

| Token | Light (page) | Dark (board) |
|---|---|---|
| `--paper` | `#f7f4ef` | `#0c1013` |
| `--surface` | `#ffffff` | `#141c22` |
| `--surface-sunk` | `#f2efe9` | `#0f161b` |
| `--ink` | `#14171a` | `#f3f0ea` |
| `--ink-muted` | `#5e574c` | `#aab3ba` |
| `--ink-faint` | `#8a8378` | `#7d8993` |
| `--rule` | `#e0dbd2` | `#232c33` |
| `--rule-soft` | `#efece6` | `#1b232a` |
| `--accent` | `#0f766e` | `#e3c179` |
| `--accent-wash` | `#f2faf8` | `rgba(200,167,90,.14)` |

Two new tokens, defined in both scopes: `--team-ally` (`#1d4ed8` light, `#2f6fd0` dark) and `--team-enemy` (`#b91c1c` light, `#c0392b` dark). `tailwind.config.ts` maps them as `team-ally` and `team-enemy`.

The map asset is copied into `public/map/rift.png` from Data Dragon at the version the project already pins, rather than hotlinked. Anchors are positioned against the frame, not the image, so a missing asset costs the background and nothing else.

`public/riot.txt`, currently untracked, is committed alongside it.

## Motion

Durations and curves are tokens in `globals.css`: `--motion-fast` 140 ms, `--motion` 240 ms, `--motion-slow` 380 ms, plus an ease-out and a slight overshoot curve. No timing literals in components.

| Animation | Trigger | Implementation |
|---|---|---|
| Pick lands | An anchor mounts (keyed by champion id) | CSS only: scale-in plus one expanding ring, drawn as a pseudo-element so it never intercepts clicks |
| Verdict recomposes | The recommendation changes | Cross-fade on name and sentence, width transition on the factor bars |
| Recalculation sweep | `isLoading`, already held by the board | The board desaturates and a highlight sweeps across it; the previous result stays readable underneath, which is already the site's rule |
| Entry stagger | First paint | 40 ms per slot, 250 ms total, `animation-fill-mode: backwards` so the resting state is the visible one and a CSS failure cannot leave the board blank |
| Alternative preview | Hover **or keyboard focus** on an alternative | The only one needing JS: measure start and end rects on enter, then a CSS transform. It is a preview — it does not mutate the draft and fires no request. Clicking, in contrast, really projects that champion onto your lane |

Under `prefers-reduced-motion: reduce`, every animation is disabled and final states render directly; the alternative preview degrades to an instant portrait swap with no travel.

## Accessibility

- The map is a convenience layer, not the only path. Every anchor is a real `<button>` whose accessible name matches the corresponding slot in the column ("Mid adverse, vide", "Top adverse : Darius"), and both trigger the same action. The full draft can be built from the columns alone, without pointing at an image.
- The picker keeps the `combobox` pattern already used by today's search, including matching on champion **id** as well as name so "kaisa" finds Kai'Sa. `Escape` closes, `Enter` takes the first result, and focus returns to the originating slot.
- The alternative preview responds to focus as well as hover, so it is not mouse-only.
- Colour is never the only carrier of side: each slot is labelled with its team and role in text.

## Error and Degraded States

Unchanged from today, and inherited rather than rewritten:

| Condition | Behaviour |
|---|---|
| `/api/recommend` fails | The previous result stays on screen under an error line. The board is never emptied. |
| No stats for the selected role | Explicit message naming the role. |
| Supabase unreachable at render | The existing degraded state on `/`. |
| `rift.png` missing | The frame renders dark and empty; anchors, slots and scoring are unaffected. |
| A placed champion has no counter relation | The existing wording: the matchup could not be assessed. Unchanged. |

## Testing

| Target | Tests |
|---|---|
| `draft-state.ts` | The three invariants above; the three selectors; that `setYourRole` and `placeChampion` produce the expected exclusion set |
| `counter.ts` | Direct opponent counted twice; flat weighting when that lane is empty; unchanged verdicts for the existing cases (the current tests stay green) |
| `draft-board.tsx` | The two existing guards, ported: only the newest response writes state, and the slider coalesces into one request. Plus: placing an enemy sends its role |
| `champion-picker.tsx` | Search matches name and id; already-placed champions are absent; `Escape` closes |
| `rift-map.tsx` | Ten anchors with accessible names distinguishing side, role and occupancy |
| Motion | Only the logic: hover and focus set and clear the preview, the preview fires no request, a click does change state |

Animations themselves are not asserted; jsdom would only be asked to confirm that a class name exists.

Existing suites that must be updated rather than deleted:

- `src/app/api/recommend/route.test.ts` — the request body changes shape.
- `src/lib/recommendation/engine.test.ts` and `counter.test.ts` — `enemyPicks` changes shape; the existing verdict expectations must survive unchanged once the weighting is flat.
- `src/lib/draft/default-example.test.ts` — see above.
- `src/components/draft/draft-tool.test.tsx` and `draft-tool.requests.test.tsx` — ported onto `draft-board.tsx`.

`src/app/draft/page.test.ts` (the redirect to `/`) is unaffected.

## Deferred

- **Draft in the URL.** Serialising the board into query parameters would make a draft shareable and reload-proof. Real value, but its own encoding and failure modes; a separate spec.
- **Ally-aware scoring.** Blocked on data that does not exist. If the win-probability model of the match-collection and win-model specs clears its bar, it consumes full drafts — both teams, all roles — which is exactly the shape this board already captures. The board is built to be ready for it and depends on none of it.
- **Bans**, **mobile layout**, and **turning the rest of the page dark**.
