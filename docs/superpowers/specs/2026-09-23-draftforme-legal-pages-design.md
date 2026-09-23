# DraftForMe Legal Pages Design

Date: 2026-09-23

## Summary

Add the legal pages a French website needs — legal notice (mentions légales), privacy policy (with a cookies section), and terms of use — written for the site as it exists today: no accounts, no forms, no cookies, no analytics. Replace the footer's informal "not affiliated with Riot Games" line with Riot's official Legal Jibber Jabber, and credit the data sources.

This is the first of three pieces of work. The owner also wants accounts and community reviews on matchups (votes, comments, up/downvotes). Order agreed: legal pages now, for the current site; accounts next; matchup reviews last. Each of the two later pieces updates the privacy policy and the terms of use before it ships.

## Why

- **The site has no legal pages at all.** French law (LCEN art. 1-1, I) requires a legal notice on any public site, and the GDPR requires telling visitors what data is processed, even when that is only hosting logs.
- **The footer's Riot line is not what Riot asks for.** Riot's policy for community projects requires its own disclaimer text, verbatim.
- **The texts must stay true.** The project's rule is that the site never shows an invented value. A generated policy would describe cookies, forms and analytics the site does not have; these pages describe only what the site actually does.

## What the site processes today (verified 2026-09-23)

| Source | Data | Notes |
|---|---|---|
| Vercel (hosting) | IP address, user agent, requested URL, in request logs | Vercel Inc., USA; transfer covered by the EU-US Data Privacy Framework |
| `ddragon.leagueoflegends.com` | Visitor IP, sent by the browser when it loads champion images (`image_url` in `champions`, rendered by `champion-avatar.tsx`) | Riot Games, Inc. |
| Supabase (database) | No visitor data: login is disabled (`/auth/login` redirects home), so no auth cookie is ever set | Supabase Pte. Ltd. |
| Fonts | None: `next/font/google` self-hosts at build time, no request to Google | — |
| Cookies, `localStorage`, analytics, ads | None | No cookie banner: there is nothing to consent to, and a banner would suggest otherwise |

## Decisions

| Question | Decision |
|---|---|
| Publisher identity | **Legal anonymity** (LCEN art. 1-1, II, non-professional publisher; renumbered by loi SREN, 2024): the legal notice names the hosting providers and a contact, not the owner. The owner has no legal structure yet and the site earns nothing. `site-info.ts` supports an `identified` mode (name, address, publication director, optional SIRET) for the day the site is monetised; switching is a config change, not a rewrite |
| Contact | A dedicated e-mail address the owner will create. Until it exists, `contactEmail` is empty and the contact line is **hidden**, like any missing data on the site. No build guard: the project is not public yet. Filling it is on the pre-launch checklist below |
| Format | Static TSX pages plus one config file. Rejected: MDX (a dependency and config for three rarely-changed pages, and it handles the anonymous/identified switch poorly); third-party policy generators (generic text that doesn't match the site, often a cookie-setting script, paid for full GDPR) |
| Cookies | A "Cookies" section inside the privacy policy stating none are set. No banner, no separate page |
| Riot disclaimer | Riot's official English text, verbatim, in the footer and the legal notice. Checked against Riot's current developer policy at implementation time rather than copied from memory |
| Data sources | Credited in the legal notice: OP.GG for statistics, Riot Data Dragon for champion images. No patch number: the header already shows it from the data, and a hardcoded one would go stale |
| Hosting log retention | Vercel's retention depends on the plan (1 hour on Hobby, 1 day on Pro, up to 30 days with Observability Plus, per its runtime logs docs on 2026-09-23), so the policy states no figure and links to Vercel's privacy policy |

## Design

### Files

| File | Responsibility |
|---|---|
| `src/lib/legal/site-info.ts` | The only place variable facts live: `contactEmail` (string, may be empty), `publisher` (`{ mode: "anonymous" }` or `{ mode: "identified"; name; address; director; siret? }`), `hosts` (Vercel and Supabase: legal name, address, website), `lastUpdated` (ISO date) |
| `src/app/(legal)/layout.tsx` | Reading layout shared by the three pages: site header and footer, narrow text column, heading hierarchy, colour tokens only |
| `src/app/(legal)/mentions-legales/page.tsx` | Publisher (per mode), contact (hidden if empty), hosts, intellectual property, Riot disclaimer, data sources |
| `src/app/(legal)/confidentialite/page.tsx` | Privacy policy |
| `src/app/(legal)/conditions-utilisation/page.tsx` | Terms of use |
| `src/components/legal/riot-disclaimer.tsx` | Riot's disclaimer text, used by the footer and the legal notice |
| `src/components/marketing/site-footer.tsx` | Replace the affiliation sentence with `<RiotDisclaimer />`; add links to the three pages |

Each page exports its own `metadata` (French title and description). All user-facing text is French, except Riot's disclaimer, which Riot requires in its own wording.

### Privacy policy content

1. **Controller:** the publisher, reachable at the contact e-mail (line hidden while empty).
2. **What is processed:** no account, no form, no cookie. Only the two technical flows in the table above (Vercel logs, IP sent to Riot's image CDN), each with its purpose, legal basis (legitimate interest: operating and securing the site), retention, processor, and transfers outside the EU.
3. **Your rights:** access, erasure, objection, restriction; how to exercise them (contact); the right to complain to the CNIL, with a link to cnil.fr.
4. **Cookies:** none are set today.
5. **Upcoming changes:** accounts and matchup reviews are planned, and this policy will be updated before they open.
6. **Last updated:** from `site-info.ts`.

### Terms of use content

Purpose of the service; free access with no availability guarantee; recommendations are decision support, not a guarantee of winning; intellectual property (the site's code and content, Riot's trademarks); limited liability; French law applies; last updated date. Nothing about accounts or user content yet: that arrives with the next two pieces of work.

## Testing

Vitest, next to the code:

- `site-info.test.ts`: when `contactEmail` is set, it is a valid address; `identified` mode requires `name`, `address` and `director`.
- `src/components/legal/legal-notice.test.tsx`: anonymous mode shows the hosts and no identity field; identified mode shows name, address and director, and hides the SIRET line when absent; the contact line is hidden when `contactEmail` is empty and shown when set.
- `riot-disclaimer.test.tsx`: the rendered text equals the official wording.
- `site-footer.test.tsx`: links to `/mentions-legales`, `/confidentialite`, `/conditions-utilisation`; the Riot disclaimer is rendered.
- `src/components/legal/privacy-policy.test.tsx` and `terms-of-use.test.tsx`: the expected sections render (including "Cookies" and the CNIL link).

The page content lives in components under `src/components/legal/` that take the `SiteInfo` as a prop; the routes pass the real `SITE_INFO`. Tests render the components with any config, so both publisher modes and both contact states are covered without mocking or editing the real config.

## Scope

- **In:** the three pages, their shared layout, `site-info.ts`, the Riot disclaimer component, footer changes, tests.
- **Out:** cookie banner (nothing to consent to); accounts; matchup reviews, comments and votes; moderation policy and the report button (they come with the reviews); any change to how the engine scores; deploying.

## Before the site goes public

- [ ] Create the dedicated contact address and set `contactEmail` in `src/lib/legal/site-info.ts`. Legally required even under anonymity.
- [ ] If the site starts earning money (ads, subscriptions, regular donations): switch `publisher` to `identified` and fill in the fields (a domiciliation address keeps the home address private). Identified mode also requires each host's **phone number** (LCEN art. 1-1, I): add a `phone` field to `Host`, taken from the hosts' own pages, not from memory.
- [ ] Check that Vercel actually holds the owner's identification details (name, address, phone), since the anonymous legal notice states they were given to the host (art. 1-1, II).
- [ ] The privacy policy does not mention that Riot Games, Inc. (USA) receives visitor IPs from outside the EU. Check whether Riot is certified under the EU-US Data Privacy Framework and add one sentence on that transfer.
- [ ] Re-read the privacy policy against what the site processes at that point.
