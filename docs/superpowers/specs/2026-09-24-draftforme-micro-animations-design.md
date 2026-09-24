# Micro-animations across the site

## Context

The site currently has no animation beyond a few `transition-colors` utilities
scattered inconsistently (`ButtonLink`, the site header nav links, the FAQ's
`+` icon rotation). Most interactive elements change state with a hard snap:
role buttons, champion-suggestion buttons, the chip's remove button, and —
most noticeably — the factor bars in `Verdict`, whose widths jump instantly
when a new recommendation replaces the old one.

The owner asked for "small animations" across the site. This spec scopes that
down to consistent micro-interactions: hover/press feedback and state
transitions. It deliberately excludes anything that reads as a flourish
(scroll-triggered entrances, an animated score counter).

## Goals

- Every hover/focus state change on an interactive element animates instead
  of snapping, consistently across the marketing pages and the draft tool.
- The factor bars visibly glide to their new width when a recommendation
  updates, so the UI communicates that the recompute actually happened.
- The draft tool's loading and error states get a visual transition instead
  of a hard cut.
- No visual flourish beyond that: no scroll-triggered reveals, no animated
  counters, no page-transition effects.

## Non-goals

- An animated score counter (`Score`) — interpolating a number on a CSS-only
  budget needs JS state, which is disproportionate to "micro".
- Scroll-triggered section entrances on the home page — explicitly ruled out
  when scoping intensity.
- Any animation on the native `<details>` open/close in the FAQ beyond the
  icon rotation it already has — animating a `<details>` element's height
  needs JS or newer, less broadly supported CSS, and the existing rotation
  already gives the expand/collapse enough affordance.

## Approach

Two levers, no new JS runtime dependency:

1. **Tailwind's built-in `transition-*` utilities** for state changes that
   are already driven by an existing CSS property change (color, border,
   width, opacity, transform). This covers every hover/press case and the
   factor bar width.
2. **`tailwindcss-animate`** (a Tailwind plugin, no JS at runtime) for the
   one case that needs an actual enter animation: the error message fading
   in when it first appears. Added as a `devDependency` and registered in
   `tailwind.config.ts`'s `plugins` array.

Two durations, applied consistently:

- **150ms** for hover/press feedback (buttons, chips, links).
- **300ms ease-out** for content changes (factor bar width, loading opacity,
  the error message's fade-in).

Both mechanisms are plain CSS transitions/animations, so both are already
covered by the `prefers-reduced-motion` block in `globals.css` (lines 64-75),
which zeroes every `transition-duration` and `animation-duration` on the
page. No component-level opt-out is needed.

## Touch points

**Marketing**

- `src/components/ui/button-link.tsx` — add `active:scale-[0.97]` with a
  150ms transform transition, alongside the existing `transition-colors`.
- `src/components/ui/chip.tsx` — add a 150ms `transition-colors` to the
  remove (`×`) button's hover state.
- `src/components/home/faq-section.tsx` — add a 150ms `transition-colors` to
  the question text in `<summary>` on hover, matching the icon's existing
  transition.
- `src/components/marketing/site-header.tsx` — no change; nav links already
  transition.

**Draft tool**

- `src/components/draft/role-selector.tsx` — add a 150ms `transition-colors`
  to the inactive button's border/color hover state.
- `src/components/draft/enemy-picks.tsx` — add a 150ms `transition-colors`
  to the champion-suggestion button's border/color hover state.
- `src/components/draft/factor-bars.tsx` — add a 300ms ease-out
  `transition-[width]` to the bar fill (`<i>` element), so a recommendation
  update glides instead of snapping.
- `src/components/draft/draft-tool.tsx` — the results wrapper gets a 300ms
  `transition-opacity`, dropping to a reduced opacity while
  `aria-busy="true"`; the error message gets `animate-in fade-in
  duration-300` from `tailwindcss-animate` so it fades in on first render
  instead of appearing instantly.

## Testing

Existing component tests assert on classes and behavior, not computed
styles, so adding transition/animation utility classes to `className`
strings does not change what those tests check — no test should need to
change. `npm test` and `npx tsc --noEmit` must still pass. Manual check in
the browser: hover states feel smooth, the factor bars glide on a role
change and on a priority-slider update, and the loading/error states are
visibly transitioning rather than snapping.
