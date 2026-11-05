# Atlas — Architecture Decision Records (ADR)

> **Produit :** Atlas Portfolio  
> **Version :** 0.2 — 2026-11-05  
> **Statut :** Registre initial enrichi ; propositions techniques non approuvées  
> **Références :** `PRD.md` v0.2, `ROADMAP.md` v0.1, `AGENTS.md`, `design.md`, `ARCHITECTURE.md`

## 1. Objet et autorité

Un ADR documente **pourquoi** une décision structurante est prise, ses alternatives, ses conséquences et sa validation. `PRD.md` fait autorité sur le périmètre métier ; `design.md` sur le visuel ; `ARCHITECTURE.md` expose la solution cible et **ne transforme pas une proposition en décision acceptée** ; `ROADMAP.md` ordonne la livraison.

**Statuts :** `proposed` (non autorisé à implémenter comme choix structurant), `accepted` (explicitement validé), `rejected`, `deprecated`, `superseded` (avec référence au remplaçant).

**Règle Codex :** ne jamais passer `proposed` à `accepted` sans approbation du responsable produit. Ne pas inventer de règles comptables lorsque le PRD signale un arbitrage. Toute modification structurante nécessite un nouvel ADR ; les précédents restent consultables.

Les orientations expressément choisies par le responsable produit dans le cadrage sont identifiées comme `accepted` ci-dessous. Les technologies citées comme recommandations restent `proposed`.

## 2. Registre

| ID | Décision | Statut | Effet | Référence |
| --- | --- | --- | --- | --- |
| ADR-0001 | Produit auto-hébergeable, gratuit, Docker Compose Linux | `accepted` | MVP | PRD §2, F-022 |
| ADR-0002 | Opérations comme source de vérité des positions | `accepted` | MVP | PRD §7, F-008/F-013 |
| ADR-0003 | Isolation multi-utilisateur et moindre privilège | `accepted` | MVP | PRD F-001/F-002, US-009 |
| ADR-0004 | Monolithe modulaire plutôt que microservices | `proposed` | Stack | Phase 0 |
| ADR-0005 | React/TypeScript, Go, PostgreSQL | `proposed` | Stack | Phase 0 |
| ADR-0006 | Journal de mouvements, nombres décimaux exacts, calculs déterministes | `proposed` | Modèle technique | PRD §7, NFR-01/02 |
| ADR-0007 | Adaptateurs de marché interchangeables et cache traçable | `proposed` | Intégration | PRD F-018/F-019, Q-05/Q-06 |
| ADR-0008 | Authentification locale sécurisée et séparation admin/finance | `proposed` | Sécurité | PRD §9 |
| ADR-0009 | Import en deux temps, rapprochement et idempotence | `proposed` | Imports | PRD F-011/F-012 |

## 3. Fiches synthétiques des décisions

### ADR-0001 — Déploiement autonome sans abonnement

- **Statut :** `accepted` ; **date :** 2026-11-05.
- **Contexte :** plusieurs utilisateurs peuvent employer Atlas ; le produit est destiné à un mini-PC Linux conteneurisé et doit être publiquement réutilisable.
- **Décision :** proposer un déploiement Docker Compose Linux et ne rendre aucune fonction P0 dépendante d'un abonnement, d'un service payant ou d'un essai temporaire. Le code est destiné à une diffusion open source ; respecter la licence effective du dépôt.
- **Alternatives :** SaaS obligatoire, service managé payant ou déploiement cloud exclusif — écartés.
- **Conséquences :** documentation d'installation, volumes persistants, procédures de mise à jour et restauration, validation des licences des données de marché. Le coût du matériel, du réseau et de l'électricité n'entre pas dans l'objectif de 0 € de service.
- **Vérification :** installation vierge reproductible sans renseignement de carte bancaire ; fonctions P0 utilisables avec les fournisseurs gratuits approuvés.

### ADR-0002 — Historique des opérations comme source de vérité

- **Statut :** `accepted` ; **date :** 2026-11-05.
- **Contexte :** le suivi des positions ne doit pas reposer sur des quantités saisies indépendamment de l'historique.
- **Décision :** achats, ventes, mouvements de cash, transferts et revenus sont enregistrés sous forme d'opérations persistantes ; positions et valorisations sont dérivées. Les caches et snapshots ne font pas autorité.
- **Alternatives :** positions saisies directement, snapshots comme vérité — écartés.
- **Conséquences :** une opération antidatée déclenche la reconstruction des états affectés ; corrections traçables ; besoin de résoudre Q-02 (historique partiel et soldes d'ouverture) avant l'implémentation des règles concernées.
- **Vérification :** recalcul reproductible à partir d'un même jeu d'opérations, sans dérive après correction ou transfert.

### ADR-0003 — Comptes utilisateurs privés

- **Statut :** `accepted` ; **date :** 2026-11-05.
- **Contexte :** Atlas vise plusieurs utilisateurs sur une même instance avec des données financières confidentielles.
- **Décision :** authentification individuelle, contrôle d'accès côté serveur sur chaque ressource privée, et absence de droit implicite d'un administrateur technique sur les données financières d'autrui.
- **Alternatives :** instance mono-utilisateur sans séparation ; accès admin financier universel — écartés.
- **Conséquences :** tests d'accès croisé, audit des opérations administratives, exports et fichiers d'import soumis aux mêmes droits.
- **Vérification :** requêtes cross-user rejetées pour tous les endpoints et documents.

### ADR-0004 — Monolithe modulaire

- **Statut :** `proposed`.
- **Contexte :** MVP en auto-hébergement, ressources limitées, faible intérêt à gérer plusieurs services métiers.
- **Proposition :** backend unique séparé par domaines (`identity`, `portfolio`, `ledger`, `valuation`, `marketdata`, `imports`), avec interfaces explicites entre composants.
- **Alternatives :** microservices (complexité de déploiement/observabilité), monolithe sans frontières (risque de couplage).
- **Conséquences :** déploiement simple, séparation métier/infrastructure, extraction ultérieure possible mais non préparée artificiellement.
- **Validation requise :** accord sur le style architectural et ses frontières avant scaffolding backend.

### ADR-0005 — Stack applicative

- **Statut :** `proposed`.
- **Proposition :** React + TypeScript + Vite pour le web/PWA ; Go pour API et moteur métier ; PostgreSQL pour la persistance ; tests Go, TypeScript et E2E adaptés aux outils finalement retenus.
- **Alternatives :** backend TypeScript full-stack, autres bases relationnelles ; comparer simplicité opérationnelle et bibliothèque décimale disponible.
- **Conséquences :** séparation front/back ; pipeline de builds et tests ; disponibilité ARM64 à vérifier.
- **Validation requise :** confirmer explicitement la stack et les versions lors de la phase 0. Aucune commande de scaffolding ne doit présumer l'approbation de cet ADR.

### ADR-0006 — Mouvements et précision financière

- **Statut :** `proposed`.
- **Proposition :** modéliser les événements en `transactions` et mouvements associés ; conserver unité, devise, frais, horodatage et origine ; utiliser des décimaux exacts pour les quantités et montants. Interdire les flottants binaires pour les règles monétaires.
- **Alternatives :** table de transactions aplatie et arithmétique flottante — plus rapide initialement mais moins sûre pour les conversions, transferts et récompenses.
- **Conséquences :** invariants de conservation, contrôles d'ordre des événements, audit et tests de précision. Ce modèle n'impose pas à lui seul une comptabilité en partie double parfaite pour tous les actifs.
- **Validation requise :** Q-02 (cash initial, négatifs) et Q-03 (staking) tranchées, puis contrats de mouvements et de coût de revient revus. La méthode CMP est proposée par le PRD, pas une loi fiscale générale.

### ADR-0007 — Cotations et taux de change via adaptateurs

- **Statut :** `proposed`.
- **Proposition :** interfaces abstraites de recherche, prix instantanés/historiques, FX et métadonnées ; cache, quota, horodatage, source, indicateur de fraîcheur ; dégradation explicite si fournisseur indisponible.
- **Alternatives :** dépendance directe à un fournisseur unique ; scrapers non officiels — à éviter pour la fiabilité et les licences.
- **Conséquences :** couverture temps réel non garantie pour les titres/ETF ; le produit distingue explicitement cours différés et cours récents. Aucune donnée synthétique en production.
- **Validation requise :** Q-05 actifs pilotes, Q-06 droit d'utilisation et quotas des fournisseurs ; aucun fournisseur commercial n'est approuvé par cet ADR.

### ADR-0008 — Sessions et autorisations

- **Statut :** `proposed`.
- **Proposition :** authentification locale avec stockage sûr des mots de passe, sessions en cookies sécurisés, contrôles de propriété systématiques ; rôle admin limité à la gestion technique. Variante OIDC ultérieure si besoin.
- **Alternatives :** jetons persistants dans le navigateur, admin global ayant accès à tous les portefeuilles — écartés pour risque de fuite.
- **Conséquences :** protections CSRF adaptées, limitation des tentatives, rotation/invalidation des sessions, logs expurgés, tests d'isolation.
- **Validation requise :** mode d'accès distant, premier compte administrateur, politique de récupération de compte.

### ADR-0009 — Pipeline d'import vérifiable

- **Statut :** `proposed`.
- **Proposition :** `upload → parse → normalize → preview → deduplicate → confirm → commit`, sans écriture métier à l'étape de prévisualisation ; lot traçable et identifiants d'import conservés.
- **Alternatives :** import automatique aveugle (risque de doubles opérations), import PDF générique sans vérification (trop fragile).
- **Conséquences :** le MVP supporte des CSV **explicitement validés** ; PDF ciblés en V1 ; signalement des lignes ambiguës et contrôle utilisateur.
- **Validation requise :** Q-01 (formats pilotes) et Q-04 (opérations crypto non supportées dans les imports).

## 4. Arbitrages produit non résolus — ne pas transformer en ADR accepté

| PRD | Sujet | Blocage |
| --- | --- | --- |
| Q-01 | Exports CSV Coinbase/Trade Republic pilotes | Parser/import |
| Q-02 | Historique incomplet, soldes d'ouverture, cash négatif | Ledger/positions |
| Q-03 | Coût et comptabilisation staking | Calculs staking |
| Q-04 | Swaps et stablecoins présents dans les exports | Imports crypto |
| Q-05 | Liste des actifs/places pilotes | Couverture des prix |
| Q-06 | Fournisseurs et licences de données | Intégrations de marché |
| Q-07 | Détail de l'épargne | Vues d'épargne |
| Q-08 | Période par défaut du dashboard | UX |
| Q-09 | Étendue du hors-ligne au MVP | PWA/cache |

**Règle :** Codex peut proposer des options avec compromis, pas prendre des décisions métier à la place du responsable produit. L'absence d'un arbitrage bloque uniquement le lot concerné.

## 5. Workflow et maintenance

1. Lire `PRD.md`, les ADR `accepted`, `AGENTS.md` et l'état réel du dépôt.
2. Écrire les alternatives et compromis des décisions majeures avant l'implémentation.
3. Soumettre un ADR `proposed` à validation, puis seulement le marquer `accepted`.
4. Si l'architecture évolue, mettre à jour `ARCHITECTURE.md` et `CODEBASE_GRAPH.md` après vérification du code.
5. Lorsqu'un ADR accepté est remplacé, créer un nouveau dossier `docs/adr/NNNN-slug.md`, référencer le remplaçant et passer l'ancien à `superseded` ; ne pas réécrire son histoire.
6. Le présent registre contient des **fiches synthétiques initiales** pour éviter des liens vers des fichiers inexistants. Lors de la première refonte de la gouvernance des ADR, ces fiches pourront être extraites dans `docs/adr/` sans changer leur numéro ni leur statut.
