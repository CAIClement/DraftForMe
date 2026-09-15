import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustBar } from "./trust-bar";

// The real seeded index: 70 264 508 appearances over 242 (champion, role) pairs.
describe("TrustBar", () => {
  it("shows the counts when they are known", () => {
    render(
      <TrustBar
        appearances={70264508}
        rankedChampions={242}
        patch="16.3"
        context="EUW · Emerald+"
        updatedAt="2026-09-14T08:30:00.000Z"
      />
    );

    expect(screen.getByText("70 264 508")).toBeInTheDocument();
    expect(screen.getByText("242")).toBeInTheDocument();
    expect(screen.getByText("16.3")).toBeInTheDocument();
  });

  it("omits a count it does not have rather than showing a zero", () => {
    render(
      <TrustBar appearances={null} rankedChampions={null} patch="16.3" context="EUW" updatedAt={null} />
    );

    expect(screen.queryByText("Apparitions analysées")).not.toBeInTheDocument();
    expect(screen.queryByText("Paires champion / rôle")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  // The patch used to be a hardcoded constant, so it could not be missing. It is
  // now derived from the seeded Data Dragon version and the tile has to vanish
  // rather than render "Patch null" or invent a plausible number.
  it("omits the patch tile rather than inventing a patch number", () => {
    render(
      <TrustBar appearances={70264508} rankedChampions={242} patch={null} context="EUW" updatedAt={null} />
    );

    expect(screen.queryByText("Patch")).not.toBeInTheDocument();
    expect(screen.getByText("70 264 508")).toBeInTheDocument();
  });

  it("renders the freshness date in French when it is known", () => {
    render(
      <TrustBar
        appearances={null}
        rankedChampions={null}
        patch={null}
        context="EUW"
        updatedAt="2026-09-14T08:30:00.000Z"
      />
    );

    expect(screen.getByText("À jour au")).toBeInTheDocument();
    expect(screen.getByText("14 septembre 2026")).toBeInTheDocument();
  });

  it("omits the freshness tile when the data carries no timestamp", () => {
    render(
      <TrustBar appearances={70264508} rankedChampions={242} patch="16.3" context="EUW" updatedAt={null} />
    );

    expect(screen.queryByText("À jour au")).not.toBeInTheDocument();
  });
});
