# Draft Tool Comparison Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/draft`, replace the single verdict + three thin alternative cards with a comparison table of all four recommendations (with an "i" per column), switch the team columns to icon-only portraits with a silhouette "play this lane" button, and fix the stray rings on the map.

**Architecture:** A new `ComparisonTable` client component renders the rows and, under the selected row, a `VerdictDetail` extracted from `Verdict` (so the home page's `Verdict` renders identically). `DraftBoard` stops reordering recommendations and holds a `selectedId` instead. A small `InfoTip` UI primitive provides the click-to-open explanations. The map fix is class-only in `rift-map.tsx`.

**Tech Stack:** Next.js App Router, React client components, Tailwind v3 with colour tokens from `src/app/globals.css`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-25-draftforme-draft-comparison-table-design.md`

**Branch:** `feat/draft-comparison-table` (already created from `main`, spec committed).

**Conventions to respect (CLAUDE.md):** colours only through tokens (no `text-white`, hex or `rgb()` in components); user-facing text in French; a missing number is hidden, never shown as `0` or a dash; tests next to the code; `npm run ci` green at every commit; engine, API, Supabase, seed, `ml/` and the home page untouched.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/components/draft/rift-map.tsx` | Modify | Pin ring and ping follow the portrait's shape; ping centred and invisible at rest |
| `src/components/draft/rift-map.test.tsx` | Modify | Pin the ping's resting classes |
| `src/app/globals.css` | Modify | New `--scrim` token |
| `tailwind.config.ts` | Modify | Map `scrim` colour |
| `src/components/draft/draft-slot.tsx` | Modify | 48 px portrait, no visible name, role tag, remove hint |
| `src/components/draft/draft-slot.test.tsx` | Modify | Name hidden, accessible names unchanged |
| `src/components/draft/draft-board.tsx` | Modify | Silhouette button, column width, `selectedId`, table instead of `Verdict` + `Alternatives` |
| `src/components/draft/draft-board.test.tsx` | Modify | Assertions move from Verdict text to table rows; selection tests |
| `src/components/draft/draft-board.requests.test.tsx` | Modify | Same helper change |
| `src/components/ui/info-tip.tsx` | Create | Click-to-open "i" explanation |
| `src/components/ui/info-tip.test.tsx` | Create | Open, close on Escape / outside / second click |
| `src/components/draft/verdict-detail.tsx` | Create | Factor bars, facts, counter text, community link (extracted from `Verdict`) |
| `src/components/draft/verdict.tsx` | Modify | Renders `VerdictDetail`; output unchanged |
| `src/components/draft/comparison-table.tsx` | Create | The table, its column help texts, the selected row's detail |
| `src/components/draft/comparison-table.test.tsx` | Create | Rows, selection, preview, empty cells, help |

`alternatives.tsx` stays (the home page uses it).

---

### Task 1: Fix the stray rings on the map

The `pin-ping` span is centred and faded only by its keyframes. With no fill mode, once the 380 ms animation ends it falls back to no transform and full opacity, so it stays visible, offset down-right. Giving it resting classes (`-translate-x-1/2 -translate-y-1/2 opacity-0`) fixes that: the keyframes override both while running, the classes take over after. The pin ring is circular around a square portrait; it becomes `rounded-lg` like the portrait.

**Files:**
- Modify: `src/components/draft/rift-map.tsx`
- Test: `src/components/draft/rift-map.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe("RiftMap", ...)` block of `src/components/draft/rift-map.test.tsx`:

```tsx
  // The ping is centred and hidden by its keyframes only while they run. Without
  // resting classes it reappears after the animation, offset down and to the
  // right, which the owner reported as stray "targets" next to every pick.
  it("leaves the landing ping centred and invisible once it has played", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    const ping = screen.getByRole("button", { name: "Mid adverse : Zed" }).querySelector(".pin-ping");

    expect(ping).not.toBeNull();
    expect(ping).toHaveClass("-translate-x-1/2", "-translate-y-1/2", "opacity-0");
  });

  // The portrait is a rounded square; a circular ring around it read as a
  // second, misaligned shape.
  it("draws an occupied pin's ring in the portrait's shape", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    const pin = screen.getByRole("button", { name: "Mid adverse : Zed" });

    expect(pin).toHaveClass("rounded-lg");
    expect(pin).not.toHaveClass("rounded-full");
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/draft/rift-map.test.tsx`
Expected: the two new tests FAIL (missing classes / `rounded-full` present); the six existing ones pass.

- [ ] **Step 3: Implement**

In `src/components/draft/rift-map.tsx`, replace the button's `className` expression:

```tsx
              className={`pin-drop absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                pinName === null
                  ? // `bg-paper/70` would be silently inert: this project's colour tokens are
                    // bare `var(--x)` with no `<alpha-value>` channel, so Tailwind emits no
                    // rule at all for an opacity modifier on one. The arbitrary value does
                    // emit, and keeps the tint on the same element the design put it on.
                    "border-2 border-dashed border-ink-faint bg-[color-mix(in_srgb,var(--paper)_70%,transparent)] p-2"
                  : ring
              }`}
```

with:

```tsx
              className={`pin-drop absolute -translate-x-1/2 -translate-y-1/2 ${
                pinName === null
                  ? // `bg-paper/70` would be silently inert: this project's colour tokens are
                    // bare `var(--x)` with no `<alpha-value>` channel, so Tailwind emits no
                    // rule at all for an opacity modifier on one. The arbitrary value does
                    // emit, and keeps the tint on the same element the design put it on.
                    "rounded-full border-2 border-dashed border-ink-faint bg-[color-mix(in_srgb,var(--paper)_70%,transparent)] p-2"
                  : // Same corners as `ChampionAvatar` (`rounded-lg`): a circle around a
                    // square portrait read as a second, misaligned shape.
                    `rounded-lg ${ring}`
              }`}
```

Then replace the ping span:

```tsx
                  <span
                    aria-hidden="true"
                    className={`pin-ping absolute left-1/2 top-1/2 h-full w-full rounded-full ring-2 ${ringColorClass}`}
                  />
```

with:

```tsx
                  {/* The keyframes set transform and opacity only while they run,
                      and the animation has no fill mode. These resting classes are
                      what the span falls back to afterwards: centred and invisible.
                      Without them it reappeared at full opacity, offset by half its
                      size -- the stray "targets" next to every placed pick. */}
                  <span
                    aria-hidden="true"
                    className={`pin-ping absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-lg opacity-0 ring-2 ${ringColorClass}`}
                  />
```

Leave the existing comment above the span (about the button being the containing block) in place, before the new one.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/draft/rift-map.test.tsx`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/rift-map.tsx src/components/draft/rift-map.test.tsx
git commit -m "fix: stop the landing ping from lingering off-centre on the map"
```

---

### Task 2: Icon-only team slots

**Files:**
- Modify: `src/app/globals.css` (token block in `:root`)
- Modify: `tailwind.config.ts`
- Modify: `src/components/draft/draft-slot.tsx`
- Test: `src/components/draft/draft-slot.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append inside `describe("DraftSlot", ...)` in `src/components/draft/draft-slot.test.tsx`:

```tsx
  // Icon-only: the name leaves the screen but not the accessibility tree or
  // the tooltip, so the existing "Retirer <name>" queries keep working.
  it("shows an occupied slot's champion by portrait only", () => {
    render(
      <DraftSlot
        side="enemy"
        role="top"
        champion={{ id: "darius", name: "Darius" }}
        isYourLane={false}
        onOpen={vi.fn()}
        onClear={vi.fn()}
      />
    );

    const slot = screen.getByRole("button", { name: "Retirer Darius" });

    expect(screen.queryByText("Darius")).not.toBeInTheDocument();
    expect(slot).toHaveAttribute("title", "Retirer Darius");
    expect(screen.getByText("Top")).toBeInTheDocument();
  });

  it("shows your lane's recommendation by portrait, with the role marked as yours", () => {
    render(
      <DraftSlot
        side="ally"
        role="mid"
        champion={{ id: "ahri", name: "Ahri" }}
        isYourLane
        onOpen={vi.fn()}
        onClear={vi.fn()}
      />
    );

    expect(screen.queryByText("Ahri")).not.toBeInTheDocument();
    expect(screen.getByText("Mid · vous")).toBeInTheDocument();
    expect(screen.getByTitle("Ahri")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/draft/draft-slot.test.tsx`
Expected: the two new tests FAIL (the name is rendered as text); the three existing ones pass.

- [ ] **Step 3: Add the scrim token**

In `src/app/globals.css`, inside `:root`, right after the `--shadow: rgb(0 0 0 / 0.45);` line, add:

```css

  /* Darkens a portrait under an overlay icon (the draft slots' "remove" cross).
     The paper colour, translucent. */
  --scrim: rgb(10 20 40 / 0.7);
```

In `tailwind.config.ts`, add to `colors` after `"team-enemy": "var(--team-enemy)"` (add the comma):

```ts
        "team-enemy": "var(--team-enemy)",
        scrim: "var(--scrim)"
```

- [ ] **Step 4: Rewrite the slot**

Replace the whole body of `src/components/draft/draft-slot.tsx` with:

```tsx
"use client";

import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { Side } from "@/lib/draft/draft-state";
import { ROLE_LABELS, type Role } from "@/lib/draft/roles";

const PORTRAIT = 48;
const ROLE_TAG = "text-[9px] font-extrabold uppercase tracking-[0.14em]";

/**
 * Portrait only: the owner wanted the icons larger and the names gone. The
 * name stays in the accessible name and in a `title` tooltip, and the column
 * header already says which side the slot is on, so the visible tag is the
 * role alone.
 */
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
      <div
        title={champion?.name}
        className="flex items-center gap-2.5 rounded-lg border border-accent bg-accent-wash p-1.5"
      >
        <ChampionAvatar name={champion?.name ?? ROLE_LABELS[role]} imageUrl={champion?.imageUrl} size={PORTRAIT} />
        <span className={`${ROLE_TAG} text-accent`}>{ROLE_LABELS[role]} · vous</span>
      </div>
    );
  }

  if (champion === null) {
    return (
      <button
        type="button"
        onClick={() => onOpen(side, role)}
        aria-label={`${lane}, vide`}
        title={`${lane} : choisir un champion`}
        className={`flex w-full items-center gap-2.5 rounded-lg border border-dashed border-rule bg-surface-sunk p-1.5 text-left ${edge}`}
      >
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface text-lg font-semibold text-ink-faint"
        >
          +
        </span>
        <span className={`${ROLE_TAG} text-ink-faint`}>{ROLE_LABELS[role]}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClear(side, role)}
      aria-label={`Retirer ${champion.name}`}
      title={`Retirer ${champion.name}`}
      className={`group flex w-full items-center gap-2.5 rounded-lg border border-rule bg-surface p-1.5 text-left ${edge}`}
    >
      <span className="relative shrink-0">
        <ChampionAvatar name={champion.name} imageUrl={champion.imageUrl} size={PORTRAIT} />
        {/* Clicking an occupied slot removes the pick, which nothing on screen
            said before. The cross only appears on hover or keyboard focus. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center rounded-lg bg-scrim text-lg font-bold text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          ×
        </span>
      </span>
      <span className={`${ROLE_TAG} text-ink-faint`}>{ROLE_LABELS[role]}</span>
    </button>
  );
}
```

Note: `ROLE_LABELS.top` is `"Top"`, so the visible tag's DOM text is `Top` (uppercased by CSS), which is what the test queries.

- [ ] **Step 5: Run the slot tests and the whole suite**

Run: `npx vitest run src/components/draft/draft-slot.test.tsx`
Expected: 5 passed.

Run: `npm test`
Expected: all pass. (`draft-board` tests scope names to the "Recommandation" group, so removing the name from the "your lane" slot breaks nothing.)

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css tailwind.config.ts src/components/draft/draft-slot.tsx src/components/draft/draft-slot.test.tsx
git commit -m "feat: show the draft slots as larger portraits without names"
```

---

### Task 3: Silhouette button instead of "Vous ?", narrower columns

**Files:**
- Modify: `src/components/draft/draft-board.tsx`
- Test: `src/components/draft/draft-board.test.tsx`

- [ ] **Step 1: Write the failing test**

Append inside `describe("DraftBoard", ...)` in `src/components/draft/draft-board.test.tsx`:

```tsx
  it("offers each other allied lane through a silhouette icon, not a text button", () => {
    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    const claim = screen.getByRole("button", { name: "Jouer top" });

    expect(claim).toHaveAttribute("title", "Jouer top");
    expect(claim.querySelector("svg")).not.toBeNull();
    expect(claim).not.toHaveTextContent("Vous");
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/components/draft/draft-board.test.tsx -t "silhouette"`
Expected: FAIL (no `title`, no `svg`, text "Vous ?").

- [ ] **Step 3: Implement**

In `src/components/draft/draft-board.tsx`, add above `export function DraftBoard`:

```tsx
// "Play this lane". Drawn inline rather than pulled from an icon library for
// one glyph; `currentColor` lets the button's hover colour reach it.
function PlayerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
```

Replace the claim button:

```tsx
                <button
                  type="button"
                  onClick={() => apply({ type: "setYourRole", role })}
                  aria-label={`Jouer ${ROLE_LABELS[role].toLowerCase()}`}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md border border-rule bg-surface px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-faint hover:border-accent hover:text-accent"
                >
                  Vous ?
                </button>
```

with:

```tsx
                <button
                  type="button"
                  onClick={() => apply({ type: "setYourRole", role })}
                  aria-label={`Jouer ${ROLE_LABELS[role].toLowerCase()}`}
                  title={`Jouer ${ROLE_LABELS[role].toLowerCase()}`}
                  className="absolute right-1.5 top-1/2 grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-md border border-rule bg-surface text-ink-faint hover:border-accent hover:text-accent"
                >
                  <PlayerIcon />
                </button>
```

Update the comment above that button: replace its last sentence ("Its accessible name says what it does; the visible label is short because the row it sits in already names the lane.") with "Its accessible name and tooltip say what it does; the icon alone is the visible label."

Replace the grid template `sm:grid-cols-[186px_1fr_186px]` with `sm:grid-cols-[170px_1fr_170px]`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/draft/draft-board.test.tsx`
Expected: all pass (the existing "Jouer top" tests query by accessible name, unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/draft-board.tsx src/components/draft/draft-board.test.tsx
git commit -m "feat: replace the draft's 'Vous ?' button with a player icon"
```

---

### Task 4: The `InfoTip` primitive

**Files:**
- Create: `src/components/ui/info-tip.tsx`
- Test: `src/components/ui/info-tip.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/info-tip.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoTip } from "./info-tip";

function renderTip() {
  return render(
    <div>
      <InfoTip label="Matchup" text="Part de 50, l'adversaire direct compte double." />
      <p>Ailleurs</p>
    </div>
  );
}

describe("InfoTip", () => {
  it("is closed until clicked", () => {
    renderTip();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click and describes its button", () => {
    renderTip();
    const button = screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" });

    fireEvent.click(button);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("l'adversaire direct compte double");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-describedby", tip.id);
  });

  it("closes on a second click", () => {
    renderTip();
    const button = screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    renderTip();
    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on a click elsewhere", () => {
    renderTip();
    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" }));

    fireEvent.mouseDown(screen.getByText("Ailleurs"));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // It sits inside clickable table rows; opening it must not select the row.
  it("does not let its click reach the element around it", () => {
    let reached = false;
    render(
      <div onClick={() => (reached = true)}>
        <InfoTip label="Score" text="Note sur 100." />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Score ?" }));

    expect(reached).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/ui/info-tip.test.tsx`
Expected: FAIL, cannot resolve `./info-tip`.

- [ ] **Step 3: Implement**

Create `src/components/ui/info-tip.tsx`:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * An "i" that explains a label. Opened by click rather than hover so it works
 * on touch screens and from the keyboard; closed by a second click, Escape, or
 * a click anywhere else. Because a click elsewhere closes it, opening another
 * one closes this one: at most one is open at a time without shared state.
 */
export function InfoTip({ label, text, align = "start" }: { label: string; text: string; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onMouseDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label={`Qu'est-ce que ${label} ?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(event) => {
          // Rows of the comparison table are clickable; asking what a column
          // means must not also select a champion.
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="grid h-4 w-4 place-items-center rounded-full border border-rule text-[9px] font-bold text-ink-faint hover:border-accent hover:text-accent"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={`absolute top-full z-20 mt-1.5 w-60 rounded-lg border border-rule bg-surface p-2.5 text-left text-[11px] font-normal leading-relaxed text-ink-muted shadow-[0_8px_24px_var(--shadow)] ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/ui/info-tip.test.tsx`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/info-tip.tsx src/components/ui/info-tip.test.tsx
git commit -m "feat: add a click-to-open info tip"
```

---

### Task 5: Extract `VerdictDetail` from `Verdict`

A pure refactor: `Verdict`'s lower half moves into its own component so the table can render it. `verdict.test.tsx` must stay green **without any edit**; that is the proof the home page is unchanged.

**Files:**
- Create: `src/components/draft/verdict-detail.tsx`
- Modify: `src/components/draft/verdict.tsx`
- Test: `src/components/draft/verdict.test.tsx` (unchanged, must pass)

- [ ] **Step 1: Create `verdict-detail.tsx`**

```tsx
import Link from "next/link";
import type { Route } from "next";
import { FactorBars } from "./factor-bars";
import type { Recommendation } from "@/lib/recommendation/types";
import type { Role } from "@/lib/draft/roles";
import { matchupHref } from "@/lib/matchup/key";

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

/**
 * Why a champion is recommended: the weighted factors, the facts behind them,
 * the counter sentence and, when the lane duel is known, the community link.
 * Shared by `Verdict` (home page) and the draft tool's comparison table.
 */
export function VerdictDetail({
  recommendation,
  role,
  enemyChampionId,
  className = ""
}: {
  recommendation: Recommendation;
  role?: Role;
  enemyChampionId?: string | null;
  className?: string;
}) {
  const counter = recommendation.explanation.factors.find((factor) => factor.key === "counter");
  const communityHref: Route | null =
    role && enemyChampionId && enemyChampionId !== recommendation.championId
      ? matchupHref(recommendation.championId, enemyChampionId, role)
      : null;

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
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
        <Fact label="Classement winrate" value={`#${recommendation.rank} / ${recommendation.totalRanked}`} />
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
        {counter?.detail}
        {communityHref && (
          <>
            {" "}
            <Link href={communityHref} className="text-accent underline underline-offset-2 hover:text-accent-pale">
              Avis de la communauté
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Make `Verdict` use it**

Replace the whole of `src/components/draft/verdict.tsx` with:

```tsx
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { Score } from "@/components/ui/score";
import { VerdictDetail } from "./verdict-detail";
import type { Recommendation } from "@/lib/recommendation/types";
import type { Role } from "@/lib/draft/roles";

export function Verdict({
  recommendation,
  role,
  enemyChampionId
}: {
  recommendation: Recommendation;
  role?: Role;
  enemyChampionId?: string | null;
}) {
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

      <VerdictDetail
        recommendation={recommendation}
        role={role}
        enemyChampionId={enemyChampionId}
        className="border-t border-rule-soft p-3.5"
      />
    </div>
  );
}
```

The resulting classes on the detail grid are `grid gap-4 sm:grid-cols-2 border-t border-rule-soft p-3.5`: the same set as before, in a different order.

- [ ] **Step 3: Run the verdict and home tests, then the suite**

Run: `npx vitest run src/components/draft/verdict.test.tsx`
Expected: 10 passed, with no edit to the test file.

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/draft/verdict-detail.tsx src/components/draft/verdict.tsx
git commit -m "refactor: extract the verdict's detail into its own component"
```

---

### Task 6: The `ComparisonTable`

**Files:**
- Create: `src/components/draft/comparison-table.tsx`
- Test: `src/components/draft/comparison-table.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/draft/comparison-table.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComparisonTable } from "./comparison-table";
import type { Recommendation } from "@/lib/recommendation/types";

function rec(
  name: string,
  score: number,
  { matchup = true, winRate = 51.3 as number | null }: { matchup?: boolean; winRate?: number | null } = {}
): Recommendation {
  return {
    championId: name.toLowerCase(),
    championName: name,
    championImageUrl: undefined,
    totalScore: score,
    metaScore: 72,
    playerScore: 5,
    counterScore: 85,
    rank: 7,
    winRate,
    pickRate: 4.1,
    banRate: 2.8,
    games: 12400,
    totalRanked: 64,
    explanation: {
      summary: "",
      factors: [
        { key: "meta", label: "Force dans le patch", score: 72, weight: 57, detail: "", available: true },
        { key: "player", label: "Votre pool", score: 5, weight: 3, detail: "", available: false },
        {
          key: "counter",
          label: "Matchup",
          score: 85,
          weight: 40,
          detail: `${name} prend l'avantage.`,
          available: matchup
        }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

const four = [rec("Galio", 88), rec("Lissandra", 81), rec("Diana", 74), rec("Ahri", 70)];

function renderTable(overrides: Partial<Parameters<typeof ComparisonTable>[0]> = {}) {
  const props = {
    recommendations: four,
    selectedId: "galio",
    role: "mid" as const,
    enemyChampionId: "zed",
    onPreview: vi.fn(),
    onSelect: vi.fn(),
    ...overrides
  };
  render(<ComparisonTable {...props} />);
  return props;
}

function cellsOf(name: string, score: number) {
  const row = screen.getByRole("button", { name: `${name}, score ${score}` }).closest("tr");
  return Array.from(row?.querySelectorAll("td") ?? []).map((cell) => cell.textContent);
}

describe("ComparisonTable", () => {
  it("lists every recommendation in the order given", () => {
    renderTable();

    const names = screen
      .getAllByRole("button", { name: /, score \d+$/ })
      .map((button) => button.getAttribute("aria-label"));

    expect(names).toEqual(["Galio, score 88", "Lissandra, score 81", "Diana, score 74", "Ahri, score 70"]);
  });

  it("shows score, patch strength, matchup, winrate and games per row", () => {
    renderTable();

    expect(cellsOf("Galio", 88).slice(1)).toEqual(["88", "72", "85", "51.3 %", "12 400"]);
  });

  it("opens the selected row's detail and only that one", () => {
    renderTable({ selectedId: "diana" });

    expect(screen.getByRole("button", { name: "Diana, score 74" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Galio, score 88" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Diana prend l'avantage.")).toBeInTheDocument();
    expect(screen.queryByText("Galio prend l'avantage.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Avis de la communauté" })).toHaveAttribute(
      "href",
      "/duel/mid/diana-vs-zed"
    );
  });

  it("selects a row on click", () => {
    const { onSelect } = renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Diana, score 74" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("diana");
  });

  it("previews a row on hover and withdraws it on leave", () => {
    const { onPreview } = renderTable();
    const row = screen.getByRole("button", { name: "Lissandra, score 81" }).closest("tr");
    if (row === null) throw new Error("row not found");

    fireEvent.mouseEnter(row);
    expect(onPreview).toHaveBeenLastCalledWith("lissandra");

    fireEvent.mouseLeave(row);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it("previews a row on keyboard focus too", () => {
    const { onPreview } = renderTable();

    fireEvent.focus(screen.getByRole("button", { name: "Lissandra, score 81" }));

    expect(onPreview).toHaveBeenLastCalledWith("lissandra");
  });

  // The site never shows an invented number: an unassessed matchup or an
  // unknown winrate leaves its cell empty, not "0" and not a dash.
  it("leaves a cell empty when its value is missing", () => {
    renderTable({ recommendations: [rec("Galio", 88, { matchup: false, winRate: null })] });

    const [, score, patch, matchup, winRate] = cellsOf("Galio", 88);

    expect(score).toBe("88");
    expect(patch).toBe("72");
    expect(matchup).toBe("");
    expect(winRate).toBe("");
  });

  it("explains each column on demand", () => {
    renderTable();

    for (const label of ["Score", "Force dans le patch", "Matchup", "Winrate", "Parties"]) {
      expect(screen.getByRole("button", { name: `Qu'est-ce que ${label} ?` })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("votre adversaire direct compte double");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/draft/comparison-table.test.tsx`
Expected: FAIL, cannot resolve `./comparison-table`.

- [ ] **Step 3: Implement**

Create `src/components/draft/comparison-table.tsx`:

```tsx
"use client";

import { Fragment } from "react";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { InfoTip } from "@/components/ui/info-tip";
import { VerdictDetail } from "./verdict-detail";
import type { Role } from "@/lib/draft/roles";
import type { Recommendation } from "@/lib/recommendation/types";

const number = new Intl.NumberFormat("fr-FR");

// The help texts describe what the engine computes today
// (`src/lib/recommendation/engine.ts`: `metaScore`, `computeWeights`;
// `counter.ts`: `scoreCounter`). If the engine changes, these change with it.
// "Score" names only patch strength and matchup: the pool's weight is not
// assessable for visitors until accounts ship, and has no column here.
const COLUMNS = [
  {
    key: "score",
    label: "Score",
    help: "Note sur 100 qui combine la force dans le patch et le matchup, selon les poids affichés dans le détail. Sans pick adverse, seule la force dans le patch compte.",
    align: "start"
  },
  {
    key: "meta",
    label: "Force dans le patch",
    help: "Place du champion dans le classement au winrate à ce rôle, ramenée sur 100 : le premier a 100, le dernier environ 10.",
    align: "start"
  },
  {
    key: "counter",
    label: "Matchup",
    help: "Comment ce champion s'en sort face aux picks adverses déjà posés. On part de 50 (neutre) : chaque adversaire qu'il contre fait monter le score, chaque adversaire qui le contre le fait baisser, et votre adversaire direct compte double. Basé sur les relations de counter connues entre champions, pas sur un winrate de matchup.",
    align: "start"
  },
  {
    key: "winRate",
    label: "Winrate",
    help: "Part des parties gagnées par ce champion à ce rôle, dans les données du patch actuel.",
    align: "end"
  },
  {
    key: "games",
    label: "Parties",
    help: "Nombre de parties sur lesquelles reposent ces statistiques.",
    align: "end"
  }
] as const;

function factorScore(recommendation: Recommendation, key: "meta" | "counter"): string | null {
  const factor = recommendation.explanation.factors.find((entry) => entry.key === key);
  return factor?.available ? String(Math.round(factor.score)) : null;
}

// One value per column, in `COLUMNS` order. `null` renders as an empty cell:
// the site never fills a missing number with `0` or a dash.
function cells(recommendation: Recommendation): Array<string | null> {
  return [
    String(Math.round(recommendation.totalScore)),
    factorScore(recommendation, "meta"),
    factorScore(recommendation, "counter"),
    recommendation.winRate === null ? null : `${recommendation.winRate.toFixed(1)} %`,
    recommendation.games === null ? null : number.format(recommendation.games)
  ];
}

/**
 * Every recommendation side by side, in the server's order: rows never move
 * when one is selected. The selected row's detail opens right under it. Hover
 * and focus preview a row on the map without committing it, like the
 * alternatives cards did.
 */
export function ComparisonTable({
  recommendations,
  selectedId,
  role,
  enemyChampionId,
  onPreview,
  onSelect
}: {
  recommendations: Recommendation[];
  selectedId: string;
  role: Role;
  enemyChampionId: string | null;
  onPreview: (championId: string | null) => void;
  onSelect: (championId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-rule">
      <table className="w-full min-w-[440px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-rule text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            <th scope="col" className="p-2 text-left">
              <span className="sr-only">Champion</span>
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="p-2 text-right">
                <span className="inline-flex items-center gap-1">
                  {column.label}
                  <InfoTip label={column.label} text={column.help} align={column.align} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recommendations.map((recommendation, index) => {
            const id = recommendation.championId;
            const selected = id === selectedId;
            const detailId = `comparison-detail-${id}`;
            const score = Math.round(recommendation.totalScore);

            return (
              <Fragment key={id}>
                {/* The row takes the mouse click; the button in its first cell is
                    the one focusable element, and a keyboard activation of it
                    bubbles here as a click, so both paths select exactly once. */}
                <tr
                  onClick={() => onSelect(id)}
                  onMouseEnter={() => onPreview(id)}
                  onMouseLeave={() => onPreview(null)}
                  className={`cursor-pointer border-b border-rule-soft ${
                    selected ? "bg-accent-wash" : "hover:bg-surface-sunk"
                  }`}
                >
                  <td className={`p-1.5 ${selected ? "border-l-2 border-l-accent" : "border-l-2 border-l-transparent"}`}>
                    <button
                      type="button"
                      aria-label={`${recommendation.championName}, score ${score}`}
                      aria-expanded={selected}
                      aria-controls={selected ? detailId : undefined}
                      title={recommendation.championName}
                      onFocus={() => onPreview(id)}
                      onBlur={() => onPreview(null)}
                      className="flex items-center gap-2 rounded-lg"
                    >
                      <span aria-hidden="true" className="w-3 text-[10px] font-bold text-ink-faint">
                        {index + 1}
                      </span>
                      <ChampionAvatar
                        name={recommendation.championName}
                        imageUrl={recommendation.championImageUrl}
                        size={40}
                      />
                    </button>
                  </td>
                  {cells(recommendation).map((value, column) => (
                    <td
                      key={COLUMNS[column].key}
                      className={`p-2 text-right tabular-nums ${
                        column === 0 ? "text-sm font-extrabold text-accent" : "font-semibold text-ink"
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
                {selected && (
                  <tr id={detailId}>
                    <td colSpan={COLUMNS.length + 1} className="border-b border-rule bg-surface-sunk">
                      <VerdictDetail
                        recommendation={recommendation}
                        role={role}
                        enemyChampionId={enemyChampionId}
                        className="p-3.5"
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/draft/comparison-table.test.tsx`
Expected: 8 passed.

If "previews a row on hover" fails because `mouseLeave` on the row also fires from the button's `onBlur`, it will not: `fireEvent.mouseLeave` does not blur. If `toHaveBeenCalledTimes(1)` in "selects a row on click" fails with 2, the button has gained its own `onClick`; remove it (the row's handler is the only one).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`directOpponent` returns `string | null`; the table takes `enemyChampionId: string | null`.)

- [ ] **Step 6: Commit**

```bash
git add src/components/draft/comparison-table.tsx src/components/draft/comparison-table.test.tsx
git commit -m "feat: add the draft comparison table with column explanations"
```

---

### Task 7: Wire the table into `DraftBoard`

**Files:**
- Modify: `src/components/draft/draft-board.tsx`
- Modify: `src/components/draft/draft-board.test.tsx`
- Modify: `src/components/draft/draft-board.requests.test.tsx`

- [ ] **Step 1: Switch the board tests to the table's rows**

The recommendation's name is no longer text anywhere on the board: it lives in the rows' accessible names. In **both** `draft-board.test.tsx` and `draft-board.requests.test.tsx`, replace the comment and body of `recommendationPanel()` with:

```tsx
// The recommendation panel holds the comparison table. Champion names live in
// the rows' accessible names ("Galio, score 88"), not as visible text.
function recommendationPanel() {
  return within(screen.getByRole("group", { name: "Recommandation" }));
}

// Row accessible names, top to bottom. The "i" buttons do not match.
function rowNames() {
  return recommendationPanel()
    .getAllByRole("button", { name: /, score \d+$/ })
    .map((button) => button.getAttribute("aria-label"));
}
```

Then, in `draft-board.test.tsx`:

- `expect(recommendationPanel().getByText("Galio")).toBeInTheDocument();` (twice: "renders the pre-solved example..." and "keeps the previous result...") becomes
  `expect(rowNames()[0]).toBe("Galio, score 88");`
- `await waitFor(() => expect(recommendationPanel().getByText("Darius")).toBeInTheDocument());` (twice: "requests again when you change lane" and "clears the error banner...") becomes
  `await waitFor(() => expect(rowNames()[0]).toBe("Darius, score 90"));`
- In "fires no request when an alternative is previewed", rename it to `"fires no request when a row is previewed"`, update its comment's "hovering the alternatives list" to "hovering the table", and replace
  `fireEvent.mouseEnter(screen.getByRole("button", { name: /lissandra/i }));` with:

```tsx
    const row = recommendationPanel().getByRole("button", { name: "Lissandra, score 81" }).closest("tr");
    if (row === null) throw new Error("row not found");
    fireEvent.mouseEnter(row);
```

In `draft-board.requests.test.tsx`:

- `await waitFor(() => expect(recommendationPanel().getByText("Briar")).toBeInTheDocument());` (twice) becomes
  `await waitFor(() => expect(rowNames()).toEqual(["Briar, score 90"]));`
- `expect(screen.queryByText("Anivia")).not.toBeInTheDocument();` becomes
  `expect(recommendationPanel().queryByRole("button", { name: /^Anivia,/ })).not.toBeInTheDocument();`

- [ ] **Step 2: Add the selection tests**

Append inside `describe("DraftBoard", ...)` in `draft-board.test.tsx`:

```tsx
  // A comparison table whose rows jump on click cannot be compared. Selecting
  // only moves the highlight and what the map shows on your lane.
  it("selects a row without reordering the table or requesting anything", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(recommendationPanel().getByRole("button", { name: "Diana, score 74" }));

    expect(rowNames()).toEqual(["Galio, score 88", "Lissandra, score 81", "Diana, score 74"]);
    expect(recommendationPanel().getByRole("button", { name: "Diana, score 74" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(
      within(screen.getByRole("group", { name: "Carte de la Faille" })).getByRole("button", {
        name: "Votre lane, Mid : Diana recommandé"
      })
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("goes back to the first row when a new answer arrives", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ recommendations: [rec("Orianna", 90), rec("Diana", 74)] }), { status: 200 })
    );

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(recommendationPanel().getByRole("button", { name: "Diana, score 74" }));
    fireEvent.click(screen.getByRole("button", { name: "Jouer top" }));

    await waitFor(() => expect(rowNames()[0]).toBe("Orianna, score 90"));
    expect(recommendationPanel().getByRole("button", { name: "Orianna, score 90" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(recommendationPanel().getByRole("button", { name: "Diana, score 74" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/components/draft/draft-board.test.tsx src/components/draft/draft-board.requests.test.tsx`
Expected: FAIL: no row buttons named `"<name>, score <n>"` yet (the board still renders `Verdict` + `Alternatives`).

- [ ] **Step 4: Implement in `draft-board.tsx`**

1. Imports: remove `import { Alternatives } from "./alternatives";` and `import { Verdict } from "./verdict";`; add `import { ComparisonTable } from "./comparison-table";`.

2. After the `previewId` state, add:

```tsx
  // Which row of the table is open. `null` means the first one. Kept apart
  // from `recommendations` so selecting never reorders the table, and reset
  // whenever a new answer arrives: an old choice does not carry over to a
  // draft it was not made for.
  const [selectedId, setSelectedId] = useState<string | null>(null);
```

3. In `refresh`, replace `setRecommendations(payload.recommendations);` with:

```tsx
      setRecommendations(payload.recommendations);
      setSelectedId(null);
```

4. Replace:

```tsx
  const previewed = previewId === null ? undefined : recommendations.find((entry) => entry.championId === previewId);
  const shown = previewed ?? top;
```

with:

```tsx
  const previewed = previewId === null ? undefined : recommendations.find((entry) => entry.championId === previewId);
  const selected = selectedId === null ? undefined : recommendations.find((entry) => entry.championId === selectedId);
  const shown = previewed ?? selected ?? top;
```

and extend the comment above it: after "...rather than showing nothing." add "The same fallback applies to a selection."

5. Change `const [top, ...rest] = recommendations;` to `const [top] = recommendations;`.

6. Replace the whole `<>...</>` fragment inside `{top ? ( ... ) : ...}` with:

```tsx
          <>
            <ComparisonTable
              recommendations={recommendations}
              selectedId={(selected ?? top).championId}
              role={draft.yourRole}
              enemyChampionId={directOpponent(draft)}
              onPreview={setPreviewId}
              onSelect={(championId) => {
                setPreviewId(null);
                // Answers nothing new: the server already scored this exact
                // draft, so choosing a row only changes what is shown.
                setSelectedId(championId);
              }}
            />
            {playerFactor?.available ? (
              <PriorityControl value={draft.priority} onChange={changePriority} />
            ) : (
              <PriorityUnavailable />
            )}
            <RefinePrompt />
          </>
```

7. Update the comment above `<div role="group" aria-label="Recommandation" ...>`: replace it with
   `{/* Labelled so tests and assistive tech can tell the table's rows apart from the columns' and the map's buttons. */}`

- [ ] **Step 5: Run the board tests, then the whole CI**

Run: `npx vitest run src/components/draft/`
Expected: all pass.

Run: `npm run ci`
Expected: typecheck, lint and every test pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/draft/draft-board.tsx src/components/draft/draft-board.test.tsx src/components/draft/draft-board.requests.test.tsx
git commit -m "feat: show every recommendation in the draft tool's comparison table"
```

---

### Task 8: Check it in the browser and record it

**Files:**
- Modify: `.claude/work/current.md`

- [ ] **Step 1: Run the site**

Start the `next-dev` preview (`.claude/launch.json`), open `http://localhost:3000/draft`.

- [ ] **Step 2: Check each point of the spec**

1. Place an enemy champion: the pin lands, the ping plays once, and **no ring remains** next to it after half a second. The pin's ring follows the portrait's rounded square.
2. Team columns: 48 px portraits, no names; hovering an occupied slot shows the cross and the "Retirer X" tooltip; the allied lanes show the silhouette button with a "Jouer <rôle>" tooltip.
3. Table: 4 rows, row 1 open with bars, facts, counter text; clicking row 3 opens it, the rows stay in place, the map's lane shows that champion; hovering a row previews it.
4. Each "i" opens its text, closes on Escape, a click elsewhere, a second click; opening one does not select the row.
5. Remove every enemy: the Matchup column is empty on every row (no `0`, no dash).
6. Resize to 375 px wide: the table scrolls inside its frame, the page has no horizontal scroll.
7. Home page (`/`): the example card looks as before.

Take a screenshot of the board with the table open for the owner.

- [ ] **Step 3: Record the state**

Add a `## feat/draft-comparison-table` section at the top of `.claude/work/current.md` (format at the bottom of that file): started 2026-09-25, spec and plan paths, what is done, what the browser check showed, next step (ship, owner's choice), nothing pushed.

- [ ] **Step 4: Commit**

```bash
git add .claude/work/current.md
git commit -m "docs: record the draft comparison table verification"
```
