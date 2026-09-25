import { describe, expect, it } from "vitest";
import { parseOffset } from "./pagination";

describe("parseOffset", () => {
  it("defaults to 0 when the param is missing", () => {
    expect(parseOffset(undefined)).toBe(0);
  });

  it("accepts a non-negative integer", () => {
    expect(parseOffset("0")).toBe(0);
    expect(parseOffset("20")).toBe(20);
  });

  it.each(["", "-20", "2.5", "1e3", " 20", "abc", "99999999999999999999"])("falls back to 0 for %j", (value) => {
    expect(parseOffset(value)).toBe(0);
  });

  it("falls back to 0 when the param is repeated", () => {
    expect(parseOffset(["20", "40"])).toBe(0);
  });
});
