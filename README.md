# Atlas Portfolio

Suivi d’investissements open source et auto-hébergeable. **En développement : socle conteneurisé et API d’identité C-02 ; aucune gestion de portefeuille disponible.** Licence Apache 2.0.

## Docker Compose

Depuis la racine du dépôt, avec Docker Engine et Compose v2 :

```sh
docker compose up --build -d --wait
curl --fail http://127.0.0.1:8080/healthz
docker compose ps
docker compose logs --tail=100 api
```

Depuis un autre ordinateur, accéder à `http://<IP_DU_SERVEUR>:8080/healthz` (adapter le port si nécessaire). Le socle ne fournit pas encore d’interface graphique.

La réponse attendue est `{"status":"ok"}`. Le service écoute sur toutes les interfaces IPv4 de l’hôte ; aucune authentification n’est encore disponible. Il tourne sans privilèges, avec un système de fichiers en lecture seule et un contrôle de santé. Celui-ci contrôle le processus uniquement.

Pour changer le port, créer un `.env` contenant `ATLAS_PORT=18080`, ou lancer `ATLAS_PORT=18080 docker compose up --build -d --wait`. Compose lit `.env` pour cette substitution ; `ATLAS_ADDR` est fixé à `0.0.0.0:8080` dans le conteneur.

Arrêter avec `docker compose stop`, redémarrer avec `docker compose start`, reconstruire après modification avec `docker compose up --build -d --wait`. Aucun volume ni donnée métier n’est créé. Le frontend n’a pas encore de page à servir et PostgreSQL n’est pas encore connecté : ils ne sont pas présentés comme des services fonctionnels.

## Développement

Prérequis : Go 1.27.3 et Node 22.22.1/npm (ou Docker pour exécuter Go).

```sh
cd backend
go run ./cmd/atlas
```

Le serveur écoute `127.0.0.1:8080`. `GET /healthz` renvoie la vitalité du processus ; aucun contrôle de base de données. `ATLAS_ADDR` permet de changer l’écoute. `.env.example` est un exemple : les fichiers `.env` ne sont pas chargés automatiquement.

```sh
cd web
npm ci
npm run lint
npm run build
npm test
```

Le frontend compile actuellement une bibliothèque technique dans `web/dist`, sans écran ni serveur web. Le build vérifie également les types. Il ne s’agit pas d’un MVP utilisable.

## Vérification backend

Depuis `backend/` :

```sh
gofmt -l .
go vet ./...
go test -race ./...
go build ./...
```

Le workflow `.github/workflows/ci.yml` exécute ces contrôles et ceux du frontend. Son exécution hébergée nécessitera un push explicite.

## Limites

Authentification et persistance des identités sont disponibles via le Compose complémentaire ci-dessous. Données de marché, opérations et calculs financiers ne sont pas implémentés. Compose lance le socle technique, pas encore un déploiement MVP de production. Aucun export ou procédure de sauvegarde/restauration livré à ce stade. Ne pas saisir de données personnelles dans ce socle.

Voir [PRD](PRD.md), [roadmap](ROADMAP.md), [décisions C-01](docs/decisions/C-01.md), [ADR](ADR.md), [cartographie](CODEBASE_GRAPH.md) et [audit initial](docs/audits/C-00.md).

## Authentification et PostgreSQL (API C-02)

Le fichier `docker-compose.auth.yml` ajoute la base persistante et active les routes d’identité. Créer un `.env` privé, ignoré par Git :

```dotenv
POSTGRES_PASSWORD=REMPLACER_PAR_UN_SECRET_HEXADECIMAL_ALEATOIRE
ATLAS_ORIGIN=https://atlas.example.org
ATLAS_REGISTRATION=false
```

Générer le secret avec `openssl rand -hex 32`. Ne pas utiliser la valeur d’exemple. Déployer derrière un proxy HTTPS correspondant exactement à l’origine (sans slash final), puis :

```sh
docker compose -f docker-compose.yml -f docker-compose.auth.yml up --build -d --wait
```

Pour un essai HTTP avec comptes fictifs sur réseau de confiance, définir explicitement `ATLAS_ORIGIN=http://IP_DU_SERVEUR:8080` et `ATLAS_INSECURE_HTTP=true`. HTTPS et cookies Secure sont le défaut. Le proxy HTTPS n’est pas fourni. Le port PostgreSQL n’est pas publié. Le volume `atlas_database` contient les identités et sessions : le conserver lors des mises à jour ; une procédure de restauration vérifiée reste à livrer.

Activer temporairement `ATLAS_REGISTRATION=true` pour autoriser les inscriptions, puis recréer le service avec la valeur `false`. Aucun compte administrateur ni identifiant par défaut n’est créé. Le script PostgreSQL configure le rôle `atlas` sans privilèges superuser sur un volume neuf.

Contrat API (aucun écran de connexion pour l’instant) :

| Méthode / chemin | Entrée et résultat |
| --- | --- |
| POST /api/v1/auth/register | JSON `email`, `password` ; 202 générique, inscription seulement si activée |
| POST /api/v1/auth/login | Même JSON ; cookie de session après vérification, 401 sinon |
| GET /api/v1/me | Cookie requis ; uniquement l’identité courante |
| POST /api/v1/auth/logout | Révocation du cookie courant ; 204 |

Les POST exigent `Origin` égal à `ATLAS_ORIGIN` ; inscription et connexion exigent `Content-Type: application/json`. Mot de passe entre 12 et 72 octets. Limite globale : 20 tentatives/minute ; session de 12 heures, renouvelée par nouvelle connexion qui invalide les anciennes. Pas de récupération de mot de passe ni validation de propriété de l’adresse mail dans ce lot.

Tests d’intégration : fournir `ATLAS_TEST_DATABASE_URL` pointant vers une **base de test dédiée**, puis `go test -race -v ./...` depuis backend. Les tests y créent des comptes synthétiques ; sans cette variable, le test PostgreSQL est explicitement ignoré. CI configurée avec PostgreSQL 18.6.
