import Link from "next/link";
import type { SiteInfo } from "@/lib/legal/site-info";
import { LEGAL_LINK_CLASS, LegalPage, LegalSection } from "./legal-page";

export function TermsOfUse({ info }: { info: SiteInfo }) {
  return (
    <LegalPage title="Conditions d'utilisation" lastUpdated={info.lastUpdated}>
      <LegalSection title="Objet">
        <p>
          Ces conditions encadrent l&apos;utilisation de {info.siteName}, un outil qui recommande des champions de League
          of Legends en fonction du rôle joué et des champions déjà choisis par l&apos;équipe adverse. Utiliser le site
          vaut acceptation de ces conditions.
        </p>
      </LegalSection>

      <LegalSection title="Accès au service">
        <p>
          Le site est gratuit et accessible sans inscription. L&apos;éditeur peut le modifier, le suspendre ou
          l&apos;arrêter à tout moment, sans préavis ; aucune disponibilité n&apos;est garantie.
        </p>
      </LegalSection>

      <LegalSection title="Nature des recommandations">
        <p>
          Les recommandations sont une aide à la décision, calculées à partir de statistiques publiques. Elles ne
          garantissent ni le résultat d&apos;une partie, ni l&apos;exactitude ou l&apos;actualité des données. Le choix
          final vous appartient.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le code, les textes et la mise en page du site appartiennent à son éditeur ; toute reproduction substantielle
          sans autorisation est interdite. League of Legends et tous les contenus associés sont la propriété de Riot
          Games, Inc. (voir les{" "}
          <Link href="/mentions-legales" className={LEGAL_LINK_CLASS}>
            mentions légales
          </Link>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          L&apos;éditeur ne peut être tenu responsable d&apos;un dommage résultant de l&apos;utilisation du site ou de
          l&apos;impossibilité d&apos;y accéder, dans les limites permises par la loi.
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>Ces conditions sont régies par le droit français.</p>
      </LegalSection>
    </LegalPage>
  );
}
