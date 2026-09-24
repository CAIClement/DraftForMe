# Micro-animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every hover, press and error-appearance on the site transition smoothly instead of snapping, using the motion system the draft board already has.

**Architecture:** CSS only. One new keyframe and class (`.fade-in`) in `src/app/globals.css`, built on the existing `--motion` / `--ease-out` tokens. Everything else is Tailwind utility classes added to existing `className` strings, following the site's hover convention `transition-colors duration-200`. No new dependency, no JS, no behaviour change.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 3.4 with tokens from `src/app/globals.css`, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-24-draftforme-micro-animations-design.md`

## Conventions every task follows

- Branch: `feat/micro-animations` (already created from `main`). Never commit on `main`.
- Colours only through tokens (`.claude/rules/ui.md`): every class below uses existing token names (`accent`, `ink`, `surface`, `surface-sunk`, ...). Do not introduce a hex value or a stock Tailwind colour.
- Hover transitions use exactly `transition-colors duration-200`, the convention already used in seven places. Do not invent another duration.
- **Why there are no new unit tests:** these are CSS class additions with no behaviour. No existing test asserts on any of these classes (the only `toHaveClass` in the suite is on `RiotDisclaimer`), and a test asserting that a string contains `transition-colors` would only restate the diff. Each task instead runs the existing tests for the files it touches, so a typo that breaks rendering is caught; Task 6 verifies the result in the browser via computed styles.
- The suite passes at every commit (`CLAUDE.md`).
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: The `fade-in` keyframe

**Files:**
- Modify: `src/app/globals.css` (append after the `.factor-bar-fill` rule at the end of the file)

- [ ] **Step 1: Append the keyframe and class**

Add at the very end of `src/app/globals.css`:

```css

/* Error messages fade in rather than popping. `backwards` for the same reason
   as `.slot-rise`: the resting state is the visible one. */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.fade-in {
  animation: fade-in var(--motion) var(--ease-out) backwards;
}
```

- [ ] **Step 2: Run the suite**

Run: `npm test`
Expected: all tests pass (CSS is not loaded by Vitest; this confirms nothing else moved).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add a fade-in animation on the motion tokens"
```

---

### Task 2: Error messages fade in

**Files:**
- Modify: `src/components/draft/draft-board.tsx:251`
- Modify: `src/components/auth/nickname-form.tsx:33`
- Modify: `src/components/auth/delete-account-form.tsx:29`
- Modify: `src/app/(account)/connexion/page.tsx:36`

Each of these `<p role="alert">` is rendered conditionally (`{error && ...}`), so the animation plays exactly when the message appears.

- [ ] **Step 1: `draft-board.tsx`**

Replace:
```tsx
        <p role="alert" className="mt-3 rounded-lg border border-rule bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
```
with:
```tsx
        <p role="alert" className="fade-in mt-3 rounded-lg border border-rule bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
```

- [ ] **Step 2: `nickname-form.tsx`**

Replace:
```tsx
        <p role="alert" className="text-sm text-danger">
```
with:
```tsx
        <p role="alert" className="fade-in text-sm text-danger">
```

- [ ] **Step 3: `delete-account-form.tsx`**

Same replacement as Step 2 (the line is identical):
```tsx
        <p role="alert" className="fade-in text-sm text-danger">
```

- [ ] **Step 4: `connexion/page.tsx`**

Replace:
```tsx
        <p role="alert" className="mt-6 text-sm text-danger">
```
with:
```tsx
        <p role="alert" className="fade-in mt-6 text-sm text-danger">
```

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run src/components/draft src/components/auth "src/app/(account)"`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/draft/draft-board.tsx src/components/auth/nickname-form.tsx src/components/auth/delete-account-form.tsx "src/app/(account)/connexion/page.tsx"
git commit -m "feat: fade error messages in"
```

---

### Task 3: Draft tool hovers that snap

**Files:**
- Modify: `src/components/draft/champion-picker.tsx:100`
- Modify: `src/components/draft/alternatives.tsx:73`
- Modify: `src/components/draft/draft-board.tsx:197`

- [ ] **Step 1: `champion-picker.tsx`**

Replace:
```tsx
              className="block w-full rounded-lg border border-rule p-0.5 hover:border-accent"
```
with:
```tsx
              className="block w-full rounded-lg border border-rule p-0.5 transition-colors duration-200 hover:border-accent"
```

- [ ] **Step 2: `alternatives.tsx`**

Replace:
```tsx
            className={`${shell} hover:border-accent`}
```
with:
```tsx
            className={`${shell} transition-colors duration-200 hover:border-accent`}
```

Only the interactive (button) branch changes; the read-only `<div>` cards on the home page have no hover and stay as they are.

- [ ] **Step 3: `draft-board.tsx`, the "Vous ?" button**

Replace:
```tsx
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md border border-rule bg-surface px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-faint hover:border-accent hover:text-accent"
```
with:
```tsx
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md border border-rule bg-surface px-1.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.1em] text-ink-faint transition-colors duration-200 hover:border-accent hover:text-accent"
```

- [ ] **Step 4: Run the draft tests**

Run: `npx vitest run src/components/draft`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/draft/champion-picker.tsx src/components/draft/alternatives.tsx src/components/draft/draft-board.tsx
git commit -m "feat: ease the draft tool's hover states"
```

---

### Task 4: Draft slots get a hover state

**Files:**
- Modify: `src/components/draft/draft-slot.tsx:45` (empty slot) and `:66` (filled slot)

The hover is a background shift, **not** a border colour: a `hover:border-*` utility has higher specificity than `border-l-team-ally` / `border-r-team-enemy` and would erase the team edge on hover. The "your lane" slot (a `<div>`, not a button) is not touched.

- [ ] **Step 1: Empty slot**

Replace:
```tsx
        className={`flex items-center gap-2.5 rounded-lg border border-dashed border-rule bg-surface-sunk p-1.5 text-left ${edge}`}
```
with:
```tsx
        className={`flex items-center gap-2.5 rounded-lg border border-dashed border-rule bg-surface-sunk p-1.5 text-left transition-colors duration-200 hover:bg-surface ${edge}`}
```

- [ ] **Step 2: Filled slot**

Replace:
```tsx
      className={`flex items-center gap-2.5 rounded-lg border border-rule bg-surface p-1.5 text-left ${edge}`}
```
with:
```tsx
      className={`flex items-center gap-2.5 rounded-lg border border-rule bg-surface p-1.5 text-left transition-colors duration-200 hover:bg-surface-sunk ${edge}`}
```

- [ ] **Step 3: Run the draft tests**

Run: `npx vitest run src/components/draft`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/draft/draft-slot.tsx
git commit -m "feat: give the draft slots a hover state"
```

---

### Task 5: Marketing and account pages

**Files:**
- Modify: `src/components/ui/button-link.tsx:30`
- Modify: `src/components/home/faq-section.tsx:37`
- Modify: `src/components/home/method-section.tsx:35`
- Modify: `src/app/(account)/connexion/page.tsx:51` and `:55`

- [ ] **Step 1: `button-link.tsx`, press feedback**

Replace:
```tsx
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 ${SIZES[size]} ${VARIANTS[variant]}`}
```
with:
```tsx
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-200 active:scale-[0.97] ${SIZES[size]} ${VARIANTS[variant]}`}
```

`transition` (rather than `transition-colors`) also covers `transform`, so the press eases in and out.

- [ ] **Step 2: `faq-section.tsx`, question hover**

Replace:
```tsx
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold [&::-webkit-details-marker]:hidden">
```
with:
```tsx
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold transition-colors duration-200 hover:text-accent [&::-webkit-details-marker]:hidden">
```

The `+` icon sets its own `text-ink-faint`, so it keeps its colour.

- [ ] **Step 3: `method-section.tsx`, underline fades in**

Replace:
```tsx
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
```
with:
```tsx
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current"
```

`text-decoration-line` cannot be animated; `text-decoration-color` can, and Tailwind's `transition-colors` includes it.

- [ ] **Step 4: `connexion/page.tsx`, the two legal links**

Both lines currently read:
```tsx
className="underline underline-offset-2 hover:text-ink"
```
Change both to:
```tsx
className="underline underline-offset-2 transition-colors duration-200 hover:text-ink"
```

- [ ] **Step 5: Run the suite, typecheck and lint**

Run: `npm test`
Expected: all pass.

Run: `npx tsc --noEmit`
Expected: no output, exit 0.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button-link.tsx src/components/home/faq-section.tsx src/components/home/method-section.tsx "src/app/(account)/connexion/page.tsx"
git commit -m "feat: ease hovers and add press feedback on the marketing pages"
```

---

### Task 6: Verify in the browser

**Files:** none changed.

The dev server needs `.env.local` (`CLAUDE.md`). This checkout has none; one exists in the main worktree at `.claude/worktrees/compassionate-sammet-bc0a41/.env.local`. **Ask the owner before copying it.** If they decline, skip this task and say explicitly that the change is verified by tests and typecheck only, not in a browser.

- [ ] **Step 1: Start the preview**

Use `preview_start` with `{ name: "next-dev" }` (from `.claude/launch.json`). Check `preview_logs` for compile errors.

- [ ] **Step 2: Home page computed styles**

On `/`, run with `javascript_tool`:

```js
const pick = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return `${sel}: not found`;
  const s = getComputedStyle(el);
  return `${sel}: ${s.transitionProperty} / ${s.transitionDuration}`;
};
[
  pick('a[href="/draft"].inline-flex'),
  pick('details summary'),
  pick('a[href="/draft"].underline')
].join("\n");
```

Expected: each line shows a duration of `0.2s` (the button's property list includes `transform`; the others include `color` / `text-decoration-color`).

- [ ] **Step 3: Draft page computed styles and team edge on hover**

On `/draft`: read `transitionDuration` of a slot button (`button[aria-label$=", vide"]` or `button[aria-label^="Retirer"]`) and expect `0.2s`. Then `computer` `hover` on an ally slot and read its `borderLeftColor`; expect it to still be the team colour `rgb(79, 155, 245)` (`--team-ally`), not the accent gold.

- [ ] **Step 4: Error fade**

The draft error only appears on a failed request. In `javascript_tool`, confirm the class is wired without forcing a failure:

```js
const p = document.body.appendChild(Object.assign(document.createElement("p"), { className: "fade-in" }));
const name = getComputedStyle(p).animationName;
p.remove();
name;
```

Expected: `"fade-in"`.

- [ ] **Step 5: Console**

`read_console_messages` with `onlyErrors: true` on both pages. Expected: no new errors.

- [ ] **Step 6: Screenshot**

Take one screenshot of `/draft` with a slot hovered, as proof to share with the owner.
