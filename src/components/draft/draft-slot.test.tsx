import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftSlot } from "./draft-slot";

describe("DraftSlot", () => {
  it("offers an empty slot for filling", () => {
    const onOpen = vi.fn();
    render(<DraftSlot side="enemy" role="top" champion={null} isYourLane={false} onOpen={onOpen} onClear={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Top adverse, vide" }));

    expect(onOpen).toHaveBeenCalledWith("enemy", "top");
  });

  it("offers to clear an occupied slot", () => {
    const onClear = vi.fn();
    render(
      <DraftSlot
        side="enemy"
        role="top"
        champion={{ id: "darius", name: "Darius" }}
        isYourLane={false}
        onOpen={vi.fn()}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Retirer Darius" }));

    expect(onClear).toHaveBeenCalledWith("enemy", "top");
  });

  // Your own lane holds the recommendation. Offering a picker there would
  // invite the player to answer the question they came to have answered.
  it("does not offer a picker on your own lane", () => {
    render(<DraftSlot side="ally" role="mid" champion={null} isYourLane onOpen={vi.fn()} onClear={vi.fn()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/vous/i)).toBeInTheDocument();
  });
});
