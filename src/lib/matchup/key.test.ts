import { describe, expect, it } from "vitest";
import { matchupHref, matchupKey, pairSegment, parsePairSegment } from "./key";

describe("matchupKey", () => {
  it("canonicalizes either input order to the same result", () => {
    const fromGarenFirst = matchupKey("garen", "darius", "top");
    const fromDariusFirst = matchupKey("darius", "garen", "top");

    expect(fromGarenFirst).toEqual({ role: "top", championLowId: "darius", championHighId: "garen" });
    expect(fromDariusFirst).toEqual(fromGarenFirst);
  });

  it("rejects a champion matched against itself", () => {
    expect(() => matchupKey("darius", "darius", "top")).toThrow(/two different champions/);
  });
});

describe("pairSegment / parsePairSegment", () => {
  it("round-trips a canonical pair", () => {
    const key = matchupKey("garen", "darius", "top");
    expect(pairSegment(key)).toBe("darius-vs-garen");
    expect(parsePairSegment(pairSegment(key))).toEqual({ championLowId: "darius", championHighId: "garen" });
  });

  it("rejects a reversed (non-canonical) segment", () => {
    expect(parsePairSegment("garen-vs-darius")).toBeNull();
  });

  it.each(["darius", "darius-vs-garen-vs-katarina", "-vs-garen", "darius-vs-"])(
    "rejects the malformed segment %s",
    (segment) => {
      expect(parsePairSegment(segment)).toBeNull();
    }
  );
});

describe("matchupHref", () => {
  it("builds the canonical duel URL regardless of input order", () => {
    expect(matchupHref("garen", "darius", "top")).toBe("/duel/top/darius-vs-garen");
    expect(matchupHref("darius", "garen", "top")).toBe("/duel/top/darius-vs-garen");
  });
});
