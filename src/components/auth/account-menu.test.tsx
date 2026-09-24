import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/compte/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/draft" }));

import { AccountMenu } from "./account-menu";

describe("AccountMenu", () => {
  it("offers to sign in, coming back to the current page", () => {
    render(<AccountMenu user={null} />);
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion?next=%2Fdraft");
  });

  it("shows the nickname, the account link and sign-out when signed in", () => {
    render(<AccountMenu user={{ id: "user-1", nickname: "Faker" }} />);

    expect(screen.getByRole("link", { name: "Faker" })).toHaveAttribute("href", "/compte");
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Se connecter" })).not.toBeInTheDocument();
  });

  it("asks a signed-in user without a nickname to choose one", () => {
    render(<AccountMenu user={{ id: "user-1", nickname: null }} />);
    expect(screen.getByRole("link", { name: "Choisir un pseudo" })).toHaveAttribute(
      "href",
      "/compte/pseudo?next=%2Fdraft"
    );
  });
});
