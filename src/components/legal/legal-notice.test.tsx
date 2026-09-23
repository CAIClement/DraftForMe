import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SITE_INFO, type SiteInfo } from "@/lib/legal/site-info";
import { RIOT_DISCLAIMER } from "./riot-disclaimer";
import { LegalNotice } from "./legal-notice";

const anonymous: SiteInfo = { ...SITE_INFO, contactEmail: "", publisher: { mode: "anonymous" } };

describe("LegalNotice", () => {
  it("names the hosts and no identity when the publisher is anonymous", () => {
    render(<LegalNotice info={anonymous} />);

    expect(screen.getAllByText(/Vercel Inc\./).length).toBeGreaterThan(0);
    expect(screen.getByText(/Supabase Pte\. Ltd\./)).toBeInTheDocument();
    expect(screen.getByText(/article 1-1, II/)).toBeInTheDocument();
    expect(screen.getByText(/communiquées à son hébergeur, Vercel Inc\./)).toBeInTheDocument();
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
    expect(screen.queryByText(/article 1-1, II/)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/Contact :/)).not.toBeInTheDocument();
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
