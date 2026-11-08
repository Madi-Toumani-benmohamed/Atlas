# P3.4 — Répartition des valeurs par portefeuille

8 novembre 2026. F-005/F-013/F-016/F-019/F-021, US-005 ; phase 3, information de qualité P3.8. Classification et valorisation existantes conservées, aucun ratio de rendement ajouté.

## Contrat

La synthèse privée ajoute `portfolio_allocations_eur`, indexé par identifiant de portefeuille propriétaire. Chaque entrée contient `total_value_eur` (`null` si une composante est inconnue), `known_value_eur`, `missing_valuation`, `uses_prior_date_observations` et `by_kind_eur`.

Les catégories utilisent les valeurs exactes EUR déjà issues du rejeu : actions, ETF, crypto, stablecoins, épargne et cash. Le cash d’un compte d’épargne reste de l’épargne ; acheter un titre réduit le cash et ajoute sa valeur, sans compter à nouveau son coût. Les positions clôturées ne créent pas de catégorie. Les sommes utilisent les fractions exactes serveur, jamais les montants arrondis d’affichage : deux positions de valeur `1/3` donnent `2/3`, affiché `≈ 0,67`.

Une catégorie contient seulement les composantes valorisables. Si d’autres composantes manquent, le total reste indisponible et le sous-total connu est explicitement partiel. Un sous-total connu zéro n’est pas présenté comme une valorisation totale complète. Aucun pourcentage n’est calculé à partir d’un périmètre incomplet. Les dates antérieures de cours/FX sont signalées pour ce portefeuille seulement.

Le snapshot SQL privé inclut désormais les identifiants des portefeuilles, y compris ceux sans compte. Un portefeuille propriétaire vide a donc un total réel zéro et aucune catégorie, également dans `portfolio_values_eur`. Les portefeuilles étrangers ne sont pas chargés. Aucune migration ou requête d’écriture ; réponses `no-store` existantes conservées.

## Interface et limites

Dans Portefeuilles, « Répartition de ce portefeuille » présente les montants EUR et la date de synthèse, le caractère partiel et les observations antérieures. Le client ne fait aucun calcul financier. Si les métadonnées sont indisponibles, il le dit sans inventer une répartition. État vide distinct de l’état partiel.

Champ JSON additif, sans nouveau fournisseur/dépendance ni modification de l’allocation globale. P3.4 reste ouvert pour sa qualification complète et les métriques agrégées non encore cadrées ; P2.8/Q-06/Q-08 ne sont pas résolus par cette vue. Retour arrière : retirer le champ/composant ensemble ; pas de données à convertir.

## Vérifications

Local : tests Go d’allocation et scénarios financiers sélectionnés, vet, gofmt, lint, TypeScript/Vite, tests npm et liens contrôlés. Navigateur à API simulée : allocation partielle et datée, douze analyses axe (panneaux ouverts et repliés) et absence de débordement à 1440/390/320 px, sombre/clair ; capture mobile inspectée. Aucune exécution SQL locale revendiquée.

Tests purs : cash 79 + actions 24 + épargne créditée 52 = 155 ; cotation inconnue sans suppression des 155 connus ; FX USD et ETF datés complètent le second portefeuille à 13 ; transfert EUR 20 vers USD 40 au taux explicite 2 déplace la répartition sans double compte ; ETF clôturé exclu ; qualité limitée au périmètre ; portefeuille vide zéro ; fractions `1/3 + 1/3` sommées avant arrondi.

SQL/API : allocation du seul propriétaire et cohérence avec les totaux complets/absents. `npm run test:portfolio-allocation` utilise API/PostgreSQL réels : épargne/cash distincts, cotation et FX manquants, sous-total partiel, résolution datée, portefeuille vide zéro sans catégorie, autre utilisateur sans accès aux allocations et douze analyses axe (panneaux ouverts et repliés)/responsive. Ce parcours doit réussir dans Quality avant fusion.

Premier run Quality 42475514348 : six jobs réussis ; le parcours existant a détecté des cibles trop proches lorsque répartition et historique étaient tous deux repliés. Le correctif donne aux deux résumés une cible de 44 px et un espacement de 16 px, sans exclusion axe. Contrôle local des deux états sur trois largeurs/deux thèmes : douze scans sans violation. Nouvelle CI requise avant fusion.

Validation finale : [Quality 42475911261](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42475911261), commit `5c411887`, sept jobs réussis. Marqueur E2E des répartitions, états partiels/vides, isolation et douze scans confirmé. PR #17 fusionnée.
