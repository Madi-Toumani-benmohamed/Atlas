# Atlas — Product Requirements Document (PRD)

> **Produit :** Atlas Portfolio  
> **Statut :** Cadrage fonctionnel validé sur la vision ; arbitrages explicitement ouverts  
> **Version :** 0.2  
> **Date :** 2026-11-05  
> **Responsable produit :** mainteneur du projet  
> **Références :** `AGENTS.md`, `design.md`, `ADR.md` ; `ARCHITECTURE.md`, `ROADMAP.md` et `CODEBASE_GRAPH.md` lorsqu'ils existent.

## 1. Objet et autorité du document

Ce PRD définit **le problème à résoudre, les usages, les exigences fonctionnelles, les limites du MVP et les critères d'acceptation** d'Atlas Portfolio. Il est destiné au responsable produit, aux contributeurs et aux agents de développement (notamment Codex).

- **Ce document fait autorité sur le *quoi* et le *pourquoi*.** Les décisions sur le *comment* relèvent de `ARCHITECTURE.md` et des ADR validés.
- `design.md` fait autorité sur l'identité visuelle et les composants UI, sous réserve des exigences d'utilisabilité et d'accessibilité de ce PRD.
- `AGENTS.md` définit les consignes de travail de l'agent ; `ROADMAP.md` ordonne les livraisons ; `CODEBASE_GRAPH.md` reflète exclusivement le code réellement présent.
- **Aucune exigence marquée `[À ARBITRER]` n'autorise Codex à prendre une décision métier implicite.** Documenter le blocage, proposer des options et demander une décision avant de développer la partie concernée.
- Le PRD ne suppose pas que les fichiers cités existent déjà ni que les fonctionnalités décrites soient implémentées.

## 2. Identité et vision produit

| Élément | Définition |
| --- | --- |
| Nom du projet | Atlas |
| Produit initial | Atlas Portfolio |
| Produit envisagé ultérieurement | Atlas Research, séparé fonctionnellement |
| Proposition de valeur | Visualiser et comprendre ses investissements et ses gains/pertes, sans complexité inutile |
| Public initial | Particulier débutant ou intermédiaire, avec plusieurs placements et comptes |
| Public à terme | Plusieurs utilisateurs indépendants sur une même instance ; autres instances auto-hébergées |
| Usage principal | Consulter quotidiennement la valeur, la variation et le résultat de ses investissements |
| Plateformes | Web responsive sur ordinateur et mobile ; PWA souhaitée |
| Modèle de coût | **0 € de service ou abonnement obligatoire** ; ressources matérielles, connexion et électricité hors de cette promesse |
| Distribution | Open source, auto-hébergement via Docker Compose sur Linux |
| Devise d'affichage initiale | EUR ; prise en charge des actifs et opérations multi-devises |

> **Vision :** Atlas aide les particuliers à savoir ce qu'ils possèdent, combien cela vaut, ce qui monte ou baisse et ce qu'ils gagnent ou perdent réellement, dans une interface riche mais lisible, reposant sur des données traçables.

### 2.1 Principes non négociables

1. **Confiance avant richesse fonctionnelle :** toute valeur financière affichée doit être calculable, datée et explicable.
2. **Densité maîtrisée :** privilégier une hiérarchie visuelle claire plutôt qu'une interface vide ou un cockpit surchargé.
3. **Opérations comme source de vérité :** reconstruire positions et performances depuis les mouvements validés ; ne pas substituer silencieusement des positions saisies à l'historique.
4. **Différencier faits, calculs, estimations et données manquantes.**
5. **Gratuité obligatoire :** aucune fonction critique du MVP ne dépend d'une offre payante ou d'un essai temporaire.
6. **Contrôle des données :** export possible, stockage maîtrisé, sauvegardes et restauration documentées.
7. **Complexité progressive :** informations avancées accessibles à la demande ; ne pas exposer la complexité du moteur sur le dashboard.
8. **Pas de fausse assurance :** ne pas annoncer « en temps réel », « à jour », « synchronisé » ou « sauvegardé » sans preuve.
9. **Aucune incitation au trading :** Atlas Portfolio décrit et suit ; il ne recommande pas automatiquement des achats/ventes et n'exécute aucun ordre.

## 3. Problème et utilisateurs

### 3.1 Situation actuelle

Les outils testés (Ghostfolio et Wealthfolio) ont été jugés trop complexes ou chargés : nombreuses données sans intérêt pour l'usage quotidien, jargon difficile à comprendre, opérations simples perçues comme compliquées et confiance insuffisante. Finary ne correspond pas au critère de gratuité.

L'utilisateur consulte les variations de prix et veut pouvoir décider lui-même s'il investit, conserve ou vend. Une application externe de cours (par exemple CoinMarketCap) peut servir à surveiller un marché, mais elle ne remplace pas le calcul de rentabilité réelle à partir de **ses propres opérations**.

### 3.2 Personas

| Persona | Besoin | Priorité |
| --- | --- | --- |
| Investisseur individuel | Suivre quotidiennement plusieurs portefeuilles, saisir/importer des opérations, comprendre son P&L | P0 |
| Nouvel investisseur | Comprendre les termes et naviguer sans expertise financière préalable | P0 |
| Autre utilisateur de l'instance | Utiliser Atlas avec des données privées indépendantes | P0 pour l'isolation des données ; administration avancée P1 |
| Utilisateur Research | Comparer et analyser de nouveaux investissements | Futur |

### 3.3 Contexte d'usage

- Consultation probablement quotidienne ; durée variable, jusqu'à environ 30 minutes.
- Investissements mêlant court, moyen et long terme.
- Actifs identifiés : actions, ETF, cryptomonnaies, stablecoins ; produits d'épargne : Livret A et PEL.
- Comptes ou services actuellement cités : Coinbase, Trade Republic.
- DCA pratiqué ; besoin futur d'objectifs, d'allocations cibles et de simulations.
- Accès mobile distant attendu ; déploiement cible sur mini-PC Linux conteneurisé.

## 4. Objectifs mesurables et non-objectifs

### 4.1 Objectifs du MVP

- **O-01 — Compréhension :** voir dès l'accueil si le patrimoine suivi progresse ou régresse, de combien, et sur quelle période.
- **O-02 — Consolidation :** agréger plusieurs portefeuilles et comptes, sans double comptabilisation.
- **O-03 — Traçabilité :** comprendre les positions et gains/pertes à partir des opérations et des cotations utilisées.
- **O-04 — Saisie simple :** enregistrer un achat, une vente et les mouvements courants sans jargon non expliqué.
- **O-05 — Migration :** importer des historiques CSV compatibles avec prévisualisation, contrôle et détection de doublons.
- **O-06 — Confiance :** expliciter cours périmés, historiques incomplets, imports ambigus et erreurs de valorisation.
- **O-07 — Souveraineté :** déployer sans abonnement, sécuriser les comptes et exporter toutes les données personnelles utiles.

### 4.2 Indicateurs d'acceptation proposés

Les cibles suivantes sont **des seuils de recette proposés**, à valider lors des premiers essais ; ce ne sont pas des promesses mesurées.

| Indicateur | Cible de recette proposée | Mesure |
| --- | --- | --- |
| Compréhension de l'accueil | Identifier valeur globale et gain/perte sans aide | Test utilisateur observé |
| Ajout d'un achat simple | Réussir sans consulter de documentation | Scénario UX |
| Correction d'une erreur | Retrouver et corriger une opération, puis voir les chiffres recalculés | E2E |
| Exactitude | 100 % des scénarios financiers de référence passent | Tests automatisés avec résultats attendus |
| Protection multi-utilisateur | 0 lecture/écriture inter-utilisateur autorisée sans droit | Tests d'autorisation |
| Transparence des cours | Toute cotation affichée est horodatée et qualifiée | Tests UI/API |
| Exigence de coût | Aucun abonnement requis pour les parcours P0 | Audit des dépendances et conditions d'utilisation |

### 4.3 Non-objectifs du MVP

- Trading automatique ou passage d'ordres.
- Prédictions de marché, recommandations d'achat/vente et assistant IA.
- Analyse fondamentale d'entreprises, comparateurs avancés d'ETF, fil d'actualités intégré.
- Fiscalité française automatisée ou déclarations fiscales.
- Gestion approfondie de la DeFi, produits dérivés, ventes à découvert, emprunt/marge.
- Synchronisation automatique de tous les courtiers/exchanges.
- Éditeur complexe de dashboards et système de plugins.
- Promesse de cotations boursières temps réel si les droits et sources gratuites ne le permettent pas.

## 5. Périmètre fonctionnel et priorisation

Définition : **P0** indispensable au MVP ; **P1** prévu pour V1 ou à la suite du MVP ; **P2** évolution ; **OUT** explicitement exclu du MVP.

| ID | Exigence | Priorité | Livraison |
| --- | --- | --- | --- |
| F-001 | Créer un compte et se connecter de façon sécurisée | P0 | MVP |
| F-002 | Isoler strictement les données de chaque utilisateur | P0 | MVP |
| F-003 | Créer, renommer et archiver des portefeuilles logiques | P0 | MVP |
| F-004 | Rattacher plusieurs comptes à un portefeuille | P0 | MVP |
| F-005 | Consolider tous les comptes/portefeuilles d'un utilisateur | P0 | MVP |
| F-006 | Gérer actions, ETF, crypto et stablecoins | P0 | MVP |
| F-007 | Suivre Livret A/PEL via soldes et opérations explicites, sans simulation trompeuse d'intérêts | P0 | MVP |
| F-008 | Enregistrer achats, ventes, dépôts, retraits, transferts internes, frais et revenus de base | P0 | MVP |
| F-009 | Enregistrer les récompenses simples de staking | P0 | MVP |
| F-010 | Saisir un montant total et calculer la quantité à partir du prix et des frais | P0 | MVP |
| F-011 | Dupliquer, consulter et corriger une opération avec trace d'audit | P0 | MVP |
| F-012 | Importer un CSV compatible avec prévisualisation et contrôle des doublons | P0 | MVP |
| F-013 | Afficher valeur, quantités, PRU, gains/pertes latents et réalisés | P0 | MVP |
| F-014 | Afficher les variations de cours (jour/semaine/mois/année) indépendamment du P&L personnel | P0 | MVP |
| F-015 | Afficher courbes historiques avec dates et limites de couverture explicites | P0 | MVP |
| F-016 | Afficher une répartition actions/ETF/crypto/épargne/liquidités | P0 | MVP |
| F-017 | Afficher les 10 actifs principaux et les meilleures/pires performances | P0 | MVP |
| F-018 | Récupérer et mettre en cache des cours gratuits, avec date, source et fraîcheur | P0 | MVP |
| F-019 | Gérer les devises des opérations et la conversion d'affichage en EUR | P0 | MVP |
| F-020 | Exporter opérations, comptes et portefeuilles dans un format documenté | P0 | MVP |
| F-021 | Mode clair/sombre/automatique, responsive et navigation mobile | P0 | MVP |
| F-022 | Installer avec Docker Compose, sauvegarder et restaurer | P0 | MVP |
| F-023 | Interface d'administration technique minimale sans accès financier implicite | P1 | V1, sauf besoins opérationnels essentiels MVP |
| F-024 | Import PDF de formats connus, extraction vérifiable et rejet des formats inconnus | P1 | V1 / pilote ciblé |
| F-025 | Synchronisation Coinbase en lecture seule, si faisable sans coût récurrent | P1 | V1 |
| F-026 | Connecteur Trade Republic uniquement si interface fiable et autorisée | P2 | Futur |
| F-027 | DCA : versement mensuel cible et suivi de régularité | P1 | V1 |
| F-028 | Allocation cible et détection des écarts | P1 | V1 |
| F-029 | Objectifs de valeur et progression | P1 | V1 |
| F-030 | Comparaison à des benchmarks pertinents | P1 | V1 |
| F-031 | Alertes de concentration, paramétrables et désactivables | P1 | V1 |
| F-032 | Journal de décision lié aux opérations | P1 | V1 |
| F-033 | Simulations de versements et d'allocations, distinguées des prévisions | P1 | V1 |
| F-034 | Réorganisation et personnalisation des blocs du dashboard | P1 | V1 |
| F-035 | Consultation hors connexion des dernières données sauvegardées, horodatées | P1 | V1 ; cache simple possible au MVP |
| F-036 | Atlas Research : données fondamentales, comparaisons, actualités, aide pédagogique | P2 | Futur |
| F-037 | Assistant IA sourcé exploitant uniquement des données autorisées | P2 | Futur |
| F-038 | Swaps crypto, mouvements on-chain et DeFi complexes | P2 | Futur / arbitrage ciblé |
| F-039 | Conseils financiers générés automatiquement et trading automatique | OUT | Hors Portfolio |

**Note de portée :** l'import CSV fait partie du MVP parce que les utilisateurs veulent reprendre leur historique. L'import PDF a été demandé, mais sa fiabilité dépend de formats exacts ; il n'est pas une promesse universelle du MVP. Les récompenses de staking simples sont P0, la modélisation des protocoles DeFi ne l'est pas.

## 6. Parcours utilisateur et critères d'acceptation

### US-001 — Premier accès

**En tant que** nouvel utilisateur, **je veux** créer mon compte, mon premier portefeuille et mon premier compte, **afin de** commencer sans configuration experte.

Critères :
- Le rôle de l'application et la première action sont explicites.
- Un état vide ne présente jamais des gains fictifs comme des données réelles.
- L'utilisateur peut créer un portefeuille, lui rattacher un compte et consulter un état vide cohérent.
- Les prérequis et erreurs de configuration sont indiqués.
- L'interface est utilisable au clavier et sur mobile.

### US-002 — Ajouter un achat (parcours métier central)

**En tant que** détenteur d'un compte, **je veux** enregistrer un achat depuis son montant total ou sa quantité, **afin de** mettre à jour automatiquement ma position.

Scénario nominal :
1. Choisir portefeuille et compte (préremplis lorsque le contexte le permet).
2. Rechercher et sélectionner un actif de façon non ambiguë.
3. Indiquer date, prix, montant ou quantité, et frais éventuels.
4. Voir le résultat calculé et confirmer.
5. Recevoir confirmation seulement après enregistrement effectif.
6. Retrouver l'opération et la position recalculée.

Critères :
- Quantité, prix, total et frais sont cohérents, avec devise visible.
- Les erreurs de saisie et les disponibilités de liquidités insuffisantes sont traitées explicitement ; aucune création de cash fictif en silence.
- Rejouer une requête avec la même clé d'idempotence ne duplique pas l'achat.
- Une opération antidatée force le recalcul des positions concernées.
- Un historique insuffisant pour déterminer le coût de revient produit un état « incomplet », pas un P&L inventé.

### US-003 — Enregistrer une vente

**En tant qu'** utilisateur, **je veux** vendre tout ou partie d'une position et voir mon gain/perte réalisé.

Critères :
- La quantité vendue ne dépasse pas la quantité détenue pour les actifs MVP.
- Les frais de cession diminuent le produit net.
- La vente réduit le coût restant selon la méthode de calcul retenue.
- Le réalisé est distingué du latent.
- Une vente antidatée est réconciliée avec les opérations ultérieures ou rejetée si elle rend l'historique incohérent.

### US-004 — Consulter le tableau de bord

**En tant qu'** utilisateur, **je veux** connaître mon état financier global en quelques secondes.

Critères :
- Valeur consolidée, apports nets, résultat global et périodes sont lisibles.
- Les soldes d'épargne et liquidités contribuent à la valeur totale sans être traités comme des performances boursières.
- Les 10 actifs principaux sont visibles sans obliger à afficher toute la liste.
- Le graphique principal distingue variation de valeur et performance hors flux lorsque disponibles.
- Tout montant partiel ou non fiable est signalé, avec son motif.

### US-005 — Explorer un portefeuille / actif

**En tant qu'** utilisateur, **je veux** comprendre quel actif contribue à ma hausse ou à ma baisse.

Critères :
- Par portefeuille : valeur, positions, répartition, gain/perte et évolution.
- Par actif : quantité, PRU, coût restant, dernier prix, variation du cours et P&L de ma position.
- « Variation du jour » et « depuis mon achat » ne sont jamais fusionnés.
- Les cours anciens et marchés fermés sont indiqués correctement lorsqu'ils sont identifiables.
- Un actif détenu dans plusieurs comptes est consolidable sans perdre le détail par compte.

### US-006 — Importer un CSV

**En tant qu'** utilisateur, **je veux** importer mes achats passés au lieu de les ressaisir.

Critères :
- Seuls des formats de CSV **explicitement supportés et testés** sont acceptés.
- Prévisualisation : lignes reconnues, doublons, lignes rejetées, devises et coûts.
- Les données ambiguës demandent une correction ; aucun import silencieux.
- Réimporter le même fichier n'ajoute pas de doublons.
- Un rapport signale les opérations importées, ignorées et problématiques.
- Les informations de transaction non déterminables ne sont pas inventées.

### US-007 — Corriger une opération

**En tant qu'** utilisateur, **je veux** corriger une date, un montant ou un actif erroné.

Critères :
- Conséquences visibles avant validation lorsque pertinentes.
- Changement audité et attribution à l'utilisateur.
- Les positions et courbes touchées sont recalculées.
- Les contraintes restent valides après correction.
- Pas de succès affiché avant la confirmation serveur.

### US-008 — Suivre l'épargne

**En tant qu'** utilisateur, **je veux** suivre Livret A et PEL dans ma valeur consolidée.

Critères :
- Dépôts, retraits, intérêts effectivement crédités et solde sont distingués.
- Un taux ou intérêt attendu n'est pas présenté comme un rendement acquis.
- L'historique de solde reste consultable et explicable.

### US-009 — Séparer les utilisateurs

**En tant qu'** utilisateur, **je veux** que mes comptes et mes opérations ne soient visibles que par moi.

Critères :
- Autorisations vérifiées côté serveur sur toute lecture et écriture.
- Les identifiants directs d'un autre utilisateur ne permettent pas d'accéder à ses ressources.
- L'administrateur technique ne dispose pas automatiquement d'un accès financier transversal.
- Exports et fichiers importés suivent les mêmes règles d'isolation.

### US-010 — Comprendre la fiabilité des données

**En tant qu'** utilisateur, **je veux** savoir d'où vient une valeur et si elle est à jour.

Critères :
- Dernier cours, fournisseur, heure d'observation, devise et statut de fraîcheur identifiables.
- Les taux de change manquants et historiques incomplets sont signalés.
- Aucun zéro n'est substitué à une donnée manquante comme s'il s'agissait d'une valeur réelle.
- Une indisponibilité temporaire de fournisseur n'efface pas les dernières valeurs valides.

## 7. Règles financières et intégrité métier

Ces règles expriment les **résultats attendus**. Les algorithmes, modèles physiques et composants techniques sont définis séparément.

### 7.1 Transactions, liquidités et comptes

- Les positions sont dérivées de transactions validées et de leurs mouvements associés.
- Les opérations sont datées (date/heure effective) et traçables (date d'enregistrement et source).
- Un achat transforme du cash en actif ; **il ne constitue pas un nouvel apport externe**.
- Un dépôt/retrait externe affecte les apports nets ; un transfert interne entre comptes du même périmètre consolidé ne modifie pas les apports nets globaux.
- Les frais et revenus sont comptabilisés une seule fois, au bon compte et dans la bonne devise.
- Q-02 validée le 2026-11-06 : ouvertures explicites, aucun découvert ni vente à découvert ; résultat global masqué pour un historique incomplet. Voir `docs/decisions/financial-policy.md`.
- Tout actif doit être identifié sans ambiguïté (le ticker seul ne suffit pas systématiquement).

### 7.2 Valeur, coût de revient et P&L

- **Valeur d'une position** = quantité détenue × dernier cours utilisable dans sa devise, puis conversion dans la devise d'affichage.
- **P&L latent** = valeur actuelle − coût de revient restant, à périmètre et devises cohérents.
- **P&L réalisé** = recettes nettes des ventes − coût attribué aux quantités vendues.
- Méthode économique de référence proposée pour MVP : **coût moyen pondéré (CMP)**, frais d'acquisition inclus ; choix fiscal et cas particuliers restent hors MVP.
- **Valeur consolidée** = valeurs des actifs + soldes de liquidités + soldes d'épargne, après élimination des doubles comptes.
- **Résultat global depuis une valeur initiale nulle et un historique exhaustif** = valeur actuelle − apports externes nets ; en cas d'historique incomplet ou de solde d'ouverture, adapter le calcul à l'état initial connu et **l'indiquer**.
- Il est interdit de présenter mécaniquement `(valeur actuelle − apports nets) / apports nets` comme un rendement financier universel.
- Gains réalisés, latents, revenus et frais doivent être distinguables et réconciliables sans double comptage.

### 7.3 Évolution temporelle

- Afficher les variations du jour, de la semaine, du mois, de l'année et depuis le début lorsque les historiques permettent leur calcul.
- Séparer **variation du prix d'un actif** et **rentabilité de la position personnelle**.
- La courbe historique d'un portefeuille utilise les positions **détenues à la date considérée**, les prix et taux de change historiques correspondants.
- La performance comparée entre périodes doit tenir compte des entrées/sorties d'argent ; une métrique de type TWR est envisagée lorsque les données le permettent.
- Ne pas créer de séries historiques fictives pour combler des périodes non couvertes.
- La période par défaut doit favoriser la lecture long terme ; la valeur exacte est **[À ARBITRER — Q-08]**.

### 7.4 Devises, prix et précision

- Conserver devise et montant d'origine de chaque opération.
- Convertir en EUR pour la synthèse selon des taux de change datés et traçables.
- Préserver la précision nécessaire aux fractions d'actions et quantités crypto ; n'arrondir pour l'affichage qu'après calcul.
- Chaque cours est associé à une source, une heure d'observation et un statut : valide/récent, différé, périmé ou indisponible, selon une politique documentée.
- Une donnée absente ne peut pas être remplacée par un prix arbitraire ou par zéro sans signalement.
- Les cours boursiers « temps réel » ne peuvent être promis sans source gratuite et droits d'utilisation adéquats.

### 7.5 Épargne et staking

- Livret A et PEL : comptes valorisés par solde et mouvements enregistrés ; intérêts reconnus lorsqu'ils sont effectivement enregistrés, sauf mode distinct explicitement étiqueté « estimation ».
- Récompenses simples de staking : enregistrer la quantité reçue, l'actif, la date, le compte et, lorsqu'elle est disponible, la valeur de référence à la date de réception.
- Q-03 validée le 2026-11-06 : cours daté à réception, reconnu comme revenu et coût d’acquisition économique ; tests spécifiques obligatoires, aucun traitement fiscal revendiqué.
- Les swaps crypto et la DeFi complexe ne doivent pas être improvisés dans un modèle initial conçu seulement pour achats/ventes.

## 8. UX et interface

`design.md` est la source de vérité sur les tokens, la palette et les composants. Ce PRD impose les résultats UX suivants :

- Interface riche mais hiérarchisée ; mode sombre soigné en priorité, plus mode clair et automatique.
- Accueil centré sur : valeur totale, résultat positif/négatif, évolution, portefeuilles, répartition et actifs remarquables.
- Un grand graphique principal et des visualisations secondaires utiles, pas une forêt d'indicateurs.
- Dix actifs maximum affichés par défaut dans le bloc principal, avec accès au reste.
- États `empty`, `loading`, `success`, `error`, `disabled`, ainsi que `stale`, `partial` ou `unavailable` pour les données financières.
- Explication accessible des notions comme PRU, P&L latent/réalisé et variation quotidienne.
- Sélecteurs de période et tri accessibles, périodes explicitement indiquées.
- Transitions soignées et utiles, respectant `prefers-reduced-motion`.
- Navigation clavier, focus visible, contrastes lisibles, labels sémantiques ; la couleur seule ne porte jamais le sens d'un gain/perte.
- Pas de données d'exemple présentées comme des données de compte réelles.
- Navigation mobile responsive ; consultation quotidienne possible depuis un téléphone.

### 8.1 Architecture d'information proposée

| Espace | Usage |
| --- | --- |
| Accueil | Synthèse consolidée, graphiques, performances et état des données |
| Portefeuilles | Regroupements logiques, comptes et positions |
| Actifs | Vue consolidée par actif et détails des positions |
| Activité | Historique, saisie, corrections et imports |
| Paramètres | Profil, préférences, export et configuration |
| Administration | Santé de l'instance, utilisateurs, fournisseurs et sauvegardes, selon les autorisations |

La navigation définitive relève de la conception UX ; ne pas ajouter des pages sans usage identifié.

## 9. Sécurité, données personnelles et administration

- Authentification par comptes utilisateurs dès le MVP ; aucune lecture anonyme de données financières privées.
- Isolation stricte des comptes, portefeuilles, opérations, exports et imports entre utilisateurs.
- Contrôles d'accès côté serveur, validation des entrées, protection des sessions et prévention des abus.
- Aucune clé API, secret ou jeton dans le navigateur, les logs ou le dépôt.
- Connexions externes avec privilèges minimaux et en lecture seule lorsqu'elles seront ajoutées.
- Chiffrement disque et sauvegardes chiffrées privilégiés ; mesures concrètes spécifiées dans l'architecture.
- Sauvegarde quotidienne souhaitée ; **restauration vérifiable**, pas seulement existence d'une archive.
- Export intégral des données utilisateur dans un format documenté.
- L'administration technique ne permet pas automatiquement de lire les investissements privés ; règles et opérations administratives auditées.
- Prévoir un chemin vers suppression de compte/données et conformité de l'instance publique ; politique exacte **[À ARBITRER]**.
- Les futures fonctions IA nécessiteront consentement explicite pour toute transmission de données financières à un service externe.

## 10. Exigences non fonctionnelles (NFR)

| ID | Domaine | Exigence | Vérification |
| --- | --- | --- | --- |
| NFR-01 | Exactitude | Calculs déterministes, scénarios de référence reproductibles | Tests unitaires métier |
| NFR-02 | Intégrité | Une opération ne peut être enregistrée partiellement | Tests transactionnels |
| NFR-03 | Idempotence | Retries et réimports n'engendrent pas de doublons | Tests d'intégration |
| NFR-04 | Sécurité | Isolation multi-utilisateur sur chaque ressource | Tests d'autorisation |
| NFR-05 | Confidentialité | Secrets protégés ; logs sans données sensibles | Revue et scans |
| NFR-06 | Disponibilité partielle | Indisponibilité d'une API de cours sans perte d'historique | Tests de panne |
| NFR-07 | Traçabilité | Cours, imports, corrections et calculs explicables | Tests API et UI |
| NFR-08 | UX | Parcours d'achat compréhensible ; erreurs récupérables | Tests E2E/usabilité |
| NFR-09 | Accessibilité | Clavier, focus, sémantique, contraste, mouvement réduit | Audits automatisés et manuels |
| NFR-10 | Portabilité | Installation conteneurisée Linux documentée | Test d'installation vierge |
| NFR-11 | Sauvegarde | Sauvegarde chiffrée et restauration testée | Exercice de restauration |
| NFR-12 | Performance | Dashboard fluide avec un historique personnel représentatif | Mesures sur machine de référence |
| NFR-13 | Maintenance | Qualité, tests, documentation et migrations rejouables | CI et revue |
| NFR-14 | Coût | Aucun service payant essentiel | Revue des fournisseurs/licences |
| NFR-15 | Design | Respect des règles de `design.md` | Inspection visuelle |

Les budgets chiffrés de latence, charge concurrente et volume restent à définir sur une machine de référence ; **ne pas inventer de SLO**.

## 11. Sources de données et intégrations

### MVP

- Cours et historiques gratuits, avec couverture vérifiée pour les actifs pilotes ; fonctionnement dégradé prévu.
- Import CSV sur formats **nommés et testés**, et saisie manuelle toujours disponible.
- Données d'épargne saisies ou importées sans simuler une connexion bancaire inexistante.
- Cache, source et fraîcheur visibles ; fréquence de rafraîchissement choisie en fonction des droits, quotas et possibilités réels.

### V1 ou ultérieur

- Import PDF ciblé, avec validation des extractions.
- Coinbase en lecture seule si les permissions, les limites et le coût le permettent.
- Trade Republic : pas d'automatisation non officielle exigeant les identifiants utilisateur ou contournant des protections.
- Comparaison aux indices et actualités selon des sources effectivement accessibles.

**Dépendance bloquante pour un périmètre actif donné :** si aucune source gratuite et autorisée ne permet de valoriser correctement un actif, Atlas doit le signaler et prévoir un prix manuel traçable ou limiter la couverture, plutôt que présenter une valeur trompeuse.

## 12. Critères d'acceptation du MVP (Definition of Done produit)

Le MVP est livrable seulement si toutes les conditions suivantes sont vérifiées :

1. Connexion utilisateur et isolation des données opérationnelles entre deux comptes de test.
2. Création de plusieurs portefeuilles et comptes, puis synthèse consolidée sans doublons.
3. Ajout d'achats et ventes avec frais, dates, devises et validation compréhensible.
4. Dépôts, retraits, transferts, dividendes et récompenses simples de staking pris en charge selon les règles définies.
5. PRU, quantités et P&L exacts sur une batterie de scénarios validés, y compris ventes partielles et opérations antidatées.
6. Affichage de la valeur, résultat, répartition et classement des actifs sur desktop et mobile.
7. Cours et taux datés ; gestion explicite des marchés fermés, prix anciens et actifs non couverts.
8. Import CSV supporté avec prévisualisation, doublons, rejets et rapport.
9. Correction d'une opération traçable ; historiques recalculés.
10. Export intégral documenté et réimport ou lecture externe possible des données exportées.
11. Sauvegarde et restauration démontrées sur l'environnement cible.
12. Tests métier, intégration, E2E, sécurité, lint, typage et build exécutés et résultats consignés.
13. Interface conforme à `design.md`, états d'échec et de chargement utilisables, parcours clavier et mobile vérifiés.
14. Aucune dépendance indispensable à une offre payante ni fonctionnalité factice affichée comme connectée.
15. Écarts connus, couverture des cours, limites financières et décisions restantes documentés.

### 12.1 Jeux de tests métier minimaux

| ID | Cas | Résultat attendu |
| --- | --- | --- |
| T-01 | Achat 5 × 100 €, puis 5 × 120 €, sans frais | 10 unités ; CMP 110 € |
| T-02 | Cours de 125 € après T-01 | Valeur 1 250 € ; P&L latent +150 € |
| T-03 | Vente de 4 unités après T-01 | 6 unités restantes ; coût restant 660 €, avant autres événements |
| T-04 | Dépôt de 1 000 €, puis achat de 1 000 € | Un seul apport externe de 1 000 € |
| T-05 | Transfert interne de 200 € | Valeur consolidée inchangée, hors frais |
| T-06 | Import répété du même lot | Aucune opération supplémentaire |
| T-07 | Correction d'un achat antidaté | Recalcul des positions et valorisations impactées |
| T-08 | Cours manquant / obsolète | État de qualité explicite, pas de valeur inventée |
| T-09 | Tentative d'accès au portefeuille d'autrui | Accès refusé côté serveur |
| T-10 | Valeur USD avec conversion EUR | Conversion fondée sur taux daté et source identifiée |
| T-11 | Staking reçu en crypto | Quantité augmentée et événement enregistré, selon politique de coût validée |
| T-12 | Intérêts d'épargne crédités | Solde augmenté, sans les faire passer pour plus-value boursière |

## 13. Risques et arbitrages

| ID | Risque / incertitude | Conséquence | Réponse attendue |
| --- | --- | --- | --- |
| R-01 | Temps réel gratuit non disponible pour toutes les places | Promesse produit incompatible avec coût zéro | Accepter le différé clairement identifié |
| R-02 | Historique de transactions incomplet | P&L incorrect | Bloquer les indicateurs non fiables et résoudre les soldes d'ouverture |
| R-03 | Formats CSV/PDF changeants | Imports erronés | Adaptateurs versionnés, tests de fixtures, aperçu |
| R-04 | Swaps et staking à coût complexe | Incohérences financières | Périmètre limité et règles explicites avant code |
| R-05 | Multiplicité des produits (PEA, crypto, épargne) | Surcharge du MVP | Parcours communs, particularités modélisées sans mélange des rendements |
| R-06 | Multi-utilisateur public | Risques de confidentialité | Tests d'isolation et accès administrateur borné |
| R-07 | Design riche | Bruit visuel similaire aux concurrents | Revue UX sur scénarios réels et hiérarchie stricte |
| R-08 | Multiplication des fonctionnalités futures | MVP interminable | Règles P0/P1/P2 et refus du hors-scope |
| R-09 | Licence ou quota des données gratuites | Rupture de valorisation | Fournisseurs interchangeables et dégradation explicite |

### Questions ouvertes prioritaires

- **Q-01 [Choix délégué le 2026-11-06] :** exports Coinbase avec ID et Trade Republic transactions à 23 colonnes retenus ; [périmètre exact des adaptateurs](docs/formats/broker-csv.md). Tests synthétiques ; compatibilité avec chaque variante réelle non garantie.
- **Q-02 [Résolue le 2026-11-06] :** ouvertures explicites, aucun découvert ni vente à découvert ; résultat global masqué si l’historique est incomplet. Contrat validé : `docs/decisions/financial-policy.md`.
- **Q-03 [Résolue le 2026-11-06] :** cours daté à réception, reconnu comme revenu et coût d’acquisition économique. Contrat validé : `docs/decisions/financial-policy.md`.
- **Q-04 [Résolue le 2026-11-06] :** swaps non pris en charge ; signalement en anomalie sans conversion automatique. Contrat validé : `docs/decisions/financial-policy.md`.
- **Q-05 [Bloquante pour les cours] :** quels titres/ETF pilotes et places de marché doivent absolument être couverts gratuitement ?
- **Q-06 [Haute] :** quels fournisseurs de marché sont utilisables légalement pour l'auto-hébergement et la distribution open source ?
- **Q-07 [Haute] :** quelles données les produits d'épargne doivent-ils afficher en l'absence d'import automatisé ?
- **Q-08 [Moyenne] :** « depuis le début » ou « 1 an » comme période par défaut du graphique principal ?
- **Q-09 [Haute] :** quel niveau de consultation hors ligne est attendu au MVP vs V1 ?
- **Q-10 [Haute] :** quelles règles de suppression de compte et de conservation des exports pour une instance multi-utilisateur publique ?

**Règle de démarrage :** Codex peut construire le squelette, la navigation, les tests et les entités non ambiguës. Il ne doit pas implémenter une règle financière touchée par une question bloquante sans décision explicite et ADR ou documentation correspondante.

## 14. Roadmap produit

| Phase | Résultat attendu | Dépendances |
| --- | --- | --- |
| 0 — Contrats | PRD validé, scénarios métiers, décisions critiques, maquettes | Arbitrages Q-02/Q-03 et couverture cours pilote |
| 1 — Socle | Utilisateurs, portefeuilles, comptes, opérations, autorisations | Modèle et tests de transactions |
| 2 — Calculs | Positions, cash, coût moyen, P&L, prix, FX, courbes | Jeux de tests financiers |
| 3 — Interface | Dashboard, portefeuilles, actifs, activité, saisie | Contrats API stables |
| 4 — Migration | Imports CSV pilotes, corrections, rapprochement | Échantillons anonymisés et fixtures |
| 5 — Publication MVP | Docker Compose, sauvegardes, exports, documentation | Audit sécurité et recette |
| 6 — V1 | Objectifs, DCA, benchmark, alertes, personnalisation, imports PDF ciblés | Usage réel du MVP |
| 7 — Research | Analyse fondamentale, actualités et IA explicable | Sources et gouvernance des données |

## 15. Gouvernance Codex et gestion des modifications

1. Toute tâche de développement cite au moins une exigence `F-*`, une user story `US-*` ou une exigence `NFR-*`.
2. L'agent ne peut pas transformer une question ouverte en décision sans validation du responsable produit.
3. Une modification de périmètre nécessite amendement du PRD et, si nécessaire, ADR.
4. `PRD.md` décrit l'intention et les résultats, `ARCHITECTURE.md` et les ADR décrivent les choix d'implémentation.
5. Avant toute déclaration « terminé », fournir les tests et critères d'acceptation vérifiés, les écarts connus et les limites de données.
6. Les mocks et données de démonstration ne peuvent jamais être confondus avec un produit connecté à des sources réelles.
7. `CODEBASE_GRAPH.md`, s'il existe, est généré ou maintenu à partir de la réalité du dépôt, jamais à partir de la vision future.
8. Tout développement qui dégrade la lisibilité ou la confiance dans les montants doit être corrigé avant ajout de fonctions secondaires.

## 16. Historique

| Version | Date | Modification |
| --- | --- | --- |
| 0.1 | 2026-11-05 | Canevas initial de PRD, périmètre métier à définir |
| 0.2 | 2026-11-05 | Cadrage Atlas Portfolio fondé sur les réponses utilisateur ; MVP/V1/Futur, parcours, règles et recette |
