import Link from "next/link";
import { AccountMenu } from "@/components/auth/account-menu";
import { ButtonLink } from "@/components/ui/button-link";
import type { CurrentUser } from "@/lib/auth/current-user";

const NAV = [
  { href: "/", label: "Accueil", page: "home" },
  { href: "/draft", label: "Outil de draft", page: "draft" }
] as const;

export function SiteHeader({
  context,
  current,
  user = null
}: {
  context?: string;
  current?: "home" | "draft";
  user?: CurrentUser | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
            DraftForMe
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-1 text-sm">
            {NAV.map((item) => {
              const active = item.page === current;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-md px-3 py-2 font-medium text-ink"
                      : "rounded-md px-3 py-2 text-ink-muted transition-colors duration-200 hover:text-ink"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-4">
          {context && <span className="hidden text-xs text-ink-faint md:inline">{context}</span>}
          {current === "home" && (
            <span className="hidden sm:inline-flex">
              <ButtonLink href="/draft" size="sm">
                Lancer une draft
              </ButtonLink>
            </span>
          )}
          <AccountMenu user={user} />
        </div>
      </div>
    </header>
  );
}
