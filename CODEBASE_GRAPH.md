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

## Lecture externe P5.1 — 2026-11-07

- `scripts/read-export.py` : fichier local v1 → validation structurelle/références/audit → résumé JSON et journal actif facultatif ; nombres Fraction exacts, instants nanoseconde, aucune dépendance Go/SQL/réseau ni écriture. Ne rejoue pas les calculs financiers.
- `scripts/tests/test_read_export.py` : cas synthétiques exacts et refus du CLI ; job documentation existant étendu sans nouveau job.
- `web/test/export-reader.mjs` : invocation indépendante sur un fichier temporaire privé issu du vrai export ; utilisé par les parcours portefeuille/courtiers, vérifie l’intégrité du fichier source après lecture.
- Contrat et limites : `docs/usage/read-export.md`, `docs/formats/atlas-portfolio-v1.md`, preuves `docs/validation/P5-1-export-reader.md`.

## Durcissement d’exploitation — 2026-11-07

- `scripts/verify-instance.py` : orchestration locale d’un projet Compose neuf, données synthétiques et scripts chiffrés existants ; retour vers l’original, pas de suppression de volume. Préflight disque/projet/répertoire hors Git et Docker local. `scripts/tests/test_verify_instance.py` couvre le confinement sans DB/Docker. Exécution complète Linux AMD64 vérifiée en CI, dont reprise dans une base distincte et retour à l’original.
- `scripts/check-licenses.py`, `docs/licenses/dependencies.json` : inventaire versionné et empreintes des notices ; mode source Go/npm et mode artefact `/web/licenses` distincts. `web/scripts/licenses.mjs` collecte aussi les dépendances transitives (`--all`).
- `.github/workflows/ci.yml` : sept jobs avec ajout licences ; notices des deux images et scénario Compose/reprise sur AMD64. Sept jobs réussis au commit `aee6d71c`, run `42385363672` ; preuves dans le rapport du lot. Contrat/preuves : `docs/operations/instance-verification.md`, `docs/validation/P5-operations-hardening.md`.

## Revue de sécurité P5.4 — 2026-11-07

`httpserver/web.go` ouvre les fichiers réguliers du build via `os.Root`, refuse les liens et fichiers cachés/spéciaux, conserve les protections HTTP et évite le double accès Stat/FileServer. `web_test.go` couvre divulgation via liens, refus sans index et HEAD/Range. L’initialisation `01-app-role.sh` lit le secret avec psql `\getenv`, sans valeur en argv ; `scripts/tests/test_app_role.py` vérifie ce contrat. La revue transversale est dans `docs/validation/P5-4-security.md` ; validation hébergée sur le commit `1eb226fc`, sept jobs réussis (run `42388263087`).

## Vérification de sauvegarde P5.3

`backend/cmd/archive` ajoute `verify`, sans fichier de sortie ; `backup.sh` authentifie le fichier avant publication. `scripts/check-backup.sh` contrôle permissions et âge mtime selon un seuil opérateur, puis GCM. `scripts/tests/test_backup_check.py` couvre la politique sans prétendre simuler une restauration. `verify-instance.py` exerce l’outil réel en CI avant la reprise. Guide et état : `docs/validation/P5-3-backup-checks.md`.

`web/test/keyboard.e2e.mjs` ajoute la recette API/DB réelle sans souris : onboarding, duplication avec confirmation et retrait rejeté/réparé, noms longs, focus visible, six scans axe et préférence de mouvement réduit. `docs/validation/P5-9-roadmap-audit.md` rapproche les lots historiques sans lever les gates MVP.

`backend/internal/ledger/benchmark_test.go` mesure six profils synthétiques exacts (ordre chronologique/inversé, 201–10001 événements), sans SQL/API ni SLO. Le job backend conserve ces mesures ; protocole et valeurs locales dans `docs/validation/P5-9-replay-benchmarks.md`.

`PurchasePreview.tsx` / `purchase-preview.ts` : récapitulatif d’achat non persistant, fractions BigInt selon les formules approuvées ; le backend reste seul validateur des liquidités et de l’historique. Tests numériques et E2E dédiés dans `web/test/`.

`AccountHoldings.tsx` : détail dans Workspace des liquidités et positions par identifiant de compte, valeurs serveur et provenance des observations ; aucun recalcul financier client. `account-holdings.e2e.mjs` vérifie comptes multi-devises, actif commun, coût/FX inconnus et navigation entre portefeuilles.
