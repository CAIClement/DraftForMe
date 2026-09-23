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
    expect(screen.queryByText(/Pour les exercer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/joignable/)).not.toBeInTheDocument();
  });

  it("offers the contact to exercise rights once configured", () => {
    render(<PrivacyPolicy info={{ ...noContact, contactEmail: "contact@example.com" }} />);
    const links = screen.getAllByRole("link", { name: "contact@example.com" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "mailto:contact@example.com");
    }
  });
});
