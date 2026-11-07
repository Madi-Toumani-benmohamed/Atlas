# P5.2/P5.3/P5.4/P5.8 — Durcissement d’exploitation, 7 novembre 2026

Branche locale `work/atlas-operations-hardening`, créée depuis `origin/main` **acf8001**, fusion de la PR #3. F-022, NFR-04/05/13/14/15. Aucun changement de journal, calcul financier, migration, modèle de données ou fournisseur.

## Avancées du lot

| Lot | Travaux concrets et statut |
| --- | --- |
| P5.2/P5.3 | Nouveau scénario reproductible de Compose neuf → persistance → archive chiffrée → base restaurée → retour à l’original. Scénario complet réussi dans le build AMD64 en CI ; P5.2 clôturé. P5.3 conserve la recette cible, la planification quotidienne et la copie hors machine ouvertes. |
| P5.4 | Assertions API non root/read-only/capacités, DB privée/rôle non privilégié, origine incorrecte et export anonyme refusés ; garde-fous de projet, daemon, répertoire privé et disque. Ce n’est pas un audit global de sécurité ; les assertions d’instance réussissent en CI. |
| P5.8 | Dix dépendances runtime inventoriées, textes MIT/BSD et PATENTS examinés, Apache 2.0 conservée. Correctif de notice transitive scheduler, contrôle du graphe source et des fichiers distribués. Les deux nouvelles images passent le contrôle des 15 fichiers de notices en CI. P5.8 clôturé. |

## Contrôles exécutés

- `python3 -B -m unittest discover -s scripts/tests -v` : **11 tests réussis**. Sept tests de lecture d’export existants ; quatre contrôles de confinement/disponibilité du laboratoire (paramètres externes ne sélectionnant pas une instance existante, secrets/permissions, refus d’espace avant appel Docker, reprise de sonde après reset TCP et timeout sans faux succès). Une socket loopback temporaire sélectionne le port ; les tests ont été exécutés avec cette capacité disponible.
- `python3 scripts/check-licenses.py` avec Go 1.27.3 : **10 dépendances** (7 Go, 3 npm), licence projet et toolchain conformes aux versions et empreintes consignées.
- Extraction en lecture seule des notices de l’image locale existante : **refus attendu**, car `scheduler/LICENSE` manquait. Après correction de `web/scripts/licenses.mjs` par `--all`, exécution du collecteur frontend réussie et notice transitive générée.
- Assemblage temporaire des notices existantes et de la notice nouvellement générée : **15 fichiers conformes** ; altération synthétique de la notice scheduler : **refus attendu**. Cet assemblage est un test du contrôle et du correctif, pas une image Docker complète reconstruite et validée.
- Refus réel du nouveau garde-fou de disque avant création de conteneur ; lint frontend, liens Markdown, rendu Compose et syntaxe Python/YAML contrôlés. Aucune nouvelle suite backend financière ou parcours navigateur revendiqué pour ce changement d’outillage.

## Limite réelle du laboratoire

Les tentatives de création d’une nouvelle instance ont échoué avant validation du scénario : préparation initiale corrigée pour utiliser des binaires statiques dans scratch, puis saturation du stockage Docker vfs pendant la création du conteneur PostgreSQL. Aucun succès de sauvegarde/restauration n’est attribué à ces tentatives. Les anciens exercices [C-03–C-09](C-03-C-09.md) restent des preuves historiques distinctes.

Les seuls conteneurs créés pour ces essais ont été arrêtés/retirés ; leurs volumes restent conservés. Les conteneurs de la recette antérieure restent arrêtés. Les exécutables temporaires et caches Go régénérables ont été nettoyés pour rétablir les outils ; code, volumes et sauvegardes conservés.

La revue automatique a refusé `docker builder prune -f`, car ce nettoyage global pouvait toucher des caches d’autres travaux. Cette commande n’a pas été exécutée ; aucun nettoyage global Docker ni suppression de volume n’a servi à contourner le refus. Le scénario intègre maintenant un garde-fou de 2 Gio libres dans son espace de travail et documente le besoin distinct du stockage Docker.

## CI et gates restants

Workflow porté à **7 jobs** : nouveau contrôle licences source ; contrôle des notices dans les deux builds ; installation/reprise complète après build AMD64. [Quality 42385363672](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42385363672), commit `aee6d71c485c2e00ee81f31b244a899a1638ebb1` : **7 jobs réussis**. Le contrôle licences source passe ; chaque image AMD64/ARM64 contient les 15 notices attendues, scheduler compris.

Sur Linux AMD64 et PostgreSQL officiel 18.6, le nouveau scénario confirme le Compose neuf, readiness, loopback, rôle non privilégié, persistance après redémarrage, correction et audit. Les vrais scripts produisent une archive chiffrée 0600, restaurent une base distincte et refusent cible existante/altération sans créer la base altérée. Après bascule, l’export est identique et le total exact reste 1175 EUR ; le dépôt de 10 EUR dans la seule base restaurée produit 1185 EUR. Le retour à l’original confirme son export intact et la présence des deux bases.

Les premiers passages hébergés échouaient sur une réinitialisation de connexion TCP pendant l’attente de redémarrage. La sonde en lecture seule est désormais réessayée avec délai borné ; aucune écriture financière n’est relancée. Deux tests supplémentaires couvrent reset/état indisponible puis reprise, et timeout sans succès fictif. Les diagnostics d’erreur n’exposent que type et lignes de code, pas les valeurs d’entrée. Le passage complet ci-dessus réussit après ce correctif.

P5.2 et P5.8 sont clôturés avec ces preuves. P5.3 et P5.4 restent ouverts pour leurs validations restantes ; aucun passage global MVP ou tag. Le serveur cible, certificat public, sauvegarde quotidienne réellement activée et restauration hors machine restent à qualifier. Les contrôles de charge, lecteur d’écran et les sources de cours non choisies restent hors de ces preuves.
