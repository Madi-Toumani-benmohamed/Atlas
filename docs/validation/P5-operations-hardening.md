# P5.2/P5.3/P5.4/P5.8 — Durcissement d’exploitation, 7 novembre 2026

Branche locale `work/atlas-operations-hardening`, créée depuis `origin/main` **acf8001**, fusion de la PR #3. F-022, NFR-04/05/13/14/15. Aucun changement de journal, calcul financier, migration, modèle de données ou fournisseur.

## Avancées du lot

| Lot | Travaux concrets et statut |
| --- | --- |
| P5.2/P5.3 | Nouveau scénario reproductible de Compose neuf → persistance → archive chiffrée → base restaurée → retour à l’original. Implémenté dans `scripts/verify-instance.py`, ajouté au build AMD64 en CI ; succès du scénario complet encore à établir. |
| P5.4 | Assertions API non root/read-only/capacités, DB privée/rôle non privilégié, origine incorrecte et export anonyme refusés ; garde-fous de projet, daemon, répertoire privé et disque. Ce n’est pas un audit global de sécurité ; les assertions d’instance attendent l’exécution complète. |
| P5.8 | Dix dépendances runtime inventoriées, textes MIT/BSD et PATENTS examinés, Apache 2.0 conservée. Correctif de notice transitive scheduler, contrôle du graphe source et des fichiers distribués. Nouvelle image complète à contrôler en CI. |

## Contrôles exécutés

- `python3 -B -m unittest discover -s scripts/tests -v` : **9 tests réussis**. Sept tests de lecture d’export existants ; deux contrôles de confinement du laboratoire (paramètres externes ne sélectionnant pas une instance existante, secrets/permissions et refus d’espace avant appel Docker). Une socket loopback temporaire sélectionne le port ; les tests ont été exécutés avec cette capacité disponible.
- `python3 scripts/check-licenses.py` avec Go 1.27.3 : **10 dépendances** (7 Go, 3 npm), licence projet et toolchain conformes aux versions et empreintes consignées.
- Extraction en lecture seule des notices de l’image locale existante : **refus attendu**, car `scheduler/LICENSE` manquait. Après correction de `web/scripts/licenses.mjs` par `--all`, exécution du collecteur frontend réussie et notice transitive générée.
- Assemblage temporaire des notices existantes et de la notice nouvellement générée : **15 fichiers conformes** ; altération synthétique de la notice scheduler : **refus attendu**. Cet assemblage est un test du contrôle et du correctif, pas une image Docker complète reconstruite et validée.
- Refus réel du nouveau garde-fou de disque avant création de conteneur ; lint frontend, liens Markdown, rendu Compose et syntaxe Python/YAML contrôlés. Aucune nouvelle suite backend financière ou parcours navigateur revendiqué pour ce changement d’outillage.

## Limite réelle du laboratoire

Les tentatives de création d’une nouvelle instance ont échoué avant validation du scénario : préparation initiale corrigée pour utiliser des binaires statiques dans scratch, puis saturation du stockage Docker vfs pendant la création du conteneur PostgreSQL. Aucun succès de sauvegarde/restauration n’est attribué à ces tentatives. Les anciens exercices [C-03–C-09](C-03-C-09.md) restent des preuves historiques distinctes.

Les seuls conteneurs créés pour ces essais ont été arrêtés/retirés ; leurs volumes restent conservés. Les conteneurs de la recette antérieure restent arrêtés. Les exécutables temporaires et caches Go régénérables ont été nettoyés pour rétablir les outils ; code, volumes et sauvegardes conservés.

La revue automatique a refusé `docker builder prune -f`, car ce nettoyage global pouvait toucher des caches d’autres travaux. Cette commande n’a pas été exécutée ; aucun nettoyage global Docker ni suppression de volume n’a servi à contourner le refus. Le scénario intègre maintenant un garde-fou de 2 Gio libres dans son espace de travail et documente le besoin distinct du stockage Docker.

## CI et gates restants

Workflow porté à **7 jobs** : nouveau contrôle licences source ; contrôle des notices dans les deux builds ; installation/reprise complète après build AMD64. Cette nouvelle CI n’a pas été exécutée avant publication du lot. La validation de la PR #3 indiquée par le responsable produit ne vaut pas preuve du nouveau scénario.

P5.2/P5.3/P5.4/P5.8 restent ouverts jusqu’aux validations manquantes ; aucun passage global MVP ou tag. Le serveur cible, certificat public, sauvegarde quotidienne réellement activée et restauration hors machine restent à qualifier. Les contrôles de charge, lecteur d’écran et les sources de cours non choisies restent hors de ces preuves.
