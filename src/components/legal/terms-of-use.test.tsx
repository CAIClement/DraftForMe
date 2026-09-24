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

  it("links to the legal notice", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByRole("link", { name: "mentions légales" })).toHaveAttribute("href", "/mentions-legales");
  });
});
