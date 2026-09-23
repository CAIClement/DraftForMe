// Every fact the legal pages print that is not fixed wording lives here, so
// switching from legal anonymity to a named publisher, or adding the contact
// address, is a change to this file only.

export type Publisher =
  // LCEN art. 6-III-2: a non-professional publisher may stay anonymous and
  // name the host instead.
  | { mode: "anonymous" }
  | { mode: "identified"; name: string; address: string; director: string; siret?: string };

export type Host = {
  role: "site" | "database";
  name: string;
  address: string;
  website: string;
  privacyPolicy: string;
};

export type SiteInfo = {
  siteName: string;
  /** Empty until the owner creates the dedicated address; every line showing it is then hidden. */
  contactEmail: string;
  publisher: Publisher;
  hosts: Host[];
  /** ISO date (YYYY-MM-DD) of the last change to the legal texts. */
  lastUpdated: string;
};

export const SITE_INFO: SiteInfo = {
  siteName: "DraftForMe",
  contactEmail: "",
  publisher: { mode: "anonymous" },
  hosts: [
    {
      role: "site",
      name: "Vercel Inc.",
      address: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
      website: "https://vercel.com",
      privacyPolicy: "https://vercel.com/legal/privacy-policy"
    },
    {
      role: "database",
      name: "Supabase Pte. Ltd.",
      address: "65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513",
      website: "https://supabase.com",
      privacyPolicy: "https://supabase.com/privacy"
    }
  ],
  lastUpdated: "2026-09-23"
};

export function formatLegalDate(iso: string): string {
  // Parsed and printed in UTC so the day never moves with the reader's time zone.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}
