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
          Le site est gratuit. Ses outils sont accessibles sans inscription ; un compte est nécessaire pour donner
          votre avis sur les matchups. L&apos;éditeur peut modifier, suspendre ou arrêter le site à
          tout moment, sans préavis ; aucune disponibilité n&apos;est garantie.
        </p>
      </LegalSection>

      <LegalSection title="Compte">
        <p>
          Vous pouvez créer un compte avec Discord ou Google si vous avez au moins 13 ans. Vous choisissez un pseudo
          public : il ne doit ni usurper l&apos;identité d&apos;une autre personne, ni être injurieux, haineux ou
          contraire à la loi. L&apos;éditeur peut renommer ou supprimer un compte qui enfreint ces règles. Vous pouvez
          supprimer votre compte à tout moment depuis la page{" "}
          <Link href="/compte" className={LEGAL_LINK_CLASS}>
            Mon compte
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Avis et commentaires">
        <p>
          Vous pouvez voter une fois par matchup et par compte, et laisser plusieurs commentaires : ils suivent la même
          règle que le pseudo (ni usurpation, ni propos injurieux, haineux ou contraires à la loi), et sont limités pour
          éviter de poster trop vite. Vos votes, vos réactions et vos commentaires sont publics. Tant que votre compte
          existe, vous pouvez modifier ou supprimer vos commentaires, et changer votre vote ou vos réactions, mais pas
          les retirer depuis le site. Ces avis reflètent l&apos;opinion des joueurs qui les publient : comme les
          recommandations, ils ne sont pas une garantie, et ils n&apos;influencent pas les recommandations du site.
        </p>
        <p>
          Un signalement est enregistré et seul l&apos;éditeur peut le lire ; l&apos;éditeur modère le site lui-même et
          peut retirer un commentaire ou supprimer un compte qui enfreint ces règles. Si vous supprimez votre compte,
          vos commentaires ne sont pas supprimés avec lui : ils ne sont plus associés à votre compte et leur auteur
          apparaît comme « Utilisateur supprimé » (voir la{" "}
          <Link href="/confidentialite" className={LEGAL_LINK_CLASS}>
            politique de confidentialité
          </Link>
          ).
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
