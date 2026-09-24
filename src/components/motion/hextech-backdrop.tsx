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
