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
