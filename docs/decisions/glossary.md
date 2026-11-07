# Langage métier du périmètre actuel

P0.2, PRD §7 et [contrat financier approuvé](financial-policy.md). Ce glossaire décrit les règles déjà définies ; il n’ajoute ni méthode fiscale, ni nouveau modèle de rendement, ni statut d’ADR.

| Terme | Sens dans Atlas |
| --- | --- |
| Portefeuille logique | Regroupement privé de comptes appartenant au même utilisateur ; ne représente pas lui-même un solde supplémentaire |
| Compte | Support de détention avec type et devise propres ; rattachement au portefeuille et propriété contrôlés côté serveur |
| Actif / instrument | Identité par namespace/place et référence, distincte du symbole ; actions/ETF, crypto/stablecoins ; l’ISIN vérifié syntaxiquement ne certifie pas l’existence du titre |
| Opération | Événement financier enregistré avec date, compte, montants/quantités/frais et provenance ; source du rejeu, pas ordre de trading |
| Transaction SQL | Unité atomique de persistance ; un autre sens que l’opération financière métier |
| Mouvement de trésorerie | Effet d’un événement sur le cash d’un compte ; un dépôt suivi d’un achat ne représente qu’un apport externe |
| Flux externe | Entrée/sortie du patrimoine suivi ; distingué du déplacement interne entre comptes possédés et des revenus |
| Transfert interne | Déplacement explicite de cash ou titres entre comptes possédés ; pas de nouvel apport global, hors effets de frais/FX enregistrés |
| Position | Quantité et coût restant dérivés des opérations actives à une date, par compte et actif ; consolidation d’un instrument possible entre comptes |
| Ouverture | Solde/position de départ explicitement déclaré ; aucune entrée de cash inventée ; historique partiel et coût inconnu signalés |
| PRU / CMP économique | Coût d’acquisition moyen restant, frais inclus selon le contrat ; modèle économique, pas règle fiscale universelle |
| Réalisé / latent | Résultat de cessions déjà enregistrées / écart de valeur des détentions restantes ; un cours absent ne devient pas zéro |
| Observation de prix | Valeur datée, dans une devise, avec source ; elle valorise une position mais ne crée pas sa quantité |
| Taux de change / FX | Conversion datée entre unités monétaires ; taux historique réellement appliqué distinct d’un taux de référence BCE |
| Date de référence / réception | Date à laquelle se rapporte un taux BCE / instant de son observation dans Atlas ; elles ne sont pas interchangeables |
| Snapshot / état à date | Vue cohérente lue ou calculée à un instant ; jamais autorité indépendante du journal et pas promesse d’une table persistée de snapshots |
| Correction / audit | Original conservé, version active remplacée ou annulée logiquement, lien et motif ; rejeu avant validation de l’écriture |
| Idempotence | Même intention avec même clé et payload ne crée pas deux événements ; la duplication volontaire prépare une nouvelle saisie et exige confirmation |
| Lot d’import | Aperçu et événements normalisés privés, puis confirmation atomique ; erreurs et doublons visibles ; CSV brut non reconstitué par l’export |
| Rapprochement | Comparaison en lecture seule d’un relevé de soldes/quantités avec le journal ; aucun ajustement silencieux |

Les définitions ne changent pas le périmètre des calculs : la performance d’un sous-ensemble de comptes ou d’un portefeuille isolé exige des règles de flux adaptées avant une nouvelle vue dédiée. Un ratio arbitraire résultat/apports n’est pas un rendement universel. Voir les [contrats implémentés](C-03-C-09.md) et les [sources de marché](market-coverage.md).
