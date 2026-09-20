import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiftMap } from "./rift-map";
import { createDraftState } from "@/lib/draft/draft-state";

const champions = [
  { id: "zed", name: "Zed" },
  { id: "malphite", name: "Malphite" }
];

const state = createDraftState({ yourRole: "mid", enemyPicks: [{ championId: "zed", role: "mid" }] });

describe("RiftMap", () => {
  it("renders one anchor per lane per side", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    expect(screen.getAllByRole("button")).toHaveLength(10);
  });

  // The map is a convenience layer. Its buttons must say the same thing the
  // side columns say, or keyboard users get a different product.
  it("names an occupied anchor by side, lane and champion", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Mid adverse : Zed" })).toBeInTheDocument();
  });

  it("names an empty anchor as empty", () => {
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Top adverse, vide" })).toBeInTheDocument();
  });

  it("marks your own lane rather than offering it as a slot", () => {
    render(
      <RiftMap
        state={state}
        champions={champions}
        recommended={{ championId: "ahri", championName: "Ahri", championImageUrl: undefined }}
        onSlotClick={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Votre lane, mid : Ahri recommandé" })).toBeInTheDocument();
  });

  it("reports which slot was clicked", () => {
    const onSlotClick = vi.fn();
    render(<RiftMap state={state} champions={champions} recommended={null} onSlotClick={onSlotClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Top adverse, vide" }));

    expect(onSlotClick).toHaveBeenCalledWith("enemy", "top");
  });
});
