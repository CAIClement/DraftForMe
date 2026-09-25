import Link from "next/link";
import { getDatabaseHost, getSiteHost, type SiteInfo } from "@/lib/legal/site-info";
import { ContactLink, ExternalLink, LEGAL_LINK_CLASS, LegalPage, LegalSection } from "./legal-page";

export function PrivacyPolicy({ info }: { info: SiteInfo }) {
  const siteHost = getSiteHost(info);
  const databaseHost = getDatabaseHost(info);

  return (
    <LegalPage title="Politique de confidentialité" lastUpdated={info.lastUpdated}>
      <LegalSection title="Responsable du traitement">
        <p>
          Le responsable du traitement est l&apos;éditeur de {info.siteName}
          {info.contactEmail ? (
            <>
              , joignable à l&apos;adresse <ContactLink email={info.contactEmail} />.
            </>
          ) : (
            "."
          )}
        </p>
      </LegalSection>

      <LegalSection title="Données traitées">
        <p>
          Si vous n&apos;avez pas de compte, aucune donnée vous concernant n&apos;est enregistrée dans la base de{" "}
          {info.siteName}. Deux traitements techniques ont lieu pour tous les visiteurs ; les sections « Compte » et
          « Avis » décrivent ce qui s&apos;y ajoute si vous vous connectez.
        </p>
        <h3 className="pt-2 font-medium text-ink">Journaux de l&apos;hébergeur</h3>
        <p>
          Comme tout hébergeur, {siteHost.name} enregistre pour chaque requête l&apos;adresse IP, le
          navigateur utilisé et la page demandée. Finalité : faire fonctionner et sécuriser le site. Base légale :
          l&apos;intérêt légitime de l&apos;éditeur. Ces journaux sont conservés par l&apos;hébergeur selon sa propre
          politique, consultable sur la{" "}
          <ExternalLink href={siteHost.privacyPolicy}>
            politique de confidentialité de son hébergeur
          </ExternalLink>
          {/* Vercel is US-based; this sentence is specific to Vercel and must be revisited if the site host changes. */}
          . Vercel étant situé aux États-Unis, ce transfert est encadré par le Data Privacy Framework UE–États-Unis.
        </p>
        <h3 className="pt-2 font-medium text-ink">Images des champions</h3>
        <p>
          Les images des champions sont chargées par votre navigateur directement depuis les serveurs de Riot Games
          (Data Dragon), qui reçoivent donc votre adresse IP. Finalité : afficher les champions. Base légale :
          l&apos;intérêt légitime de l&apos;éditeur. Ce traitement relève de la{" "}
          <ExternalLink href="https://www.riotgames.com/fr/privacy-notice">
            politique de confidentialité de Riot Games
          </ExternalLink>
          .
        </p>
      </LegalSection>

      <LegalSection title="Compte">
        <p>
          Si vous vous connectez avec Discord ou Google, {info.siteName} enregistre l&apos;identifiant de votre compte
          chez ce fournisseur, votre adresse e-mail, les informations de profil que le fournisseur transmet (nom
          d&apos;utilisateur ou nom, photo de profil), les dates de création du compte et de dernière connexion, et le
          pseudo que vous choisissez. Seul ce pseudo est affiché sur le site.
        </p>
        <p>
          Finalité : gérer votre compte et votre pseudo. Base
          légale : l&apos;exécution du service que vous demandez en créant un compte (article 6.1.b du RGPD). Durée
          de conservation : jusqu&apos;à la suppression de votre compte, que vous pouvez faire à tout moment depuis la
          page{" "}
          <Link href="/compte" className={LEGAL_LINK_CLASS}>
            Mon compte
          </Link>
          .
        </p>
        <p>
          Ces données sont stockées par {databaseHost.name}, sous-traitant de l&apos;éditeur (
          <ExternalLink href={databaseHost.privacyPolicy}>politique de confidentialité de Supabase</ExternalLink>).
          La connexion elle-même est traitée par Discord ou Google selon leurs propres règles :{" "}
          <ExternalLink href="https://discord.com/privacy">politique de confidentialité de Discord</ExternalLink>,{" "}
          <ExternalLink href="https://policies.google.com/privacy?hl=fr">
            politique de confidentialité de Google
          </ExternalLink>
          .
        </p>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation et d&apos;opposition sur les données vous concernant. Vous pouvez aussi supprimer votre compte
          vous-même depuis la page{" "}
          <Link href="/compte" className={LEGAL_LINK_CLASS}>
            Mon compte
          </Link>
          .
          {info.contactEmail && (
            <>
              {" "}
              Pour les exercer, écrivez à <ContactLink email={info.contactEmail} />.
            </>
          )}
        </p>
        <p>
          Vous pouvez aussi adresser une réclamation à la{" "}
          <ExternalLink href="https://www.cnil.fr/fr/plaintes">CNIL</ExternalLink>.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          {info.siteName} ne dépose aucun cookie de mesure d&apos;audience ni publicitaire. Si vous lancez une
          connexion, des cookies techniques sont déposés pour la mener à bien puis vous garder connecté : ils sont
          strictement nécessaires au service que vous demandez et exemptés de consentement. Ils sont supprimés à la
          déconnexion ou, si la connexion est abandonnée, à leur expiration. Aucun consentement ne vous est donc
          demandé.
        </p>
      </LegalSection>

      <LegalSection title="Avis">
        <p>
          Si vous donnez votre avis sur un matchup, {info.siteName} enregistre les éléments suivants, chacun associé à
          votre compte : votre choix de vote, le texte de vos commentaires (vous pouvez en laisser plusieurs par
          matchup), vos réactions (pour ou contre) sur les commentaires des autres joueurs, et le motif de vos
          éventuels signalements (spam, insultant, hors sujet ou autre), que seul l&apos;éditeur peut lire.
        </p>
        <p>
          Quand vous commentez, votre pseudo est affiché publiquement à côté de vos commentaires. Vos votes et vos
          réactions sont publics : ils sont enregistrés avec l&apos;identifiant technique de votre compte, que
          n&apos;importe qui peut consulter, et peuvent donc être rattachés à votre pseudo si vous avez commenté.
        </p>
        <p>
          Finalité : publier les avis de la communauté sur les matchups et permettre la modération. Base légale :
          l&apos;exécution du service que vous demandez en votant, en commentant ou en réagissant (article 6.1.b du
          RGPD) ; l&apos;intérêt légitime de l&apos;éditeur pour les signalements. Durée de conservation : vos votes,
          vos réactions et vos signalements sont conservés au plus tard jusqu&apos;à la suppression de votre compte ;
          vos commentaires, jusqu&apos;à ce que vous les supprimiez ou que l&apos;éditeur les retire, y compris après
          la suppression de votre compte.
        </p>
        <p>
          Tant que votre compte existe, vous pouvez modifier ou supprimer vos commentaires, et changer votre vote ou
          vos réactions. Le site ne permet pas de retirer un vote ou une réaction, seulement d&apos;en changer : pour en
          effacer un sans supprimer votre compte, demandez-le à l&apos;éditeur, comme indiqué dans la section « Vos
          droits ».
        </p>
        <p>
          Si vous supprimez votre compte, vos votes, vos réactions et vos signalements sont supprimés avec lui. Vos
          commentaires, en revanche, restent visibles : c&apos;est le compte qui est supprimé, pas le contenu que
          d&apos;autres joueurs sont venus lire ; ils ne sont plus associés à votre compte et leur auteur apparaît
          comme « Utilisateur supprimé ». Si vous voulez qu&apos;ils disparaissent, supprimez-les avant de supprimer
          votre compte : ensuite, vous ne pourrez plus le faire vous-même et devrez le demander à l&apos;éditeur, comme
          indiqué dans la section « Vos droits ».
        </p>
      </LegalSection>
    </LegalPage>
  );
}
