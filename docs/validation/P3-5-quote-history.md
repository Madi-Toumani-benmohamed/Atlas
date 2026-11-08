# P3.5 — Observations de cours par actif

7 novembre 2026. F-013/F-014/F-015, US-005, NFR-08/09 ; tranche du détail d’actif en phase 3.

## Comportement

Dans « Mes actifs », un panneau dépliable présente les observations enregistrées pour l’actif détenu, cinq par cinq. Chaque ligne conserve la valeur exacte reçue, la devise, la date ISO avec fuseau et la source. Aucun calcul financier côté client : ni conversion, ni arrondi, ni interpolation, ni assimilation de ce cours au rendement personnel.

Le filtre utilise l’identifiant de l’actif, jamais son symbole. Les taux de change sans actif et les observations d’un autre actif sont exclus. L’API privée existante reste la seule source ; elle ordonne par date d’observation, date de création et identifiant. Le client inverse une copie de cet ordre pour afficher le plus récent en premier, sans nouveau tri ou écrasement des observations de même date.

Aucun changement de schéma, d’API, de fournisseur ou de politique financière. État vide explicite, détails natifs au clavier, valeurs et noms longs repliables sur mobile. Le bouton affiche davantage d’éléments déjà chargés ; il ne prétend pas paginer les requêtes de l’API. L’historique non détenu et une courbe propre à l’actif ne sont pas livrés par cette tranche. P3.5 et US-005 ne sont donc pas déclarés intégralement terminés.

## Vérification

Local : `npm run lint`, `npm run build` (TypeScript et Vite), `npm test` réussis.

`npm run test:quote-history`, ajouté au job E2E de Quality, utilise des utilisateurs et observations synthétiques persistés par l’API réelle dans PostgreSQL :

- sept cours insérés dans un ordre différent des dates, affichage des cinq derniers puis des sept ;
- valeurs décimales conservées intégralement et devise USD préservée ;
- exclusion d’une observation d’un autre actif et d’un taux FX ;
- position sans cours et absence explicite d’historique ;
- noms de source longs, absence de débordement, six analyses axe (1440/390/320 px, sombre/clair) et absence d’erreur JavaScript.

Ce parcours réel n’est pas revendiqué comme exécuté localement. Les sept jobs [Quality 42397153107](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42397153107) ont réussi sur `b234f5db`, dont le marqueur du parcours réel et ses six scans axe. PR #11 fusionnée ; CI de main 42397379794 réussie également. Les contrôles automatiques ne remplacent pas la recette humaine avec lecteur d’écran. Le fournisseur d’actifs automatique et l’ETF S&P 500 exact restent à qualifier séparément.
