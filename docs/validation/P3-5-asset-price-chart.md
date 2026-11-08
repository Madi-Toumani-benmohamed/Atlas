# P3.5 — Graphique des observations de cours

8 novembre 2026. F-015/F-019/F-021, US-005, NFR-01/07/08/09 ; phase 3. Lecture de prix manuels existants, sans fournisseur, migration ou méthode de performance supplémentaire.

## Comportement

Depuis Actifs, ouvrir « Cours et historique de cet actif », puis « Graphique des observations de cours ». Choisir explicitement devise, début et fin dans le fuseau du navigateur. Aucun choix de période longue par défaut (Q-08 reste ouvert). La période, au plus 366 jours, ne peut dépasser la date de lecture du jeu d’observations privé.

Seules les observations de cet identifiant d’actif et de cette devise sont représentées, par points aux instants enregistrés : aucune ligne interpolée, conversion FX, association par symbole ou application de la position actuelle au passé. Le graphique décrit les cours du marché, jamais le rendement personnel. Un actif sans détention peut être consulté. Minimum, maximum, devise et bornes UTC sont explicites ; chaque point conserve date, prix exact et source dans une liste accessible. Deux sources simultanées restent deux observations.

Prix : comparaison et normalisation par BigInt à 18 décimales, dans les bornes du contrat de prix manuel. Les instants RFC3339 conservent jusqu’à neuf décimales et leur décalage pour le filtrage exact ; aucune troncature aux millisecondes pour décider l’appartenance à la période. Seules les coordonnées SVG finales, bornées, utilisent Number. Prix et dates source ne sont pas réécrits. Les prix grands séparés par 10⁻¹⁸ restent distincts et un prix de 10⁻¹⁸ ne devient pas zéro.

Aucune observation : message explicite, sans faux tracé nul. Dates invalides, période trop longue, prix non représentable ou plus de 1 000 observations sélectionnées : erreur explicite, champs conservés, aucun échantillonnage silencieux. Changer de devise/période retire l’ancien tracé. Le rechargement des observations démonte les panneaux précédents. Aucune écriture ni requête à un fournisseur depuis ce graphique.

## Vérification et portée

Tests purs `npm test` : précision minuscule/grande, nanosecondes, fuseaux, séparation des actifs/devises/FX, bornes inclusives, période vide/invalide, prix constant et sources simultanées, plafond de 1 000 points sans modification des sources. Lint, build TypeScript/Vite et contrôle du diff requis.

Prévisualisation locale avec API explicitement simulée : deux cours, devise et période explicites, aucune interpolation ; douze scans axe ouverts/repliés en sombre/clair aux largeurs 1440/390/320 px et captures desktop/mobile inspectées. Cette prévisualisation ne constitue pas une preuve PostgreSQL.

`npm run test:asset-price-chart` utilise une instance dédiée et API/PostgreSQL réels : actif sans détention, huit observations synthétiques, quatre points EUR retenus, prix à 18 décimales, borne à la microseconde avant/après la fin, exclusion USD/autre actif de même symbole/FX, changement de devise, périodes vide/invalide, sources inchangées, douze scans axe/responsive et absence d’erreur JavaScript. Succès CI requis avant fusion. Aucune exécution SQL locale revendiquée.

## Matrice du détail d’actif

| Critère P3.5 | Implémentation et preuve |
| --- | --- |
| Dernier prix, devise, date et source, même sans détention | Catalogue et historique des cours ; rapports P3-5-asset-catalogue et P3-5-quote-history |
| Variations de marché distinctes des résultats personnels | Comparaisons Go exactes jour/semaine/mois/année ; rapport P3-5-catalogue-changes |
| Quantité, coût/PRU, valeur, résultats réalisés/latents | Positions par compte et consolidation ; fractions exactes accessibles ; rapports P3-4-account-holdings et P3-5-asset-catalogue |
| Historique source et corrections auditées | AssetOperations ; rapport P3-5-asset-operations |
| Graphique historique, absence de données et précision | Présent lot, tests purs et E2E réel requis |
| Isolation, erreurs, responsive et accessibilité automatisée | Parcours réels des lots précédents et présent lot, scans ouverts/repliés |

Cette matrice qualifie le détail des données actuellement enregistrées. Les sources automatiques/licences Q-06, l’ETF exact, les calendriers de marché, les ratios de rendement global, le lecteur d’écran humain et les gates MVP restent dans leurs lots respectifs. P3.5 reste à qualifier tant que le nouveau parcours réel n’est pas vert. Retour arrière : retirer le composant, helper et commande de test ensemble ; données sources inchangées.
