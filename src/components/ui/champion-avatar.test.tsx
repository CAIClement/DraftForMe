import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChampionAvatar } from "./champion-avatar";

describe("ChampionAvatar", () => {
  it("renders the portrait when an image is supplied", () => {
    render(<ChampionAvatar name="Ahri" imageUrl="https://example.test/ahri.png" />);

    expect(screen.getByAltText("Portrait de Ahri")).toBeInTheDocument();
  });

  it("falls back to initials when the image fails", () => {
    render(<ChampionAvatar name="Ahri" imageUrl="https://example.test/broken.png" />);

    fireEvent.error(screen.getByAltText("Portrait de Ahri"));

    expect(screen.getByText("Ah")).toBeInTheDocument();
  });

  it("renders initials when no image is supplied", () => {
    render(<ChampionAvatar name="Kai'Sa" />);

    expect(screen.getByText("Ka")).toBeInTheDocument();
  });
});
