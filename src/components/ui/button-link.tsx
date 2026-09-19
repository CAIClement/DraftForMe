import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

const VARIANTS = {
  primary: "bg-accent text-on-accent shadow-sm hover:bg-accent-pale",
  secondary: "border border-rule bg-surface text-ink hover:border-ink-faint hover:bg-surface-sunk",
  inverse: "bg-band-ink text-band hover:bg-accent-pale"
} as const;

const SIZES = {
  md: "min-h-11 px-5 text-sm",
  sm: "min-h-9 px-3.5 text-[13px]"
} as const;

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  children
}: {
  href: Route;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 ${SIZES[size]} ${VARIANTS[variant]}`}
    >
      {children}
    </Link>
  );
}
