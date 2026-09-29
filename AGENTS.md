# DraftForMe — instructions pour les agents

## Projet et communication

- DraftForMe est un coach de draft pour League of Legends : à partir d'un rôle et des picks adverses verrouillés, il recommande trois champions et explique leurs scores.
- Répondre au propriétaire en français. Écrire le code, les commentaires, les identifiants, les specs et les messages de commit en anglais. Les textes de l'interface restent en français.
- Le site utilise Next.js (App Router), React, TypeScript, Tailwind et Supabase ; `ml/` contient la recherche Python. Lire `README.md` et les fichiers concernés pour les détails actuels.
- La production est hébergée sur Vercel. Ne pas supposer qu'un environnement local ou un script pointe vers une base de test : vérifier sa cible avant toute commande qui pourrait écrire.

## Repères et invariants

- `src/lib/recommendation/` contient le moteur de score : conserver ses fonctions pures. Tout changement de calcul de score doit être demandé explicitement et avoir sa propre spec.
- `src/lib/draft/load-example.ts` et `src/app/api/recommend/route.ts` chargent les mêmes tables et appellent le même moteur : garder leurs requêtes cohérentes.
- `supabase/seed.sql` est généré depuis `data/` par `scripts/build-seed-data.mjs`. Ne jamais le modifier à la main ; utiliser `npm run seed:build`, puis `npm run seed:check`.
- Pour changer le schéma, ajouter une migration dans `supabase/migrations/` ; ne pas réécrire une migration déjà appliquée.
- Dans l'interface, utiliser les couleurs définies dans `src/app/globals.css` et `tailwind.config.ts`. Ne pas inventer de statistique : lorsqu'une donnée manque, masquer l'élément concerné.
- Consulter les règles ciblées dans `.claude/rules/` selon la tâche (sécurité, Supabase, UI, tests, TypeScript ou App Router). Ces fichiers sont de la documentation utile, pas des hooks Codex. Pour l'accès en lecture seule à la production, la règle de la section « Limites » ci-dessous reflète la préférence la plus récente du propriétaire.

## Travail et vérification

- Pour un nouveau chantier de développement, rédiger une spec puis un plan dans `docs/superpowers/` avant d'implémenter. Annoncer les étapes et les vérifications prévues ; avancer ensuite sur le travail local selon les validations exigées par les skills applicables.
- Partir de `main` sur une branche de travail ; ne pas committer une fonctionnalité directement sur `main`. Vérifier `git worktree list` avant de supposer que la branche `main` du checkout courant est à jour.
- Utiliser les skills pertinents lorsqu'ils sont disponibles. Pour une tâche de code, utiliser `ponytail` pour chercher d'abord la réutilisation et la solution la plus simple qui couvre réellement le besoin, sans retirer sécurité, accessibilité ni vérification.
- Utiliser des sous-agents pour des sous-tâches réellement indépendantes si les outils le permettent. Donner un périmètre et un résultat attendu à chacun, éviter les modifications concurrentes des mêmes fichiers, puis vérifier et intégrer leurs résultats.
- Prévoir les cas à tester et exécuter les contrôles pertinents, si possible en lot. `npm run ci` couvre typecheck, lint et tests du site ; `npm run seed:check` vérifie le seed ; `python -m pytest test/ml -q` couvre Python. Rapporter les commandes réellement exécutées et leurs résultats.
- Garder les tests du site près du code (`*.test.ts(x)`). Les tests Python restent dans `test/ml/`. Les sorties des commandes Python doivent rester compatibles cp1252 sur Windows ; les erreurs attendues ont un message français et un code de sortie documenté.

## Limites

- La clé Riot ne doit jamais être écrite sur disque, dans un `.env`, un commit ou une conversation : elle vient seulement de `RIOT_API_KEY`. Ne pas appeler la véritable API Riot ; le propriétaire exécute ces commandes.
- La base de collecte `%LOCALAPPDATA%\DraftForMe\matches.sqlite` est hors OneDrive. Ne jamais l'ouvrir en écriture hors de la collecte ; les analyses et `ml.win` l'ouvrent en lecture seule.
- `ml.win.test` évalue le jeu de test une seule fois. Ne pas supprimer `test_report.json`, relancer l'évaluation pour améliorer le résultat ou présenter un essai comme un nouveau verdict. Utiliser un autre dossier `--artifacts` pour les essais.
- La lecture seule de Supabase production est autorisée. Avant toute écriture en production (données, schéma, Storage, Auth ou service), expliquer pourquoi elle est nécessaire, sa cible et ses effets, puis attendre l'accord explicite du propriétaire.
- Ne pas pousser ni déployer sans demande explicite du propriétaire. Préparer et vérifier les changements localement reste autorisé.
