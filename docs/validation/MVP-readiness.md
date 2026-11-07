# État de recette MVP — 7 novembre 2026

Cette matrice prépare P5.9 ; elle ne déclare ni la recette globale ni une publication MVP. Les preuves historiques restent datées dans les rapports [C-03–C-09](C-03-C-09.md), [rapprochement](P4-5-reconciliation.md) et [observabilité](P5-5-observability.md). « Vérifié en laboratoire » ne signifie pas vérifié chez l’exploitant.

| PRD §12 | État et preuves / réserves |
| --- | --- |
| 1 — Connexion et isolation | Vérifié en laboratoire : tests SQL et parcours HTTPS à deux utilisateurs ; rapport C-03–C-09. |
| 2 — Portefeuilles, comptes, consolidation | Vérifié en laboratoire : transfert entre comptes et instrument consolidé sans doublon. |
| 3 — Achats, ventes, frais, dates, devises | Vérifié en laboratoire : moteur exact, validation API/UI et vente excessive refusée. |
| 4 — Flux et staking | Vérifié selon la politique approuvée ; ouvertures explicites, pas de découvert/short, swaps non pris en charge. |
| 5 — PRU, quantités, P&L | Scénarios T-01–T-12 couverts par suites métier/SQL ; historique incomplet signalé, performance globale masquée. |
| 6 — Valeur et affichages desktop/mobile | Parcours financiers et consolidation vérifiés à 1440/390/320 px ; ne vaut pas revue produit exhaustive de tous les classements. |
| 7 — Cours et taux datés | Partiel : observations manuelles et FX BCE, états manquants/anciens. Aucun flux automatique actions/ETF/crypto validé ; Q-05/Q-06 ouverts. |
| 8 — CSV | Aperçu, rejets, doublons et atomicité vérifiés ; variantes courtiers limitées à des fixtures synthétiques, exports réels à qualifier. |
| 9 — Corrections | Vérifié : audit conservé, rejeu et recalcul, rollback des corrections incohérentes. |
| 10 — Export | JSON privé et audit vérifiés ; [contrat de lecture externe](../formats/atlas-portfolio-v1.md) documenté. [Lecture externe indépendante vérifiée](P5-1-export-reader.md) sur exports réels de recette ; pas de restauration globale par JSON annoncée. |
| 11 — Sauvegarde/restauration cible | Non acquis : exercice chiffré et base distincte vérifiés en [CI Linux](P5-operations-hardening.md) ; serveur cible, copie hors machine et planification opérateur non validés. |
| 12 — Qualité et sécurité | Suites locales et CI des lots applicatifs consignées. Dernière CI du lot exploitation : [42385363672](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42385363672), sept jobs réussis ; réserves d’audit détaillées dans les rapports. |
| 13 — Design, clavier, mobile | Audits axe, focus, thèmes et parcours responsive effectués ; recette lecteur d’écran et revue humaine exhaustive encore ouvertes. |
| 14 — Coûts et connexions réelles | Pas d’offre payante indispensable dans l’implémentation ; seul connecteur marché actif : FX BCE. [Licences runtime et notices embarquées vérifiées](../licenses/README.md) ; couverture/droits de futurs flux à instruire avant ajout. |
| 15 — Limites et décisions | Guides et rapports publics disponibles ; [couverture marché](../decisions/market-coverage.md), décisions et réserves conservées. |

Les lots P5.3/P5.4/P5.9/P5.10 restent ouverts dans la roadmap. Les guides ne remplacent pas une installation, une restauration, un audit, un choix de licence ou un tag de version. Aucun service ni timer activé sur un serveur cible par ce lot.
