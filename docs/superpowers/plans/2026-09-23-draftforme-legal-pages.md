# Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a legal notice, a privacy policy and terms of use that describe the site as it is today, plus Riot's official disclaimer in the footer.

**Architecture:** Every variable fact (contact, publisher mode, hosts, last-updated date) lives in `src/lib/legal/site-info.ts`. The page content lives in presentational components under `src/components/legal/` that take that info as a prop, so tests render them with any config without mocking. The three routes under `src/app/(legal)/` are thin wrappers that pass the real config in; a route-group layout adds the site header and footer.

**Tech Stack:** Next.js 15 App Router (typedRoutes on), React 19, TypeScript, Tailwind with the colour tokens from `src/app/globals.css`, Vitest + Testing Library (jsdom, globals, setup in `src/test/setup.ts`).

**Spec:** `docs/superpowers/specs/2026-09-23-draftforme-legal-pages-design.md`

## Facts verified while planning (2026-09-23)

- Riot's required disclaimer (developer.riotgames.com/policies/general), verbatim with the product name substituted: `DraftForMe isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.` It must be "readily visible to players".
- Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, United States; certified under the EU-U.S. Data Privacy Framework. Runtime log retention depends on the plan (1 hour on Hobby, 1 day on Pro, up to 30 days with Observability Plus), so the policy links to Vercel's privacy policy rather than stating a figure.
- **Deviation from the spec:** the Supabase contracting entity is **Supabase Pte. Ltd.**, 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513 (from supabase.com/terms), not "Supabase Inc.".
- **Deviation from the spec:** the legal notice credits OP.GG without naming a patch. The patch is already shown in the site header from the data, and a hardcoded "16.3" would go stale when the stats are refreshed.

## Conventions every task follows

- Colours only through Tailwind token names (`text-ink`, `text-ink-muted`, `text-ink-faint`, `border-rule`, `text-accent`…). Never `text-white`, hex, `rgb()`.
- User-facing text in French; code, comments, identifiers in English.
- Missing data is hidden, never filled in: an empty `contactEmail` removes every sentence that would show it.
- This branch comes from `main`, which has no ESLint config yet (it is on the unmerged `feat/claude-code-scaffold` branch), so `npm run lint` is not part of the checks here. The checks are `npm test` and `npx tsc --noEmit`.
- **typedRoutes:** `next/link` hrefs are checked against `.next/types/link.d.ts`, which only `next dev`, `next build` or `next typegen` regenerate. Every typecheck step below therefore runs `npx next typegen && npx tsc --noEmit`; otherwise a new route is rejected by a stale route list.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/legal/site-info.ts` | Create | `SiteInfo` types, the real `SITE_INFO`, `formatLegalDate()` |
| `src/lib/legal/site-info.test.ts` | Create | Config sanity and date formatting |
| `src/components/legal/riot-disclaimer.tsx` (+ test) | Create | Riot's text, verbatim |
| `src/components/legal/legal-page.tsx` | Create | `LegalPage` (h1 + last-updated) and `LegalSection` (h2 + body) reading primitives |
| `src/components/legal/legal-notice.tsx` (+ test) | Create | Mentions légales content |
| `src/components/legal/privacy-policy.tsx` (+ test) | Create | Politique de confidentialité content |
| `src/components/legal/terms-of-use.tsx` (+ test) | Create | Conditions d'utilisation content |
| `src/app/(legal)/layout.tsx` | Create | Header + `<main>` + footer around the three pages |
| `src/app/(legal)/mentions-legales/page.tsx` | Create | Route + metadata |
| `src/app/(legal)/confidentialite/page.tsx` | Create | Route + metadata |
| `src/app/(legal)/conditions-utilisation/page.tsx` | Create | Route + metadata |
| `src/components/marketing/site-header.tsx` | Modify | `current` becomes optional (legal pages are neither home nor draft) |
| `src/components/marketing/site-footer.tsx` (+ new test) | Modify | Riot disclaimer and links to the three pages |

---

### Task 1: Site info config

**Files:**
- Create: `src/lib/legal/site-info.ts`
- Test: `src/lib/legal/site-info.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/legal/site-info.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatLegalDate, SITE_INFO } from "./site-info";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/legal/site-info.test.ts`
Expected: FAIL, cannot resolve `./site-info`.

- [ ] **Step 3: Write the implementation**

`src/lib/legal/site-info.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/legal/site-info.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legal/site-info.ts src/lib/legal/site-info.test.ts
git commit -m "feat: add the legal site info config"
```

---

### Task 2: Riot disclaimer

**Files:**
- Create: `src/components/legal/riot-disclaimer.tsx`
- Test: `src/components/legal/riot-disclaimer.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/legal/riot-disclaimer.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/legal/riot-disclaimer.test.tsx`
Expected: FAIL, cannot resolve `./riot-disclaimer`.

- [ ] **Step 3: Write the implementation**

`src/components/legal/riot-disclaimer.tsx`:

```tsx
// Riot's developer policy requires this exact text, in English, somewhere
// readily visible. Do not translate or paraphrase it.
export const RIOT_DISCLAIMER =
  "DraftForMe isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

export function RiotDisclaimer({ className }: { className?: string }) {
  return (
    <p lang="en" className={className}>
      {RIOT_DISCLAIMER}
    </p>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/legal/riot-disclaimer.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/legal/riot-disclaimer.tsx src/components/legal/riot-disclaimer.test.tsx
git commit -m "feat: add Riot's official disclaimer component"
```

---

### Task 3: Reading primitives, optional header state, legal layout

**Files:**
- Create: `src/components/legal/legal-page.tsx`
- Create: `src/app/(legal)/layout.tsx`
- Modify: `src/components/marketing/site-header.tsx` (the `SiteHeader` signature)
- Test: `src/components/marketing/site-header.test.tsx` (add one case)

- [ ] **Step 1: Write the failing test**

Add this case inside the existing `describe("SiteHeader", ...)` block in `src/components/marketing/site-header.test.tsx`:

```tsx
  it("marks no page as current when rendered outside home and the tool", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Outil de draft" })).not.toHaveAttribute("aria-current");
  });
```

- [ ] **Step 2: Run the typecheck to verify it fails**

Run: `npx next typegen && npx tsc --noEmit`
Expected: FAIL, `Property 'current' is missing` on `<SiteHeader />`. (Vitest does not typecheck, so the runtime test already passes; the typecheck is the failing signal here.)

- [ ] **Step 3: Make `current` optional**

In `src/components/marketing/site-header.tsx`, change the signature line:

```tsx
export function SiteHeader({ context, current }: { context?: string; current?: "home" | "draft" }) {
```

Nothing else in the file changes: `item.page === current` is already false for every item when `current` is undefined, and the CTA is already only shown when `current === "home"`.

- [ ] **Step 4: Create the reading primitives**

`src/components/legal/legal-page.tsx`:

```tsx
import type { ReactNode } from "react";
import { formatLegalDate } from "@/lib/legal/site-info";

export function LegalPage({
  title,
  lastUpdated,
  children
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-ink-faint">Dernière mise à jour : {formatLegalDate(lastUpdated)}</p>
      <div className="mt-10 space-y-10">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 text-[15px] leading-7 text-ink-muted">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 transition-colors duration-200 hover:text-accent-pale"
    >
      {children}
    </a>
  );
}
```

- [ ] **Step 5: Create the route-group layout**

`src/app/(legal)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function LegalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run src/components/marketing/site-header.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/legal/legal-page.tsx "src/app/(legal)/layout.tsx" src/components/marketing/site-header.tsx src/components/marketing/site-header.test.tsx
git commit -m "feat: add the legal pages layout and reading primitives"
```

---

### Task 4: Mentions légales

**Files:**
- Create: `src/components/legal/legal-notice.tsx`
- Create: `src/app/(legal)/mentions-legales/page.tsx`
- Test: `src/components/legal/legal-notice.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/legal/legal-notice.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SITE_INFO, type SiteInfo } from "@/lib/legal/site-info";
import { RIOT_DISCLAIMER } from "./riot-disclaimer";
import { LegalNotice } from "./legal-notice";

const anonymous: SiteInfo = { ...SITE_INFO, contactEmail: "", publisher: { mode: "anonymous" } };

describe("LegalNotice", () => {
  it("names the hosts and no identity when the publisher is anonymous", () => {
    render(<LegalNotice info={anonymous} />);

    expect(screen.getByText(/Vercel Inc\./)).toBeInTheDocument();
    expect(screen.getByText(/Supabase Pte\. Ltd\./)).toBeInTheDocument();
    expect(screen.getByText(/article 6-III-2/)).toBeInTheDocument();
    expect(screen.queryByText(/Directeur de la publication/)).not.toBeInTheDocument();
  });

  it("shows name, address and director when the publisher is identified", () => {
    render(
      <LegalNotice
        info={{
          ...anonymous,
          publisher: { mode: "identified", name: "Jean Test", address: "1 rue de l'Exemple, 75000 Paris", director: "Marie Test" }
        }}
      />
    );

    expect(screen.getByText("Jean Test", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("1 rue de l'Exemple, 75000 Paris")).toBeInTheDocument();
    expect(screen.getByText(/Directeur de la publication/)).toBeInTheDocument();
    expect(screen.getByText("Marie Test")).toBeInTheDocument();
    expect(screen.queryByText(/SIRET/)).not.toBeInTheDocument();
    expect(screen.queryByText(/article 6-III-2/)).not.toBeInTheDocument();
  });

  it("shows the SIRET when there is one", () => {
    render(
      <LegalNotice
        info={{
          ...anonymous,
          publisher: { mode: "identified", name: "A", address: "B", director: "C", siret: "123 456 789 00012" }
        }}
      />
    );

    expect(screen.getByText("123 456 789 00012")).toBeInTheDocument();
  });

  it("hides the contact line while no address is configured", () => {
    render(<LegalNotice info={anonymous} />);
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("shows the contact address as a mailto link once configured", () => {
    render(<LegalNotice info={{ ...anonymous, contactEmail: "contact@example.com" }} />);
    expect(screen.getByRole("link", { name: "contact@example.com" })).toHaveAttribute("href", "mailto:contact@example.com");
  });

  it("carries Riot's disclaimer and credits the data sources", () => {
    render(<LegalNotice info={anonymous} />);

    expect(screen.getByText(RIOT_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText(/OP\.GG/)).toBeInTheDocument();
    expect(screen.getByText(/Data Dragon/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/legal/legal-notice.test.tsx`
Expected: FAIL, cannot resolve `./legal-notice`.

- [ ] **Step 3: Write the component**

`src/components/legal/legal-notice.tsx`:

```tsx
import type { SiteInfo } from "@/lib/legal/site-info";
import { ExternalLink, LegalPage, LegalSection } from "./legal-page";
import { RiotDisclaimer } from "./riot-disclaimer";

export function LegalNotice({ info }: { info: SiteInfo }) {
  const { publisher } = info;

  return (
    <LegalPage title="Mentions légales" lastUpdated={info.lastUpdated}>
      <LegalSection title="Éditeur du site">
        {publisher.mode === "anonymous" ? (
          <p>
            {info.siteName} est un projet personnel, non professionnel et non commercial. Conformément à
            l&apos;article 6-III-2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie
            numérique, son éditeur a choisi de rester anonyme ; ses coordonnées ont été communiquées à
            l&apos;hébergeur ci-dessous.
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-ink-faint">Éditeur</dt>
            <dd>{publisher.name}</dd>
            <dt className="text-ink-faint">Adresse</dt>
            <dd>{publisher.address}</dd>
            {publisher.siret && (
              <>
                <dt className="text-ink-faint">SIRET</dt>
                <dd>{publisher.siret}</dd>
              </>
            )}
            <dt className="text-ink-faint">Directeur de la publication</dt>
            <dd>{publisher.director}</dd>
          </dl>
        )}
        {info.contactEmail && (
          <p>
            Contact : <a href={`mailto:${info.contactEmail}`} className="text-accent underline underline-offset-2">{info.contactEmail}</a>
          </p>
        )}
      </LegalSection>

      <LegalSection title="Hébergement">
        <ul className="space-y-3">
          {info.hosts.map((host) => (
            <li key={host.name}>
              <span className="font-medium text-ink">{host.name}</span>
              {host.role === "site" ? " (hébergement du site)" : " (base de données)"}
              <br />
              {host.address}
              <br />
              <ExternalLink href={host.website}>{host.website.replace("https://", "")}</ExternalLink>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le code, les textes et la mise en page de {info.siteName} appartiennent à son éditeur. League of Legends, ses
          champions, leurs noms et leurs images sont la propriété de Riot Games, Inc.
        </p>
        <RiotDisclaimer className="text-sm text-ink-faint" />
      </LegalSection>

      <LegalSection title="Sources des données">
        <p>
          Les statistiques de jeu (taux de victoire, counters) proviennent d&apos;
          <ExternalLink href="https://op.gg">OP.GG</ExternalLink>. Les images des champions proviennent de Data Dragon,
          le service public de Riot Games.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
```

Note for the test on Data Dragon and OP.GG: both are matched by regex against text nodes; "OP.GG" is inside a link whose text is exactly `OP.GG`, and "Data Dragon" is inside the paragraph text. If `getByText(/OP\.GG/)` finds more than one element, change that assertion to `screen.getByRole("link", { name: "OP.GG" })`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/legal/legal-notice.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the route**

`src/app/(legal)/mentions-legales/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LegalNotice } from "@/components/legal/legal-notice";
import { SITE_INFO } from "@/lib/legal/site-info";

export const metadata: Metadata = {
  title: "Mentions légales — DraftForMe",
  description: "Éditeur, hébergeurs, propriété intellectuelle et sources des données de DraftForMe."
};

export default function LegalNoticePage() {
  return <LegalNotice info={SITE_INFO} />;
}
```

- [ ] **Step 6: Typecheck**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/legal/legal-notice.tsx src/components/legal/legal-notice.test.tsx "src/app/(legal)/mentions-legales/page.tsx"
git commit -m "feat: add the legal notice page"
```

---

### Task 5: Politique de confidentialité

**Files:**
- Create: `src/components/legal/privacy-policy.tsx`
- Create: `src/app/(legal)/confidentialite/page.tsx`
- Test: `src/components/legal/privacy-policy.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/legal/privacy-policy.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SITE_INFO, type SiteInfo } from "@/lib/legal/site-info";
import { PrivacyPolicy } from "./privacy-policy";

const noContact: SiteInfo = { ...SITE_INFO, contactEmail: "" };

describe("PrivacyPolicy", () => {
  it("has every expected section", () => {
    render(<PrivacyPolicy info={noContact} />);

    for (const title of [
      "Responsable du traitement",
      "Données traitées",
      "Vos droits",
      "Cookies",
      "Évolutions à venir"
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("states that no cookie is set", () => {
    render(<PrivacyPolicy info={noContact} />);
    // Said twice on purpose: in "Données traitées" and in "Cookies".
    expect(screen.getAllByText(/aucun cookie/i)).toHaveLength(2);
  });

  it("describes both technical flows with their processor's policy", () => {
    render(<PrivacyPolicy info={noContact} />);

    expect(screen.getByRole("link", { name: /politique de confidentialité de Vercel/i })).toHaveAttribute(
      "href",
      "https://vercel.com/legal/privacy-policy"
    );
    expect(screen.getByRole("link", { name: /politique de confidentialité de Riot Games/i })).toHaveAttribute(
      "href",
      "https://www.riotgames.com/fr/privacy-notice"
    );
    expect(screen.getByText(/Data Privacy Framework/)).toBeInTheDocument();
  });

  it("links to the CNIL complaint page", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.getByRole("link", { name: /CNIL/ })).toHaveAttribute("href", "https://www.cnil.fr/fr/plaintes");
  });

  it("hides every mention of the contact while it is empty", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.queryByRole("link", { name: /@/ })).not.toBeInTheDocument();
  });

  it("offers the contact to exercise rights once configured", () => {
    render(<PrivacyPolicy info={{ ...noContact, contactEmail: "contact@example.com" }} />);
    expect(screen.getAllByRole("link", { name: "contact@example.com" })[0]).toHaveAttribute(
      "href",
      "mailto:contact@example.com"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/legal/privacy-policy.test.tsx`
Expected: FAIL, cannot resolve `./privacy-policy`.

- [ ] **Step 3: Write the component**

`src/components/legal/privacy-policy.tsx`:

```tsx
import type { SiteInfo } from "@/lib/legal/site-info";
import { ExternalLink, LegalPage, LegalSection } from "./legal-page";

function ContactLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="text-accent underline underline-offset-2">
      {email}
    </a>
  );
}

export function PrivacyPolicy({ info }: { info: SiteInfo }) {
  const vercel = info.hosts.find((host) => host.role === "site");

  return (
    <LegalPage title="Politique de confidentialité" lastUpdated={info.lastUpdated}>
      <LegalSection title="Responsable du traitement">
        <p>
          Le responsable du traitement est l&apos;éditeur de {info.siteName}
          {info.contactEmail ? (
            <>
              , joignable à l&apos;adresse <ContactLink email={info.contactEmail} />.
            </>
          ) : (
            "."
          )}
        </p>
      </LegalSection>

      <LegalSection title="Données traitées">
        <p>
          {info.siteName} ne propose ni compte, ni formulaire, et ne dépose aucun cookie. Aucune donnée vous concernant
          n&apos;est enregistrée dans sa base. Seuls deux traitements techniques ont lieu lorsque vous consultez le site.
        </p>
        <h3 className="pt-2 font-medium text-ink">Journaux de l&apos;hébergeur</h3>
        <p>
          Comme tout hébergeur, {vercel?.name ?? "l'hébergeur"} enregistre pour chaque requête l&apos;adresse IP, le
          navigateur utilisé et la page demandée. Finalité : faire fonctionner et sécuriser le site. Base légale :
          l&apos;intérêt légitime de l&apos;éditeur. Ces journaux sont conservés par l&apos;hébergeur selon sa propre
          politique, consultable sur la{" "}
          <ExternalLink href={vercel?.privacyPolicy ?? "https://vercel.com/legal/privacy-policy"}>
            politique de confidentialité de Vercel
          </ExternalLink>
          . Vercel étant situé aux États-Unis, ce transfert est encadré par le Data Privacy Framework UE–États-Unis.
        </p>
        <h3 className="pt-2 font-medium text-ink">Images des champions</h3>
        <p>
          Les images des champions sont chargées par votre navigateur directement depuis les serveurs de Riot Games
          (Data Dragon), qui reçoivent donc votre adresse IP. Finalité : afficher les champions. Base légale :
          l&apos;intérêt légitime de l&apos;éditeur. Ce traitement relève de la{" "}
          <ExternalLink href="https://www.riotgames.com/fr/privacy-notice">
            politique de confidentialité de Riot Games
          </ExternalLink>
          .
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation et d&apos;opposition sur les données vous concernant.
          {info.contactEmail && (
            <>
              {" "}
              Pour les exercer, écrivez à <ContactLink email={info.contactEmail} />.
            </>
          )}
        </p>
        <p>
          Vous pouvez aussi adresser une réclamation à la{" "}
          <ExternalLink href="https://www.cnil.fr/fr/plaintes">CNIL</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          {info.siteName} ne dépose aucun cookie, ni de mesure d&apos;audience, ni publicitaire, ni de connexion. Aucun
          consentement ne vous est donc demandé.
        </p>
      </LegalSection>

      <LegalSection title="Évolutions à venir">
        <p>
          La création de comptes et des avis sur les matchups sont prévus. Cette politique sera mise à jour avant leur
          ouverture pour décrire les données qu&apos;ils impliquent.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/legal/privacy-policy.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the route**

`src/app/(legal)/confidentialite/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { SITE_INFO } from "@/lib/legal/site-info";

export const metadata: Metadata = {
  title: "Politique de confidentialité — DraftForMe",
  description: "Les données traitées quand vous consultez DraftForMe, vos droits, et les cookies (aucun)."
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicy info={SITE_INFO} />;
}
```

- [ ] **Step 6: Typecheck**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/legal/privacy-policy.tsx src/components/legal/privacy-policy.test.tsx "src/app/(legal)/confidentialite/page.tsx"
git commit -m "feat: add the privacy policy page"
```

---

### Task 6: Conditions d'utilisation

**Files:**
- Create: `src/components/legal/terms-of-use.tsx`
- Create: `src/app/(legal)/conditions-utilisation/page.tsx`
- Test: `src/components/legal/terms-of-use.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/legal/terms-of-use.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SITE_INFO } from "@/lib/legal/site-info";
import { TermsOfUse } from "./terms-of-use";

describe("TermsOfUse", () => {
  it("has every expected section", () => {
    render(<TermsOfUse info={SITE_INFO} />);

    for (const title of [
      "Objet",
      "Accès au service",
      "Nature des recommandations",
      "Propriété intellectuelle",
      "Responsabilité",
      "Droit applicable"
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("says recommendations are decision support, not a guarantee", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/aide à la décision/)).toBeInTheDocument();
  });

  it("links to the legal notice", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByRole("link", { name: "mentions légales" })).toHaveAttribute("href", "/mentions-legales");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/legal/terms-of-use.test.tsx`
Expected: FAIL, cannot resolve `./terms-of-use`.

- [ ] **Step 3: Write the component**

`src/components/legal/terms-of-use.tsx`:

```tsx
import Link from "next/link";
import type { SiteInfo } from "@/lib/legal/site-info";
import { LegalPage, LegalSection } from "./legal-page";

export function TermsOfUse({ info }: { info: SiteInfo }) {
  return (
    <LegalPage title="Conditions d'utilisation" lastUpdated={info.lastUpdated}>
      <LegalSection title="Objet">
        <p>
          Ces conditions encadrent l&apos;utilisation de {info.siteName}, un outil qui recommande des champions de League
          of Legends en fonction du rôle joué et des champions déjà choisis par l&apos;équipe adverse. Utiliser le site
          vaut acceptation de ces conditions.
        </p>
      </LegalSection>

      <LegalSection title="Accès au service">
        <p>
          Le site est gratuit et accessible sans inscription. L&apos;éditeur peut le modifier, le suspendre ou
          l&apos;arrêter à tout moment, sans préavis ; aucune disponibilité n&apos;est garantie.
        </p>
      </LegalSection>

      <LegalSection title="Nature des recommandations">
        <p>
          Les recommandations sont une aide à la décision, calculées à partir de statistiques publiques. Elles ne
          garantissent ni le résultat d&apos;une partie, ni l&apos;exactitude ou l&apos;actualité des données. Le choix
          final vous appartient.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le code, les textes et la mise en page du site appartiennent à son éditeur ; toute reproduction substantielle
          sans autorisation est interdite. League of Legends et tous les contenus associés sont la propriété de Riot
          Games, Inc. (voir les{" "}
          <Link href="/mentions-legales" className="text-accent underline underline-offset-2">
            mentions légales
          </Link>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          L&apos;éditeur ne peut être tenu responsable d&apos;un dommage résultant de l&apos;utilisation du site ou de
          l&apos;impossibilité d&apos;y accéder, dans les limites permises par la loi.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>Ces conditions sont régies par le droit français.</p>
      </LegalSection>
    </LegalPage>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/legal/terms-of-use.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the route**

`src/app/(legal)/conditions-utilisation/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TermsOfUse } from "@/components/legal/terms-of-use";
import { SITE_INFO } from "@/lib/legal/site-info";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — DraftForMe",
  description: "Les règles d'utilisation de DraftForMe."
};

export default function TermsOfUsePage() {
  return <TermsOfUse info={SITE_INFO} />;
}
```

- [ ] **Step 6: Typecheck**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors (typedRoutes accepts `/mentions-legales` because the route now exists).

- [ ] **Step 7: Commit**

```bash
git add src/components/legal/terms-of-use.tsx src/components/legal/terms-of-use.test.tsx "src/app/(legal)/conditions-utilisation/page.tsx"
git commit -m "feat: add the terms of use page"
```

---

### Task 7: Footer

**Files:**
- Modify: `src/components/marketing/site-footer.tsx` (whole component)
- Test: `src/components/marketing/site-footer.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

`src/components/marketing/site-footer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RIOT_DISCLAIMER } from "@/components/legal/riot-disclaimer";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("links to the three legal pages", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Mentions légales" })).toHaveAttribute("href", "/mentions-legales");
    expect(screen.getByRole("link", { name: "Confidentialité" })).toHaveAttribute("href", "/confidentialite");
    expect(screen.getByRole("link", { name: "Conditions d'utilisation" })).toHaveAttribute(
      "href",
      "/conditions-utilisation"
    );
  });

  it("keeps the site links", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Outil de draft" })).toHaveAttribute("href", "/draft");
  });

  it("shows Riot's official disclaimer", () => {
    render(<SiteFooter />);
    expect(screen.getByText(RIOT_DISCLAIMER)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/marketing/site-footer.test.tsx`
Expected: FAIL on the legal links and the disclaimer; "keeps the site links" passes.

- [ ] **Step 3: Rewrite the footer**

`src/components/marketing/site-footer.tsx`:

```tsx
import Link from "next/link";
import { RiotDisclaimer } from "@/components/legal/riot-disclaimer";

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/draft", label: "Outil de draft" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/conditions-utilisation", label: "Conditions d'utilisation" }
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-[13px] text-ink-faint sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-semibold text-ink">DraftForMe</span>
          <nav aria-label="Pied de page" className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors duration-200 hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <RiotDisclaimer className="max-w-3xl text-xs leading-5" />
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/marketing/site-footer.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the whole suite and the typecheck**

Run: `npm test`
Expected: every test passes (no existing test asserts on the old "non affilié à Riot Games" sentence; if one does, update it to look for `RIOT_DISCLAIMER`).

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/site-footer.tsx src/components/marketing/site-footer.test.tsx
git commit -m "feat: link the legal pages and show Riot's disclaimer in the footer"
```

---

### Task 8: Visual check

**Files:** none changed unless a defect is found.

- [ ] **Step 1:** Start the dev server (needs `.env.local` with the Supabase variables, already present on the owner's machine) and open `/mentions-legales`, `/confidentialite`, `/conditions-utilisation`.
- [ ] **Step 2:** Check at 375 px wide and at desktop width: no horizontal scroll, headings and links readable against the navy background, the footer's five links wrap cleanly, the Riot disclaimer is visible.
- [ ] **Step 3:** Check the header on a legal page: no link marked current, no "Lancer une draft" button.
- [ ] **Step 4:** If anything is fixed, rerun `npm test` and `npx tsc --noEmit`, then commit with `fix: ...`.
- [ ] **Step 5:** Update the spec's "Decisions" table for the two deviations recorded at the top of this plan (Supabase entity, no patch in the data-source credit) and commit with `docs: record the legal pages deviations`.
