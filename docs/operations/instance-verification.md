# Recette isolée d’installation et de reprise

P5.2/P5.3/P5.4, F-022, NFR-04/05/13. Le [script de recette](../../scripts/verify-instance.py) est destiné à un laboratoire Linux avec Docker local et Compose 2.24.4+, Python 3.10+ et Bash. Il n’est pas un outil d’administration d’une instance existante.

## Préparer et lancer

Construire l’image du checkout à vérifier et télécharger PostgreSQL 18.6. Prévoir de l’espace libre sur le stockage Docker **et** sur le répertoire de travail ; le garde-fou vérifie au moins 2 Gio sur ce dernier, sans garantir la capacité de tous les autres systèmes de fichiers. Le pilote Docker vfs peut multiplier les copies de couches et demander davantage.

```sh
docker build -f backend/Dockerfile -t atlas-recette:local .
docker pull postgres:18.6
python3 scripts/verify-instance.py --image atlas-recette:local --work-dir /CHEMIN_PRIVE_NOUVEAU/recette
```

Le parent doit exister ; le répertoire final doit être neuf et situé hors du checkout Git. Le script refuse sa réutilisation, génère des secrets distincts, crée le répertoire en 0700 et le fichier d’environnement en 0600. Il n’imprime pas les secrets ni les erreurs brutes des commandes. Un échec de commande peut laisser un `command-failure.log` privé pour diagnostic.

Le programme cible uniquement `/var/run/docker.sock`, ignore les sélecteurs de contexte/daemon et de projet Compose hérités, puis génère un nom `atlas-recette-…` unique. Il utilise les fichiers Compose livrés avec un override de laboratoire ; il ne choisit pas un projet existant. Les images doivent déjà être disponibles localement (`--no-build --pull never`). Le port API est choisi sur loopback ; la réservation est relâchée avant le démarrage et une collision concurrente fait échouer le test. HTTP et inscriptions ouvertes ne concernent que ces données synthétiques.

## Scénario automatique prévu

1. Volume et instance neufs ; readiness, API non root/read-only, capacités retirées, PostgreSQL non publié et rôle applicatif non privilégié.
2. Inscription/connexion synthétiques, portefeuille/compte/actif, dépôt 1000 EUR, achat de 5 unités corrigé de 100 à 90, observation à 125 : total attendu **1175 EUR** et audit conservé. Refus de l’export anonyme et d’une origine d’écriture incorrecte.
3. Redémarrage de l’API ; comparaison du JSON exporté, hors heure de génération.
4. Extraction de l’outil archive, clé privée, exécution des vrais scripts `backup.sh` et `restore.sh` dans une base distincte ; permissions 0600, refus d’une base cible existante et d’une archive altérée avant création de base.
5. Bascule de la seule API vers la base restaurée, connexion, export et valorisation comparés. Écriture d’un dépôt 10 EUR dans cette seule base : 1185 EUR ; retour vers la base d’origine pour vérifier son export intact et la présence des deux bases.

Cette liste décrit les assertions du scénario. Un ajout à la CI ne prouve pas leur réussite : consulter [le rapport du lot](../validation/P5-operations-hardening.md).

## Fin, diagnostic et portée

En succès ou échec, le bloc final arrête et retire les seuls conteneurs du projet généré, **sans supprimer les volumes**. Le réseau et les volumes peuvent rester. Le répertoire privé contient clé, archives, notices et configuration ; le conserver protégé pour diagnostic puis appliquer votre politique de rétention. Aucun nettoyage global Docker ni suppression automatique de volume n’est inclus.

Le scénario ne démarre pas systemd, ne planifie pas une sauvegarde quotidienne, n’installe pas de certificat public et ne valide pas un retour d’un ancien schéma vers un nouveau. La recette de la machine cible et les sauvegardes hors machine restent à exécuter selon [installation](installation.md), [sauvegarde/restauration](backup-restore.md) et [mise à jour](upgrades.md).

La CI ajoute ce scénario après le build AMD64, avec PostgreSQL officiel sur un runner jetable. ARM64 conserve le build et le contrôle des notices, sans prétendre rejouer cette recette sur matériel ARM64 physique.
