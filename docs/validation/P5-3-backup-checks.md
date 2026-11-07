# P5.3 — Vérification des sauvegardes, 7 novembre 2026

F-022, NFR-05/11/13 ; base `main` `777164a`. Le responsable produit reporte le déploiement de sa machine Linux x86 ; connexion Atlas par mot de passe, SSO envisagé plus tard. Aucun accès SSH ou mot de passe n’a été demandé ou utilisé. P5.3 conserve donc sa réserve de recette cible et de planification réelle.

## Livré

- `archive verify -key-file …` authentifie l’archive sans publier de plaintext ; `-out` refusé. Format AES-GCM v1 et limite de 512 Mio inchangés. Déchiffrement en mémoire, pas de promesse de streaming ou d’effacement mémoire garanti.
- `backup.sh` vérifie le fichier chiffré écrit avant son lien de publication atomique. Si cette étape échoue, pas de nom terminé ni de faux succès de service.
- `check-backup.sh` applique un seuil d’âge explicitement fourni par l’exploitant, refuse permissions publiques/groupe, liens et dates futures, puis vérifie GCM. Âge du mtime, sans prétendre dater cryptographiquement le dump.
- La recette Compose exécute les vrais contrôles sur l’archive produite et sur son altération, puis restaure la base comme précédemment. La CI existante exécute les nouveaux tests sans ajout de job.

## Vérifications locales

`python3 -B -m unittest discover -s scripts/tests -v` : **15 tests réussis**. Deux tests nouveaux couvrent huit variantes de politique de fichier et l’absence de publication quand la vérification post-écriture échoue. Ils utilisent un outil crypto simulé pour isoler la politique du shell ; l’AES-GCM réel est testé en Go et dans la recette Compose.

Syntaxe Bash, gofmt, liens documentaires et `git diff --check` contrôlés. Le test Go ajouté couvre succès de verify sans fichier produit, refus de -out, données invalides/tronquées/ajoutées et mauvaise clé. Les nouveaux tests Go et le scénario réel passent dans [Quality 42391095402](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42391095402), commit `92ddb9d8`, sept jobs réussis. La CI confirme aussi le contrôle d’âge choisi, l’altération refusée, la restauration distincte et l’original préservé. Fusion via PR #6 ; [CI main 42391314792](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42391314792) également réussie. Aucune compilation Go locale n’est revendiquée sur le disque limité du laboratoire.

## Compatibilité et suites

Les nouveaux scripts doivent être utilisés avec l’outil archive du même commit ; le guide de mise à jour l’explicite. Aucun volume, ancienne archive ou base n’est supprimé. L’authentification seule ne remplace pas une restauration SQL et sa recette fonctionnelle. La copie hors machine, l’installation du timer et la recette cible restent ouvertes ; aucun SLO d’âge ou de latence n’est inventé.
