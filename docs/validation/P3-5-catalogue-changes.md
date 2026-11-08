# P3.5 — Variations de cours sans détention

8 novembre 2026. F-006/F-014/F-015/F-019/F-021, US-005, NFR-01/02/07/08/09 ; phases 2–3. Réutilisation de la règle de marché existante, sans nouvelle méthode de performance.

## Contrat et calcul

GET privé `/api/v1/prices` conserve `items` et ajoute `as_of` (UTC) et `asset_market_changes_percent`, indexé par identifiant d’actif ayant des observations. Les observations FX sans actif sont exclues. Aucun cours ni identifiant d’un autre propriétaire. Les actifs sans observation n’ont pas d’entrée ; aucune variation zéro ne leur est fabriquée.

Les pourcentages sont issus des fractions exactes Go : `(cours / cours antérieur − 1) × 100`. Jour/semaine sont des comparaisons calendaires UTC ; mois/année utilisent le même jour avec bornage à la fin du mois (par exemple 31 mars → 29 février en 2024). Les observations sélectionnées restent à leur instant de coupure. Un dernier cours du jour courant et une observation dans la même devise à la date comparée, sans dépasser son instant de coupure, sont requis. Sinon, `null`. Aucune conversion FX, interpolation, fermeture de marché supposée ou assimilation au rendement personnel.

Le helper partagé remplace le calcul auparavant inclus dans les positions, à règles inchangées pour les données valides. Le catalogue n’exige donc aucune détention ni aucun compte. Prix positifs requis ; une valeur invalide ne produit pas de division par zéro. L’arrondi de pourcentage à deux décimales reste séparé de la fraction exacte (`100/3` → `≈ 33,33 %`). Un mouvement réel nul reste `0`, distinct de `null`.

La projection de la réponse groupe les observations par actif pour éviter de parcourir les autres instruments à chaque période ; aucune nouvelle requête au fournisseur ou dépendance. Lecture non cachable, un seul jeu d’observations privé et un instant de calcul commun à la réponse. Aucun nouvel endpoint ni migration.

## Interface

Dans Actifs, le panneau des cours affiche les quatre variations, leur instant de calcul, les indisponibilités et le détail accessible des valeurs exactes arrondies. La devise reste celle du cours source. Les positions ont leur propre date de synthèse. Une réponse d’API plus ancienne sans ces métadonnées n’entraîne pas de calcul client ni de faux pourcentage.

Les cours automatiques/licences Q-06 et l’ETF S&P 500 exact restent non résolus. Ce lot utilise uniquement les observations manuelles du propriétaire ; aucune sélection de fournisseur ou publication MVP. P3.5 garde sa recette complète et son graphique historique dédié à qualifier. Retour arrière : retirer les métadonnées et leur présentation ensemble, sans conversion de données.

## Vérifications

Local : tests Go de variations et scénarios financiers/valorisations/périmètres sélectionnés, vet, gofmt, lint, TypeScript/Vite, tests npm et diff réussis. Prévisualisation à API simulée : actif sans position, fraction de pourcentage et douze scans axe ouverts/repliés (1440/390/320 px, sombre/clair), sans débordement ; capture mobile inspectée.

Tests numériques : `110/100−1` → 10 %, semaine 25 %, mois 100 %, année 150 % ; `4/3−1` → `100/3 %` exact ; `3/4−1` → −25 % ; cours inchangé → zéro connu ; devise différente, date absente, cours ancien ou aucune observation → indisponible ; FX/identités exclus. Fin de mois bissextile et défense contre un dénominateur zéro couverts.

SQL/API : nouvelles métadonnées non cachables, instant UTC et absence d’actif étranger/FX. `npm run test:catalogue-changes` utilise API/PostgreSQL réels, aucune position : observations synthétiques alignées sur la date serveur, quatre périodes, fraction exacte et arrondie, devise incompatible, cours ancien, vrai zéro, même symbole sans mélange, autre utilisateur et douze scans axe/responsive. Parcours réel requis avant fusion ; aucun succès SQL local revendiqué.

Preuve CI : [PR20, run 42479671449](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42479671449), sept jobs réussis ; fusion main `05ae956c5eab7d9d2e13dd0bf97323fd92c6e14a`, [run main 42480383165](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42480383165) réussi.
