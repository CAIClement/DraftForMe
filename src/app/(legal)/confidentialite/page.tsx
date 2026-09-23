import type { Metadata } from "next";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { SITE_INFO } from "@/lib/legal/site-info";

export const metadata: Metadata = {
  title: "Politique de confidentialité — DraftForMe",
  description: "Les données traitées quand vous consultez DraftForMe, vos droits, et les cookies (aucun)."
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicy info={SITE_INFO} />;
}
