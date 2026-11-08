# P3.4 — Évolution de la valeur par portefeuille

8 novembre 2026. F-005/F-013/F-015/F-019/F-021, US-005, NFR-01/02/08/09 ; phase 3. Aucun nouveau calcul de rendement ni arbitrage des flux.

## Comportement et contrat

Dans Portefeuilles, après sélection d’un portefeuille, « Évolution de la valeur du portefeuille » propose une période explicite. Le graphique et la liste montrent la valeur EUR quotidienne, transferts et apports inclus, jamais un rendement personnel. Aucune période par défaut n’est décidée à la place de Q-08. Les dates saisies sont celles du fuseau du navigateur ; la réponse reste en instants UTC, à pas de 24 heures, pour une plage d’au plus 366 jours selon le contrat existant. Données manquantes, observations antérieures et valeurs exactes sont explicites.

Le contrat existant `GET /api/v1/history?from=…&to=…` accepte désormais le paramètre facultatif `portfolio_id`. Sans ce paramètre, le comportement global reste identique. Avec lui, propriété vérifiée avant lecture ; étranger/inexistant → 404, anonyme → 401. Les réponses restent privées `no-store`. Métadonnées additives : `portfolio_id` (vide pour global) et `metric: valuation`. `items`, `resolution: daily`, `timezone: UTC`, `interpolation: false` restent compatibles.

Le moteur rejoue **tous les comptes du propriétaire**, puis sélectionne la valeur du portefeuille calculée à chaque date. Il ne retire pas les contreparties d’un transfert du jeu d’événements. Exemple : dépôt 100 dans A, puis transfert 40 vers B → séries de valeur A 100→60, B 0→40 ; aucune performance n’est déduite de ces variations. Les valeurs exactes sont issues de `portfolio_values_eur`, sans somme ni calcul monétaire côté client.

Une cotation/FX manquante dans un autre portefeuille ne rend pas la série sélectionnée manquante ; les indicateurs d’observation antérieure sont limités aux positions/cash du portefeuille sélectionné et utilisent la date de référence BCE lorsqu’elle existe. Un portefeuille **propriétaire réellement sans comptes** a une valeur enregistrée zéro ; un total inconnu reste absent. Une ouverture partielle ne crée pas de rendement global fictif.

Changer de portefeuille réinitialise le formulaire et les points. Une réponse tardive du composant démonté ne remplit pas le nouveau périmètre. Nouvelle demande/erreur → anciens points retirés, champs conservés ; session expirée signalée. Liste défilable accessible au clavier. Aucun schéma, fournisseur ou dépendance ajouté. Retour arrière : retirer le composant et le filtre optionnel ensemble ; pas de migration de données.

## Vérifications

Local : tests Go de périmètre/transferts/qualité et scénarios numériques existants sélectionnés réussis ; `go vet ./internal/ledger`, gofmt, lint, TypeScript/Vite et tests npm réussis. Six analyses axe et absence de débordement à 1440/390/320 px sombre/clair dans une prévisualisation à API simulée ; capture mobile inspectée. Ces preuves ne constituent pas une exécution SQL locale.

Tests numériques : A/B après transfert, global inchangé et absent si cotation d’un troisième portefeuille manquante ; portefeuille vide zéro ; qualité prix/FX limitée au périmètre, y compris date de référence BCE.

Test API/PostgreSQL ajouté : portefeuille propriétaire vide et archivé accessible, étranger/inexistant 404, anonyme 401, réponses non cachables et métadonnées contrôlées.

`npm run test:portfolio-history` dans Quality vérifie sur API/PostgreSQL réels : séries A `[100,60,60,60]`, B `[0,40,40,40]`, portefeuille vide `[0,0,0,0]`, portefeuille avec cotation manquante puis connue `[absent,absent,5,5]`, et global `[absent,absent,105,105]`. Vérifie accès croisés, cours ancien exclu du mauvais périmètre, navigation sans ancienne série, erreur de plage avec brouillon conservé et six scans axe/responsive. Parcours réel requis avant fusion.

P3.4 reste ouvert pour les exigences de répartition/présentation encore non qualifiées ; cette série de valeur ne résout pas P2.8, Q-06, Q-08, ni la recette matérielle NFR-12.
