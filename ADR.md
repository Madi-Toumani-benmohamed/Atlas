# Atlas — Architecture Decision Records (ADR)

> Registre des décisions structurantes du projet Atlas.
> Les ADR expliquent **pourquoi** un choix a été fait, les alternatives envisagées et ses conséquences. Ils ne remplacent ni `ARCHITECTURE.md` (architecture cible), ni `CODEBASE_GRAPH.md` (état vérifié du code).

## 1. Principes

- Documenter une décision lorsqu'elle est **structurante, difficile à inverser ou susceptible d'être remise en question**.
- Décrire les compromis avec précision ; ne pas présenter une hypothèse comme une décision validée.
- Rédiger un ADR **avant l'implémentation** quand c'est possible, sinon dans la même livraison.
- Privilégier une décision courte, vérifiable et compréhensible sans lire toute l'historique du projet.
- Ne jamais réécrire l'histoire d'une décision : créer un nouvel ADR qui remplace l'ancien.
- Ne pas créer d'ADR pour les détails locaux, choix de nommage, corrections de bugs ou ajustements purement visuels.

## 2. Statuts

| Statut | Signification |
| --- | --- |
| `proposed` | Choix étudié, non approuvé ; ne constitue pas une instruction d'implémentation. |
| `accepted` | Décision approuvée, applicable au périmètre indiqué. |
| `deprecated` | Décision conservée à titre historique, mais déconseillée pour de nouveaux usages. |
| `superseded` | Décision remplacée par un autre ADR, identifié explicitement. |
| `rejected` | Proposition étudiée et écartée. |

**Règle d'approbation :** Codex peut préparer un ADR en `proposed`. Il ne passe pas une décision structurante à `accepted` sans validation explicite du responsable du projet, sauf si la décision a déjà été explicitement fournie par celui-ci dans une instruction faisant autorité.

## 3. Quand créer un ADR ?

Exemples pertinents :

- Choix du langage, du framework, de la base de données ou du mode de déploiement.
- Choix entre monolithe modulaire, services séparés ou autre découpage majeur.
- Stratégie d'authentification, d'autorisation, de chiffrement ou de stockage des secrets.
- Contrats d'API ou d'événements et stratégie de versionnement.
- Choix de persistance, synchronisation, cache, tâches asynchrones ou intégrations structurantes.
- Décisions importantes sur la confidentialité, la sécurité, la résilience et la gestion des données.

Un ADR n'est généralement pas nécessaire pour une dépendance utilitaire triviale, un refactoring purement interne ou l'ajout d'un composant d'interface respectant `design.md`.

## 4. Organisation et nommage

Pour démarrer, ce fichier `ADR.md` sert de **registre et de modèle**. Lorsque les décisions se multiplient, les fiches sont créées dans `docs/adr/` :

```text
atlas/
├── AGENTS.md
├── design.md
├── ARCHITECTURE.md             # Architecture cible, si disponible
├── CODEBASE_GRAPH.md           # Cartographie du code existant
├── ADR.md                      # Registre + règles + modèle
└── docs/
    └── adr/
        ├── 0001-titre-court.md
        ├── 0002-titre-court.md
        └── ...
```

- Numéro séquentiel sur quatre chiffres, jamais réutilisé.
- Nom en `kebab-case`, stable après publication.
- Un fichier par décision ; ne pas regrouper des choix indépendants.
- Le registre ci-dessous est mis à jour à chaque création ou changement de statut.
- Les liens sont relatifs afin de fonctionner dans GitHub et les éditeurs Markdown.

## 5. Registre des décisions

Aucune décision technique n'est considérée comme validée à la création de ce document.

| ID | Décision | Statut | Date | Remplace |
| --- | --- | --- | --- | --- |
| — | Aucune décision enregistrée | — | — | — |

> Lors du premier ADR, remplacer la ligne de placeholder par un lien : `[0001](docs/adr/0001-titre-court.md)`.

## 6. Modèle d'une fiche ADR

Copier ce modèle dans `docs/adr/NNNN-titre-court.md` et remplacer tous les champs entre chevrons.

````markdown
# ADR-NNNN — <Titre de la décision>

- **Statut :** proposed
- **Date :** YYYY-MM-DD
- **Décideur :** <Responsable ou équipe>
- **Portée :** <Modules / services / domaines concernés>
- **Remplace :** Aucun
- **Remplacé par :** Aucun

## Contexte

<Problème réel, contraintes, objectifs et éléments factuels.>

## Décision proposée / retenue

<Choix précis, limites, règles d'application.>

## Alternatives étudiées

| Option | Avantages | Inconvénients | Motif du choix ou du rejet |
| --- | --- | --- | --- |
| <Option A> | ... | ... | ... |
| <Option B> | ... | ... | ... |

## Conséquences

- **Bénéfices :** <...>
- **Coûts / compromis :** <...>
- **Risques et mitigations :** <...>
- **Impacts sécurité / confidentialité :** <... ou « sans impact identifié » justifié>
- **Impacts exploitation / maintenance :** <...>

## Vérification

<Conditions observables permettant de vérifier que la décision est appliquée.>

## Références

- <Liens vers code, PR, documentation ou mesures, si disponibles.>
````

## 7. Workflow Codex

1. Lire `AGENTS.md`, les ADR `accepted` pertinents et l'architecture existante avant tout changement structurant.
2. Vérifier les faits dans le dépôt et identifier les contraintes réelles.
3. Si plusieurs options majeures sont possibles, proposer un ADR `proposed` avec compromis et recommandation.
4. Attendre validation avant d'adopter une décision structurante non autorisée.
5. Une fois la décision validée, passer l'ADR à `accepted`, implémenter et ajouter des vérifications ciblées.
6. Mettre à jour le registre dans `ADR.md` et, si nécessaire, `ARCHITECTURE.md` et `CODEBASE_GRAPH.md`.
7. Lors d'un changement de direction, créer un nouvel ADR `accepted` référencé par l'ancien, puis marquer l'ancien `superseded`.
8. Dans la synthèse de livraison, mentionner les ADR créés, approuvés, remplacés ou restant à arbitrer.

## 8. Cohérence documentaire

- `AGENTS.md` : règles de conduite de l'agent et workflow de développement.
- `PRD.md` : besoins produit, comportement attendu, priorités.
- `design.md` : design system et principes UX/UI.
- `ARCHITECTURE.md` : vue consolidée des choix techniques actuels.
- `CODEBASE_GRAPH.md` : topologie réelle du dépôt, vérifiée dans le code.
- `ADR.md` et `docs/adr/` : historique des décisions et de leurs justifications.

En cas de désaccord entre la documentation et le code, **constater l'écart et le signaler** : le code décrit l'état exécuté, mais ne suffit pas à annuler silencieusement une décision `accepted`. Corriger l'implémentation ou faire approuver une nouvelle décision selon le cas.
