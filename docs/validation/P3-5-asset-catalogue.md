# P3.5 — Cours et positions depuis le catalogue

8 novembre 2026. F-006/F-010/F-013/F-015/F-019/F-021, US-005, NFR-07/08/09 ; phase 3 et états de qualité P3.8.

## Comportement

L’onglet Actifs donne accès aux observations de cours du propriétaire, même sans position dans l’actif. Chaque fiche présente le dernier cours enregistré, sa devise originale, sa source/date et l’historique existant, cinq observations puis davantage sur demande. Sélection par identifiant exact ; même symbole sur un autre instrument et observations FX exclus. L’ordre serveur date/création/id est conservé, sans tri temporel JavaScript ou conversion des montants. Cours d’une date antérieure signalé lorsqu’une date de synthèse est disponible, sans supposer une fermeture de marché ou une fraîcheur temps réel.

Les positions du catalogue conservent les valeurs serveur par compte : quantité, valeur EUR, coût restant, PRU économique et résultats latent/réalisé. L’ancien affichage omettait le signe d’approximation : `1/3` paraissait être exactement `0,33333333`. Il porte désormais `≈` et un détail accessible au clavier/toucher expose les valeurs exactes, sans recalcul client. État sans position explicite, sans détention fabriquée.

Une lecture privée `/prices` est partagée par toutes les fiches pendant la visite de l’onglet, indépendamment de la synthèse. Chargement, échec et rechargement sont distingués d’un historique réellement vide. Une panne de lecture des observations n’efface pas les positions disponibles ni la saisie en cours ; aucun prix zéro de substitution. Une réponse tardive après changement d’onglet n’est pas appliquée. Le bouton recharge les observations privées, pas un fournisseur externe.

Aucune API, dépendance, migration, conversion, méthode de performance ou source de marché ajoutée. Les catégories d’actifs de test restent synthétiques et ne constituent pas une sélection de l’ETF pilote S&P 500. Les variations pour des actifs sans position et le détail complet P3.5 ne sont pas déclarés terminés.

Retour arrière : rétablir le rendu de positions précédent et retirer la lecture/catalogue ; aucune donnée à convertir. Les panneaux ont des cibles de 44 px et un espacement, y compris repliés.

## Vérifications

Local : lint, TypeScript/Vite, tests npm et diff réussis. Prévisualisation à API simulée : fraction exacte, cours des actifs détenus/non détenus, douze analyses axe (ouvert/replié, 1440/390/320 px, sombre/clair), absence de débordement et capture mobile inspectée.

`npm run test:asset-catalogue` dans Quality utilise API/PostgreSQL réels : achat au total donnant `1/3`, approximation marquée et fraction consultable ; sept cours d’un actif, même symbole d’un autre instrument exclu, taux FX exclu ; actif non détenu coté en USD avec 18 décimales, actif sans cours, ordre/historique progressif et dates antérieures. Douze scans axe et cibles tactiles contrôlés.

Une réponse 503 est explicitement simulée uniquement pour la lecture des observations : positions et métadonnées restent sur l’API réelle. Le test vérifie message d’erreur, absence de faux cours vide, brouillon conservé et reprise. Il ne prétend pas provoquer une panne PostgreSQL. Parcours réel requis avant fusion ; aucun succès SQL local revendiqué.
