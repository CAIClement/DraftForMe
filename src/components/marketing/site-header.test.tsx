import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  it("marks the landing page as current on /", () => {
    render(<SiteHeader current="home" />);

    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Outil de draft" })).not.toHaveAttribute("aria-current");
  });

  it("links the tool to /draft and marks it current there", () => {
    render(<SiteHeader current="draft" context="Patch 16.3 · EUW · Emerald+" />);

    const tool = screen.getByRole("link", { name: "Outil de draft" });
    expect(tool).toHaveAttribute("href", "/draft");
    expect(tool).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Patch 16.3 · EUW · Emerald+")).toBeInTheDocument();
  });

  it("marks no page as current when rendered outside home and the tool", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Outil de draft" })).not.toHaveAttribute("aria-current");
  });
});
