import { describe, expect, it } from "vitest";
import { validateNickname } from "./nickname";

describe("validateNickname", () => {
  it.each(["abc", "Faker", "the_best-mid", "a".repeat(20), "Zed2026"])("accepts %s", (value) => {
    expect(validateNickname(value)).toEqual({ ok: true, nickname: value });
  });

  it("trims surrounding spaces", () => {
    expect(validateNickname("  Faker  ")).toEqual({ ok: true, nickname: "Faker" });
  });

  it("rejects a nickname shorter than 3 characters", () => {
    expect(validateNickname("ab")).toEqual({ ok: false, error: "Le pseudo doit faire au moins 3 caractères." });
  });

  it("rejects a nickname longer than 20 characters", () => {
    expect(validateNickname("a".repeat(21))).toEqual({ ok: false, error: "Le pseudo doit faire au plus 20 caractères." });
  });

  it.each(["with space", "élodie", "emoji🙂", "dot.name", "at@name"])("rejects the characters in %s", (value) => {
    expect(validateNickname(value)).toEqual({
      ok: false,
      error: "Utilisez seulement des lettres sans accent, des chiffres, « _ » et « - »."
    });
  });
});
