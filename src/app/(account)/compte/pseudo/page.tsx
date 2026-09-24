import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { NicknameForm } from "@/components/auth/nickname-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = {
  title: "Choisir un pseudo — DraftForMe"
};

export default async function NicknamePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = safeNextPath(next);
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      `/connexion?next=${encodeURIComponent(`/compte/pseudo?next=${encodeURIComponent(safeNext)}`)}` as Route
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">
        {user.nickname ? "Changer de pseudo" : "Choisissez votre pseudo"}
      </h1>
      <p className="mt-3 mb-8 text-sm text-ink-muted">
        C&apos;est le seul nom affiché sur le site. Votre nom Discord ou Google n&apos;est jamais montré.
      </p>
      <NicknameForm defaultValue={user.nickname ?? undefined} next={safeNext} />
    </div>
  );
}
