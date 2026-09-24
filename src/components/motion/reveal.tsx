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
