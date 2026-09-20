import { describe, expect, it } from "vitest";
import {
  createDraftState,
  directOpponent,
  draftReducer,
  enemyPicksWithRoles,
  excludedChampionIds
} from "./draft-state";

const base = createDraftState({
  yourRole: "mid",
  enemyPicks: [{ championId: "zed", role: "mid" }]
});

describe("draftReducer", () => {
  it("places a champion on the requested lane", () => {
    const next = draftReducer(base, { type: "place", side: "enemy", role: "top", championId: "darius" });

    expect(next.enemy.top).toBe("darius");
  });

  // Your own lane is where the recommendation is rendered. Accepting a value
  // there would store something no view can ever show.
  it("refuses to fill your own lane", () => {
    const next = draftReducer(base, { type: "place", side: "ally", role: "mid", championId: "ahri" });

    expect(next.ally.mid).toBeNull();
    expect(next).toBe(base);
  });

  // Without this, moving from mid to top leaves the old ally pick stranded on
  // a lane the recommendation now occupies.
  it("empties the incoming lane when your role changes", () => {
    const withTop = draftReducer(base, { type: "place", side: "ally", role: "top", championId: "malphite" });
    const moved = draftReducer(withTop, { type: "setYourRole", role: "top" });

    expect(moved.yourRole).toBe("top");
    expect(moved.ally.top).toBeNull();
  });

  // The picker filters placed champions out, but the reducer is the guard that
  // survives a future caller that forgets to.
  it("refuses a champion already placed anywhere", () => {
    const next = draftReducer(base, { type: "place", side: "ally", role: "top", championId: "zed" });

    expect(next).toBe(base);
  });

  it("clears a lane", () => {
    const next = draftReducer(base, { type: "clear", side: "enemy", role: "mid" });

    expect(next.enemy.mid).toBeNull();
  });

  it("opens and closes the picker without touching the draft", () => {
    const open = draftReducer(base, { type: "openPicker", side: "enemy", role: "adc" });
    expect(open.picker).toEqual({ side: "enemy", role: "adc" });

    const closed = draftReducer(open, { type: "closePicker" });
    expect(closed.picker).toBeNull();
    expect(closed.enemy).toEqual(open.enemy);
  });
});

describe("selectors", () => {
  it("excludes every placed champion, both sides", () => {
    const withAlly = draftReducer(base, { type: "place", side: "ally", role: "top", championId: "malphite" });

    expect(excludedChampionIds(withAlly).sort()).toEqual(["malphite", "zed"]);
  });

  it("reports the enemy picks with their lanes", () => {
    expect(enemyPicksWithRoles(base)).toEqual([{ championId: "zed", role: "mid" }]);
  });

  it("reports the champion on your own lane as the direct opponent", () => {
    expect(directOpponent(base)).toBe("zed");
    expect(directOpponent(draftReducer(base, { type: "clear", side: "enemy", role: "mid" }))).toBeNull();
  });
});
