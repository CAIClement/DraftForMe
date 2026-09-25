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
