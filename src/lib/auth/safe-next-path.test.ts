import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it.each(["/", "/draft", "/compte?x=1", "/mentions-legales#editeur"])("keeps the internal path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "draft",
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/%0a/evil.com\n"
  ])("falls back to / for %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
