import type { SiteInfo } from "@/lib/legal/site-info";
import { ExternalLink, LEGAL_LINK_CLASS, LegalPage, LegalSection } from "./legal-page";

function ContactLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className={LEGAL_LINK_CLASS}>
      {email}
    </a>
  );
}

export function PrivacyPolicy({ info }: { info: SiteInfo }) {
  const vercel = info.hosts.find((host) => host.role === "site");

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
          {info.siteName} ne propose ni compte, ni formulaire, et ne dépose aucun cookie. Aucune donnée vous concernant
          n&apos;est enregistrée dans sa base. Seuls deux traitements techniques ont lieu lorsque vous consultez le site.
        </p>
        <h3 className="pt-2 font-medium text-ink">Journaux de l&apos;hébergeur</h3>
        <p>
          Comme tout hébergeur, {vercel?.name ?? "l'hébergeur"} enregistre pour chaque requête l&apos;adresse IP, le
          navigateur utilisé et la page demandée. Finalité : faire fonctionner et sécuriser le site. Base légale :
          l&apos;intérêt légitime de l&apos;éditeur. Ces journaux sont conservés par l&apos;hébergeur selon sa propre
          politique, consultable sur la{" "}
          <ExternalLink href={vercel?.privacyPolicy ?? "https://vercel.com/legal/privacy-policy"}>
            politique de confidentialité de Vercel
          </ExternalLink>
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

      <LegalSection title="Vos droits">
        <p>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de
          limitation et d&apos;opposition sur les données vous concernant.
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
          {info.siteName} ne dépose aucun cookie, ni de mesure d&apos;audience, ni publicitaire, ni de connexion. Aucun
          consentement ne vous est donc demandé.
        </p>
      </LegalSection>

      <LegalSection title="Évolutions à venir">
        <p>
          La création de comptes et des avis sur les matchups sont prévus. Cette politique sera mise à jour avant leur
          ouverture pour décrire les données qu&apos;ils impliquent.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
