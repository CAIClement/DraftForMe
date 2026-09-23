import type { SiteInfo } from "@/lib/legal/site-info";
import { ExternalLink, LEGAL_LINK_CLASS, LegalPage, LegalSection } from "./legal-page";
import { RiotDisclaimer } from "./riot-disclaimer";

export function LegalNotice({ info }: { info: SiteInfo }) {
  const { publisher } = info;

  return (
    <LegalPage title="Mentions légales" lastUpdated={info.lastUpdated}>
      <LegalSection title="Éditeur du site">
        {publisher.mode === "anonymous" ? (
          <p>
            {info.siteName} est un projet personnel, non professionnel et non commercial. Conformément à
            l&apos;article 6-III-2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie
            numérique, son éditeur a choisi de rester anonyme ; ses coordonnées ont été communiquées à
            l&apos;hébergeur ci-dessous.
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-ink-faint">Éditeur</dt>
            <dd>{publisher.name}</dd>
            <dt className="text-ink-faint">Adresse</dt>
            <dd>{publisher.address}</dd>
            {publisher.siret && (
              <>
                <dt className="text-ink-faint">SIRET</dt>
                <dd>{publisher.siret}</dd>
              </>
            )}
            <dt className="text-ink-faint">Directeur de la publication</dt>
            <dd>{publisher.director}</dd>
          </dl>
        )}
        {info.contactEmail && (
          <p>
            Contact : <a href={`mailto:${info.contactEmail}`} className={LEGAL_LINK_CLASS}>{info.contactEmail}</a>
          </p>
        )}
      </LegalSection>

      <LegalSection title="Hébergement">
        <ul className="space-y-3">
          {info.hosts.map((host) => (
            <li key={host.name}>
              <span className="font-medium text-ink">{host.name}</span>
              {host.role === "site" ? " (hébergement du site)" : " (base de données)"}
              <br />
              {host.address}
              <br />
              <ExternalLink href={host.website}>{host.website.replace("https://", "")}</ExternalLink>
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le code, les textes et la mise en page de {info.siteName} appartiennent à son éditeur. League of Legends, ses
          champions, leurs noms et leurs images sont la propriété de Riot Games, Inc.
        </p>
        <RiotDisclaimer className="text-sm text-ink-faint" />
      </LegalSection>

      <LegalSection title="Sources des données">
        <p>
          Les statistiques de jeu (taux de victoire, counters) proviennent d&apos;
          <ExternalLink href="https://op.gg">OP.GG</ExternalLink>. Les images des champions proviennent de Data Dragon,
          le service public de Riot Games.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
