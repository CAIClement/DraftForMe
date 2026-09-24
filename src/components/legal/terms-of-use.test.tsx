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
      "Compte",
      "Avis et commentaires",
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

  it("sets the account rules", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/au moins 13 ans/)).toBeInTheDocument();
    expect(screen.getByText(/usurper l'identité/)).toBeInTheDocument();
    expect(screen.getByText(/renommer ou supprimer un compte/)).toBeInTheDocument();
  });

  it("sets the review rules", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/une fois par matchup et par compte/)).toBeInTheDocument();
    expect(screen.getByText(/poster trop vite/)).toBeInTheDocument();
    expect(screen.getByText(/ne sont pas une garantie/)).toBeInTheDocument();
    expect(screen.getByText(/n'influencent pas les recommandations/)).toBeInTheDocument();
    expect(screen.getByText(/retirer un commentaire ou supprimer un compte/)).toBeInTheDocument();
    expect(screen.getByText(/ils ne sont plus associés à votre compte/)).toBeInTheDocument();
    expect(screen.getByText(/« Utilisateur supprimé »/)).toBeInTheDocument();
    expect(screen.queryByText(/anonymisés/)).not.toBeInTheDocument();
    expect(screen.getByText(/Un signalement est enregistré et seul l'éditeur peut le lire/)).toBeInTheDocument();
    expect(screen.queryByText(/transmis à l'éditeur/)).not.toBeInTheDocument();
    expect(screen.getByText(/Tant que votre compte existe, vous pouvez modifier ou supprimer vos commentaires/)).toBeInTheDocument();
    expect(screen.getByText(/changer votre vote ou vos réactions, mais pas les retirer depuis le site/)).toBeInTheDocument();
    const reviews = screen.getByRole("heading", { level: 2, name: "Avis et commentaires" }).closest("section");
    expect(reviews?.textContent).not.toMatch(/à tout moment/);
    expect(screen.getByRole("link", { name: "politique de confidentialité" })).toHaveAttribute(
      "href",
      "/confidentialite"
    );
  });

  it("says votes, reactions and comments are public", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/Vos votes, vos réactions et vos commentaires sont publics/)).toBeInTheDocument();
  });

  it("says an account is needed to leave a review", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/un compte est nécessaire pour donner votre avis/)).toBeInTheDocument();
    expect(screen.queryByText(/n'est nécessaire pour aucune/)).not.toBeInTheDocument();
  });

  it("never doubles a full stop or spaces a punctuation mark", () => {
    const { container } = render(<TermsOfUse info={SITE_INFO} />);
    expect(container.textContent).not.toMatch(/\.\./);
    expect(container.textContent).not.toMatch(/\s[.,]/);
  });

  it("links to the legal notice", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByRole("link", { name: "mentions légales" })).toHaveAttribute("href", "/mentions-legales");
  });
});
