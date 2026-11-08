# P3.5 — Historique source des opérations d’un actif

8 novembre 2026. F-010/F-011/F-013, US-005/US-007 ; phase 3, présentation de l’audit déjà existant.

Dans « Mes actifs », le détail permet de consulter les opérations associées à l’identifiant exact de l’actif. Les comptes propriétaires restent distingués. Chaque écriture présente sa date économique, son compte/devise, son statut actif ou remplacé/annulé, les quantités/prix/montants/frais/coûts effectivement saisis et les éventuels motif de correction et note. Une correction ne remplace pas visuellement son original : les deux restent consultables avec leur statut.

L’ordre est celui de l’enregistrement renvoyé par l’API, inversé pour présenter le plus récent en premier. Il ne prétend pas être un tri par date économique : une correction antidatée nouvellement enregistrée reste en tête. Cinq écritures sont montrées initialement, puis cinq de plus sur demande. Les événements sans cet actif, notamment dépôts de cash, sont exclus.

Le composant filtre les opérations privées déjà chargées par Finance. Aucune nouvelle requête, écriture, migration ou règle de coût/flux. Les champs sources ne sont pas recalculés : un achat saisi au total affiche ce total et son prix, sans inventer une quantité source absente du journal. Aucune somme de performance tirée des écritures remplacées. Notes/motifs sont rendus comme texte React, sans insertion HTML.

Cette tranche complète les [observations de cours](P3-5-quote-history.md) et les métriques de positions, sans déclarer toutes les vues d’évolution du PRD terminées. Retour arrière : retirer le composant et son inclusion dans Finance, sans changement des données.

## Vérification

Local : lint, build TypeScript/Vite et tests npm réussis. Prévisualisation avec API simulée, statut d’audit, affichage progressif et six analyses axe à 1440/390/320 px dans les deux thèmes ; aucun débordement et capture mobile inspectée.

`npm run test:asset-operations`, dans le job E2E Quality, crée uniquement des données synthétiques par API/PostgreSQL réels : huit écritures de l’actif dans deux comptes, achat par total corrigé avec motif et original conservé, autre actif et cash exclus. Vérifie cinq puis huit écritures, dernier enregistrement en tête malgré sa date antidatée, original inactif montant 10, remplacement actif montant 8, sept écritures actives, six scans axe et responsive. L’authentification de fixture respecte Retry-After ; aucune écriture financière n’est réessayée automatiquement. Parcours réel requis avant fusion, sans revendication de succès SQL local.

Validation hébergée : [Quality 42467636383](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42467636383), commit `d46fb2ad`, sept jobs réussis, marqueur du parcours réel et ses six scans axe confirmé. PR #14 fusionnée.
