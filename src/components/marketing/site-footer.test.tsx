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
