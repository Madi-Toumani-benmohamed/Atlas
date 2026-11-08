# Atlas — Roadmap produit et livraison

> **Produit :** Atlas Portfolio  
> **Version du document :** 0.2
> **Date :** 2026-11-07
> **Statut :** Exécution en cours ; état rapproché des preuves, gates MVP encore ouverts
> **Référence produit :** `PRD.md` v0.2  
> **Références complémentaires :** `AGENTS.md`, `design.md`, `ADR.md` ; `ARCHITECTURE.md` lorsqu'il existe

## 1. Objectif et règles de pilotage

Cette roadmap ordonne les travaux nécessaires pour livrer **Atlas Portfolio**, application web/PWA gratuite et auto-hébergeable de suivi d'actions, d'ETF, de cryptoactifs et de comptes d'épargne. Le produit doit afficher des valorisations et performances **fiables, traçables et compréhensibles**, sans reproduire la surcharge de Ghostfolio ou Wealthfolio.

- **`PRD.md` fait autorité sur le périmètre et les critères d'acceptation.** Cette roadmap définit l'ordre d'exécution et les jalons, pas de nouvelles règles métier.
- **`design.md` fait autorité sur le design.** Une maquette ou un mock ne prouve pas qu'une fonction est opérationnelle.
- **`ADR.md` et `ARCHITECTURE.md`** documentent respectivement les décisions structurantes et la solution technique. Aucun choix technique cité ici à titre d'orientation n'est validé par la roadmap seule.
- **`AGENTS.md`** gouverne le travail de Codex et des contributeurs.
- **Pas de calendrier inventé.** Les phases avancent par critères de sortie, non par dates ou estimations arbitraires.
- **Coût externe obligatoire : 0 €.** Les coûts du matériel, de l'énergie et de l'accès réseau ne sont pas inclus dans cette exigence.
- **Pas de fausses données.** Un cours manquant, ancien, différé ou estimé doit être identifié ; ne jamais synthétiser des cotations ou performances pour remplir l'écran.
- **Pas de développement spéculatif.** Si une règle métier est bloquée, isoler la portion concernée et poursuivre uniquement les tâches indépendantes.

### Priorités

| Classe | Signification | Règle |
| --- | --- | --- |
| P0 | Indispensable au MVP | Obligatoire avant publication MVP |
| P1 | V1 ou amélioration importante | Ne retarde pas le MVP, sauf prérequis opérationnel avéré |
| P2 | Futur / expérimentation | Pas d'implémentation anticipée |
| OUT | Exclu du produit | Ne pas ajouter sans décision produit formelle |

### États d'avancement

`TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE` ; `BLOCKED` si un arbitrage ou une dépendance empêche de continuer.

Une phase peut contenir des travaux parallèles, mais son jalon est considéré atteint uniquement lorsque **tous ses critères de sortie** sont vérifiés. Les statuts initiaux ci-dessous ne prétendent pas refléter l'état réel du dépôt ; ils doivent être contrôlés au démarrage.

## 2. Vue d'ensemble

| Phase | Livrable principal | État constaté | Passage requis |
| --- | --- | --- | --- |
| **0 — Contrats** | Spécifications, arbitrages critiques, architecture, cas de référence | BLOCKED | Contrats métier et qualité acceptés |
| **1 — Socle** | Utilisateurs, portefeuilles, comptes, opérations, permissions | DONE | Données isolées et écritures atomiques |
| **2 — Moteur financier** | Positions, liquidités, PRU, P&L, cours, FX, historique | IN_PROGRESS | Tests financiers exacts et données datées |
| **3 — Expérience utilisateur** | Dashboard, actifs, portefeuilles, activité et saisie | IN_PROGRESS | Parcours complets desktop/mobile |
| **4 — Imports et corrections** | CSV pilotes, prévisualisation, doublons, audit | IN_PROGRESS | Réimport idempotent et correction fiable |
| **5 — Publication MVP** | Export, Docker, sauvegarde/restauration, sécurité, documentation | IN_PROGRESS | Recette globale du PRD validée |
| **6 — V1 : pilotage** | DCA, objectifs, benchmarks, alertes, personnalisation | TODO | Fonctions P1 éprouvées sans surcharge |
| **7 — Research / IA** | Analyse et découverte d'actifs, explications sourcées | TODO | Gouvernance des sources et séparation des responsabilités |

Preuves de rapprochement et écarts : [audit P5.9](docs/validation/P5-9-roadmap-audit.md). Une case cochée ne lève pas les gates des autres lots ni les arbitrages de cotation.

**Chemin critique proposé :** Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Les composants visuels, tests et travaux d'infrastructure indépendants peuvent être préparés en parallèle, sans déclarer prématurément les phases terminées.

---

## 3. Phase 0 — Contrats et préparation du développement

**But :** rendre les premières tâches Codex non ambiguës et éviter de figer des erreurs financières dans le code.

### Lots

- [ ] **P0.1 — Vérifier les documents :** aligner `PRD.md`, `design.md`, `AGENTS.md`, `ADR.md` et `ARCHITECTURE.md` si présent ; supprimer les contradictions, distinguer décision et hypothèse.
- [x] **P0.2 — Définir le langage métier :** portefeuille logique, compte, actif, opération, mouvement de liquidités, position, transaction externe, prix, taux de change, snapshot, correction.
- [x] **P0.3 — Arrêter les invariants comptables :** conservation des montants, coûts et frais ; traitement des transferts ; bornes des quantités ; règles d'ordre chronologique ; correction et audit.
- [x] **P0.4 — Résoudre Q-02 :** soldes d'ouverture, liquidités insuffisantes, historiques partiels et politique d'affichage des performances incertaines.
- [x] **P0.5 — Résoudre Q-03 :** comptabilisation des récompenses de staking et traitement du coût d'acquisition selon une règle explicite.
- [x] **P0.6 — Décider le traitement Q-04 :** imports contenant des swaps crypto non supportés ; refuser, mettre en attente ou élargir le périmètre via arbitrage.
- [ ] **P0.7 — Fixer les actifs pilotes et les licences de cotation (Q-05/Q-06) :** BTC/ETH et un ETF S&P 500 retenus le 2026-11-07 ; ETF/place exacts, sources et droits encore à vérifier. Pas de couverture automatique présumée.
- [x] **P0.8 — Décrire les scénarios de référence :** formaliser T-01 à T-12 du PRD et les données de test attendues (frais, devises, dates, prix absents).
- [x] **P0.9 — Définir les contrats de service et le plan de tests :** entrées/sorties métier, erreurs, idempotence, conventions de précision, permissions et migration.
- [ ] **P0.10 — Maquetter les parcours critiques :** premier lancement, achat, vente, dashboard, détail de position, CSV, erreur de données ; respecter `design.md`.
- [ ] **P0.11 — Décider l'architecture et les ADR pertinents :** stack exacte, modèle de persistance, authentification, stratégies de collecte de cours et découpage modulaire.
- [x] **P0.12 — Préparer le dépôt :** conventions, lints, tests, CI initiale, `.env.example`, données fictives explicites. Aucun secret ni compte de marché réel dans le dépôt.

**Critères de sortie :** Q-02 et Q-03 tranchées ; politique Q-04 explicite ; échantillon d'actifs et source de cours pilote vérifiés ; tests financiers écrits ; parcours d'achat spécifié ; architecture/ADR cohérents. Les autres questions restent tracées avec propriétaires et impact.

**Références :** PRD §7, §11, §12.1, §13 ; `NFR-01`, `NFR-07`, `NFR-14`.

## 4. Phase 1 — Socle métier et sécurité

**But :** disposer d'une base de données cohérente et isolée, indépendamment de l'interface finale.

### Lots

- [x] **P1.1 — Authentification :** inscription/connexion, sessions sûres, renouvellement et déconnexion ; protections des identifiants et erreurs.
- [x] **P1.2 — Isolation multi-utilisateur :** contrôle de propriété systématique sur ressources et requêtes ; tests négatifs entre deux comptes.
- [x] **P1.3 — Portefeuilles logiques :** création, renommage, archivage ; rattachement au propriétaire.
- [x] **P1.4 — Comptes :** plusieurs comptes par portefeuille ; type, devise, fournisseur facultatif et statut d'archivage.
- [x] **P1.5 — Référentiel d'actifs :** distinction action, ETF, crypto, stablecoin et produit d'épargne ; identité sans dépendre du ticker seul.
- [x] **P1.6 — Journal d'opérations :** achats, ventes, dépôts, retraits, transferts, frais, dividendes et récompenses de staking selon règles validées.
- [x] **P1.7 — Enregistrement atomique :** écritures équilibrées/cohérentes, identifiants uniques, idempotence côté API pour les opérations critiques.
- [x] **P1.8 — Lecture et validation :** consultation filtrée de l'historique ; rejets explicites (quantités, dates, comptes, permissions, devises).
- [x] **P1.9 — Migrations et fixtures :** migrations versionnées et jeux d'essai exclusivement fictifs.

**Critères de sortie :** deux utilisateurs sans fuite de données ; opérations persistées atomiquement ; transferts comptabilisés une seule fois dans la consolidation ; validation serveur éprouvée. Aucun écran simulant un gain réel.

**Références :** `F-001` à `F-011`, `US-001`, `US-009`, `NFR-02` à `NFR-05`.

## 5. Phase 2 — Moteur financier et cotations

**But :** calculer des chiffres corrects avant d'en faire des visualisations attractives.

### Lots

- [x] **P2.1 — Reconstruction des positions :** quantités par compte et actif à toute date ; recomputation après opération antidatée.
- [x] **P2.2 — Coût moyen et ventes :** coût d'acquisition restant, frais, PRU, résultat latent et réalisé ; distinction du calcul fiscal.
- [x] **P2.3 — Liquidités et épargne :** dépôts/retraits, effets des achats/ventes, Livret A et PEL, intérêts effectivement crédités.
- [x] **P2.4 — Staking simple :** mouvements de récompense et valorisation selon politique documentée ; écarter DeFi complexe.
- [ ] **P2.5 — Prix de marché :** recherche/association des actifs, prix datés, cache, quotas, fournisseur et statut de fraîcheur ; cours manuel traçable si nécessaire.
- [x] **P2.6 — Taux de change :** préservation des devises de transaction, conversions EUR datées, précision décimale et arrondis de présentation.
- [x] **P2.7 — Valorisation consolidée :** valeur par actif, compte, portefeuille et globale ; apports externes séparés des achats et transferts.
- [ ] **P2.8 — Performances :** gains et pertes en montant/pourcentage, variations de cours distinctes du rendement personnel, résultats réalisés/latents.
- [x] **P2.9 — Séries temporelles :** positions et prix historiques par date ; historiques incomplets signalés et rendement temporel uniquement lorsque calculable.
- [ ] **P2.10 — Défaillances :** cours manquants, marchés fermés, prix différés, données incohérentes ; états observables et dégradation maîtrisée.

**Critères de sortie :** T-01 à T-05 et T-07 à T-12 passent ; toutes les valeurs ont une provenance et une date ; pas de performance inventée ; la valeur consolidée exclut les doubles comptes ; incident de fournisseur n'altère pas l'historique.

**Références :** `F-005` à `F-009`, `F-013` à `F-019`, `US-010`, `NFR-01`, `NFR-06`, `NFR-07`.

## 6. Phase 3 — Dashboard et parcours UX

**But :** transformer le moteur en interface quotidienne riche mais lisible.

### Lots

- [x] **P3.1 — Shell responsive :** navigation Accueil, Portefeuilles, Actifs et Activité ; thèmes sombre/clair/auto ; accessibilité et états UI.
- [x] **P3.2 — Onboarding :** création d'utilisateur, premier portefeuille, compte, première opération ou import ; empty states explicites.
- [ ] **P3.3 — Dashboard global :** valeur, gain/perte, période, courbe, allocation, synthèse des portefeuilles, dix actifs, meilleures/pires performances.
- [ ] **P3.4 — Portefeuilles/comptes :** liste, regroupements logiques, positions, liquidités, résultats et navigation. [Détail des comptes](docs/validation/P3-4-account-holdings.md) enrichi ; vues d’évolution/répartition propres au portefeuille encore ouvertes.
- [ ] **P3.5 — Détail d'actif :** prix et variation du marché, quantité, PRU, valeur, P&L personnel, historique et dernière cotation. Tranches [observations de cours enregistrées](docs/validation/P3-5-quote-history.md) et [historique source des opérations](docs/validation/P3-5-asset-operations.md) disponibles ; détail complet encore ouvert.
- [x] **P3.6 — Formulaires :** achat par montant total, vente avec disponibilité, dépôt/retrait, transfert, dividende, staking et frais ; retour de validation compréhensible.
- [x] **P3.7 — Activité :** liste, filtres, détail, duplication ; correction traçable selon phase 4 si non disponible.
- [ ] **P3.8 — Information fiable :** indicateurs de données obsolètes, incompletes, différées ; langage accessible, aide contextuelle courte.
- [ ] **P3.9 — Recette visuelle et E2E :** desktop/mobile, clavier, contraste, mouvement réduit, chargement/erreur/absence de données ; aucun faux état de connexion.

**Critères de sortie :** un utilisateur peut réaliser `US-001` à `US-005` et consulter les données réelles de son compte ; les dix actifs et les performances sont lisibles ; achat et vente testés de bout en bout ; conformité `design.md` inspectée.

**Références :** `F-010`, `F-013` à `F-017`, `F-021`, `US-001` à `US-005`, `NFR-08`, `NFR-09`, `NFR-15`.

## 7. Phase 4 — Imports, rapprochement et audit

**But :** rendre la reprise d'historique sûre et corrigeable.

### Lots

- [ ] **P4.1 — Formats CSV pilotes :** sélectionner les exports réels autorisés (Q-01), constituer des fixtures anonymisées et documenter les versions supportées.
- [x] **P4.2 — Prévisualisation :** extraction et mapping des colonnes ; examen des montants, actifs, dates, devises et frais avant écriture.
- [x] **P4.3 — Validation des imports :** contrôle de cohérence, signalement des opérations non supportées et rejet sans perte du lot.
- [x] **P4.4 — Détection des doublons :** empreinte de lot, identifiants externes, règles déterministes et intervention humaine en cas d'ambiguïté.
- [x] **P4.5 — Rapprochement :** écarts entre soldes ou positions calculés et états importés ; pas de correction silencieuse.
- [x] **P4.6 — Correction/audit :** modifier ou annuler logiquement une opération avec historique ; recalcul des impacts et affichage des changements.
- [x] **P4.7 — Rapport :** opérations acceptées, rejetées, doublons, ambiguïtés et limites documentées.
- [ ] **P4.8 — PDF :** **hors obligation MVP** ; prototype seulement si un format pilote est explicitement approuvé, sans généraliser l'extraction.

**Critères de sortie :** un même fichier réimporté ne duplique aucune transaction ; les données ambiguës restent en attente ; correction antidatée déclenche un recalcul ; rapport exploitable par l'utilisateur. T-06 et T-07 passent.

**Références :** `F-011`, `F-012`, `US-006`, `US-007`, `NFR-03`, `NFR-07`.

## 8. Phase 5 — Durcissement et publication MVP

**But :** publier une version personnellement utilisable, installable et récupérable après incident.

### Lots

- [x] **P5.1 — Export complet :** portefeuilles, comptes et opérations dans des formats ouverts/documentés ; lecture externe indépendante vérifiée. [Preuves P5.1](docs/validation/P5-1-export-reader.md).
- [x] **P5.2 — Docker Compose :** installation vierge Linux, configuration d'environnement, stockage persistant, lancement et mises à jour documentées. Installation Linux vierge, persistance et reprise vérifiées en CI : [lot exploitation](docs/validation/P5-operations-hardening.md).
- [ ] **P5.3 — Sauvegardes :** procédure quotidienne, sauvegardes chiffrées et exercice de restauration réel ; pas d'affirmation de succès sans vérification.
- [x] **P5.4 — Sécurité :** sessions, contrôles d'accès, secrets, validation, dépendances, journalisation et protections d'exposition distante ; revue interne, correctifs et CI vérifiés. [Preuves et réserves P5.4](docs/validation/P5-4-security.md).
- [x] **P5.5 — Observabilité minimale :** santé applicative, disponibilité DB, erreurs fournisseurs, quotas, synchronisation ; pas de fuite d'informations financières.
- [x] **P5.6 — CI et reproductibilité :** lint, typage, unitaires, intégration, E2E, builds, migrations et checks de sécurité.
- [x] **P5.7 — Documentation publique :** README, installation, configuration, utilisateurs, limites d'actifs couverts, sauvegarde/restauration, export et contribution. Preuves : [rapport P5.7](docs/validation/P5-7-public-docs.md) ; réserves de recette conservées.
- [x] **P5.8 — Licence open source :** Apache 2.0 existante, inventaire runtime et notices transitives vérifiés ; 15 fichiers de notices contrôlés dans chaque image AMD64/ARM64. [Licences et droits des flux](docs/licenses/README.md).
- [ ] **P5.9 — Recette globale :** cocher les 15 critères du PRD §12, preuves et écarts connus à l'appui.
- [ ] **P5.10 — Publication :** [notes préparatoires](docs/releases/unreleased.md) disponibles ; version initiale/tag et publication restent conditionnés aux gates MVP et à la recette cible.

**Critères de sortie :** **tous les P0 du PRD sont livrés**, testés et sans service payant obligatoire ; installation et restauration démontrées ; données et limites traçables ; aucun défaut critique de sécurité ou de calcul connu laissé sans traitement.

**Références :** `F-020`, `F-022`, `NFR-04` à `NFR-15`, PRD §12.

---

## 9. Phase 6 — V1 : piloter ses investissements

**Déclencheur :** MVP utilisé sur des données réelles, retours UX documentés et dette critique maîtrisée.

- [ ] **V1.1 — DCA :** montant cible mensuel, opérations récurrentes et suivi de discipline (`F-027`).
- [ ] **V1.2 — Allocation cible :** répartition souhaitée, écarts et représentation compréhensible (`F-028`).
- [ ] **V1.3 — Objectifs :** valeurs cibles et progression (`F-029`).
- [ ] **V1.4 — Benchmarks :** comparaisons sur périodes et devises cohérentes (`F-030`).
- [ ] **V1.5 — Alertes :** concentration et écarts ; opt-in, paramètres et désactivation (`F-031`).
- [ ] **V1.6 — Journal d'investissement :** notes de décision attachées aux opérations (`F-032`).
- [ ] **V1.7 — Simulations :** scénarios hypothétiques clairement marqués, jamais pris pour des prévisions (`F-033`).
- [ ] **V1.8 — Dashboard personnalisable :** ordre et visibilité des widgets sans casser la hiérarchie (`F-034`).
- [ ] **V1.9 — Hors ligne :** consultation des dernières données datées en cache, stratégie PWA explicite (`F-035`).
- [ ] **V1.10 — Administration :** interface technique sans accès financier implicite (`F-023`).
- [ ] **V1.11 — Import PDF ciblé :** uniquement formats contrôlés et vérifiables (`F-024`).
- [ ] **V1.12 — Coinbase lecture seule :** uniquement si API, permissions et quotas conviennent (`F-025`).

**Critères de sortie :** fonctionnalités activées sans coût obligatoire, sans baisse de fiabilité et sans densifier l'accueil inutilement ; scénarios comparatifs et alertes explicables.

## 10. Phase 7 — Atlas Research et capacités IA

**Déclencheur :** base Portfolio stable et sources de données adaptées ; validation séparée du périmètre Research.

- [ ] **R7.1 — Frontière fonctionnelle :** Research distinct de Portfolio dans la navigation et les responsabilités ; décider ultérieurement module ou produit séparé.
- [ ] **R7.2 — Données fondamentales :** chiffres d'entreprise, historique, provenance, dates et couverture (`F-036`).
- [ ] **R7.3 — Recherche et comparaison :** actions/ETF côte à côte, critères sélectionnés et explications pédagogiques (`F-036`).
- [ ] **R7.4 — Actualités contextualisées :** sources et dates, sans attribuer abusivement une causalité aux variations de prix (`F-036`).
- [ ] **R7.5 — IA sourcée :** questions sur le portefeuille avec permissions strictes, données issues des services métier et distinction faits/hypothèses (`F-037`).
- [ ] **R7.6 — Gouvernance :** confidentialité, absence d'envoi non approuvé à un modèle externe, évaluation des hallucinations, limites et coût zéro.
- [ ] **R7.7 — Études futures :** Trade Republic officiel (`F-026`), swaps/on-chain/DeFi complexes (`F-038`) selon arbitrages indépendants.

**Exclusion constante :** aucun conseil automatique présenté comme certain, aucun ordre exécuté automatiquement, aucune recommandation fondée sur des données inventées (`F-039`, OUT).

## 11. Dépendances et décisions bloquantes

| ID PRD | Décision | À résoudre avant | Politique en attendant |
| --- | --- | --- | --- |
| Q-01 | CSV pilotes Coinbase / Trade Republic | Choix délégué le 2026-11-06 | Adaptateurs limités documentés ; recette d’exports réels encore partielle |
| Q-02 | Soldes d'ouverture et historiques partiels | Résolu le 2026-11-06 | Ouvertures explicites, aucun découvert/short, performance incomplète masquée |
| Q-03 | Coût des récompenses staking | Résolu le 2026-11-06 | Cours daté à réception, revenu et coût d’acquisition |
| Q-04 | Swaps présents dans l'historique | Résolu le 2026-11-06 | Rejet explicite sans conversion automatique |
| Q-05 | Liste d'actifs/places pilotes | Phase 2 | Couverture non garantie |
| Q-06 | Fournisseurs et droits de marché | Phase 2 / publication | Prix manuels datés ou actif non valorisé |
| Q-07 | Affichage des produits d'épargne | Phase 3 | Solde et intérêts crédités uniquement |
| Q-08 | Période par défaut du graphique | Phase 3 | Contrôle de période, défaut à trancher |
| Q-09 | Niveau hors ligne | Phase 3 / V1 | Déclarer précisément ce qui fonctionne hors ligne |
| Q-10 | Suppression/conservation des données | Publication publique | Définir avant ouverture multi-utilisateur |

**Registre de décision :** pour chaque Q-*, consigner la décision validée, sa date, ses impacts, les cas de test touchés et, si nécessaire, un ADR. Une question bloquante n'est jamais résolue implicitement par Codex.

## 12. Ordre de réalisation recommandé pour Codex

Ne pas demander « implémente Atlas » en un seul prompt. Une unité de travail doit produire un résultat vérifiable et rester facile à relire.

| Itération | Travail autorisé | Preuve minimale |
| --- | --- | --- |
| C-00 | Auditer documents et dépôt, lister incohérences et décisions ouvertes | Rapport sans modification métier implicite |
| C-01 | Initialiser le squelette et la CI, après choix de stack | Build, lint et tests de fumée |
| C-02 | Authentification et isolation des utilisateurs | Deux utilisateurs, accès croisé refusé |
| C-03 | Portefeuilles, comptes et actifs | Tests API et intégrité DB |
| C-04 | Ledger des opérations après Q-02/Q-03 | Tests d'atomicité et d'idempotence |
| C-05 | Positions, PRU et P&L | Jeux de tests financiers T-01 à T-05 |
| C-06 | Prix, FX, historique | Tests prix périmés/manquants, multi-devises |
| C-07 | Parcours de saisie et écrans principaux | Tests E2E et revue design |
| C-08 | Imports CSV et audit | Réimport sans doublons, correction antidatée |
| C-09 | Export, sauvegardes et publication | Installation et restauration prouvées |

À chaque itération : **(1)** citer les exigences concernées ; **(2)** annoncer les fichiers concernés ; **(3)** implémenter ; **(4)** exécuter les contrôles ; **(5)** présenter résultats et limites ; **(6)** mettre à jour la documentation utile. Une itération peut être subdivisée en plusieurs PR.

### Structure suggérée des issues / PR

```markdown
## Objectif
## Références PRD (F-*, US-*, NFR-*)
## Périmètre et hors périmètre
## Dépendances / décisions ouvertes
## Critères d'acceptation
## Tests attendus
## Impact documentation / ADR
```

## 13. Suivi de l'avancement et changements de périmètre

Pour chaque phase ou lot, maintenir : statut, lien issue/PR, décisions nécessaires, preuves de recette et risques résiduels. La roadmap ne doit **pas** être utilisée comme substitut à un gestionnaire de tâches détaillé.

- Nouvelle fonctionnalité : valider d'abord sa priorité dans `PRD.md` ; actualiser ensuite la roadmap.
- Choix d'architecture structurant : créer ou mettre à jour l'ADR, puis ajuster les lots concernés.
- Échec d'un test financier : priorité à la correction ; ne pas masquer l'erreur par un fallback UI.
- Demande UX : vérifier la cohérence avec `design.md` et la promesse de lisibilité.
- Fonctionnalité terminée : exiger preuves de test, comportement réel et documentation ; ne pas déclarer `DONE` sur simple génération de code.

## 14. Definition of Done transverse

Une tâche ne peut être marquée `DONE` que si :

1. Son comportement satisfait les critères d'acceptation identifiés.
2. Les tests pertinents passent et leur exécution est rapportée.
3. Les erreurs, états vides, échecs réseau et permissions sont traités lorsque applicables.
4. Aucune donnée fictive n'est présentée comme réelle.
5. Les changements de schéma incluent migrations et stratégie de retour arrière appropriée.
6. Les secrets et données sensibles ne figurent ni dans le dépôt ni dans les logs.
7. L'interface concernée respecte `design.md` et reste utilisable sur mobile.
8. Les décisions, limites et différences avec le PRD sont documentées.

**Publication MVP :** appliquer en plus tous les critères du `PRD.md` §12 et les 12 scénarios T-01 à T-12 qui concernent le périmètre effectivement supporté ; un scénario du périmètre P0 ne peut pas être supprimé sans amendement produit.

## 15. Historique

| Version | Date | Modification |
| --- | --- | --- |
| 0.1 | 2026-11-05 | Création de la roadmap alignée sur le PRD v0.2 ; phases, gates, lots Codex et dépendances métier |

## Suivi C-01 — 2026-11-05

Démarrage autorisé par délégation explicite du responsable produit après C-00. ADR-0004/0005 acceptés ; socle Go et chaîne frontend créés avec CI. Voir `docs/decisions/C-01.md` et `CODEBASE_GRAPH.md`. Les autres lots de Phase 0 restent ouverts ; aucun passage global en Phase 1 déclaré.

Preuves C-01 : lint, build/types et test de fumée frontend réussis ; formatage, vet, tests avec race detector et build Go exécutés en conteneur. **READY_WITH_RESERVATIONS** pour ce socle : alertes npm modérées de développement documentées, CI distante non exécutée. L’interface produit, PostgreSQL et Compose de production ne sont pas implémentés.

### Conteneurisation du socle — 2026-11-05

F-022, NFR-10 ; préparation P5.2, sans déclarer la publication MVP. Ajout de `compose.yaml`, image Go multi-stage/scratch, contrôle de vitalité, utilisateur non root et publication locale. Vérifié : `docker compose config --quiet`, `ATLAS_PORT=18080 docker compose -p atlas-compose-check up --build -d --wait`, requête HTTP `/healthz`, inspection `healthy`, utilisateur `65532:65532`, racine en lecture seule ; arrêt du service de test réussi. Pas de DB ni frontend servi à ce stade, pas de preuve ARM64, TLS ou restauration. Conteneur de test arrêté, conservé ; aucune donnée supprimée.

À la demande explicite du responsable produit, le fichier est renommé `docker-compose.yml` et le port publié sur `0.0.0.0` pour accès distant au socle. Validation : `docker compose config --quiet` ; pas de redémarrage des services effectué pour cette modification.

### C-02 — API d’identité, 2026-11-05

F-001/F-002, US-001/US-009, NFR-02/04/05/13 ; P1.1/P1.2/P1.9. ADR-0008 accepté par délégation. Implémenté : PostgreSQL, schéma v1, inscription opt-in, connexion, session persistante/expiration/rotation, déconnexion et identité privée. Tests d’intégration avec deux utilisateurs, refus d’accès, CSRF par origine, rate limit et migration rejouée réussis ; build/vet/race et smoke HTTP avec redémarrage réussis. Contrat : `docs/decisions/C-02.md`.

Lot API vérifié ; C-02 global reste en cours : aucun écran ni récupération de compte. C-03 et les règles financières ne sont pas commencés. Phase 0 et publication MVP non déclarées terminées.

### C-02 — Parcours web, 2026-11-06

Suite locale : interface d’inscription/connexion, restauration de session, déconnexion et état connecté explicite sans portefeuille. F-001/F-002, identité de US-001/US-009, NFR-09/15 ; P1.1/P1.2 et préparation P3.2. Lint, typage/build, tests HTTP et parcours Chromium avec API simulée réussis ; trois largeurs contrôlées. Détails et reproduction : `docs/decisions/C-02-web.md`. Suite vérifiée : intégration réelle Chromium/API/PostgreSQL avec deux utilisateurs, rotation, CSRF, déconnexion et session conservée après redémarrage ; tests Go avec race detector réussis. Job CI E2E ajouté, non exécuté sur GitHub. Hébergement HTTPS de production encore à vérifier ; récupération de compte absente. C-02 reste IN_PROGRESS, C-03 non commencé.

### C-02 — Validation élargie, 2026-11-06

NFR-04/05/09/10/13/15 : parcours réel HTTPS sur build statique et API conteneurisée, cookie Secure, persistance après redémarrage, 12 analyses axe sans violation détectée, contrôles Node 22/24, frontières UTF-8 et CSRF serveur, vérification des modules et audits de dépendances. Restauration d’une sauvegarde chiffrée sur base distincte et reprise de session vérifiées sur données synthétiques ; compilation statique ARM64 réussie sans exécution ARM64. CI enrichie, pas de run hébergé. **READY_WITH_RESERVATIONS pour le périmètre livré**, pas de publication MVP : alertes npm de développement, Dockerfile multi-stage complet et hébergement public restent à traiter/vérifier. Rapport : `docs/validation/C-02.md`.

### C-03 à C-09 — poursuite autorisée, 2026-11-06

Le responsable produit a demandé de poursuivre tous les lots au-delà de C-02 et approuvé la politique d’ouverture, de contraintes cash/inventaire, de staking et de swaps non pris en charge. Le choix des formats CSV est délégué : Coinbase historique avec ID et Trade Republic transactions à 23 colonnes retenus, avec périmètre limité documenté.

| Lot | État observé |
| --- | --- |
| C-03 | Implémenté, API/DB privée vérifiée |
| C-04 | Implémenté, journal transactionnel et corrections vérifiés |
| C-05 | Implémenté, résultats numériques et consolidation vérifiés |
| C-06 | Implémenté pour observations manuelles/FX BCE/historique ; couverture automatique d’actifs ouverte |
| C-07 | Implémenté, recette navigateur réelle, états vides et 22 analyses axe sur données synthétiques vérifiés |
| C-08 | Atlas v1 et adaptateurs limités Coinbase/Trade Republic vérifiés en tests SQL et navigateur sur fixtures synthétiques |
| C-09 | Export/archives/scripts/TLS et builds multi-architecture implémentés ; restauration des neuf tables et exécution ARM émulée vérifiées |

Les paragraphes C-01/C-02 ci-dessus sont des étapes historiques et ne décrivent plus seuls l’état courant. Preuves, commandes, réserves et couverture exacte : [rapport C-03–C-09](docs/validation/C-03-C-09.md). Aucun statut global MVP `DONE`. Après publication autorisée, CI GitHub [Quality #2](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42267576348) réussie sur le commit applicatif `3f033c88` : backend, web, E2E réels et builds Docker AMD64/ARM64, cinq jobs sur cinq. La réserve de CI distante de ce lot est levée ; les réserves de cours automatiques et de déploiement cible restent ouvertes.


### P4.5 — Rapprochement de relevés, 2026-11-06

Implémenté et vérifié : CSV Atlas soldes v1, compte/devise/instant explicites, comparaison historique exacte, couverture partielle/complète déclarée, rapport exportable et aucune écriture du journal. Source/API/écran et tests : [rapport P4.5](docs/validation/P4-5-reconciliation.md).

Les cases des lots P1.1–P1.9, P4.2–P4.7 et P5.6 reflètent désormais les preuves C-03–C-09 et P4.5. P4.1 reste partiel faute de recette sur exports réels ; P4.8 reste hors obligation MVP. Les autres cases non cochées incluent des lots partiellement implémentés : ne pas les lire comme une absence totale de code. La couverture automatique des cours (P2.5, Q-05/Q-06), les gates de publication restent à traiter sans promouvoir les fonctions V1/Research.


### P5.5 — Observabilité minimale, 2026-11-06

Implémenté : vitalité/readiness distinctes, DB sondée avec timeout et mutualisation, sonde Compose adaptée, état BCE sans récupération implicite, statut de persistance privé, backoff/Retry-After, concurrence et logs JSON expurgés. Panne/reprise PostgreSQL réelle et erreurs fournisseur contrôlées vérifiées. Contrats, résultats et limites : [guide](docs/operations/observability.md), [rapport](docs/validation/P5-5-observability.md). Aucun fournisseur d’actifs ni service de supervision obligatoire ajouté ; gates MVP/déploiement cible non fermés par ce lot.
