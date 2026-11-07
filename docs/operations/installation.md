# Installation et configuration

F-022, P5.7. Ces instructions partent d’un checkout contenant les fichiers référencés et d’une **nouvelle** instance. Pour une instance existante, suivre [la procédure de mise à jour](upgrades.md) et garder son projet Compose, ses secrets et ses volumes.

## Prérequis et version choisie

Linux avec Docker Engine/BuildKit et Docker Compose 2.24.4 ou ultérieur (`!override`). Accès au registre des images et aux téléchargements nécessaires au build. Node et Go sont embarqués dans les étapes de compilation Docker, pas requis sur le serveur. Bash et OpenSSL servent aux procédures opérateur ; Python est seulement utilisé par le contrôle documentaire de développement.

Choisir un commit dont le workflow Quality a réussi, et conserver son SHA. Aucun tag de version stable n’est encore revendiqué. La compilation ARM64 existe ; les preuves d’exécution actuelles incluent de l’émulation, pas la recette de votre matériel.

Depuis la racine du checkout, dans un shell Bash :

```sh
(
  set +x
  set -e
  set -o noclobber
  umask 077
  atlas_admin_password=$(openssl rand -hex 32)
  atlas_app_password=$(openssl rand -hex 32)
  while IFS= read -r atlas_line || [ -n "$atlas_line" ]; do
    case "$atlas_line" in
      POSTGRES_PASSWORD=*) printf 'POSTGRES_PASSWORD=%s\n' "$atlas_admin_password" ;;
      ATLAS_DATABASE_PASSWORD=*) printf 'ATLAS_DATABASE_PASSWORD=%s\n' "$atlas_app_password" ;;
      *) printf '%s\n' "$atlas_line" ;;
    esac
  done < .env.example > .env
)
```

Ce bloc crée un `.env` privé avec deux secrets hexadécimaux distincts sans les afficher ni les passer en arguments de commandes externes. Il refuse un `.env` déjà présent. Éditer ensuite les variables non secrètes localement selon la variante choisie ; ne pas commiter le fichier. Le format hexadécimal évite un encodage de mot de passe particulier dans le DSN.

Pour une nouvelle installation, choisir aussi un nom stable de projet Compose et l’inscrire dans ce `.env`, par exemple `COMPOSE_PROJECT_NAME=atlas`. Ce nom détermine notamment les volumes. Sur une installation existante, reprendre exactement le nom déjà utilisé : changer de nom peut créer une instance vide à côté de l’ancienne.

## Variables

| Variable | Rôle / valeur attendue |
| --- | --- |
| `COMPOSE_PROJECT_NAME` | Nom stable choisi par l’exploitant ; conserver celui des instances existantes |
| `POSTGRES_PASSWORD` | Secret administrateur PostgreSQL, distinct du secret applicatif |
| `ATLAS_DATABASE_PASSWORD` | Secret du rôle `atlas`, non superuser ; seul ce secret DB est donné à l’API |
| `ATLAS_DOMAIN` | Domaine réel du proxy HTTPS, sans schéma |
| `ATLAS_ORIGIN` | Origine exacte du navigateur : schéma + hôte + port éventuel, sans chemin ni slash final |
| `ATLAS_INSECURE_HTTP` | `false` pour HTTPS ; `true` uniquement pour le laboratoire HTTP synthétique ci-dessous |
| `ATLAS_REGISTRATION` | `true` pendant l’ouverture voulue des inscriptions, puis `false` pour les fermer |
| `ATLAS_PORT` | Port HTTP publié par la variante laboratoire ; 8080 par défaut |

Les variables `DATABASE_URL`, `ATLAS_ADDR` et `ATLAS_WEB_DIR` sont configurées par Compose ; ne pas remplacer le DSN manuellement pour l’installation normale. Le Compose authentifié sélectionne la sonde `/readyz`. Voir [l’observabilité](observability.md).

Le script `deploy/postgres/01-app-role.sh` doit être lisible au premier lancement (`chmod 644 deploy/postgres/01-app-role.sh`). Il ne s’exécute que sur un volume neuf ; modifier un mot de passe dans `.env` ne le modifie pas dans un volume existant. La [rotation des secrets existants](backup-restore.md) est une procédure distincte.

## Laboratoire HTTP sur cette machine

Données et comptes exclusivement synthétiques, sur machine de confiance. Configurer `ATLAS_ORIGIN=http://127.0.0.1:8080`, `ATLAS_PORT=8080`, `ATLAS_INSECURE_HTTP=true`, `ATLAS_REGISTRATION=true`. Adapter ensemble origine et port si nécessaire.

```sh
export COMPOSE_FILE=docker-compose.yml:docker-compose.auth.yml:docker-compose.loopback.yml
docker compose config --quiet
docker compose up --build -d --wait
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/readyz
```

Ouvrir exactement l’origine indiquée. Le fichier loopback lie uniquement l’API à `127.0.0.1`. Le Compose de base conserve son exposition sur toutes les interfaces IPv4 ; ce n’est pas la même variante. PostgreSQL n’est pas publié par ces fichiers.

`ATLAS_INSECURE_HTTP=true` ne fournit pas TLS : ne pas réutiliser cette configuration pour l’accès distant à des données ou identifiants réels.

## Instance HTTPS

Configurer un domaine réel pointant vers l’hôte et l’accès aux ports 80/443. Dans `.env`, renseigner le même domaine et `ATLAS_ORIGIN=https://VOTRE_DOMAINE`, `ATLAS_INSECURE_HTTP=false`. Pendant la création des premiers comptes, activer les inscriptions seulement sur une instance dont l’accès est maîtrisé.

```sh
export COMPOSE_FILE=docker-compose.yml:docker-compose.auth.yml:docker-compose.tls.yml
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

La variante TLS retire le port public direct de l’API ; Caddy assure HTTPS. Ne pas ajouter le fichier loopback après le fichier TLS, car il réintroduirait une publication HTTP de l’API. Le domaine de l’exemple n’est pas un domaine fourni ou déployé par le projet.

Vérifier le certificat du **vrai domaine** et `/readyz` par HTTPS. Ne pas désactiver la vérification TLS. Une recette avec une autorité locale de test n’établit pas le bon fonctionnement du DNS ou du certificat public de votre instance.

Créer les comptes voulus dans l’interface, puis remettre `ATLAS_REGISTRATION=false` dans `.env` et recréer l’API :

```sh
docker compose up -d --wait api
```

Il n’y a aucun compte ou mot de passe par défaut, et le premier inscrit n’est pas administrateur financier. Aucun parcours de récupération de compte n’est livré.

## Vérifier et conserver

1. `docker compose ps` indique API/DB saines ; le proxy répond sur l’origine HTTPS attendue.
2. Connexion, création du premier portefeuille et déconnexion fonctionnent ; une session se restaure après rechargement.
3. Le même projet Compose et les mêmes volumes sont conservés après redémarrage.
4. Une sauvegarde chiffrée puis une restauration en base distincte sont réellement vérifiées selon [la procédure](backup-restore.md).

Les certificats Caddy, la base et la clé d’archive ont des rôles distincts. Conserver les volumes, les secrets privés et une copie protégée de la clé d’archive. `docker compose stop` arrête sans supprimer les volumes ; `down -v` les supprime et ne fait partie d’aucune récupération proposée ici.
