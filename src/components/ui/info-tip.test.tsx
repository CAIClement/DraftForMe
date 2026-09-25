import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InfoTip } from "./info-tip";

function renderTip() {
  return render(
    <div>
      <InfoTip label="Matchup" text="Part de 50, l'adversaire direct compte double." />
      <p>Ailleurs</p>
    </div>
  );
}

describe("InfoTip", () => {
  it("is closed until clicked", () => {
    renderTip();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on click and describes its button", () => {
    renderTip();
    const button = screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" });

    fireEvent.click(button);

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("l'adversaire direct compte double");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-describedby", tip.id);
  });

  it("closes on a second click", () => {
    renderTip();
    const button = screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    renderTip();
    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" }));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on a click elsewhere", () => {
    renderTip();
    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" }));

    fireEvent.mouseDown(screen.getByText("Ailleurs"));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  // It sits inside clickable table rows; opening it must not select the row.
  it("does not let its click reach the element around it", () => {
    let reached = false;
    render(
      <div onClick={() => (reached = true)}>
        <InfoTip label="Score" text="Note sur 100." />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Score ?" }));

    expect(reached).toBe(false);
  });
});
