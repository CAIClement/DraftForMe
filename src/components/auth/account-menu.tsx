"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/compte/actions";
import type { CurrentUser } from "@/lib/auth/current-user";

const LINK = "rounded-md px-3 py-2 text-sm text-ink-muted transition-colors duration-200 hover:text-ink";

export function AccountMenu({ user }: { user: CurrentUser | null }) {
  const next = encodeURIComponent(usePathname() ?? "/");

  if (!user) {
    return (
      <Link href={`/connexion?next=${next}` as Route} className={LINK}>
        Se connecter
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {user.nickname ? (
        <Link href="/compte" className={`${LINK} font-medium text-ink`}>
          {user.nickname}
        </Link>
      ) : (
        <Link href={`/compte/pseudo?next=${next}` as Route} className={LINK}>
          Choisir un pseudo
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className={LINK}>
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
