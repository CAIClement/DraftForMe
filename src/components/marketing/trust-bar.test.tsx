import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustBar } from "./trust-bar";

describe("TrustBar", () => {
  it("shows the counts when they are known", () => {
    render(<TrustBar appearances={13991689} rankedChampions={55} patch="16.10" context="EUW" />);

    expect(screen.getByText("13 991 689")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
  });

  it("omits a count it does not have rather than showing a zero", () => {
    render(<TrustBar appearances={null} rankedChampions={null} patch="16.10" context="EUW" />);

    expect(screen.queryByText("Apparitions analysées")).not.toBeInTheDocument();
    expect(screen.queryByText("Champions classés")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
