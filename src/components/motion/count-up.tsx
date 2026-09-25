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
