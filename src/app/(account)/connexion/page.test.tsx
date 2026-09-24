import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  })
}));

import { getCurrentUser } from "@/lib/auth/current-user";
import SignInPage from "./page";

describe("SignInPage", () => {
  it("shows the sign-out failure message to a signed-in user instead of redirecting them away", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", nickname: "Faker" });

    const jsx = await SignInPage({ searchParams: Promise.resolve({ erreur: "deconnexion" }) });
    render(jsx);

    expect(screen.getByRole("alert")).toHaveTextContent("La déconnexion a échoué. Réessayez.");
  });

  it("redirects a signed-in user away when there is no error", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", nickname: "Faker" });

    await expect(SignInPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/");
  });

  it("shows a generic failure message when nobody is signed in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const jsx = await SignInPage({ searchParams: Promise.resolve({ erreur: "1" }) });
    render(jsx);

    expect(screen.getByRole("alert")).toHaveTextContent("La connexion a échoué. Réessayez.");
  });
});
