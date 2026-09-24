import type { ReactNode } from "react";
import { SiteShell } from "@/components/marketing/site-shell";

export default function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <SiteShell>{children}</SiteShell>;
}
