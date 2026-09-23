import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RIOT_DISCLAIMER, RiotDisclaimer } from "./riot-disclaimer";

// Riot's developer policy requires this wording verbatim; this literal is the
// reference, copied from developer.riotgames.com/policies/general on 2026-09-23.
const OFFICIAL =
  "DraftForMe isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

describe("RiotDisclaimer", () => {
  it("uses Riot's official wording", () => {
    expect(RIOT_DISCLAIMER).toBe(OFFICIAL);
  });

  it("renders the wording, marked as English", () => {
    const { container } = render(<RiotDisclaimer />);
    const paragraph = container.querySelector("p");

    expect(paragraph).toHaveTextContent(OFFICIAL);
    expect(paragraph).toHaveAttribute("lang", "en");
  });

  it("passes a class name through", () => {
    const { container } = render(<RiotDisclaimer className="text-xs" />);
    expect(container.querySelector("p")).toHaveClass("text-xs");
  });
});
