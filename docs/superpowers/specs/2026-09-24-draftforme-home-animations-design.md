# DraftForMe Home Page Animations Design

Date: 2026-09-24

## Summary

The home page gains motion. The hero gets the full "Hextech" treatment: an animated backdrop, a word-by-word title, and a card that pops in and catches a recurring gold sheen. Every section below it reveals once as it scrolls into view, with the recommended pick's weighting bars filling and its score counting up to its real value.

Everything is CSS keyframes plus two small client components. No dependency is added, the engine is untouched, and the draft tool's shared components (`Verdict`, `Alternatives`, `FactorBars`) are not modified.

## Current Context

`src/app/page.tsx` renders six server-component sections from `src/components/home/`: `Hero`, `SignalsSection`, `MethodSection`, `DataSection`, `FaqSection`, `CtaSection`. None of them moves today.

The only motion on the site lives in `src/app/globals.css` for the draft board (`pin-drop`, `pin-ping`, `slot-rise`, `board-sweep`, `.factor-bar-fill`), built on the tokens `--motion`, `--motion-slow`, `--ease-out`, `--ease-overshoot`. A global `prefers-reduced-motion: reduce` block collapses every animation and transition to 0.01 ms and one iteration.

No home section has a test today.

## Decisions

| Question | Decision |
|---|---|
| Intensity | Hextech ("C") in the hero, lighter scroll reveals ("B") everywhere below. Chosen by the owner from live demos |
| Technique | CSS keyframes in `globals.css` + a `Reveal` and a `CountUp` client component. No `motion`/Framer, no canvas |
| Scroll reveals | Play once per element, at about 15 % visibility, never replay on scroll back |
| Count-up | Only the recommended pick's score in `SignalsSection`. `TrustBar` statistics stay static |
| Shared draft components | Untouched; animation is applied around them |

## What Moves

### Hero

- **Backdrop** (`HextechBackdrop`): two large radial glows, cyan (`--spark`) and gold (`--accent`), drifting and scaling on a 9 s alternate loop; about seven small diamond outlines in cyan rising and fading on staggered 6 s loops. Fewer diamonds under the `sm` breakpoint. Decorative only: `aria-hidden`, `pointer-events: none`, behind the content.
- **Title**: each word rises in with the overshoot ease, staggered about 90 ms. "pick" keeps its gold colour.
- **Paragraph, buttons, facts list**: fade-up in sequence, 80 ms apart.
- **Example card**: pops in (slight scale and `rotateX`), then a gold sheen sweeps across it every few seconds.

### Below the hero (once, on entering the viewport)

- **SignalsSection**: the three criteria rise in sequence. The weighting card's factor bars fill left to right, its score counts up, and a soft gold halo pulses around it.
- **MethodSection**: the three steps rise one after another.
- **DataSection**: the text column and its three points rise in sequence. The `TrustBar` card fades up; its numbers are not animated.
- **FaqSection**: a simple fade-up.
- **CtaSection**: fades up; its button carries the same recurring sheen as the hero card.

## Components

All new files live in `src/components/motion/`.

### `Reveal` (`reveal.tsx`, client)

`<Reveal as="div" delay={80} className=...>{children}</Reveal>`

- Server render: no `data-reveal` attribute, so the content is fully visible without JavaScript.
- On mount: sets `data-reveal="pending"` and observes itself with its own `IntersectionObserver` (threshold 0.15). When it intersects, it becomes `data-reveal="shown"` and is unobserved. One observer per element (about fifteen on the page) is simpler to test than a shared module-level one and costs nothing measurable.
- Used only below the hero. The hero animates on page load with pure CSS classes, so hydration never hides content that is already on screen.
- `delay` (ms) is passed as the CSS variable `--reveal-delay`.
- If `IntersectionObserver` is unavailable, it goes straight to `shown`.
- If the user prefers reduced motion, it does not set `pending` at all: the element stays in its final state.

### `CountUp` (`count-up.tsx`, client)

`<CountUp value={78} />`

- Server render and first client render output the real value.
- When the element becomes visible, the displayed digits animate from 0 to the value over about 1.1 s with a cubic ease-out, via `requestAnimationFrame`, then rest on the exact value.
- The animated digits are `aria-hidden`; a `sr-only` span always holds the real value.
- Under reduced motion, or without `IntersectionObserver`, it never animates.

### `HextechBackdrop` (`hextech-backdrop.tsx`, server)

Pure markup: the glow layer and the diamonds, with per-diamond position and delay set inline as CSS variables. The hero section gets `relative overflow-hidden` and its content sits above the backdrop.

### Hero title

The `h1` keeps its accessible name through `aria-label` with the full sentence; the word spans inside are `aria-hidden`.

## Styles (`globals.css`)

New keyframes next to the board's: `reveal-up`, `word-rise`, `card-pop`, `sheen`, `halo`, `glow-drift`, `hex-float`, each built on the existing motion and easing tokens.

- `[data-reveal="pending"]` hides and offsets; `[data-reveal="shown"]` plays `reveal-up` with `animation-delay: var(--reveal-delay, 0ms)`.
- Factor bars: `[data-reveal="pending"] .factor-bar-fill` is `transform: scaleX(0)` with `transform-origin: left`; once shown it transitions to `scaleX(1)`. `factor-bars.tsx` is unchanged, so the draft tool's bars behave as today.
- New colour tokens `--glow-accent` and `--glow-spark` (the accent and spark colours with alpha) feed the glows, halo and sheen. No hardcoded colour in components.

The existing reduced-motion block already neutralises every new animation. Looping ones (drift, float, sheen, halo) stop after one imperceptible iteration there.

## Truthfulness

The site never shows an invented number. The count-up is the one place a non-final number is briefly painted, so:

- The real value is in the HTML and in the `sr-only` span at all times.
- It is limited to one score, derived from the engine's real output for the example.
- No JavaScript, reduced motion, or no observer: the real value is shown from the start.
- Volume statistics (`TrustBar`) are never animated, so no count ever looks like a figure being computed.

## Testing

Vitest, next to the code:

- `reveal.test.tsx`: no attribute on first render before effects; `pending` after mount; `shown` when the mocked observer reports an intersection; the element is unobserved afterwards; stays unset under mocked reduced motion; goes to `shown` without `IntersectionObserver`.
- `count-up.test.tsx`: initial render contains the real value; the `sr-only` span contains the real value throughout; under reduced motion no animation frame is requested.
- `hero.test.tsx`: the `h1` exposes the full sentence as its accessible name.

Manual check in the browser on `npm run dev`: desktop, mobile width, and emulated reduced motion (everything visible, in its final state, nothing looping).

`npm run ci` passes at every commit.

## Out of Scope

- Animations on any page other than `/`.
- Changes to the draft tool, the engine, the seed or `ml/`.
- Mouse-reactive or canvas effects.
