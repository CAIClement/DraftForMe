import { describe, expect, it } from "vitest";
import { formatLegalDate, getSiteHost, SITE_INFO, type SiteInfo } from "./site-info";

describe("SITE_INFO", () => {
  it("has either no contact yet or a well-formed e-mail address", () => {
    const email = SITE_INFO.contactEmail;
    expect(email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).toBe(true);
  });

  it("fills every identity field when the publisher is identified", () => {
    const publisher = SITE_INFO.publisher;
    if (publisher.mode === "identified") {
      expect(publisher.name.trim()).not.toBe("");
      expect(publisher.address.trim()).not.toBe("");
      expect(publisher.director.trim()).not.toBe("");
    }
  });

  it("lists Vercel and Supabase as hosts", () => {
    expect(SITE_INFO.hosts.map((host) => host.role)).toEqual(["site", "database"]);
  });

  it("stores the last update as an ISO date", () => {
    expect(SITE_INFO.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatLegalDate", () => {
  it("writes an ISO date the French way", () => {
    expect(formatLegalDate("2026-09-23")).toBe("23 septembre 2026");
  });

  it("does not shift the day with the local time zone", () => {
    expect(formatLegalDate("2026-01-01")).toBe("1 janvier 2026");
  });
});

describe("getSiteHost", () => {
  it("returns Vercel for SITE_INFO", () => {
    expect(getSiteHost(SITE_INFO).name).toBe("Vercel Inc.");
  });

  it("throws when there is no host with role \"site\"", () => {
    const info: SiteInfo = { ...SITE_INFO, hosts: SITE_INFO.hosts.filter((host) => host.role === "database") };
    expect(() => getSiteHost(info)).toThrow(/role "site"/);
  });
});
