# Micro-animations across the site

## Context

The owner asked for "small animations" across the site. Scoped during
brainstorming to **micro-interactions only**, on both the marketing pages and
the draft tool: hover and press feedback, and state transitions. No
scroll-triggered entrances, no animated counters.

The site already has a motion system, added with the draft board:

- Tokens in `src/app/globals.css`: `--motion` (240ms), `--motion-slow`
  (380ms), `--ease-out`, `--ease-overshoot`.
- Keyframes and classes built on them: `.pin-drop` and `.pin-ping` (a pick
  landing on the map), `.slot-rise` (board slots arriving in sequence),
  `.board-sweep` (the loading sweep), `.factor-bar-fill` (score bars gliding
  to a new width).
- A `prefers-reduced-motion` block that zeroes every transition and animation
  duration and stops loops.
- A hover convention: `transition-colors duration-200`, used in eight places
  (`ButtonLink`, header, footer, account menu, legal links, account pages).

So the draft board's big moments are already animated. What is left is
consistency: a handful of interactive elements still change colour on hover
with a hard snap, some have no hover state at all, and error messages pop in.

## Decision: no new dependency

An earlier draft of this spec, written against a stale branch, added the
`tailwindcss-animate` plugin. It is dropped. The only enter animation this
work needs is an error message fading in, and a plugin would introduce a
second animation convention, with its own durations, beside the token-based
one the board already uses. A six-line keyframe on the existing tokens does
the job.

## Changes

**New in `globals.css`**: a `fade-in` keyframe (opacity 0 to 1) and a
`.fade-in` class running it for `var(--motion)` with `var(--ease-out)` and
`backwards` fill, next to the board's keyframes. `backwards` for the same
reason as `.slot-rise`: the resting state is the visible one.

**Hover transitions that currently snap** get the existing
`transition-colors duration-200`:

| File | Element |
|---|---|
| `src/components/draft/champion-picker.tsx` | Champion grid buttons (`hover:border-accent`) |
| `src/components/draft/alternatives.tsx` | Interactive alternative cards (`hover:border-accent`) |
| `src/components/draft/draft-board.tsx` | The "Vous ?" button (`hover:border-accent hover:text-accent`) |
| `src/app/(account)/connexion/page.tsx` | The two legal links (`hover:text-ink`) |

**Hover states that do not transition at all today:**

- `src/components/home/method-section.tsx`: the "Ouvrir l'outil" link toggles
  `hover:underline`, and `text-decoration-line` cannot be animated. It becomes
  `underline decoration-transparent hover:decoration-current` with
  `transition-colors duration-200`, so the underline fades in instead.
- `src/components/home/faq-section.tsx`: the `<summary>` gets
  `transition-colors duration-200 hover:text-accent`. Its `+` icon keeps its
  own colour and rotation.
- `src/components/draft/draft-slot.tsx`: the empty and filled slot buttons
  have no hover state. They get a background shift with
  `transition-colors duration-200`: the empty slot goes
  `bg-surface-sunk` to `hover:bg-surface`, the filled slot `bg-surface` to
  `hover:bg-surface-sunk`. Deliberately not a border change: a
  `hover:border-*` utility would override the `border-l-team-ally` /
  `border-r-team-enemy` edge that tells the two teams apart.

**Press feedback**: `src/components/ui/button-link.tsx` gets
`active:scale-[0.97]`, and its `transition-colors` becomes `transition` (which
also covers `transform`), keeping `duration-200`.

**Error messages fade in**: every `role="alert"` paragraph gets `.fade-in`:
`draft-board.tsx`, `nickname-form.tsx`, `delete-account-form.tsx`,
`connexion/page.tsx`.

## Out of scope

- Animated score counter (`Score`): needs JS interpolation.
- Scroll-triggered section entrances on the home page.
- Animating the FAQ `<details>` height: needs JS or poorly supported CSS; the
  rotating icon already signals open/closed.
- The board's existing motion (pins, slot rise, sweep, factor bars): already
  done, unchanged.

## Accessibility

Everything added is a CSS transition or animation, so the existing
`prefers-reduced-motion` block already covers it. No component-level opt-out.

## Testing

No test asserts on the classes being changed (checked: the only `toHaveClass`
in the suite is on `RiotDisclaimer`), and these are CSS-only changes with no
behaviour to unit-test. Verification is: `npm test`, `npx tsc --noEmit` and
`npm run lint` stay green; then in the browser, computed styles confirm each
touched element has a non-zero `transition-duration` (or, for alerts, the
`fade-in` animation), and the draft slots keep their team edge colour on
hover. Reduced motion is not re-verified in the browser (the preview pane
cannot emulate it); it rests on the global block, which this work does not
touch.
