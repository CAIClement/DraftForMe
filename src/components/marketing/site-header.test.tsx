import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("@/app/compte/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

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

  it("shows the account menu for the user it is given", () => {
    render(<SiteHeader current="home" user={{ id: "user-1", nickname: "Faker" }} />);
    expect(screen.getByRole("link", { name: "Faker" })).toHaveAttribute("href", "/compte");
  });

  it("offers to sign in when nobody is signed in", () => {
    render(<SiteHeader current="home" user={null} />);
    expect(screen.getByRole("link", { name: "Se connecter" })).toBeInTheDocument();
  });
});
