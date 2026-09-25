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
