# Sauvegarde et restauration

F-022 / C-09. Les opérations sont la source de vérité ; sauvegarder **toute la base**, pas seulement une capture du dashboard. Aucun script ne supprime un volume ou n’écrase une base existante.

## Préparation

Depuis le checkout utilisé pour lancer l’instance, configurer `COMPOSE_FILE` avec les fichiers réellement utilisés (séparateur `:` sur Linux). Exemple avec HTTPS :

```sh
export COMPOSE_FILE=docker-compose.yml:docker-compose.auth.yml:docker-compose.tls.yml
mkdir -p bin
docker cp "$(docker compose ps -q api)":/archive ./bin/atlas-archive
```

Le binaire extrait est statique et correspond à l’architecture de l’image. On peut aussi le compiler avec `go build -o ../bin/atlas-archive ./cmd/archive` depuis `backend/`.

Choisir un répertoire de clés privé **hors du dépôt et séparé des archives**, puis :

```sh
./bin/atlas-archive keygen -out CHEMIN_PRIVE/atlas-backup.key
```

`keygen` crée 32 octets aléatoires en mode 0600, refuse un fichier déjà existant et n’imprime pas la clé. Conserver une copie de récupération de cette clé sur un support distinct et protégé. Une archive chiffrée est irrécupérable sans sa clé ; ne pas stocker la clé dans Git ou à côté d’une copie publiquement accessible du dump.

Variables de l’exploitant :

```sh
export ATLAS_BACKUP_KEY_FILE=CHEMIN_ABSOLU_VERS_LA_CLE
export ATLAS_BACKUP_DIR=CHEMIN_ABSOLU_VERS_LES_ARCHIVES
export ATLAS_ARCHIVE_BIN=CHEMIN_ABSOLU_VERS_bin/atlas-archive
# À adapter si l’API utilise une base restaurée ou renommée :
export ATLAS_DATABASE_NAME=atlas
```

## Sauvegarder

```sh
bash scripts/backup.sh
```

Le script utilise `pg_dump -Fc -U atlas`, donc le rôle applicatif non superuser. Avec `pipefail`, un échec du dump ne publie pas une sauvegarde terminée. L’archive est d’abord écrite dans un répertoire temporaire privé ; seule une chaîne complète réussie publie un nouveau nom de fichier. Le fichier existant n’est pas écrasé.

Chiffrement standard **AES-256-GCM**, nonce aléatoire 96 bits, en-tête de version authentifié comme données associées. Le déchiffrement vérifie l’authenticité de toute l’archive avant de produire un fichier plaintext. Modification, troncature, ajout de données et mauvaise clé sont refusés. L’outil refuse les dumps de plus de 512 Mio ; il travaille en mémoire et n’est pas présenté comme une solution de streaming pour de très grandes bases.

Les sorties publiées et les clés sont en mode 0600. Les fichiers temporaires créés par le script sont nettoyés sur succès/échec. Les clés ne sont jamais passées comme valeurs de ligne de commande ou imprimées.

## Restaurer sans écraser l’instance

Choisir un **nouveau** nom valide `atlas_restore_...` :

```sh
export ATLAS_RESTORE_DATABASE=atlas_restore_recette
bash scripts/restore.sh CHEMIN_ARCHIVE.aesgcm
```

Le script authentifie et déchiffre l’archive dans un fichier temporaire 0600 avant toute création de base. `createdb` refuse un nom existant ; seuls les noms `atlas_restore_[a-z0-9_]+` sont acceptés. Le restore est transactionnel (`pg_restore --single-transaction --exit-on-error --no-owner --no-privileges`) sous le rôle `atlas`. Le plaintext temporaire est supprimé ensuite.

En cas d’échec SQL, la nouvelle base est conservée pour diagnostic, sans toucher à l’ancienne. Ne pas contourner un échec en supprimant la base d’origine. Refaire l’essai dans un autre nom neuf après diagnostic.

Vérifier schéma, compteurs et données ; lancer une API de test avec `DATABASE_URL` pointant vers cette base et vérifier connexion, positions, cours, corrections, imports et export. La restauration ne modifie pas automatiquement la configuration de production. Lors d’une bascule explicitement décidée, conserver l’ancienne base et actualiser aussi `ATLAS_DATABASE_NAME` pour les sauvegardes futures.

Les rôles PostgreSQL sont préparés par le Compose ; le dump de base ne remplace pas la gestion des rôles de l’instance. Les sessions restaurées peuvent rester valides jusqu’à leur expiration : décider d’une révocation explicite en cas d’incident de sécurité, sans l’assimiler à une simple vérification de restauration.

## Exécution quotidienne

Les exemples `deploy/systemd/atlas-backup.service` et `.timer` utilisent un utilisateur `atlas`, un checkout `/srv/atlas` et un fichier privé `/etc/atlas/backup.env`. Adapter ces valeurs et les droits d’accès à Docker, au checkout, aux clés et au répertoire de sauvegardes.

Le fichier d’environnement contient les chemins ci-dessus et `COMPOSE_FILE`, pas la clé de chiffrement. Le `.env` Compose privé reste géré par l’exploitant. Installer les unités adaptées puis les activer sur le mini-PC cible :

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now atlas-backup.timer
systemctl list-timers atlas-backup.timer
journalctl -u atlas-backup.service
```

`OnCalendar=daily` suit le fuseau de l’hôte ; `Persistent=true` rattrape un déclenchement manqué. Aucune unité système n’est activée par cette session de développement. Le succès du service indique une sauvegarde terminée, pas une restauration prouvée : programmer aussi un exercice régulier dans une base distincte et vérifier les archives hors machine.

La rétention, la copie hors machine et les permissions relèvent de l’exploitant ; aucun effacement automatique des anciennes archives n’est introduit. Ne pas lancer `docker compose down -v` sur un volume à conserver.

## Secrets PostgreSQL distincts

`POSTGRES_PASSWORD` appartient à l’administrateur PostgreSQL. `ATLAS_DATABASE_PASSWORD` appartient au seul rôle applicatif `atlas` ; générer deux valeurs différentes. L’API reçoit uniquement le DSN applicatif. Le script d’initialisation utilise la variable applicative et transfère la propriété de `POSTGRES_DB` au rôle non privilégié.

Sur un volume déjà initialisé, modifier `.env` ne modifie pas les mots de passe PostgreSQL. Pour migrer depuis le prototype qui partageait un secret, effectuer une sauvegarde, arrêter l’API, puis utiliser `docker compose exec db psql -U postgres -d atlas` et la commande interactive `\password atlas` pour saisir le nouveau secret applicatif sans l’inscrire dans l’historique des commandes. Mettre à jour `ATLAS_DATABASE_PASSWORD` dans le `.env` privé puis recréer l’API. Conserver le secret administrateur séparément et vérifier l’accès avant toute autre rotation. Aucun volume ne doit être réinitialisé pour cette migration.

Pour sélectionner ensuite une base restaurée dans le même projet Compose, suivre [mise à jour et retour arrière](upgrades.md). Le fichier facultatif `docker-compose.restore.yml` ne réalise pas la restauration.

Recette reproductible du code de reprise : [scénario Compose isolé](instance-verification.md). Ses assertions et son état de validation restent distincts d’un exercice sur votre serveur cible.
