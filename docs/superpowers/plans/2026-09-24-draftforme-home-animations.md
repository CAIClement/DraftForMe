# Home Page Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate the home page: a Hextech hero (drifting backdrop, word-by-word title, popping card with a sheen) and once-only scroll reveals below it, with the top pick's bars filling and score counting up.

**Architecture:** CSS keyframes in `src/app/globals.css`, built on the existing motion tokens. Two small client components in `src/components/motion/` (`Reveal`, `CountUp`) sharing a tiny `visibility.ts` helper; one server component (`HextechBackdrop`). The hero animates with pure CSS on load; sections below use `Reveal`. Home sections stay server components.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 3, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-09-24-draftforme-home-animations-design.md`

**Branch:** `feat/home-animations` (already created from `main`, spec committed).

**Rules that apply to every task** (from `CLAUDE.md`):
- Colours only through CSS variables / Tailwind tokens. No hex, `rgb()` or `text-white` in components; `rgb()` is allowed only when defining a token in `globals.css`.
- User-facing text is French and unchanged by this work.
- Do not modify `src/components/draft/*` (`Verdict`, `Alternatives`, `FactorBars` are shared with the draft tool), the engine, the seed or `ml/`.
- `npm run ci` must pass at every commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/motion/visibility.ts` (create) | `prefersReducedMotion()` and `onceVisible(element, callback)`: the only code that touches `matchMedia` / `IntersectionObserver` |
| `src/components/motion/reveal.tsx` (create) | Client wrapper that toggles `data-reveal` from absent → `pending` → `shown` |
| `src/components/motion/count-up.tsx` (create) | Client number that counts from 0 to its real value once visible |
| `src/components/motion/hextech-backdrop.tsx` (create) | Server markup for the hero's glows and floating diamonds |
| `src/test/motion.ts` (create) | Test helpers: fake `IntersectionObserver`, reduced-motion stub |
| `src/app/globals.css` (modify) | Two colour tokens, the home keyframes and classes |
| `src/components/home/hero.tsx` (modify) | Backdrop, word-by-word title, CSS rise/pop/sheen classes |
| `src/components/home/signals-section.tsx` (modify) | Reveals, halo, `CountUp` on the score |
| `src/components/home/method-section.tsx` (modify) | Reveals on header and steps |
| `src/components/home/data-section.tsx` (modify) | Reveals on text, points, trust card |
| `src/components/home/faq-section.tsx` (modify) | Reveal on both columns |
| `src/components/home/cta-section.tsx` (modify) | Reveal on the box, sheen on the button |

---

### Task 1: Test helpers, `visibility.ts` and `Reveal`

**Files:**
- Create: `src/test/motion.ts`
- Create: `src/components/motion/visibility.ts`
- Create: `src/components/motion/reveal.tsx`
- Test: `src/components/motion/reveal.test.tsx`

- [ ] **Step 1: Write the test helpers**

`src/test/motion.ts`:

```ts
import { vi } from "vitest";

/**
 * jsdom has neither IntersectionObserver nor matchMedia. The motion components
 * treat "missing" as "show everything at once", so tests that want to see the
 * animated path install these fakes explicitly.
 */
export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly observed = new Set<Element>();
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.add(element);
  }

  unobserve(element: Element) {
    this.observed.delete(element);
  }

  disconnect() {
    this.observed.clear();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Reports the element as intersecting, as the browser would on scroll. */
  enter(element: Element) {
    this.callback(
      [{ target: element, isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

export function installFakeObserver() {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
}

export function observerOf(element: Element): FakeIntersectionObserver {
  const observer = FakeIntersectionObserver.instances.find((instance) => instance.observed.has(element));
  if (!observer) throw new Error("element is not observed");
  return observer;
}

export function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {}
  }));
}
```

- [ ] **Step 2: Write the failing `Reveal` tests**

`src/components/motion/reveal.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeIntersectionObserver, installFakeObserver, observerOf, stubReducedMotion } from "@/test/motion";
import { Reveal } from "./reveal";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Reveal", () => {
  it("renders its content with no reveal state on the server, so nothing is hidden without JavaScript", () => {
    const html = renderToString(<Reveal>Bonjour</Reveal>);

    expect(html).toContain("Bonjour");
    expect(html).not.toContain("data-reveal");
  });

  it("waits hidden, then shows once the element scrolls into view, and stops observing", () => {
    installFakeObserver();
    stubReducedMotion(false);
    render(<Reveal>Bonjour</Reveal>);
    const element = screen.getByText("Bonjour");

    expect(element).toHaveAttribute("data-reveal", "pending");
    const observer = observerOf(element);
    expect(observer.options?.threshold).toBe(0.15);

    act(() => observer.enter(element));

    expect(element).toHaveAttribute("data-reveal", "shown");
    expect(observer.observed.has(element)).toBe(false);
  });

  it("stays in its final state under reduced motion", () => {
    installFakeObserver();
    stubReducedMotion(true);
    render(<Reveal>Bonjour</Reveal>);

    expect(screen.getByText("Bonjour")).not.toHaveAttribute("data-reveal");
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it("shows at once when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    stubReducedMotion(false);
    render(<Reveal>Bonjour</Reveal>);

    expect(screen.getByText("Bonjour")).toHaveAttribute("data-reveal", "shown");
  });

  it("passes its delay as a CSS variable and renders the requested element", () => {
    render(
      <ul>
        <Reveal as="li" delay={120}>
          Bonjour
        </Reveal>
      </ul>
    );
    const element = screen.getByText("Bonjour");

    expect(element.tagName).toBe("LI");
    expect(element.style.getPropertyValue("--reveal-delay")).toBe("120ms");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/motion/reveal.test.tsx`
Expected: FAIL, `Failed to resolve import "./reveal"`.

- [ ] **Step 4: Write `visibility.ts`**

`src/components/motion/visibility.ts`:

```ts
/**
 * The two browser facts the home page's motion depends on. Both are read
 * defensively: when either API is missing, callers show content in its final
 * state rather than leaving it hidden.
 */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function canObserve(): boolean {
  return typeof IntersectionObserver === "function";
}

/**
 * Calls `onVisible` once, the first time at least 15 % of `element` is on
 * screen, then stops watching. Returns a cleanup for unmount. Without
 * IntersectionObserver it calls back immediately.
 */
export function onceVisible(element: Element, onVisible: () => void): () => void {
  if (!canObserve()) {
    onVisible();
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.unobserve(element);
      onVisible();
    },
    { threshold: 0.15 }
  );
  observer.observe(element);

  return () => observer.unobserve(element);
}
```

- [ ] **Step 5: Write `Reveal`**

`src/components/motion/reveal.tsx`:

```tsx
"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { onceVisible, prefersReducedMotion } from "./visibility";

type RevealState = "pending" | "shown" | undefined;

/**
 * Rises into view once, the first time it scrolls on screen. The server
 * renders no `data-reveal`, so without JavaScript (or under reduced motion)
 * the content is simply there. Meant for content below the fold: above it,
 * hiding on hydration would flash, so the hero uses CSS-only classes instead.
 */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children
}: {
  as?: "div" | "li";
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<RevealState>(undefined);

  useEffect(() => {
    if (!node || prefersReducedMotion()) return;
    setState("pending");
    return onceVisible(node, () => setState("shown"));
  }, [node]);

  const style = delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined;

  return (
    <Tag ref={setNode} data-reveal={state} className={className} style={style}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/motion/reveal.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/test/motion.ts src/components/motion/visibility.ts src/components/motion/reveal.tsx src/components/motion/reveal.test.tsx
git commit -m "feat: add a Reveal component for once-only scroll reveals"
```

---

### Task 2: `CountUp`

**Files:**
- Create: `src/components/motion/count-up.tsx`
- Test: `src/components/motion/count-up.test.tsx`

- [ ] **Step 1: Write the failing tests**

`src/components/motion/count-up.test.tsx`:

```tsx
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFakeObserver, observerOf, stubReducedMotion } from "@/test/motion";
import { CountUp } from "./count-up";

function fakeFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    get pending() {
      return queue.length;
    },
    run(now: number) {
      const batch = queue.splice(0);
      act(() => batch.forEach((callback) => callback(now)));
    }
  };
}

function parts(container: HTMLElement) {
  return {
    visible: container.querySelector('[aria-hidden="true"]'),
    spoken: container.querySelector(".sr-only")
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CountUp", () => {
  it("renders the real value on the server, visible and spoken", () => {
    const html = renderToString(<CountUp value={78} />);

    expect(html).toContain('<span aria-hidden="true">78</span>');
    expect(html).toContain('<span class="sr-only">78</span>');
  });

  it("counts from 0 to the real value once visible, and always speaks the real value", () => {
    installFakeObserver();
    stubReducedMotion(false);
    const frames = fakeFrames();
    const { container } = render(<CountUp value={78} />);
    const { visible, spoken } = parts(container);

    expect(visible).toHaveTextContent("0");
    expect(spoken).toHaveTextContent("78");

    const root = container.firstElementChild as Element;
    act(() => observerOf(root).enter(root));
    frames.run(1000);
    expect(visible).toHaveTextContent("0");
    expect(spoken).toHaveTextContent("78");

    frames.run(1550);
    expect(Number(visible?.textContent)).toBeGreaterThan(0);
    expect(Number(visible?.textContent)).toBeLessThan(78);

    frames.run(2100);
    expect(visible).toHaveTextContent("78");
    expect(frames.pending).toBe(0);
  });

  it("never animates under reduced motion", () => {
    installFakeObserver();
    stubReducedMotion(true);
    const frames = fakeFrames();
    const { container } = render(<CountUp value={78} />);

    expect(parts(container).visible).toHaveTextContent("78");
    expect(frames.pending).toBe(0);
  });

  it("never animates without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    stubReducedMotion(false);
    const frames = fakeFrames();
    const { container } = render(<CountUp value={78} />);

    expect(parts(container).visible).toHaveTextContent("78");
    expect(frames.pending).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/motion/count-up.test.tsx`
Expected: FAIL, `Failed to resolve import "./count-up"`.

- [ ] **Step 3: Write `CountUp`**

`src/components/motion/count-up.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { canObserve, onceVisible, prefersReducedMotion } from "./visibility";

const DURATION_MS = 1100;

/**
 * A real number that counts up to itself once it scrolls into view. The HTML
 * and the screen-reader text always carry the true value; the intermediate
 * digits are a visual effect only, hidden from assistive tech. With no
 * observer or under reduced motion it never leaves the true value.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!node || prefersReducedMotion() || !canObserve()) return;

    let frame = 0;
    setShown(0);
    const stop = onceVisible(node, () => {
      let start: number | null = null;
      const tick = (now: number) => {
        start ??= now;
        const progress = Math.min((now - start) / DURATION_MS, 1);
        setShown(Math.round(value * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });

    return () => {
      stop();
      cancelAnimationFrame(frame);
      setShown(value);
    };
  }, [node, value]);

  return (
    <span ref={setNode} className={className}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/motion/count-up.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/motion/count-up.tsx src/components/motion/count-up.test.tsx
git commit -m "feat: add a CountUp component that always speaks the real value"
```

---

### Task 3: Tokens, keyframes and classes in `globals.css`

**Files:**
- Modify: `src/app/globals.css`

No unit test: CSS is verified in the browser in Task 7.

- [ ] **Step 1: Add the two colour tokens**

In `:root`, directly after `--shadow: rgb(0 0 0 / 0.45);`, add:

```css
  /* The home page's light effects: glows, halo, sheen. The accent and spark
     colours, translucent. */
  --glow-accent: rgb(200 170 110 / 0.22);
  --glow-spark: rgb(10 200 185 / 0.16);
```

- [ ] **Step 2: Add the home motion rules**

Append at the end of the file:

```css
/* The home page's motion. The hero plays on load with CSS alone (`rise`,
   `word-rise`, `card-pop`), so hydration never hides what is already on
   screen. Below it, `Reveal` sets `data-reveal` and these rules play once.
   Every entrance uses `backwards`: the resting state is the visible one. */
@keyframes reveal-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes card-pop {
  from {
    opacity: 0;
    transform: perspective(900px) rotateX(14deg) scale(0.92);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* Sweeps during the first 40 % of the cycle, then rests: a glint every few
   seconds rather than a constant shimmer. */
@keyframes sheen {
  0% {
    background-position: 150% 0;
  }
  40%,
  100% {
    background-position: -100% 0;
  }
}

@keyframes halo {
  0%,
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    box-shadow: 0 0 28px 0 var(--glow-accent);
  }
}

@keyframes glow-drift {
  from {
    transform: rotate(0deg) scale(1);
  }
  to {
    transform: rotate(25deg) scale(1.15);
  }
}

@keyframes hex-float {
  0% {
    opacity: 0;
    transform: translateY(40px) rotate(45deg);
  }
  20% {
    opacity: 0.7;
  }
  100% {
    opacity: 0;
    transform: translateY(-320px) rotate(225deg);
  }
}

.rise {
  animation: reveal-up 600ms var(--ease-out) var(--reveal-delay, 0ms) backwards;
}

.word-rise {
  display: inline-block;
  animation: reveal-up 520ms var(--ease-overshoot) var(--reveal-delay, 0ms) backwards;
}

.card-pop {
  animation: card-pop 700ms var(--ease-overshoot) var(--reveal-delay, 0ms) backwards;
}

.sheen {
  position: relative;
  overflow: hidden;
}

.sheen::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(100deg, transparent 30%, var(--glow-accent) 50%, transparent 70%);
  background-size: 250% 100%;
  background-position: 150% 0;
  animation: sheen 5s ease-in-out 1.4s infinite;
  pointer-events: none;
}

.halo {
  animation: halo 3.5s ease-in-out infinite;
}

.hextech-glow {
  position: absolute;
  inset: -40%;
  background:
    radial-gradient(circle at 30% 30%, var(--glow-spark), transparent 40%),
    radial-gradient(circle at 70% 60%, var(--glow-accent), transparent 45%);
  animation: glow-drift 9s ease-in-out infinite alternate;
}

.hextech-diamond {
  position: absolute;
  bottom: 0;
  width: 8px;
  height: 8px;
  border: 1px solid var(--spark);
  opacity: 0;
  animation: hex-float 6s linear var(--float-delay, 0ms) infinite;
}

[data-reveal="pending"] {
  opacity: 0;
}

[data-reveal="shown"] {
  animation: reveal-up 600ms var(--ease-out) var(--reveal-delay, 0ms) backwards;
}

/* Factor bars fill from the left once their card is revealed. Scoped to
   `data-reveal`, so the draft tool's bars behave exactly as before. */
[data-reveal] .factor-bar-fill {
  transform-origin: left;
  transition:
    transform 900ms var(--ease-out) calc(var(--reveal-delay, 0ms) + 200ms),
    width var(--motion) var(--ease-out);
}

[data-reveal="pending"] .factor-bar-fill {
  transform: scaleX(0);
}

/* Under reduced motion the global block already collapses durations; this
   also drops the entrance delays, so nothing waits invisible. */
@media (prefers-reduced-motion: reduce) {
  .rise,
  .word-rise,
  .card-pop,
  [data-reveal] {
    animation-delay: 0ms !important;
  }
}
```

- [ ] **Step 3: Check the suite still passes**

Run: `npm run ci`
Expected: typecheck, lint and all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add the home page motion keyframes and glow tokens"
```

---

### Task 4: `HextechBackdrop` and the hero

**Files:**
- Create: `src/components/motion/hextech-backdrop.tsx`
- Modify: `src/components/home/hero.tsx`
- Test: `src/components/home/hero.test.tsx`

- [ ] **Step 1: Write the failing hero test**

`src/components/home/hero.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "./hero";

describe("Hero", () => {
  it("keeps the full title as the heading's accessible name despite the word-by-word animation", () => {
    render(<Hero recommendations={[]} caption={null} patch={null} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sachez quoi pick, avant la fin du timer." })
    ).toBeInTheDocument();
  });

  it("hides the animated backdrop from assistive tech", () => {
    const { container } = render(<Hero recommendations={[]} caption={null} patch={null} />);

    expect(container.querySelector(".hextech-glow")?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/home/hero.test.tsx`
Expected: the first test may already pass (today's `h1` has that text); the second FAILS because `.hextech-glow` does not exist. That is the expected red.

- [ ] **Step 3: Write `HextechBackdrop`**

`src/components/motion/hextech-backdrop.tsx`:

```tsx
import type { CSSProperties } from "react";

// Horizontal position (%) and start offset (ms) of each floating diamond. The
// last three only show from `sm` up, to keep phones calmer.
const DIAMONDS = [
  { x: 6, delay: 0 },
  { x: 18, delay: 2600 },
  { x: 34, delay: 1200 },
  { x: 52, delay: 4200 },
  { x: 66, delay: 700 },
  { x: 80, delay: 3400 },
  { x: 93, delay: 1900 }
];

/** The hero's decoration: drifting glows and rising diamonds. Purely visual. */
export function HextechBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hextech-glow" />
      {DIAMONDS.map((diamond, index) => (
        <i
          key={diamond.x}
          className={`hextech-diamond ${index >= 4 ? "hidden sm:block" : ""}`}
          style={{ left: `${diamond.x}%`, "--float-delay": `${diamond.delay}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the hero**

Replace `src/components/home/hero.tsx` with:

```tsx
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Alternatives } from "@/components/draft/alternatives";
import { Verdict } from "@/components/draft/verdict";
import { HextechBackdrop } from "@/components/motion/hextech-backdrop";
import { ButtonLink } from "@/components/ui/button-link";
import type { Recommendation } from "@/lib/recommendation/types";
import { Eyebrow } from "./eyebrow";

const TITLE = "Sachez quoi pick, avant la fin du timer.";

function delay(ms: number): CSSProperties {
  return { "--reveal-delay": `${ms}ms` } as CSSProperties;
}

/** One title word, rising in on its own beat. */
function Word({ index, children }: { index: number; children: ReactNode }) {
  return (
    <span className="word-rise" style={delay(60 + index * 70)}>
      {children}
    </span>
  );
}

/**
 * The right-hand panel is the engine's real answer for the default example,
 * rendered with the tool's own components -- not a mockup. With no data it
 * says so instead of inventing a result.
 *
 * Everything here animates on load with CSS alone: it is above the fold, so a
 * JavaScript reveal would flash the content away on hydration.
 */
export function Hero({
  recommendations,
  caption,
  patch
}: {
  recommendations: Recommendation[];
  caption: string | null;
  patch: string | null;
}) {
  const [top, ...rest] = recommendations;

  const facts = ["Sans inscription", "Données EUW · Emerald+", patch === null ? null : `Patch ${patch}`].filter(
    (fact): fact is string => fact !== null
  );

  return (
    <section className="relative overflow-hidden border-b border-rule bg-[linear-gradient(180deg,var(--paper)_0%,var(--paper-deep)_100%)]">
      <HextechBackdrop />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-24">
        <div>
          <div className="rise">
            <Eyebrow>Coach de draft · League of Legends</Eyebrow>
          </div>
          {/* The words are split for the animation; the label keeps the sentence whole for screen readers. */}
          <h1
            aria-label={TITLE}
            className="mt-4 text-[clamp(2.5rem,5.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          >
            <span aria-hidden="true">
              <Word index={0}>Sachez</Word> <Word index={1}>quoi</Word>{" "}
              <Word index={2}>
                <span className="text-accent">pick</span>,
              </Word>
              <br />
              <Word index={3}>avant</Word> <Word index={4}>la</Word> <Word index={5}>fin</Word>{" "}
              <Word index={6}>du</Word> <Word index={7}>timer.</Word>
            </span>
          </h1>
          <p className="rise mt-5 max-w-[48ch] text-[17px] leading-relaxed text-ink-muted" style={delay(620)}>
            Indiquez votre rôle et les champions déjà verrouillés en face. DraftForMe vous propose trois picks, classés
            sur des données de parties réelles, avec le détail de chaque critère.
          </p>
          <div className="rise mt-8 flex flex-col gap-3 sm:flex-row" style={delay(700)}>
            <ButtonLink href="/draft">
              Lancer une draft
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href="/#comment-ca-marche" variant="secondary">
              Comment ça marche
            </ButtonLink>
          </div>
          <ul className="rise mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-muted" style={delay(780)}>
            {facts.map((fact) => (
              <li key={fact} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-3.5 text-accent" strokeWidth={2.5} />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="card-pop sheen rounded-2xl border border-rule bg-surface p-3 shadow-[0_1px_2px_var(--shadow),0_12px_32px_-12px_var(--shadow)] sm:p-4"
          style={delay(450)}
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <span className="text-xs font-medium text-ink-muted">{caption ? `Exemple réel · ${caption}` : "Exemple"}</span>
            <span className="rounded-full border border-rule px-2 py-0.5 text-[11px] text-ink-faint">Lecture seule</span>
          </div>
          {top ? (
            <>
              <Verdict recommendation={top} />
              <Alternatives recommendations={rest} />
            </>
          ) : (
            <p className="rounded-xl border border-rule-soft bg-surface-sunk p-8 text-center text-sm text-ink-muted">
              L'exemple en direct n'est pas disponible pour le moment. L'outil reste accessible.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the hero test to verify it passes**

Run: `npx vitest run src/components/home/hero.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Full suite**

Run: `npm run ci`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/motion/hextech-backdrop.tsx src/components/home/hero.tsx src/components/home/hero.test.tsx
git commit -m "feat: animate the home hero with a Hextech backdrop and a word-by-word title"
```

---

### Task 5: Signals and method sections

**Files:**
- Modify: `src/components/home/signals-section.tsx`
- Modify: `src/components/home/method-section.tsx`
- Test: `src/components/home/signals-section.test.tsx`

- [ ] **Step 1: Write the failing signals test**

`src/components/home/signals-section.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/lib/recommendation/types";
import { SignalsSection } from "./signals-section";

function build(): Recommendation {
  return {
    championId: "galio",
    championName: "Galio",
    championImageUrl: undefined,
    totalScore: 77.6,
    metaScore: 72,
    playerScore: 84,
    counterScore: 91,
    rank: 7,
    winRate: 51.3,
    pickRate: 4.1,
    banRate: 2.8,
    games: 204556,
    totalRanked: 64,
    explanation: {
      summary: "Recommandé pour son matchup.",
      factors: [
        { key: "meta", label: "Force dans le patch", score: 72, weight: 60, detail: "", available: true },
        { key: "counter", label: "Matchup", score: 91, weight: 40, detail: "", available: true }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

describe("SignalsSection", () => {
  it("gives screen readers the real rounded score of the recommended pick", () => {
    render(<SignalsSection top={build()} />);

    expect(screen.getByText("78", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("keeps the weighting card out when there is no recommendation", () => {
    render(<SignalsSection top={undefined} />);

    expect(screen.queryByText("Pondération du pick recommandé")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/home/signals-section.test.tsx`
Expected: the first test FAILS (no `.sr-only` element yet); the second passes.

- [ ] **Step 3: Update `signals-section.tsx`**

Add these imports:

```tsx
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
```

Wrap the text column: replace the opening `<div>` of the left column (the one containing `<Eyebrow>Méthode</Eyebrow>`) and its closing `</div>` with `<Reveal>` / `</Reveal>`.

Replace the signals list items so each rises in turn:

```tsx
          <ul className="mt-8 divide-y divide-rule border-y border-rule">
            {SIGNALS.map((signal, index) => (
              <Reveal as="li" key={signal.title} delay={120 + index * 90} className="flex gap-4 py-4">
                <span className="grid size-9 flex-none place-items-center rounded-lg border border-rule bg-surface text-accent">
                  <signal.icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
                </span>
                <span>
                  <strong className="block text-[15px] font-semibold">{signal.title}</strong>
                  <span className="text-sm text-ink-muted">{signal.body}</span>
                </span>
              </Reveal>
            ))}
          </ul>
```

Replace the weighting card block (`{top && ( ... )}`) with:

```tsx
        {top && (
          <Reveal delay={150}>
            <div className="halo rounded-2xl border border-rule bg-surface p-6 shadow-[0_12px_32px_-16px_var(--shadow)] sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <ChampionAvatar name={top.championName} imageUrl={top.championImageUrl} size={44} />
                <span>
                  <span className="block text-xs text-ink-faint">Pondération du pick recommandé</span>
                  <strong className="text-lg font-semibold tracking-tight">{top.championName}</strong>
                </span>
                <span className="ml-auto text-right">
                  <strong className="block text-2xl font-semibold tabular-nums text-accent">
                    <CountUp value={Math.round(top.totalScore)} />
                  </strong>
                  <span className="text-xs text-ink-faint">score / 100</span>
                </span>
              </div>
              <FactorBars factors={top.explanation.factors} />
              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule-soft bg-rule-soft text-sm">
                <div className="bg-surface p-4">
                  <dt className="text-xs text-ink-faint">Classement winrate</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    #{top.rank} sur {top.totalRanked}
                  </dd>
                </div>
                {top.winRate !== null && (
                  <div className="bg-surface p-4">
                    <dt className="text-xs text-ink-faint">Taux de victoire</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{top.winRate.toFixed(1)} %</dd>
                  </div>
                )}
              </dl>
            </div>
          </Reveal>
        )}
```

Keep the existing comment `{/* The weights below are the example's real ones, straight from the engine. */}` above it.

- [ ] **Step 4: Update `method-section.tsx`**

Add `import { Reveal } from "@/components/motion/reveal";`.

Wrap the header's inner `<div>` (the one with `<Eyebrow>Comment ça marche</Eyebrow>` and `<SectionTitle ...>`) as `<Reveal>` … `</Reveal>`.

Replace the steps list with:

```tsx
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 120} className="rounded-2xl border border-rule bg-surface p-6">
              <span className="text-sm font-semibold tabular-nums text-accent">Étape {index + 1}</span>
              <h3 className="mb-2 mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </Reveal>
          ))}
        </ol>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/home`
Expected: PASS (hero and signals files).

- [ ] **Step 6: Full suite**

Run: `npm run ci`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/home/signals-section.tsx src/components/home/signals-section.test.tsx src/components/home/method-section.tsx
git commit -m "feat: reveal the signals and method sections, count up the top score"
```

---

### Task 6: Data, FAQ and CTA sections

**Files:**
- Modify: `src/components/home/data-section.tsx`
- Modify: `src/components/home/faq-section.tsx`
- Modify: `src/components/home/cta-section.tsx`

These are wrapper-only changes; their behaviour is covered by `reveal.test.tsx` and checked in the browser in Task 7.

- [ ] **Step 1: Update `data-section.tsx`**

Add `import { Reveal } from "@/components/motion/reveal";`.

Replace the left column's opening `<div>` / closing `</div>` with `<Reveal>` / `</Reveal>`, and the points list with:

```tsx
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {POINTS.map((point, index) => (
              <Reveal as="li" key={point.title} delay={120 + index * 90} className="border-t border-band-rule pt-4">
                <strong className="block text-sm font-semibold text-band-ink">{point.title}</strong>
                <span className="text-sm text-band-muted">{point.body}</span>
              </Reveal>
            ))}
          </ul>
```

Replace the trust card (`<div className="rounded-2xl border border-band-rule bg-surface/40 p-6 sm:p-8">` … `</div>`) with:

```tsx
          <Reveal delay={150} className="rounded-2xl border border-band-rule bg-surface/40 p-6 sm:p-8">
            <TrustBar
              appearances={appearances}
              rankedChampions={rankedChampions}
              patch={patch}
              context={context}
              updatedAt={updatedAt}
            />
          </Reveal>
```

`TrustBar`'s numbers are deliberately not wrapped in `CountUp` (see the spec's Truthfulness section).

- [ ] **Step 2: Update `faq-section.tsx`**

Add `import { Reveal } from "@/components/motion/reveal";`.

Replace the heading column `<div>` … `</div>` with `<Reveal>` … `</Reveal>`, and the answers column `<div className="border-t border-rule">` … `</div>` with `<Reveal delay={120} className="border-t border-rule">` … `</Reveal>`.

- [ ] **Step 3: Update `cta-section.tsx`**

Replace the file with:

```tsx
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button-link";

export function CtaSection() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6 sm:pb-28">
      <Reveal className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-2xl border border-rule bg-surface p-8 shadow-[0_12px_32px_-16px_var(--shadow)] sm:p-12 lg:flex-row lg:items-center">
        <div>
          <h2 id="cta-title" className="text-[clamp(1.625rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.03em]">
            Préparez votre prochaine draft.
          </h2>
          <p className="mt-2 max-w-[52ch] text-base text-ink-muted">
            Aucune inscription, aucune configuration. Choisissez un rôle, le résultat s'affiche.
          </p>
        </div>
        {/* The wrapper carries the sheen so the shared ButtonLink stays untouched. */}
        <span className="sheen inline-flex rounded-lg">
          <ButtonLink href="/draft">
            Lancer une draft
            <ArrowRight aria-hidden className="size-4" />
          </ButtonLink>
        </span>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 4: Full suite**

Run: `npm run ci`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/data-section.tsx src/components/home/faq-section.tsx src/components/home/cta-section.tsx
git commit -m "feat: reveal the data, FAQ and call-to-action sections"
```

---

### Task 7: Browser verification and record

**Files:**
- Modify: `docs/superpowers/specs/2026-09-24-draftforme-home-animations-design.md` (only if something built differs from the spec)
- Modify: `.claude/work/current.md`

- [ ] **Step 1: Run the site**

Start the dev server with the preview tool (`.claude/launch.json`; `npm run dev` on port 3000, needs `.env.local`) and open `/`.

- [ ] **Step 2: Desktop check**

- Hero: glows drift, diamonds rise, title words land one by one, card pops then glints every ~5 s.
- Scroll down: each section rises once; scrolling back up does not replay.
- Signals card: bars fill from the left, score counts to its value, halo pulses.
- `read_console_messages`: no errors or hydration warnings.

- [ ] **Step 3: Mobile check**

`resize_window` preset `mobile`, reload: no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), only four diamonds visible.

- [ ] **Step 4: Reduced-motion check**

The preview pane cannot emulate `prefers-reduced-motion`. The component side is covered by the `Reveal` and `CountUp` tests (no `pending`, no animation frame). For the CSS side, confirm the new rule shipped, in `javascript_tool`:

```js
[...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]).some(
  (rule) => rule.media?.mediaText.includes("reduce") && rule.cssText.includes(".word-rise")
)
```

Expected: `true`. Tell the owner they can double-check in Chrome DevTools (Rendering → Emulate CSS prefers-reduced-motion): everything visible in its final state, nothing looping.

- [ ] **Step 5: Draft tool unchanged**

Open `/draft`, pick a role: the factor bars render at full width immediately, as before (no `data-reveal` ancestor there).

- [ ] **Step 6: Screenshot as proof, reset viewport**

Take a screenshot of the hero and of the signals card; `resize_window` preset `desktop`.

- [ ] **Step 7: Record and commit**

Update `.claude/work/current.md` with a `## feat/home-animations` entry (spec, plan, what's done, next: ship). If anything in the build diverged from the spec, update the spec to match.

```bash
git add .claude/work/current.md docs/superpowers/specs/2026-09-24-draftforme-home-animations-design.md
git commit -m "docs: record the home animations verification"
```
