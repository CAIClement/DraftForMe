import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoachWorkspace } from "./coach-workspace";

describe("CoachWorkspace", () => {
  it("shows a Riot ID field instead of Google or Discord login links", () => {
    render(<CoachWorkspace />);

    expect(screen.getByLabelText("Riot ID")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nom#TAG")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Discord" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Google" })).not.toBeInTheDocument();
  });
});
