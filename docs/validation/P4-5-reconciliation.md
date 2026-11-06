# P4.5 — Rapprochement de relevés, 6 novembre 2026

Références : ROADMAP P4.5, F-012/F-011, US-006/US-007, NFR-01/02/04. Suite autorisée en autonomie après la recette et fusion C-03–C-09 ; branche `work/atlas-reconciliation`, issue de `work/atlas-validation-followup` dont `main` est ancêtre. Aucune règle de comptabilisation, source de cours ou fonctionnalité P1/P2 supplémentaire introduite.

## Comportement livré

Écran Imports → « Rapprocher un relevé ». Choix explicite du compte et de la date/heure, devise du compte affichée, lecture du CSV Atlas soldes v1, déclaration facultative de complétude des positions. Rapport attendu/calculé/écart exact, couverture visible et export JSON.

- Sans déclaration de complétude, les éléments omis restent non contrôlés. Avec déclaration, les positions effectivement détenues mais omises sont comparées à zéro et signalées comme telles.
- Les liquidités sont indépendantes : pas de ligne cash, pas de contrôle cash.
- Les données sont reconstruites à la date du relevé à partir du journal corrigé actuel, jamais des seules positions actuelles. Transferts et corrections sont pris en compte par le moteur existant.
- Égalité exacte, tolérance zéro ; arrondi uniquement pour lecture, écarts inférieurs à la précision affichée exposés dans leur forme exacte.
- Transaction PostgreSQL repeatable-read **en lecture seule**, pas de migration, de nouvelle table, d’import persistant ou de correction automatique. Aucun appel fournisseur.
- API `POST /api/v1/reconciliations/preview`, authentification et origine exigées. Compte/actifs filtrés par propriétaire, ressources étrangères/absentes indiscernables ; lecture des archives autorisée.

Format, limites et JSON : [Atlas soldes v1](../formats/atlas-balances-v1.md). Le fichier est une référence de soldes, pas un export natif de courtier présumé compatible.

## Vérifications exécutées

- `go vet ./...` et `ATLAS_TEST_DATABASE_URL=… go test -race ./...` réussis sur PostgreSQL 18.6 réel, rôle applicatif non privilégié ; compilation du serveur réussie.
- Tests numériques : liquidités 1 000 → achat 5 × 100 → 500 ; quantité historique avant achat nulle ; transfert de 2 titres ramenant la position de 5 à 3 ; relevé partiel sans faux zéro ; relevé complet détectant une position omise ; différence exacte `1/1000000000` ; comparaison d’un solde de relevé négatif sans création d’endettement ; quantité récurrente `100/3` et ouverture partielle signalée.
- Parseur : BOM/CRLF, fractions, 500 lignes acceptées, 501 refusées, doublons cash/actifs, colonnes inconnues/dupliquées, valeurs manquantes/non numériques et lignes mal formées refusées.
- Tests SQL de route : comparaison actuelle et historique, archives, ressources étrangères, devise incohérente, date future, accès anonyme, JSON inattendu ; compteurs d’opérations et de lots d’import inchangés.
- Frontend : lint et typage/build réussis. `npm run test:reconciliation` exécuté avec Chromium et API/DB réelles : concordance puis divergence, relevé complet/partiel, changement de compte, décalage de fuseau Paris→UTC, transfert historique, correction antidatée, erreur de doublon avec saisie conservée et export JSON exact. Événements et imports comparés avant/après, inchangés par les rapprochements.
- Quatre analyses axe sur le résultat et le formulaire, dark/light, 1440/320 px : aucune violation détectée. Pas de débordement horizontal. Le guide des identifiants est également ouvert lors de la recette mobile finale.

Le job GitHub E2E exécute désormais `npm run test:reconciliation` après les imports courtiers. Aucun résultat hébergé de ce lot n’est revendiqué avant publication et consultation du run correspondant.

## Limites et suite

Le rapport n’est pas enregistré sur le serveur : téléchargement volontaire pour archivage, fichier source à conserver séparément. Pas de certification comptable/fiscale ni de tolérance automatique pour arrondi de courtier. Une correction ultérieure nécessite un nouveau calcul explicite. La date du relevé doit inclure une heure ; aucun fuseau ou horaire de fin de marché n’est déduit d’un relevé sans horodatage.

Les questions Q-05/Q-06 de cours d’actifs automatiques et les conditions de déploiement cible restent ouvertes. P4.1 reste partiel : formats natifs identifiés et testés sur synthétiques, pas de recette avec exports personnels réels. Ce lot ne déclare pas la publication MVP terminée.
