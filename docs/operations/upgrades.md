# Mettre à jour et préparer un retour arrière

F-022, P5.7. Une mise à jour peut appliquer automatiquement des migrations au démarrage de l’API. La réversibilité se prépare avec une image/code identifiés et une sauvegarde restaurable ; ce n’est pas un simple redémarrage d’un ancien binaire.

## Identifier l’instance

Opérer depuis le checkout et le **même projet Compose** que l’installation. Reprendre les mêmes fichiers et le même `.env` privé ; ne pas régénérer de secrets ou changer de nom de projet pendant la mise à jour.

```sh
git status --short
git rev-parse HEAD
docker compose ls
docker compose ps
docker compose images
```

Conserver la référence de code, les identifiants d’images, la liste des fichiers Compose et le nom de projet. Si le checkout comporte des modifications locales, les examiner et les préserver avant de changer de référence. Le projet ne fournit pas encore de version stable taguée : choisir un commit dont les contrôles ont réussi et lire ses changements de configuration, schéma et limites.

Pour une instance HTTPS normale :

```sh
export COMPOSE_FILE=docker-compose.yml:docker-compose.auth.yml:docker-compose.tls.yml
```

Adapter cette liste à l’instance existante, pas l’inverse. Les variables `COMPOSE_FILE` exportées valent pour le shell courant ; un service systemd doit aussi avoir sa propre configuration cohérente.

## Préparer la maintenance

1. Vérifier une sauvegarde chiffrée et sa clé séparée avec [la procédure complète](backup-restore.md). Le dump couvre toute la base, pas seulement les opérations visibles.
2. Conserver l’image précédente. Exemple d’alias local unique, à enregistrer pour la reprise :

```sh
atlas_previous_image=$(docker compose images -q api)
atlas_rollback_tag="atlas-local:before-update-$(date -u +%Y%m%dT%H%M%SZ)"
docker image tag "$atlas_previous_image" "$atlas_rollback_tag"
```

3. Pour la sauvegarde servant de point de retour, interrompre les écritures applicatives. Le binaire d’archive doit avoir été extrait et les variables privées de sauvegarde configurées avant l’arrêt de l’API.

```sh
docker compose stop proxy api
bash scripts/backup.sh
```

Sans proxy dans votre variante, arrêter seulement `api`. La DB reste démarrée pour le dump. Ce point de retour exclut les écritures effectuées ensuite ; conserver l’instance en maintenance jusqu’à décision de reprise. Aucun script ne bloque d’éventuels autres clients SQL gérés par l’exploitant.

Tester la restauration dans une **autre base**, puis vérifier schéma et données. Un clone contenant des données réelles doit rester dans un environnement privé isolé, avec origine HTTPS et cookies distincts de la production. Ne pas publier ce clone comme une nouvelle instance de démonstration.

## Appliquer le code choisi

Dans le checkout propre, récupérer la référence retenue. Exemple de sélection explicite, remplacer `SHA_VERIFIE` par le commit choisi :

```sh
git fetch origin
git switch --detach SHA_VERIFIE
docker compose config --quiet
docker compose build api
docker compose up -d --wait
```

`--detach` évite de modifier une branche locale de développement ; il ne remplace pas une sauvegarde. Lire la documentation de **la version choisie**. Si elle introduit une variable ou un nouveau fichier Compose, l’ajouter consciemment avant le démarrage ; ne pas remplacer le `.env` existant par un exemple neuf.

Une erreur de build ne justifie pas de supprimer une base. Une erreur de migration ne se contourne pas en supprimant le volume ou en modifiant son registre à la main. Conserver les journaux techniques, le code précédent et les bases pour diagnostic.

## Recette après démarrage

- Vérifier `/healthz`, `/readyz`, le certificat HTTPS et les états de `docker compose ps`.
- Vérifier une connexion existante, un portefeuille connu, un export et les dates/sources. Préférer une consultation à une opération financière réelle de test.
- Distinguer panne DB et indisponibilité du fournisseur : une DB prête ne garantit pas des cours récents. Voir [l’observabilité](observability.md).
- Vérifier que le prochain job de sauvegarde cible toujours le bon projet et la bonne base. Conserver le point de retour jusqu’à la fin de la recette.

Ces vérifications sur la machine cible restent à exécuter par l’exploitant ; les preuves de laboratoire ne les remplacent pas.

## Reprise sur une base restaurée

Si le schéma n’a pas changé et qu’un retour d’image est démontré compatible, utiliser la version/image conservée selon la procédure validée pour cette instance. À défaut de compatibilité prouvée, ne pas lancer l’ancien binaire sur la base migrée.

Restaurer le point de retour dans un nouveau nom `atlas_restore_...` avec `scripts/restore.sh`. Après validation, le fichier optionnel `docker-compose.restore.yml` permet de sélectionner cette base **dans le même service DB et le même volume**. Il ne la crée pas, ne la restaure pas et ne supprime rien.

```sh
export ATLAS_RESTORE_DATABASE=atlas_restore_recette
export COMPOSE_FILE=docker-compose.yml:docker-compose.auth.yml:docker-compose.tls.yml:docker-compose.restore.yml
docker compose config --quiet
```

Adapter le nom à une base réellement restaurée et vérifiée. Choisir le code/image compatible avec cette sauvegarde, puis seulement démarrer la variante retenue. Le secret applicatif vient du `.env` privé ; aucun mot de passe n’est à écrire dans le fichier restore.

Après bascule, régler aussi `ATLAS_DATABASE_NAME` sur ce nom pour les futures sauvegardes. Le nom `atlas` de la base d’origine n’est pas supprimé. Les sessions présentes dans la sauvegarde peuvent encore être valides : une révocation pour incident de sécurité est une décision distincte d’une simple reprise technique.

La clé d’archive, les secrets DB, les volumes TLS et la version applicative ont des fonctions différentes. Les changements de rôle/mot de passe se font selon [la procédure des secrets existants](backup-restore.md), jamais par réinitialisation des volumes.

Après mise à jour de l’image, extraire aussi le nouvel outil `/archive` dans le chemin opérateur configuré avant d’utiliser les scripts du nouveau commit. Les scripts avec vérification post-écriture exigent `archive verify`. Le point de retour avant mise à jour utilise le script et l’outil de l’ancienne version ensemble.
