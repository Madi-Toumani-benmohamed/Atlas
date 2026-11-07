# Atlas Portfolio

Suivi d’investissements open source, auto-hébergeable sur Linux, sans abonnement obligatoire. Licence Apache 2.0.

**En développement, au-delà du socle C-02 :** utilisateurs isolés ; portefeuilles, comptes et actifs privés ; achats/ventes et mouvements ; calculs exacts ; dashboard et historique daté ; corrections auditées ; CSV Atlas v1 et adaptateurs Coinbase/Trade Republic limités ; export JSON ; sauvegarde chiffrée/restauration ; interface intégrée à Docker et HTTPS optionnel.

**Limites importantes :** les cours d’actions/ETF/crypto sont actuellement saisis manuellement. Les taux de référence de la BCE peuvent être récupérés gratuitement. Aucun cours temps réel ni synchronisation de courtier n’est annoncé. Les variantes CSV prises en charge sont [nommées et limitées](docs/formats/broker-csv.md) ; la couverture de cours pilote reste à établir. Ni fiscalité, ni trading, ni Research/IA ne sont livrés. Voir [l’état de livraison](docs/validation/C-03-C-09.md) et [la couverture de données](docs/decisions/market-coverage.md).

## Guides publics

[Documentation](docs/index.md) · [Installation](docs/operations/installation.md) · [Premiers pas](docs/usage/first-steps.md) · [Mise à jour et récupération](docs/operations/upgrades.md) · [Contribution](CONTRIBUTING.md) · [Sécurité](SECURITY.md)

## Installation locale de test

Prérequis : Linux, Docker Engine avec BuildKit, Docker Compose **2.24.4 ou ultérieur** (`!override` est utilisé). Le frontend, l’API et l’outil d’archive sont construits dans l’image ; aucun Go/Node nécessaire sur le serveur.

1. Copier `.env.example` vers un `.env` privé ignoré par Git.
2. Générer deux secrets différents `POSTGRES_PASSWORD` et `ATLAS_DATABASE_PASSWORD` avec `openssl rand -hex 32` et remplacer la valeur d’exemple. Le secret hexadécimal évite les caractères spéciaux dans le DSN.
3. Pour un laboratoire HTTP avec comptes synthétiques sur machine/réseau de confiance : `ATLAS_ORIGIN=http://127.0.0.1:8080`, `ATLAS_INSECURE_HTTP=true`, `ATLAS_REGISTRATION=true`.
4. Lancer :

```sh
docker compose -f docker-compose.yml -f docker-compose.auth.yml -f docker-compose.loopback.yml up --build -d --wait
```

Ouvrir exactement l’origine configurée. Le build React est servi par Go sur le même port que `/api/v1`. Le fichier loopback de ce laboratoire lie le port à `127.0.0.1` ; le Compose de base conserve sa publication sur toutes les interfaces IPv4. Le port PostgreSQL n’est pas publié. HTTPS est requis pour une utilisation distante avec de vrais identifiants.

Le script `deploy/postgres/01-app-role.sh` doit être lisible par PostgreSQL avant le premier lancement (`chmod 644 deploy/postgres/01-app-role.sh` si un umask restrictif a produit un fichier illisible). Il crée le rôle `atlas` non superuser dans un volume neuf. Ne pas supprimer un volume pour résoudre un échec d’initialisation : l’inspecter et le récupérer.

Désactiver les inscriptions après création des comptes en définissant `ATLAS_REGISTRATION=false` et en recréant le service API avec les mêmes fichiers Compose. Aucun compte, mot de passe ou administrateur par défaut. Pas de récupération de compte livrée.

Sans le fichier auth, le Compose de base fournit uniquement le serveur web et la vitalité ; les données privées exigent PostgreSQL et la configuration d’identité.

## HTTPS pour l’auto-hébergement

Configurer un domaine réel pointant vers le serveur, les ports 80/443 et les variables privées :

```dotenv
ATLAS_DOMAIN=atlas.example.org
ATLAS_ORIGIN=https://atlas.example.org
ATLAS_INSECURE_HTTP=false
ATLAS_REGISTRATION=false
POSTGRES_PASSWORD=REMPLACER_PAR_UN_SECRET_HEXADECIMAL_ALEATOIRE
ATLAS_DATABASE_PASSWORD=REMPLACER_PAR_UN_AUTRE_SECRET_HEXADECIMAL_ALEATOIRE
```

Puis :

```sh
docker compose -f docker-compose.yml -f docker-compose.auth.yml -f docker-compose.tls.yml up --build -d --wait
```

Le proxy Caddy termine HTTPS et gère ses certificats ; l’API n’est plus publiée directement par cette variante. Les volumes TLS et PostgreSQL sont persistants. Le domaine et l’origine doivent correspondre exactement, sans slash final sur `ATLAS_ORIGIN`. Ne pas utiliser l’origine HTTP pour des identifiants réels. La recette locale HTTPS avec autorité de test ne remplace pas la recette DNS/certificat de votre domaine public.

Le manifeste web permet l’ouverture en mode application lorsque le navigateur le prend en charge ; aucune consultation hors ligne des données financières n’est promise.

## Utiliser le suivi

- **Portefeuilles :** créer/renommer/archiver/restaurer des regroupements et leurs comptes. Le type, la devise et le rattachement d’un compte restent fixes. L’archivage ne supprime pas l’historique et n’efface pas les valorisations consolidées.
- **Actifs :** actions/ETF identifiés par ISIN vérifié structurellement et MIC ; crypto/stablecoins identifiés par namespace/réseau et référence distincte du symbole. Ces identités restent déclaratives ; aucun fournisseur ne certifie automatiquement leur existence.
- **Activité :** dépôt, retrait, achat, vente, transfert de liquidités ou titres, frais, dividendes, intérêts effectivement crédités, staking et ouvertures explicites. L’achat peut être saisi par total frais inclus. La saisie est conservée en cas de refus.
- **Cours et taux :** observations manuelles positives, datées et sourcées ; bouton pour les taux de référence BCE. Ils sont distincts des taux réellement appliqués à une transaction. Aucun portefeuille ou montant n’est transmis à la BCE.
- **Accueil :** valeur globale, résultats, liquidités/épargne, consolidation par compte et portefeuille, allocation connue, dix principales positions, PRU et résultats réalisés/latents. Les variations de cours sont séparées du rendement personnel. La courbe journalière utilise les positions de chaque date ; les dates incomplètes interrompent le tracé. Choisir une plage d’au plus 366 jours à la fois.
- **Corrections :** remplacer ou annuler une opération avec motif. L’original reste dans l’audit. Tout l’historique est rejoué ; une correction créant un découvert ou une vente à découvert est refusée sans modification partielle.
- **Rapprochement :** comparez un relevé de liquidités et positions au journal à une date donnée, sans correction automatique. Le contrôle distingue les éléments fournis d’un relevé déclaré complet ; rapport JSON exportable. Voir [Atlas soldes v1](docs/formats/atlas-balances-v1.md).
- **Imports :** CSV Atlas v1 et variantes Coinbase/Trade Republic documentées, prévisualisation sans écriture financière puis confirmation atomique du lot. Réimport idempotent par identifiant externe. Les swaps et opérations non supportées sont signalés ; aucune transformation silencieuse. Voir [Atlas v1](docs/formats/atlas-csv-v1.md) et [les formats courtiers](docs/formats/broker-csv.md).
- **Export :** [JSON Atlas Portfolio v1](docs/formats/atlas-portfolio-v1.md) versionné de toutes les ressources privées disponibles, y compris journal/audit, prix et rapports d’import. Aucun mot de passe ou jeton. Les opérations actives se rejouent par `occurred_at`, puis `replay_order`, ordre relatif au seul utilisateur. L’export est lisible hors Atlas ; aucun import JSON de restauration n’est annoncé.

Les quantités acceptent aussi une fraction exacte (par exemple `100/3`) pour liquider sans arrondi une quantité calculée non terminante. Les montants sources sont des chaînes décimales (36 chiffres entiers et 18 décimales au maximum). Les calculs utilisent des rationnels exacts, y compris les quantités non terminantes obtenues par division. L’API fournit valeur exacte et affichage arrondi ; `≈` signale un arrondi. Les arrondis ne sont jamais réinjectés dans les calculs.

Les ouvertures sont explicites, sans dépôt inventé. Une histoire incomplète masque le résultat global ; un coût inconnu masque PRU/résultat de position. Aucun découvert ni vente à découvert. Les récompenses de staking ont un cours daté à réception, enregistré comme revenu et coût d’acquisition, selon [le contrat validé](docs/decisions/financial-policy.md). Ce modèle économique n’est pas une méthode fiscale.

Chaque compte conserve sa devise. Les transferts entre devises exigent un taux explicite ; pour les flux historiques non EUR, fournir le taux vers EUR et sa provenance à la date de l’opération si le résultat consolidé doit être calculable. Un cours ou FX manquant n’est jamais remplacé par zéro. Les dernières observations connues peuvent servir de référence datée ; leur ancienneté est signalée. Une variation de cours n’est calculée que lorsque les deux dates de comparaison sont couvertes.

## Sauvegarde chiffrée et restauration

Voir [la procédure complète](docs/operations/backup-restore.md). L’outil Go `/archive` est inclus dans l’image et peut être extrait sans installer Go sur le serveur :

```sh
mkdir -p bin
docker cp "$(docker compose -f docker-compose.yml -f docker-compose.auth.yml ps -q api)":/archive ./bin/atlas-archive
```

Créer une clé privée de 32 octets hors du dépôt avec `atlas-archive keygen -out CHEMIN_CLE`. Elle n’est pas imprimée et n’est jamais écrasée. La conserver séparément des archives.

Les scripts `scripts/backup.sh` et `scripts/restore.sh` utilisent les fichiers Compose indiqués par `COMPOSE_FILE` et la configuration de l’exploitant. Le chiffrement AES-256-GCM est authentifié ; la restauration vérifie toute l’archive avant d’écrire dans une **nouvelle** base `atlas_restore_...`. Aucune suppression ou substitution de base existante. Limite explicite de l’outil : 512 Mio par dump.

Des unités systemd quotidiennes sont fournies dans `deploy/systemd/` ; adapter utilisateur, chemins et environnement puis les activer sur le serveur cible. Elles ne sont pas activées automatiquement dans cet environnement. La présence d’un timer ne remplace pas un essai de restauration.

## Développement et vérifications

Les liens documentaires et profils décrits se contrôlent avec `python3 scripts/check-docs.py` et `python3 scripts/check-compose-docs.py` (Git/Python 3.10+, client Compose pour le second ; aucune instance démarrée).

Go 1.27.3 et Node 22.22.1/npm. Avec une base de test dédiée :

```sh
cd backend
gofmt -l .
go vet ./...
go mod verify
ATLAS_TEST_DATABASE_URL=DSN_DE_TEST go test -race -v ./...
go build ./...
go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 ./...
```

Sans `ATLAS_TEST_DATABASE_URL`, les tests PostgreSQL sont explicitement ignorés. Le serveur natif utilise `DATABASE_URL`, `ATLAS_ORIGIN`, `ATLAS_REGISTRATION`, `ATLAS_INSECURE_HTTP` et éventuellement `ATLAS_WEB_DIR` pointant vers `web/dist`. Les fichiers `.env` ne sont pas chargés automatiquement par le binaire Go.

```sh
cd web
npm ci
npm run lint
npm run build
npm test
npm audit --omit=dev
npm run dev
```

Vite écoute 127.0.0.1:5173 et relaie `/api/` vers 127.0.0.1:8080. Pour ce mode, l’origine API doit être `http://127.0.0.1:5173` avec HTTP de laboratoire explicite. `npm run preview` inspecte le build seul, sans intégration API de production.

Installer Chromium avec `npx playwright install chromium`, ou sélectionner un binaire par `ATLAS_CHROMIUM`. Depuis `web/`, avec les services de test actifs :

```sh
npm run test:browser
npm run test:a11y
ATLAS_E2E_ORIGIN=http://127.0.0.1:5173 ATLAS_E2E_TEST_INSTANCE=true npm run test:e2e
ATLAS_E2E_ORIGIN=http://127.0.0.1:5173 ATLAS_E2E_TEST_INSTANCE=true npm run test:portfolio
ATLAS_E2E_ORIGIN=http://127.0.0.1:5173 ATLAS_E2E_TEST_INSTANCE=true npm run test:brokers
ATLAS_E2E_ORIGIN=http://127.0.0.1:5173 ATLAS_E2E_TEST_INSTANCE=true npm run test:reconciliation
ATLAS_E2E_ORIGIN=http://127.0.0.1:5173 ATLAS_E2E_TEST_INSTANCE=true npm run test:market-status
```

Les cinq dernières suites créent des comptes et opérations **synthétiques dans une instance dédiée**. La suite portefeuille vérifie les montants attendus, les achats/ventes, erreurs, corrections, imports, export, rechargement et accessibilité des écrans peuplés. Les suites UI avec API simulée restent distinctes.

La CI comporte contrôles Go, frontend, intégration réelle avec rôle non superuser, accessibilité et builds Docker amd64/arm64. Le commit applicatif `3f033c88` a passé les cinq jobs du workflow [Quality #2](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42267576348).

## Exploitation et limites de livraison

`/healthz` mesure la vitalité du processus ; `/readyz` contrôle PostgreSQL avec une sonde bornée et mutualisée. La stack authentifiée utilise readiness pour son healthcheck. L’état BCE et votre dernière persistance sont consultables dans Activité, avec backoff en cas d’échec ; aucun appel externe pour lire cet état. Voir [le guide d’observabilité](docs/operations/observability.md). Consulter aussi les erreurs API/les logs (`docker compose logs --tail=100 api`) et vérifier les sauvegardes. Le serveur fonctionne sans privilèges, en lecture seule, avec délais et arrêt propre. En HTTPS, la session utilise `__Host-atlas_session`, sans Domain et avec Path=/ ; le cookie HTTP de laboratoire est distinct et n’est jamais accepté comme repli en HTTPS. Une mise à jour depuis le prototype C-02 peut demander une nouvelle connexion, sans perte de données. Les réponses privées ne sont pas mises en cache ; aucun token de session ni mot de passe n’est stocké dans JavaScript.

Les schémas v2 à v5 sont des migrations additives et sérialisées. Avant mise à jour, sauvegarder et tester une restauration dans une base distincte. Ne pas réécrire une migration publiée ou revenir à un ancien binaire sur des données qu’il ne sait pas interpréter ; restaurer un instantané compatible dans une nouvelle base si nécessaire. Ne pas exécuter `down -v` sur des données à conserver.

Les budgets de charge, la recette avec lecteurs d’écran, le matériel ARM64 réel et le déploiement sur le mini-PC cible restent à établir. La couverture boursière/crypto automatique, la récupération de compte, le hors-ligne et les fonctions V1/Research ne sont pas présentés comme livrés. Le MVP global ne peut pas être déclaré terminé en masquant ces écarts.

Références : [PRD](PRD.md), [roadmap](ROADMAP.md), [architecture](ARCHITECTURE.md), [cartographie](CODEBASE_GRAPH.md), [rapport initial C-02](docs/validation/C-02.md).

La suite `npm run test:readiness` nécessite une **instance de recette dédiée**, `ATLAS_E2E_API_ORIGIN`, `ATLAS_E2E_HEALTHCHECK` et `ATLAS_E2E_DATABASE_CONTAINER` : elle arrête puis redémarre ce conteneur DB pour prouver la reprise. Ne jamais la pointer sur une instance de production.

Recette : [état des quinze critères MVP](docs/validation/MVP-readiness.md) et [validation documentaire P5.7](docs/validation/P5-7-public-docs.md).

Lecture externe sans Atlas : [guide du lecteur Python hors ligne](docs/usage/read-export.md) et [preuves P5.1](docs/validation/P5-1-export-reader.md).

Durcissement en cours : [recette isolée installation/restauration](docs/operations/instance-verification.md), [licences et notices embarquées](docs/licenses/README.md), [preuves et limites du lot](docs/validation/P5-operations-hardening.md).
