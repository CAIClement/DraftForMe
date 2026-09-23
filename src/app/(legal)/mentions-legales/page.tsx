import type { Metadata } from "next";
import { LegalNotice } from "@/components/legal/legal-notice";
import { SITE_INFO } from "@/lib/legal/site-info";

export const metadata: Metadata = {
  title: "Mentions légales — DraftForMe",
  description: "Éditeur, hébergeurs, propriété intellectuelle et sources des données de DraftForMe."
};

export default function LegalNoticePage() {
  return <LegalNotice info={SITE_INFO} />;
}
