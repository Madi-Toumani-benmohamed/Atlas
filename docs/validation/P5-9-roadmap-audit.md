# P5.9 — Audit de roadmap et recette restante

7 novembre 2026. Base de revue `main` après la reprise et la sécurité (`777164a`), puis les contrôles de sauvegarde P5.3. Ce lot rapproche les cases historiques des sources et preuves ; il ne déclare ni publication MVP ni approbation d’ADR proposée. Les critères de recette restent ceux du [PRD §12](../../PRD.md) et de la [matrice MVP](MVP-readiness.md).

## Lots rapprochés avec les preuves existantes

| Lots | État constaté et preuves |
| --- | --- |
| P0.2 | Glossaire des termes existants désormais explicite, lié aux contrats approuvés ; aucune politique ajoutée |
| P0.3/P0.4/P0.5/P0.6 | Invariants et décisions Q-02/03/04 explicitement approuvés ; [politique financière](../decisions/financial-policy.md), rejeu/contrôles/arrondis documentés dans C-03–C-09 |
| P0.8/P0.9 | T-01–T-12 et contrats d’erreur/idempotence/précision/permissions/migrations décrits et testés en moteur/SQL ; [contrats](../decisions/C-03-C-09.md) et [rapport](C-03-C-09.md) |
| P0.12 | Dépôt, chaîne Go/frontend, configuration privée et fixtures synthétiques, CI réelle ; sept jobs réexécutés jusqu’à la [revue sécurité](P5-4-security.md) |
| P1.1–P1.9 | Déjà cochés : catalogue, identité, journal, isolation, migrations et écritures atomiques. Les critères de sortie sont couverts par tests à deux utilisateurs, transactions et transferts. Phase 1 DONE |
| P2.1/P2.2 | Positions et CMP recalculés, ventes partielles, corrections antidatées et coût inconnu ; tests numériques moteur/SQL |
| P2.3/P2.4 | Soldes cash/épargne, intérêts effectivement crédités, staking à réception selon contrat. Q-07 sur la présentation détaillée de l’épargne reste ouvert |
| P2.6/P2.7 | FX daté exact, valeurs complètes/partielles, consolidation et absence de double comptage ; T-04/05/10 et consolidation inter-comptes |
| P2.9 | Historique reconstruit depuis événements et observations disponibles à chaque date, points manquants non interpolés ; pas de TWR inventé |
| P3.1/P3.2 | Navigation, thèmes, responsive, premier compte/portefeuille et états vides réels ; E2E et audits axe existants |
| P3.6 | Formulaires et validations des opérations supportées, achat par total et vente excessive refusée ; E2E achat/vente et tests numériques des autres opérations |
| P3.7 | Liste, filtre compte, copie préparée sans persistance et corrections présents dans Finance.tsx ; le nouveau parcours clavier vérifie la duplication explicite et le lot est clôturé |
| P4.2–P4.7 | Aperçu, cohérence, doublons, rapprochement readonly, corrections et rapport vérifiés ; [rapprochement P4.5](P4-5-reconciliation.md) |
| P5.1/P5.2/P5.4–P5.8 | Lots déjà clôturés avec rapports datés ; la disponibilité de ces composants n’est pas une recette globale du produit |

La mise à jour de cases reflète l’état observé ; elle ne change pas le PRD, ne retire pas une exigence P0 et ne fait pas passer les phases 0/2/3/4/5 globalement à DONE.

## Écarts encore ouverts

| Lots / exigences | Écart concret et suite |
| --- | --- |
| P0.1/P0.11 | Le registre garde ADR-0006/0007/0009 en `proposed` alors que des mécanismes correspondants existent et sont décrits dans les contrats. Cet audit ne transforme pas le code en approbation : statuts à réconcilier explicitement ; stack/auth ADR-0004/0005/0008 acceptés conservés |
| P0.7/P2.5/F-018 | Aucun flux automatique actions/ETF/crypto validé ; seuls manuel et FX BCE actifs. Q-05 actifs/places et Q-06 couverture/licence restent bloquants |
| P0.10 | Parcours implémentés et inspectés historiquement ; les arbitrages UX encore ouverts ne sont pas déclarés résolus par l’existence du code |
| P2.8 | Résultats en montant et variations de cours disponibles ; ratio personnel universel ou rendement temporel non inventé. Mesures/présentation restantes à cadrer selon leur sens financier |
| P2.10/P3.8 | États absent/ancien/partiel et panne BCE éprouvés ; calendrier de marché et cours différés non revendiqués pour des fournisseurs d’actifs non connectés |
| P3.3 | Dashboard et dix instruments consolidés présents ; période par défaut Q-08 et recette produit exhaustive encore ouvertes |
| P3.4/P3.5/US-005 | Valeurs de comptes/portefeuilles et métriques de positions présentes ; vues dédiées d’évolution/répartition par portefeuille et historique d’actif à qualifier. Ne pas ajouter un filtre financier qui change silencieusement les flux externes |
| P3.9/NFR-09 | Parcours E2E, focus, axe et captures historiques existants ; nouveau parcours clavier vérifié sur API/PostgreSQL réels ; recette avec lecteur d’écran humain toujours ouverte |
| P4.1 | Variantes CSV nommées et fixtures synthétiques ; qualification d’exports réels autorisés encore absente |
| P4.8 | PDF P1, hors obligation MVP ; aucun prototype ajouté par simple passage dans la roadmap |
| P5.3/PRD §12.11 | Archive et restauration CI éprouvées ; machine cible et timer quotidien/copie hors machine non validés. Responsable produit : déploiement Linux x86 à préparer plus tard, mot de passe actuel, SSO futur |
| P5.9/NFR-12 | Matrice des 15 critères partielle, pas de charge sur matériel de référence ; aucun budget de latence ou SLO inventé |
| P5.10 | Aucun tag stable ; gates MVP non levés. Les notes de livraison peuvent être préparées, la publication reste conditionnée à la recette |
| Q-07/Q-08/Q-09 | Affichage épargne, période par défaut et niveau de consultation hors ligne gardent leurs arbitrages ; pas de cache financier offline privé ajouté |

## Nouveau contrôle de recette

`npm run test:keyboard` crée exclusivement des comptes/données synthétiques dans une instance dédiée et pilote inscription, premier portefeuille/compte et opérations par Tab/Entrée, sans clic ni focus forcé dans le test. La copie d’une opération ne doit rien écrire avant confirmation ; un retrait excessif doit préserver le brouillon, puis pouvoir être réparé. Noms longs, trois largeurs, deux thèmes et préférence de mouvement réduit sont contrôlés, avec six analyses axe. Il ne simule pas un lecteur d’écran.

Le lint passe localement. Le parcours réel réussit dans [Quality 42392202583](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42392202583), commit `e9b45d5a`, avec sept jobs réussis. Le marqueur de log confirme les six analyses axe, la saisie sans souris, la copie sans écriture avant confirmation, le retrait refusé avec brouillon conservé puis sa réparation. Le laboratoire local ne lance pas de nouveau conteneur sur son disque limité. P3.7 clôturé ; la recette humaine avec lecteur d’écran reste ouverte.
