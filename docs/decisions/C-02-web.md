# C-02 — Parcours web d’identité

2026-11-06. Suite de la branche `work/atlas-foundation-auth`, commit de départ `a2f2f5fd8346022bec7a9802d9f5d1803b4ba2ff`. F-001/F-002, partie identité de US-001/US-009, NFR-02/04/05/09/15 ; ROADMAP P1.1/P1.2 et préparation P3.2. Contrat API et ADR-0008 inchangés. Aucun arbitrage financier effectué.

## Implémentation

- Le squelette bibliothèque devient une application React/Vite avec inscription, connexion, restauration de session au chargement et déconnexion. L’état connecté affiche uniquement l’adresse confirmée par `/me` et une limite explicite sur les portefeuilles absents.
- Client `/api/v1` same-origin, cookies HttpOnly gérés par le navigateur, aucune persistance JS des identifiants/session, cache désactivé, redirections refusées. Un 401 sur `/me` signifie anonyme ; les autres erreurs restent visibles. La connexion n’est confirmée qu’après lecture réussie de `/me`.
- Échec d’écriture : pas de faux succès, saisie préservée. Inscription : réponse générique sans affirmation qu’un nouveau compte a été créé. Le mot de passe est effacé après succès, déconnexion et changement de formulaire. Limite UTF-8 identique au serveur, pas de troncature silencieuse.
- Formulaires sémantiques, labels, autocomplete, messages live, focus sur le titre après transition, contrôles tactiles ; thèmes sombre/clair/système selon les tokens existants. Seule la préférence visuelle est stockée localement.
- Proxy Vite en développement sur 127.0.0.1:5173 vers l’API 8080 ; hébergement du build et proxy HTTPS de production à configurer séparément. Aucun changement du Compose ou du backend.
- Tests navigateur reproductibles dans `web/test/browser.mjs`, Playwright verrouillé comme dépendance de développement. Aucun appel au backend réel dans ces tests.

## Preuves exécutées

Avec Node 24.22.1/npm 11.9.0 : `npm run lint`, `npm run build` (types et bundle), `npm test` réussis depuis `web/`. `git diff --check` réussi.

Avec `npm run dev` actif : `ATLAS_CHROMIUM=/usr/bin/chromium npm run test:browser` réussi. Réponses API **simulées** : mauvais identifiants et conservation de saisie, connexion puis confirmation `/me`, restauration après rechargement, échec de déconnexion sans faux succès, déconnexion réussie, limite UTF-8, inscription désactivée puis acceptée génériquement, indisponibilité du service et nouvelle vérification, thème mémorisé et ordre clavier. Aucun événement pageerror. Absence de débordement horizontal à 320, 390 et 1440 px. Capture mobile 390 px inspectée visuellement.

Pour rejouer : depuis `web/`, installer les dépendances avec `npm ci`, installer Chromium avec `npx playwright install chromium` (ou sélectionner un Chromium système par `ATLAS_CHROMIUM`), lancer `npm run dev` dans un terminal, puis `npm run test:browser` dans un autre.

## Limites et reprise

Les preuves réelles ajoutées lors de la suite de cette itération sont détaillées ci-dessous. Aucun audit WCAG complet ni déploiement de production exécuté ; l’hébergement reste à recetter. La récupération de compte et la vérification d’adresse restent absentes. C-02 global n’est pas déclaré DONE ; US-001 complet dépend de C-03. Aucun passage de phase ni MVP déclaré terminé.

Retour arrière : rétablir les fichiers frontend et la documentation de cette itération ; aucune migration, suppression de données, modification de session serveur ni action sur les services utilisateur. Aucun commit/push réalisé.

## Suite — Intégration réelle, 2026-11-06

- Ajout de `web/test/identity.e2e.mjs` et `npm run test:e2e` : navigateur réel, aucune interception de requête. Refus de lancer sans origine explicite et marqueur d’instance de test ; attente de disponibilité du web/API. Deux utilisateurs synthétiques, cookies HttpOnly/SameSite/Secure selon l’origine, rechargement, refus de changement de propriétaire par paramètre, rotation des sessions d’un utilisateur sans affecter l’autre, refus d’une origine étrangère, déconnexion/révocation et mauvais mot de passe.
- Nouveau job `identity-e2e` dans `.github/workflows/ci.yml` : PostgreSQL 18.6, rôle applicatif non superuser via le script existant, API native et Vite, Chromium Playwright. Configuration YAML analysée localement ; aucune exécution hébergée affirmée.
- Base locale dédiée `atlas-identity-check`, rôle `atlas` confirmé sans SUPERUSER/CREATEDB/CREATEROLE. Les premières tentatives ont échoué : espace disque Docker insuffisant, puis script d’initialisation illisible par PostgreSQL avec le mode local 0600. Image Go de test retirée, Go natif 1.27.3 installé dans `work/`, lecture du script rétablie à 0644 et rôle initialisé dans la base dédiée sans suppression de volume. Aucun changement de code backend nécessaire.
- `go vet ./...`, `go test -race -v ./...` avec `ATLAS_TEST_DATABASE_URL` sur la base dédiée, puis `go build -o /workspace/work/identity-check/out/atlas ./cmd/atlas` : réussis. L’intégration PostgreSQL a effectivement été exécutée, pas ignorée ; migration rejouée, expiration, rotation, contrôle d’origine et isolation des identités vérifiés.
- `ATLAS_CHROMIUM=/usr/bin/chromium ATLAS_E2E_ORIGIN=http://127.0.0.1:5173 ATLAS_E2E_TEST_INSTANCE=true npm run test:e2e` : réussi deux fois, dont une fois après redémarrage de l’API. Vérification supplémentaire via Chromium : cookie de session conservé, arrêt/reprise de l’API avec la même base, retour de l’identité connectée sans nouvelle authentification. État navigateur temporaire conservé uniquement sous `work/` pendant la vérification.
- Frontend : lint, typage, build, tests HTTP réussis ; `git diff --check` réussi. Les anciennes preuves UI simulées restent complémentaires, sans être assimilées à l’intégration réelle.

Les services backend/base créés pour ces vérifications sont arrêtés après la recette ; le volume de test et les comptes synthétiques sont conservés. Pas de suppression de données, commit ou push. C-02 reste limité au périmètre livré ; la récupération de compte, la recette HTTPS de production et les ressources financières restent absentes.

## Validation élargie

Voir `docs/validation/C-02.md` pour les preuves HTTPS, cookie Secure, conteneur non root/readonly/healthy, persistance après redémarrage, restauration chiffrée sur une base distincte, cross-compilation ARM64, Node 22, audits Go/npm et accessibilité automatique. Tests serveur supplémentaires sur les frontières de mots de passe UTF-8 et les origines des trois écritures. Les suites d’accessibilité et scans de dépendances sont ajoutés à la CI. Les réserves du rapport empêchent toute affirmation de validation globale de production/MVP.
