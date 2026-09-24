import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SITE_INFO, type SiteInfo } from "@/lib/legal/site-info";
import { PrivacyPolicy } from "./privacy-policy";

const noContact: SiteInfo = { ...SITE_INFO, contactEmail: "" };

function sectionTitled(title: string): HTMLElement {
  const section = screen.getByRole("heading", { level: 2, name: title }).closest("section");
  if (!section) throw new Error(`No section titled ${title}`);
  return section;
}

describe("PrivacyPolicy", () => {
  it("has every expected section", () => {
    render(<PrivacyPolicy info={noContact} />);

    for (const title of [
      "Responsable du traitement",
      "Données traitées",
      "Compte",
      "Vos droits",
      "Cookies",
      "Avis"
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("says only session cookies are set, and only when signing in", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.getByText(/cookies techniques/)).toBeInTheDocument();
    expect(screen.getByText(/exemptés de consentement/)).toBeInTheDocument();
    expect(screen.queryByText(/ne propose ni compte/)).not.toBeInTheDocument();
  });

  it("describes the account data, its basis, its retention and the processors", () => {
    render(<PrivacyPolicy info={noContact} />);

    const account = within(sectionTitled("Compte"));
    expect(account.getByText(/article 6\.1\.b du RGPD/)).toBeInTheDocument();
    expect(account.getByText(/jusqu'à la suppression de votre compte/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /politique de confidentialité de Discord/ })).toHaveAttribute(
      "href",
      "https://discord.com/privacy"
    );
    expect(screen.getByRole("link", { name: /politique de confidentialité de Google/ })).toHaveAttribute(
      "href",
      "https://policies.google.com/privacy?hl=fr"
    );
    expect(screen.getByRole("link", { name: /politique de confidentialité de Supabase/ })).toHaveAttribute(
      "href",
      "https://supabase.com/privacy"
    );
    expect(screen.getAllByRole("link", { name: "Mon compte" })[0]).toHaveAttribute("href", "/compte");
  });

  it("no longer announces accounts as upcoming", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.queryByText(/création de comptes/)).not.toBeInTheDocument();
  });

  it("no longer announces matchup reviews as upcoming", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.queryByText(/sont prévus/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Évolutions à venir" })).not.toBeInTheDocument();
  });

  it("describes what an avis stores, including reactions and report reasons", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.getByText(/votre choix de vote/)).toBeInTheDocument();
    expect(screen.getByText(/vos réactions \(pour ou contre\)/)).toBeInTheDocument();
    expect(screen.getByText(/motif de vos éventuels signalements/)).toBeInTheDocument();
    expect(screen.getByText(/seul l'éditeur peut lire/)).toBeInTheDocument();

    const avis = within(sectionTitled("Avis"));
    expect(avis.getByText(/article 6\.1\.b du RGPD/)).toBeInTheDocument();
    expect(avis.getByText(/jusqu'à ce que l'éditeur retire le contenu/)).toBeInTheDocument();
  });

  it("says the nickname is shown publicly next to comments", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.getByText(/votre pseudo est affiché publiquement à côté de vos commentaires/)).toBeInTheDocument();
  });

  it("describes what happens to each kind of avis when the account is deleted", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.getByText(/vos votes, vos réactions et vos signalements sont supprimés avec lui/)).toBeInTheDocument();
    expect(screen.getByText(/supprimé, pas le contenu/)).toBeInTheDocument();
    expect(screen.getByText(/« Utilisateur supprimé »/)).toBeInTheDocument();
    expect(screen.getByText(/modifier ou supprimer vos commentaires à tout moment/)).toBeInTheDocument();
  });

  it("describes both technical flows with their processor's policy", () => {
    render(<PrivacyPolicy info={noContact} />);

    expect(screen.getByRole("link", { name: /politique de confidentialité de son hébergeur/i })).toHaveAttribute(
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

  it("never doubles a full stop or spaces a punctuation mark, with or without a contact address", () => {
    const { container: withoutContact } = render(<PrivacyPolicy info={noContact} />);
    expect(withoutContact.textContent).not.toMatch(/\.\./);
    expect(withoutContact.textContent).not.toMatch(/\s[.,]/);

    const { container: withContact } = render(
      <PrivacyPolicy info={{ ...noContact, contactEmail: "contact@example.com" }} />
    );
    expect(withContact.textContent).not.toMatch(/\.\./);
    expect(withContact.textContent).not.toMatch(/\s[.,]/);
  });
});
