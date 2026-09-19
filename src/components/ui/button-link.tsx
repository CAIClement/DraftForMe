import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

const VARIANTS = {
  primary: "bg-ink text-white shadow-sm hover:bg-stone-800",
  secondary: "border border-rule bg-surface text-ink hover:border-ink-faint hover:bg-surface-sunk",
  inverse: "bg-white text-ink hover:bg-stone-100"
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
