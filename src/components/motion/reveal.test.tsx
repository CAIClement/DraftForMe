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
