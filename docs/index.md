# Documentation Atlas Portfolio

Atlas est en développement. Une CI réussie prouve les contrôles du commit concerné ; elle ne déclare pas une version stable, une cotation temps réel ou une installation validée sur chaque machine.

| Je veux… | Guide |
| --- | --- |
| Installer une instance privée ou un laboratoire | [Installation et configuration](operations/installation.md) |
| Créer mon premier portefeuille et saisir mes données | [Premiers pas](usage/first-steps.md) |
| Mettre à jour une instance et préparer un retour arrière | [Mise à jour et récupération](operations/upgrades.md) |
| Sauvegarder, vérifier ou restaurer une base distincte | [Sauvegardes chiffrées](operations/backup-restore.md), [preuves P5.3](validation/P5-3-backup-checks.md) |
| Reproduire une recette Compose et restauration isolées | [Recette automatisée](operations/instance-verification.md) |
| Comprendre une indisponibilité DB/BCE | [Observabilité](operations/observability.md) |
| Importer des opérations | [Atlas CSV v1](formats/atlas-csv-v1.md), [Coinbase/Trade Republic](formats/broker-csv.md) |
| Comparer les soldes d’un relevé sans corriger le journal | [Atlas soldes v1](formats/atlas-balances-v1.md) |
| Contribuer au code ou à la documentation | [Contribution](../CONTRIBUTING.md) |
| Signaler un problème de sécurité | [Politique de signalement](../SECURITY.md), [revue P5.4](validation/P5-4-security.md) |
| Lire un export hors Atlas | [Lecteur hors ligne](usage/read-export.md), [JSON Atlas Portfolio v1](formats/atlas-portfolio-v1.md) |
| Consulter les licences et leurs notices | [Apache 2.0](../LICENSE), [dépendances et données](licenses/README.md) |

## État et limites

Le catalogue privé, le journal exact, les corrections, les imports nommés, l’export, le rapprochement, les sauvegardes/restaurations et les diagnostics sont implémentés. Les contrats détaillés sont dans [C-03–C-09](decisions/C-03-C-09.md), [P4.5](validation/P4-5-reconciliation.md) et [P5.5](validation/P5-5-observability.md).

Les cours d’actions/ETF/crypto sont saisis manuellement. Seuls les taux de référence BCE sont récupérés automatiquement à la demande ; ils ne sont pas des taux d’exécution. La [couverture et les droits des données](decisions/market-coverage.md) sont distincts de la licence du code.

Les imports natifs de courtiers ont un périmètre limité : une variante non documentée, des retenues fiscales, conversions ou transferts ambigus peuvent bloquer un lot. Un relevé de rapprochement n’est pas un fichier d’opérations. Aucun import JSON de restauration applicative, récupération de compte, cache financier hors ligne, trading, conseil fiscal ou module Research n’est annoncé.

Les [preuves de validation](validation/C-03-C-09.md) et la [roadmap](../ROADMAP.md) distinguent recette locale, CI hébergée et environnement cible. Les mesures de charge, la recette lecteur d’écran, le matériel ARM64 physique et l’installation/restauration sur la machine cible restent à établir.

[Notes préparatoires de livraison](releases/unreleased.md) — sans tag stable annoncé.

## Recette et langage

[Glossaire métier](decisions/glossary.md), [audit de roadmap P5.9](validation/P5-9-roadmap-audit.md) et [matrice des quinze critères MVP](validation/MVP-readiness.md), [profils de rejeu](validation/P5-9-replay-benchmarks.md), [quantités exactes réutilisables](validation/P5-9-canonical-quantities.md), [historique des cours d’un actif](validation/P3-5-quote-history.md), [récapitulatif d’achat](validation/P3-6-purchase-preview.md), [liquidités et positions par compte](validation/P3-4-account-holdings.md), [opérations d’un actif](validation/P3-5-asset-operations.md), [évolution de valeur par portefeuille](validation/P3-4-portfolio-history.md), [répartition par portefeuille](validation/P3-4-portfolio-allocation.md), [cours et positions du catalogue](validation/P3-5-asset-catalogue.md), [quantité datée avant vente](validation/P3-6-sale-availability.md), [variations sans détention](validation/P3-5-catalogue-changes.md). Les phases futures restent hors du périmètre automatique.

## Navigation technique

[PRD](../PRD.md) → besoins et règles ; [ADR](../ADR.md) → décisions ; [architecture](../ARCHITECTURE.md) → contrats techniques ; [cartographie](../CODEBASE_GRAPH.md) → fichiers réellement implémentés ; [design](../design.md) → système visuel.
