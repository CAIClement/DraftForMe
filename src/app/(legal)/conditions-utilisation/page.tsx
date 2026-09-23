import type { Metadata } from "next";
import { TermsOfUse } from "@/components/legal/terms-of-use";
import { SITE_INFO } from "@/lib/legal/site-info";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — DraftForMe",
  description: "Les règles d'utilisation de DraftForMe."
};

export default function TermsOfUsePage() {
  return <TermsOfUse info={SITE_INFO} />;
}
