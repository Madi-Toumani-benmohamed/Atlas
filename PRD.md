# Atlas — Product Requirements Document (PRD)

> **Statut :** Draft — cadrage produit à valider  
> **Version :** 0.1  
> **Date :** 2026-11-05  
> **Responsable produit :** à préciser  
> **Références :** `AGENTS.md`, `design.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `ADR.md`

## 1. Objet du document

Ce PRD définit le problème produit, les utilisateurs, les usages, le périmètre du MVP et les conditions d'acceptation d'Atlas.

Il décrit **ce que le produit doit accomplir** et **comment vérifier que cela fonctionne**, sans imposer prématurément les choix techniques.

**Important :** la vision fonctionnelle détaillée du projet et son premier prompt de cadrage ne sont pas confirmés dans les éléments consultables pour cette version. Les champs `[À VALIDER]` doivent être complétés avant qu'un agent ne développe les fonctionnalités correspondantes. Les exigences transversales ci-dessous constituent une base de qualité, pas une validation du périmètre métier.

## 2. Identité et vision produit

| Élément | Définition |
| --- | --- |
| Nom | Atlas |
| Proposition de valeur | [À VALIDER — une phrase décrivant le bénéfice principal] |
| Problème central | [À VALIDER — problème utilisateur précis] |
| Public principal | [À VALIDER — utilisateur / rôle cible] |
| Usage principal | [À VALIDER — action récurrente la plus importante] |
| Contexte d'utilisation | [À VALIDER — personnel, équipe, professionnel, autre] |
| Plateformes ciblées | [À VALIDER — web, desktop, mobile] |
| Promesse UX | Une interface cohérente, soignée, lisible et agréable, conforme à `design.md` |

### Vision en une phrase

> Atlas aide **[utilisateur cible]** à **[résultat recherché]**, sans **[friction majeure]**, grâce à **[différenciation principale]**.

### Principes produit

1. **Utilité avant complexité :** chaque fonctionnalité doit résoudre un besoin identifiable.
2. **Clarté avant densité :** l'interface doit rendre la prochaine action évidente.
3. **Cohérence :** comportements et visuels respectent `design.md`.
4. **Fiabilité :** aucune action critique ne doit sembler réussie si elle a échoué.
5. **Contrôle utilisateur :** les opérations importantes et leurs conséquences doivent être compréhensibles.
6. **Évolutivité mesurée :** ne pas construire des abstractions ou intégrations hypothétiques.

## 3. Problème et utilisateurs

### Problème à résoudre

**Situation actuelle :** [À VALIDER — comment la tâche est réalisée aujourd'hui]

**Points de friction :** [À VALIDER — temps perdu, erreurs, dispersion, limites des outils actuels]

**Résultat souhaité :** [À VALIDER — résultat observable après adoption d'Atlas]

**Pourquoi maintenant :** [À VALIDER — motivation et priorité]

### Personas

| Persona | Besoin principal | Friction actuelle | Priorité |
| --- | --- | --- | --- |
| Utilisateur principal — [À VALIDER] | [À VALIDER] | [À VALIDER] | P0 |
| Utilisateur secondaire — facultatif | [À VALIDER] | [À VALIDER] | À décider |

**Règle :** ne pas ajouter de multi-utilisateur, collaboration, rôles, abonnements ou partage tant que leur nécessité n'est pas démontrée et approuvée.

## 4. Objectifs et non-objectifs

### Objectifs MVP

- **O1 — Valeur :** l'utilisateur principal accomplit le parcours métier central de bout en bout.
- **O2 — Compréhension :** navigation et états de l'interface ne créent pas d'ambiguïté.
- **O3 — Fiabilité :** les erreurs sont visibles, explicables et récupérables.
- **O4 — Qualité :** l'expérience correspond au système visuel de `design.md`.
- **O5 — Maintenabilité :** les fonctionnalités livrées sont testables et documentées.

### Indicateurs de réussite à définir

| Indicateur | Méthode | Cible |
| --- | --- | --- |
| Réussite du parcours principal | Test de scénario de bout en bout | [À VALIDER] |
| Temps pour réaliser l'action centrale | Mesure sur scénario représentatif | [À VALIDER] |
| Erreurs bloquantes | Tests et retours d'usage | [À VALIDER] |
| Satisfaction sur l'expérience | Retours qualitatifs / tests utilisateurs | [À VALIDER] |

### Non-objectifs initiaux

Sauf décision explicite, le MVP ne comprend pas : architecture distribuée prématurée, fonctionnalités « au cas où », système de plugins, collaboration avancée, tableaux de bord décoratifs, automatisations non nécessaires au parcours central ou intégrations externes non spécifiées.

Ces exclusions sont **provisoires** et doivent être adaptées au vrai domaine métier.

## 5. Périmètre fonctionnel

Le périmètre métier reste à valider. Utiliser ce registre avant d'ouvrir des tâches de développement.

| ID | Fonctionnalité / capacité | Valeur utilisateur | Priorité | Statut |
| --- | --- | --- | --- | --- |
| F-001 | [À VALIDER — parcours métier principal] | [À VALIDER] | P0 proposé | Non défini |
| F-002 | [À VALIDER — consulter / retrouver le résultat] | [À VALIDER] | À arbitrer | Non défini |
| F-003 | [À VALIDER — modifier / corriger une action] | [À VALIDER] | À arbitrer | Non défini |
| F-004 | [À VALIDER — persistance / import / export si nécessaires] | [À VALIDER] | À arbitrer | Non défini |

### Grille de priorisation

- **P0 :** indispensable pour délivrer la valeur du parcours central.
- **P1 :** améliore sensiblement l'expérience, sans être indispensable au MVP.
- **P2 :** amélioration ultérieure ou expérimentation.
- **Out :** hors périmètre de la version considérée.

**Aucune ligne placeholder n'autorise Codex à inventer ou implémenter une capacité.**

## 6. Parcours utilisateur de référence

### US-001 — Premier accès

**En tant que** nouvel utilisateur, **je veux** comprendre le rôle d'Atlas et identifier l'action principale, **afin de** commencer sans devoir explorer des menus ambigus.

Critères d'acceptation :
- L'écran initial rend la finalité du produit et son action principale compréhensibles.
- Les éléments interactifs sont identifiables et accessibles au clavier.
- Aucun faux contenu, chiffre ou état de connexion ne simule une donnée réelle.
- Si une configuration préalable est nécessaire, les prérequis sont explicités.

### US-002 — Parcours métier central `[À VALIDER]`

**En tant que** [persona], **je veux** [action], **afin de** [résultat].

Scénario nominal :
1. L'utilisateur [déclencheur].
2. Il [action principale].
3. Atlas [traitement attendu].
4. L'utilisateur constate [résultat observable].

Scénarios alternatifs à décrire :
- Données absentes ou invalides.
- Erreur de traitement.
- Action interrompue ou annulée.
- Reprise et correction lorsque cela est applicable.

**Statut :** spécification bloquante tant que le scénario nominal n'est pas renseigné.

### US-003 — Retours d'état

**En tant qu'** utilisateur, **je veux** savoir si mon action est en cours, réussie ou échouée, **afin d'** éviter les doublons et les pertes d'information.

Critères d'acceptation :
- Les actions asynchrones ont un état de progression ou d'attente explicite.
- Un succès n'est affiché qu'après confirmation effective.
- Toute erreur fournit une explication exploitable et, si possible, une action corrective.
- Les actions destructives ou irréversibles présentent leurs conséquences avant confirmation.

## 7. Exigences UX et interface

`design.md` reste la **source de vérité** pour les tokens, couleurs, typographies, composants, interactions et règles de responsive design.

Exigences produit :
- Interface sombre en priorité, cohérente avec le design validé.
- Hiérarchie visuelle claire ; action principale facilement identifiable.
- États **empty / loading / success / error / disabled** pour chaque flux pertinent.
- Navigation clavier, focus visible, labels sémantiques et contrastes appropriés.
- Adaptation aux tailles d'écran prévues dans le périmètre de plateformes.
- Animations sobres, fonctionnelles et compatibles avec la préférence de réduction des mouvements.
- Aucun écran purement esthétique ne doit remplacer une interaction fonctionnelle.

**À définir :** arborescence de navigation, écrans métier, modèles de contenu, langues et formats locaux.

## 8. Données, confidentialité et sécurité

Les décisions de stockage, modèle de données et fournisseurs appartiennent à `ARCHITECTURE.md` et aux ADR validés.

Exigences minimales :
- Identifier les données collectées et leur finalité avant de les stocker ou transférer.
- Ne jamais placer de secret dans le dépôt ou le navigateur.
- Valider les entrées aux frontières de confiance.
- Appliquer les contrôles d'accès côté serveur s'ils sont nécessaires.
- Éviter les journaux contenant des données sensibles.
- Prévoir des états d'échec et, pour les données persistantes importantes, une stratégie de reprise adaptée.
- Demander une décision explicite avant l'envoi de données utilisateur à un service tiers non approuvé.

**Questions ouvertes :** authentification requise ? stockage local ou distant ? données personnelles ? sauvegarde, suppression, export, synchronisation ? Ces décisions dépendent du métier et ne sont pas fixées ici.

## 9. Exigences non fonctionnelles

| ID | Domaine | Exigence | Vérification |
| --- | --- | --- | --- |
| NFR-01 | Fiabilité | État d'erreur explicite ; pas de faux succès | Tests de scénarios d'échec |
| NFR-02 | Accessibilité | Parcours clavier et focus visibles | Contrôles manuels et automatisés disponibles |
| NFR-03 | Sécurité | Validation aux frontières et secrets protégés | Revue ciblée et tests |
| NFR-04 | Performance | Parcours principal fluide sur appareils cibles | Mesures après choix des plateformes |
| NFR-05 | Maintenabilité | Modules compréhensibles, tests pertinents | Revue, lint, types, tests |
| NFR-06 | Design | Conformité à `design.md` | Inspection visuelle |
| NFR-07 | Observabilité | Échecs diagnostiquables sans exposer les secrets | Vérification logs / erreurs |

Les budgets chiffrés (latence, disponibilité, taille de bundle, etc.) seront définis lorsque les plateformes et volumes cibles seront connus. Ne pas inventer de SLO.

## 10. Définition du MVP

Le MVP est livrable uniquement si :

1. Le problème, le persona et le parcours principal sont validés.
2. Toutes les exigences **P0 acceptées** sont implémentées de bout en bout.
3. Les critères d'acceptation du parcours principal sont vérifiés.
4. Les principaux cas d'échec ont un traitement utilisable.
5. Les vérifications adaptées (tests, lint, types, build) ont été exécutées et leurs résultats communiqués.
6. L'interface respecte le design retenu et a été inspectée lorsque l'environnement le permet.
7. Les limites connues et décisions en attente sont documentées.
8. Aucune dépendance métier essentielle ne repose sur une fonctionnalité fictive ou une maquette non connectée.

## 11. Risques et dépendances

| Risque | Impact | Réponse |
| --- | --- | --- |
| Fonction centrale non explicitée | Développement hors cible | Valider US-002 avant implémentation métier |
| Stack choisie trop tôt | Refactorings inutiles | Décider après cadrage du PRD |
| Ajout continu de fonctionnalités | MVP incontrôlable | Appliquer P0/P1/P2 et arbitrer les écarts |
| Design détaché du comportement réel | Produit séduisant mais inutilisable | Tester chaque flux de bout en bout |
| Intégrations ou données sensibles | Risques de sécurité / confidentialité | ADR et revue avant activation |

## 12. Questions ouvertes — à résoudre avant développement métier

| ID | Question | Priorité |
| --- | --- | --- |
| Q-01 | À quoi sert Atlas, en une phrase concrète ? | Bloquante |
| Q-02 | Qui est son utilisateur principal ? | Bloquante |
| Q-03 | Quelle action principale doit réussir dans le MVP ? | Bloquante |
| Q-04 | Quelles sont les 3 à 5 fonctionnalités réellement indispensables ? | Bloquante |
| Q-05 | Quelles plateformes Atlas doit-il supporter au lancement ? | Haute |
| Q-06 | Quelles données doit-il gérer, conserver ou échanger ? | Haute |
| Q-07 | Quelles intégrations sont incontournables ? | Haute |
| Q-08 | Quels éléments sont explicitement hors MVP ? | Haute |
| Q-09 | Quels indicateurs prouvent que le MVP apporte de la valeur ? | Moyenne |

## 13. Gouvernance et usage par Codex

- `PRD.md` définit les **besoins et critères produit**.
- `design.md` définit les **règles UX/UI**.
- `ARCHITECTURE.md` décrit la **solution technique cible**, une fois validée.
- `ADR.md` consigne les **décisions structurantes et leurs justifications**.
- `CODEBASE_GRAPH.md` décrit le **code réellement présent**.
- `ROADMAP.md` organise les **étapes de livraison**.
- `AGENTS.md` définit le **comportement de l'agent**.

Règles de modification :
1. Ne pas transformer un `[À VALIDER]` en exigence sans décision du responsable produit.
2. Avant toute fonctionnalité, relier la tâche à une exigence identifiée (`F-*`, `US-*`, `NFR-*`).
3. Si une demande change le périmètre, proposer un amendement au PRD et préciser son impact.
4. Faire évoluer les critères d'acceptation lorsque le comportement attendu change.
5. Conserver les décisions techniques hors du PRD, dans l'architecture ou les ADR.
6. Ne pas déclarer une fonctionnalité terminée tant que ses critères vérifiables ne sont pas satisfaits.

## 14. Historique

| Version | Date | Modification |
| --- | --- | --- |
| 0.1 | 2026-11-05 | Création du cadre PRD ; métier et MVP à confirmer |
