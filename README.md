# DraftForMe

**Un coach de draft pour League of Legends.** Indiquez votre rôle et les champions déjà verrouillés en face : DraftForMe propose trois picks classés, et montre pour chacun le détail du calcul.

## Ce qui le distingue

- **Des recommandations explicables.** Chaque pick est accompagné de ses critères et de leur poids : vous savez toujours pourquoi un champion sort en tête.
- **Des données réelles, jamais inventées.** Chaque chiffre affiché vient de la base. Quand une donnée manque, elle disparaît de l'écran plutôt que d'être remplacée par une valeur plausible.
- **Une démarche mesurée.** Un modèle de machine learning a été entraîné sur de vraies parties classées, puis évalué une seule fois sur des parties jamais vues, contre le moteur actuel. Son verdict, négatif, est documenté plutôt que caché (voir [Côté recherche](#côté-recherche)).

## Comment ça marche

Le moteur de recommandation (`src/lib/recommendation/`) classe les champions d'un rôle selon trois critères :

| Critère | Ce qu'il mesure |
|---|---|
| **Force dans le patch** | Le classement du champion à votre poste, d'après son taux de victoire |
| **Lecture du matchup** | Les counters connus face aux champions déjà pickés en face |
| **Votre aisance** | Votre pool de champions (à venir) |

Le poids de chaque critère s'adapte à la situation (par exemple, le matchup ne compte qu'une fois un pick adverse connu) et il est affiché à côté du résultat.

**Les données** portent sur l'EUW, en Emerald et au-dessus. Les statistiques actuelles proviennent d'OP.GG (patch 16.3). Leur remplacement par des statistiques calculées à partir de l'API Riot, sur le patch en cours, est en préparation ([spec](docs/superpowers/specs/2026-09-18-draftforme-site-stats-refresh-design.md)).

## Côté recherche

Le dossier `ml/` contient deux projets menés pour savoir si un modèle pouvait faire mieux que les règles écrites à la main.

1. **Collecte** (`ml/collect/`). Des parties classées EUW du patch en cours sont récupérées via l'API officielle de Riot, à parts égales entre les dix rangs, dans une base SQLite reprise automatiquement après une interruption. Objectif : 30 000 parties.
2. **Modèle de victoire** (`ml/win/`). Un modèle prédit le vainqueur d'une draft. Il est comparé une seule fois, sur des parties mises de côté, à trois références : le moteur du site, les winrates des parties collectées, et les statistiques publiques seules.

**Premier résultat, sur un essai de 11 000 parties :** les statistiques publiques prédisent le vainqueur aussi bien que tout ce qui a été appris sur les drafts, et le modèle ne les bat pas. Toutes les approches restent proches du pile ou face (log loss d'environ 0,69), ce qui confirme qu'une composition seule en dit peu sur l'issue d'une partie. La conclusion pratique : garder les statistiques du site à jour vaut plus qu'un modèle. Le verdict officiel sera rendu sur les 30 000 parties.

Le détail est dans les specs : [collecte](docs/superpowers/specs/2026-09-17-draftforme-match-collection-design.md) et [modèle de victoire](docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md).

## Stack

- **Site :** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, déployé sur Vercel
- **Données :** Supabase (Postgres)
- **Tests :** Vitest et Testing Library
- **Recherche :** Python 3.11, scikit-learn, pandas, httpx, pytest

## Démarrage local

**Prérequis :** Node.js 22 ou plus, npm, et un projet Supabase (ou `supabase start` en local). Python 3.11 seulement pour le dossier `ml/`.

```bash
npm install
```

Créez un fichier `.env.local` à la racine avec l'URL et la clé publique (`anon`) de votre projet Supabase :

```
NEXT_PUBLIC_SUPABASE_URL=https://<projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé anon>
```

Appliquez le schéma (`supabase/migrations/`) et les données de départ (`supabase/seed.sql`). Avec une base Supabase locale (Docker requis), une seule commande fait les deux :

```bash
supabase db reset
```

Pour un projet hébergé, appliquez les migrations avec `supabase db push`, puis exécutez `supabase/seed.sql` dans l'éditeur SQL.

Puis lancez le site sur http://localhost:3000 :

```bash
npm run dev
```

### Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` puis `npm run start` | Version de production |
| `npm test` | Tests du site |
| `npm run lint` | Lint |
| `npm run seed:build` | Régénère `supabase/seed.sql` à partir de `data/` |
| `python -m pytest test/ml -q` | Tests du dossier `ml/` |

### Recherche (`ml/`)

```bash
pip install -r ml/requirements.txt
```

La collecte demande une clé de l'API Riot, à saisir dans la session sans jamais l'écrire dans un fichier :

```powershell
$env:RIOT_API_KEY = [Net.NetworkCredential]::new("", (Read-Host "Cle Riot" -AsSecureString)).Password
python -m ml.collect.run --target 30000 --db "$env:LOCALAPPDATA\DraftForMe\matches.sqlite"
```

L'entraînement et l'évaluation du modèle sont décrits dans [ml/README.md](ml/README.md).

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `src/app/` | Pages et routes API (Next.js) |
| `src/components/` | Composants : page d'accueil, outil de draft, interface |
| `src/lib/recommendation/` | Le moteur de recommandation |
| `src/lib/data/`, `src/lib/supabase/` | Accès aux données |
| `supabase/` | Migrations et données de départ |
| `data/`, `scripts/` | Données sources et génération du seed |
| `ml/` | Collecte Riot, modèle de victoire, ancien pipeline |
| `test/ml/` | Tests Python |
| `docs/superpowers/` | Specs et plans de chaque chantier |

## Documentation

Chaque chantier commence par une spec (`docs/superpowers/specs/`) et un plan d'implémentation (`docs/superpowers/plans/`). Ils expliquent les décisions prises et pourquoi.

---

DraftForMe n'est pas approuvé par Riot Games et ne reflète pas les opinions de Riot Games ni de quiconque officiellement impliqué dans la production ou la gestion des propriétés de Riot Games. Riot Games et toutes les propriétés associées sont des marques commerciales ou déposées de Riot Games, Inc.
