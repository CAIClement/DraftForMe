import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("filters champions in the picker and shows champion portraits", () => {
    render(
      <CoachWorkspace
        champions={[
          {
            id: "ahri",
            name: "Ahri",
            imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Ahri.png"
          },
          {
            id: "zed",
            name: "Zed",
            imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Zed.png"
          }
        ]}
      />
    );

    expect(screen.getAllByAltText("Portrait de Ahri")).toHaveLength(2);

    const enemySearch = screen.getByLabelText("Rechercher un pick ennemi");
    fireEvent.change(enemySearch, { target: { value: "ahr" } });

    const enemyPicker = enemySearch.closest("div");
    expect(enemyPicker).not.toBeNull();
    expect(within(enemyPicker as HTMLElement).getByText("Ahri")).toBeInTheDocument();
    expect(within(enemyPicker as HTMLElement).queryByText("Zed")).not.toBeInTheDocument();
  });
});
