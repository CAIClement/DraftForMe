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
