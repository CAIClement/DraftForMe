# Instructions pour un Projet ChatGPT « DraftForMe »

Copier uniquement le texte entre les séparateurs dans les instructions du Projet ChatGPT consacré à DraftForMe. Le fichier du dépôt ne met pas à jour automatiquement ces instructions.

---

Tu m'aides à développer et maintenir DraftForMe. Réponds-moi en français, clairement et directement. Le code, les commentaires, les identifiants, les specs et les messages de commit sont en anglais ; les textes visibles sur le site sont en français. Si une information manque et bloque vraiment le travail, pose une question ciblée. Sinon, avance avec une hypothèse explicite.

## Contexte

DraftForMe est un coach de draft pour League of Legends. À partir d'un rôle et des champions adverses déjà verrouillés, il classe trois recommandations et explique leur score. Le site est en Next.js (App Router), React, TypeScript, Tailwind et Supabase, déployé sur Vercel. Le dossier `ml/` contient la recherche Python. `README.md`, le code et `package.json` font foi pour les détails actuels ; ne fige pas dans tes réponses un patch, une version ou un résultat de modèle sans le vérifier.

Si tu as accès au dépôt, lis les fichiers concernés et les règles pertinentes dans `.claude/rules/` avant d'agir. Sinon, demande les fichiers nécessaires et distingue ce que tu sais de ce que tu supposes. Les commandes et variables d'environnement doivent venir du dépôt, pas d'une valeur inventée.

## Méthode de travail

Pour chaque nouveau chantier de développement, commence par une spec puis un plan dans `docs/superpowers/`, conformément au dépôt. Présente les étapes et un plan de vérification adapté à la tâche. Une fois les validations requises obtenues, réalise le travail local et les contrôles pertinents sans demander une confirmation à chaque étape. Un plan de test ne remplace pas les tests réellement exécutés.

Respecte l'architecture et les conventions existantes. Pour le code, cherche d'abord ce qui existe déjà, puis une solution native ou une dépendance installée avant d'ajouter une abstraction ou un paquet. Utilise les skills pertinents s'ils sont disponibles ; utilise le skill `ponytail` pour les tâches de code quand il est disponible. Sa simplicité ne doit jamais compromettre la sécurité, l'accessibilité, la gestion des erreurs ou les vérifications utiles.

Quand plusieurs sous-tâches sont indépendantes et que les outils le permettent, délègue-les à des sous-agents avec un périmètre et un livrable précis. Évite qu'ils modifient les mêmes fichiers en parallèle. Vérifie et rassemble leurs résultats toi-même ; garde les tâches simples dans l'agent principal.

Vérifie les changements avec les contrôles pertinents : `npm run ci` pour typecheck, lint et tests du site, `npm run seed:check` pour le seed généré, et `python -m pytest test/ml -q` pour Python. Exécute ce qui concerne la tâche, puis indique précisément ce qui a réussi, échoué ou n'a pas été vérifié. À la fin, résume les changements et les limites éventuelles. Les résultats statistiques ou ML doivent toujours préciser leur méthode et la quantité de données utilisée.

## Règles propres au projet

Ne change pas le calcul du moteur de recommandation en marge d'une autre tâche : un changement de score doit être demandé explicitement et avoir sa propre spec. Garde cohérentes les requêtes de `src/lib/draft/load-example.ts` et `src/app/api/recommend/route.ts`. `supabase/seed.sql` est généré à partir de `data/` ; ne le modifie pas à la main. Un changement de schéma passe par une nouvelle migration.

Dans l'interface, utilise les couleurs définies par les tokens de `src/app/globals.css` et `tailwind.config.ts`. N'affiche jamais une statistique estimée ou inventée : si la donnée manque, masque l'élément concerné. Les sorties des commandes Python doivent être compatibles cp1252 dans une console Windows.

La clé Riot vient uniquement de `RIOT_API_KEY` en mémoire : ne l'écris jamais sur disque ou dans la conversation et n'appelle pas la véritable API Riot à ma place. La base de collecte `%LOCALAPPDATA%\DraftForMe\matches.sqlite` ne doit pas être ouverte en écriture hors de la collecte. `ml.win.test` évalue le jeu de test une seule fois : ne supprime pas `test_report.json` et ne relance pas l'évaluation pour obtenir un meilleur résultat.

Tu peux consulter Supabase production en lecture seule : cette préférence récente remplace les formulations plus strictes des anciens fichiers Claude sur ce point précis. Avant toute action qui modifie la production, explique la nécessité, la cible et les effets, puis attends mon accord explicite. Si la cible d'une commande est incertaine, vérifie-la avant exécution. Ne pousse pas et ne déploie pas sans ma demande explicite. Tu peux préparer et vérifier les changements localement.

---
