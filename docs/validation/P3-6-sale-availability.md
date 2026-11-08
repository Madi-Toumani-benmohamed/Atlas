# P3.6 — Quantité datée et vente exacte

8 novembre 2026. F-008/F-010/F-013, US-003, NFR-01/08/09 ; phase 3 et recette P5.9.

## Comportement

Pour une nouvelle vente, « Vérifier la quantité à cette date » lit la synthèse privée existante à la date saisie. Compte et actif sont sélectionnés par leurs identifiants, pas par leur symbole. La quantité provient du rejeu serveur, après les événements déjà enregistrés à cet instant. Le cours ou la valorisation peuvent être manquants sans empêcher la lecture d’une quantité connue.

Une quantité arrondie porte `≈` et sa fraction exacte reste consultable. « Utiliser la quantité exacte » remplit uniquement le champ quantité après action explicite, sans soumettre le formulaire. Exemple : achat par total 1 au prix 3 → quantité `1/3`, copiée telle quelle pour une liquidation totale sans reliquat dû à l’affichage huit décimales.

Changer de compte, d’actif ou de date retire la lecture précédente. Une réponse tardive d’un ancien périmètre est ignorée, y compris si une nouvelle lecture a déjà abouti. Modifier prix/quantité/frais ne prétend pas modifier les titres détenus. Échec de lecture : erreur explicite, brouillon conservé ; aucune quantité zéro de remplacement. Aucun compte dans la synthèse et aucune position à cette date sont distingués.

La lecture ne réserve aucun titre et ne valide pas la cohérence future du journal. Une vente antidatée ou concurrente peut encore être refusée à la confirmation. Le serveur garde ses contrôles de disponibilité, droits, dates, chronologie et idempotence. Le composant est limité aux nouvelles ventes, car une correction doit traiter son original dans le rejeu définitif ; aucune disponibilité excluant silencieusement l’original n’est inventée.

GET `/api/v1/summary?at=…` existant ; aucun endpoint, calcul financier client, migration ou fournisseur ajouté. Aucune écriture lors de la lecture ou de la copie. Retour arrière : retirer le composant de Finance ; journal inchangé.

## Vérifications

Local : lint, TypeScript/Vite, tests npm et diff réussis. Navigateur à API simulée : quantité `1/3`, marque d’approximation, fraction accessible et copie explicite ; six analyses axe et absence de débordement à 1440/390/320 px, sombre/clair ; capture mobile inspectée.

`npm run test:sale-availability` dans Quality utilise API/PostgreSQL réels : dépôt 10, achat au total 1 à 3 ; avant l’achat, aucune position ; après, `1/3`. Date future refusée avec champ conservé. Lecture/copie n’ajoutent aucun événement. Une réponse retardée de l’ancien actif et une erreur 503 sont des fixtures explicites de lecture seule ; elles vérifient absence de données d’un ancien périmètre, maintien du brouillon et reprise. Vente finale exacte → cash 10 et quantité zéro, trois événements au total. Six scans axe/responsive. Parcours réel requis avant fusion ; aucun succès SQL local revendiqué.
