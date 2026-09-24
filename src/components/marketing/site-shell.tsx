import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// Header, main and footer for pages that have no header context of their own
// (legal and account pages). Async because the header shows the signed-in user.
export async function SiteShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
