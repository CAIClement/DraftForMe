import { describe, expect, it } from "vitest";
import { isRole, ROLE_LABELS, ROLES } from "./roles";

describe("roles", () => {
  it("lists the five roles in draft order", () => {
    expect(ROLES).toEqual(["top", "jungle", "mid", "adc", "support"]);
  });

  it("labels every role", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("rejects a string that is not a role", () => {
    expect(isRole("mid")).toBe(true);
    expect(isRole("botlane")).toBe(false);
  });
});
