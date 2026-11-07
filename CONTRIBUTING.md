# Contribuer à Atlas Portfolio

Le [PRD](PRD.md), la [roadmap](ROADMAP.md), les [ADR](ADR.md) et les instructions [AGENTS.md](AGENTS.md) définissent le périmètre. Le code est sous [Apache 2.0](LICENSE) ; les droits des données de marché sont distincts. Une nouvelle dépendance ou source doit préciser sa licence, son coût et ses limites.

## Proposer un changement

Décrire le problème, le comportement final attendu et le lot/les exigences concernés. Un bug se reproduit avec des données **fictives** ; ne pas joindre de relevé réel, `.env`, cookie, DSN, clé ou sauvegarde. Pour une vulnérabilité, lire [SECURITY.md](SECURITY.md) avant d’ouvrir une discussion publique.

Une proposition technique n’est pas automatiquement un ADR accepté. Les questions métier ouvertes ne se résolvent pas en inventant un prix, un solde, une règle fiscale ou une couverture de courtier. Le travail peut continuer sur les parties indépendantes du blocage.

## Environnement de développement

Go 1.27.3, Node 22.22.1 et npm ; Git, Python 3.10+ pour la documentation ; PostgreSQL 18.6 pour les tests DB, ou Docker/Compose pour l’exécuter. Pas de base de production pour les tests : ils créent des utilisateurs et opérations synthétiques.

Pour un laboratoire local, suivre [l’installation](docs/operations/installation.md). Les fichiers Compose livrés ne publient pas PostgreSQL. Si le serveur Go tourne hors Docker, ajouter un override **de recette** publiant la DB sur loopback et sur un port libre, par exemple :

```yaml
services:
  db:
    ports:
      - "127.0.0.1:54330:5432"
```

Utiliser un projet de test et un `.env.test` privé, avec un secret applicatif distinct. Démarrer seulement ce service DB pour le développement natif. Ne pas appliquer cet override à une instance contenant des données réelles.

Depuis un shell Bash de développement, saisir le secret applicatif sans le placer dans l’historique :

```sh
set +x
read -r -s -p 'Secret applicatif de la DB de test : ' atlas_test_password
export ATLAS_TEST_DATABASE_URL="postgres://atlas:${atlas_test_password}@127.0.0.1:54330/atlas?sslmode=disable"
unset atlas_test_password
```

Le secret doit correspondre au rôle `atlas` du projet de test. Les tests DB ignorés faute de DSN ne constituent pas une validation PostgreSQL réussie.

## Contrôles

Depuis la racine du dépôt :

```sh
python3 scripts/check-docs.py
python3 -B -m unittest discover -s scripts/tests -v
cd backend
gofmt -l .
go vet ./...
go test -race ./...
go mod verify
go build ./...
```

L’environnement `ATLAS_TEST_DATABASE_URL` doit être exporté dans ce même shell pour les intégrations. Le serveur Go natif ne charge pas automatiquement les fichiers `.env`. Pour l’E2E avec Vite, configurer séparément `DATABASE_URL`, `ATLAS_ADDR=127.0.0.1:8080`, `ATLAS_ORIGIN=http://127.0.0.1:5173`, `ATLAS_INSECURE_HTTP=true`, `ATLAS_REGISTRATION=true` dans l’environnement **de recette**.

Dans `web/` :

```sh
npm ci
npm run lint
npm run build
npm test
npm audit --omit=dev
npm run dev
```

Vite sert le navigateur sur 127.0.0.1:5173 et relaie `/api/` au serveur Go sur 127.0.0.1:8080. Installer Chromium avec `npx playwright install chromium` ou utiliser un binaire via `ATLAS_CHROMIUM`. Les commandes E2E du [README](README.md) exigent `ATLAS_E2E_TEST_INSTANCE=true` et créent leurs propres comptes synthétiques.

La suite `test:readiness` arrête/redémarre le conteneur DB explicitement désigné ; elle exige aussi son origine API et le binaire healthcheck. Elle est réservée à une instance de recette isolée. Les tests UI avec API simulée, fixtures fournisseur, API réelle et panne DB réelle ont des preuves différentes : indiquer précisément celles exécutées.

## Intégrité financière et revue

Pour un changement de calcul, ajouter des valeurs attendues exactes et les cas d’erreur pertinents : frais, devises, dates, historique partiel, correction et transfert. Les chaînes décimales/rationnelles servent aux valeurs financières ; l’arrondi d’affichage n’est pas une entrée de calcul. Tester les accès croisés et les transactions selon le périmètre modifié.

Une PR décrit le problème et le comportement livré, les contrôles réellement exécutés, les migrations et les réserves. Ne pas cocher un contrôle qui a été ignoré ou simulé comme s’il était réel. Les changements de contrat public demandent une mise à jour de la [cartographie](CODEBASE_GRAPH.md), de l’[architecture](ARCHITECTURE.md) et des guides concernés.

Le contrôle documentaire vérifie les cibles locales des liens explicites Markdown du checkout Git, y compris les références et images ; il ignore les blocs clôturés de code. Il ne valide pas les ancres, la disponibilité des sites externes ni toutes les variantes de syntaxe Markdown. C’est une aide à la revue, pas une certification du contenu ou des droits de réutilisation.

Les notices collectées pendant le build sont dans `/licenses/` et dans l’image. Ne pas retirer celles des dépendances pour simplifier un artefact. Ne pas publier de release, tag ou déploiement sur la seule base d’une CI verte si les gates MVP restent ouverts.
