# Cartographie vérifiée — Atlas Portfolio

État du code local au 2026-11-06, suite C-03–C-09. La cartographie décrit l’implémentation, pas une validation globale du MVP.

- `backend/cmd/atlas/main.go` : configuration, origine HTTPS, pool PostgreSQL, migrations v1–v5, serveur et arrêt propre ; `ATLAS_WEB_DIR` pour le build statique.
- `backend/internal/identity/` : bcrypt, sessions opaques hachées, rotation/révocation/expiration, origine stricte et limitation des essais. `WithUser` est l’unique entrée d’authentification des routes privées. Cookie HTTPS préfixé `__Host-`, cookie de laboratoire distinct.
- `backend/internal/catalog/` : migration v2, portefeuilles/comptes/actifs privés, archivage, contraintes FK composites, pagination et export de métadonnées. Contrôle ISIN/MIC ; aucune donnée de marché inférée d’un ticker.
- `backend/internal/ledger/engine.go` : rejeu exact, cash, positions, coût moyen, réalisé, revenus/frais et transferts. Indépendant de HTTP/SQL/fournisseurs. `engine_test.go` couvre les scénarios numériques et les données manquantes.
- `backend/internal/ledger/server.go` : journal SQL, idempotence, corrections et vérification des droits ; `server_test.go` vérifie PostgreSQL, accès croisés, concurrence, rollback, imports et exports.
- `backend/internal/ledger/import.go` / `broker.go` : CSV Atlas v1 et variantes Coinbase/Trade Republic, preview et confirmation atomique/dédoublonnage ; migration v4.
- `backend/internal/ledger/reconciliation.go` : rapprochement de soldes/quantités importés, rejeu historique exact, instantané SQL en lecture seule, couverture partielle/complète explicite ; aucun journal modifié.
- `backend/internal/ledger/summary.go` / `aggregate.go` : observations privées, valorisations datées, agrégats comptes/portefeuilles, allocation, variations, historique et export intégral.
- `backend/internal/ledger/provider.go` : cache public BCE, récupération exclusive, backoff/Retry-After, snapshots techniques et persistance privée du seul propriétaire ; événements JSON sans données financières.
- `backend/internal/ledger/market.go` : adaptateur FX BCE fixe, cache public borné, validation XML, réciproques exactes, conservation de la date de référence et attribution ; migration v5. Aucun connecteur de cours actions/ETF/crypto déclaré actif.
- `backend/internal/httpserver/` : routes `/healthz` (vitalité) et `/readyz` (DB, timeout/cache), assemblage des routes, serveur statique sécurisé ; tests des méthodes, erreurs API et headers.
- `backend/cmd/healthcheck` : sonde locale liveness/readiness selon chemin autorisé, sans redirection. `backend/cmd/archive` : outil autonome AES-256-GCM, clé privée, sorties atomiques sans écrasement, tests d’intégrité.
- `web/src/main.tsx` / `auth.ts` : identité, thème, session et erreurs. `Workspace.tsx` / `api.ts` : navigation, métadonnées, pagination, export et gestion d’expiration. `Finance.tsx` : saisie réelle, synthèse, journal/audit, cours/FX, imports. `Reconciliation.tsx` : relevé de soldes, comparaison et rapport JSON. `MarketStatus.tsx` : diagnostic BCE à la demande, sans appel fournisseur. `HistoryChart.tsx` : tracé de points sans combler les valeurs absentes, calcul des coordonnées à partir des décimaux via BigInt.
- `web/test/` : tests HTTP, UI avec API simulée, E2E identité réelle, parcours portefeuille financier réel, imports courtiers et rapprochements historiques ; audits axe dédiés et sur écrans peuplés. Aucun jeu de portefeuille factice chargé par défaut.
- `web/public/` : manifeste et icône ; pas de service worker ou cache financier hors ligne annoncé.
- `backend/Dockerfile` / `.dockerignore` : build Node/Go, cibles amd64/arm64, secrets CA optionnels uniquement pendant les builds, image scratch avec UI et notices légales. `web/scripts/licenses.mjs` / `scripts/licenses.sh` collectent les notices.
- `docker-compose.yml` + `.auth.yml` : API et PostgreSQL avec volume persistant, rôle non superuser et secret applicatif distinct du secret administrateur. `.tls.yml` / `deploy/Caddyfile` : terminaison HTTPS optionnelle et isolation du port API.
- `scripts/backup.sh`, `restore.sh`, `deploy/systemd/` : sauvegarde chiffrée, restauration dans une base neuve, timer quotidien à configurer/activer par l’exploitant.
- `.github/workflows/ci.yml` : Go/race/DB/vet/vuln, frontend, E2E et accessibilité, builds Docker deux architectures ; cinq jobs hébergés réussis pour le commit applicatif `3f033c88`, voir le rapport de validation.

Flux : navigateur → routes même origine → session/propriétaire → catalog/ledger → PostgreSQL. L’écriture financière sérialise le propriétaire puis verrouille les ressources et rejoue l’historique avant commit. Les prix restent des observations datées, pas la source des positions. La BCE reçoit uniquement une requête publique fixe, sans portefeuille, quantité ou identité. Exports et rapports d’import sont filtrés par le même propriétaire.

Contrats : `docs/decisions/C-03-C-09.md`, `docs/decisions/financial-policy.md`. Formats/ops : `docs/formats/atlas-csv-v1.md`, `docs/formats/broker-csv.md`, `docs/operations/backup-restore.md`. Commandes : `README.md`. Preuves actuelles : `docs/validation/C-03-C-09.md` ; anciens rapports C-00/C-01/C-02 conservés comme historique.

## Documentation P5.7 — 2026-11-07

- `docs/index.md`, `docs/usage/`, `docs/operations/installation.md` et `upgrades.md` : parcours publics utilisateur/exploitant ; `docs/formats/atlas-portfolio-v1.md` : lecture des exports existants.
- `CONTRIBUTING.md`, `SECURITY.md`, `.github/PULL_REQUEST_TEMPLATE.md` : contribution et signalement privé sans contact ou SLA inventé.
- `scripts/check-docs.py` : liens locaux Markdown hors fences ; `scripts/check-compose-docs.py` : rendu des profils documentés sans démarrer de service. Nouveau job documentation, portant le workflow à six jobs avec les deux builds Docker. Validation hébergée de ce changement encore à effectuer.
- `docker-compose.loopback.yml` : laboratoire local facultatif ; `docker-compose.restore.yml` : DSN vers une base existante explicitement nommée, même projet/volume. Aucun défaut du Compose de base modifié.
- `docs/validation/MVP-readiness.md` : preuves et réserves des quinze critères ; aucune publication MVP déclarée.
