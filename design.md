# Atlas Portfolio — Design System

> **Direction :** Midnight Observatory  
> **Version :** 2.0 — 2026-11-05  
> **Statut :** spécification UX/UI de référence proposée, alignée avec `PRD.md` v0.2  
> **Audience :** design, frontend, Codex, contributeurs

## 1. Rôle et autorité

Ce document est la **source de vérité visuelle et interactionnelle** d'Atlas Portfolio : tokens, composants, composition, graphiques, responsive, accessibilité et retours d'état. Il ne crée **aucune fonctionnalité métier**. `PRD.md` définit le périmètre et les règles produit ; `ROADMAP.md` définit l'ordre de livraison ; les ADR acceptés et `ARCHITECTURE.md` définissent les décisions techniques ; `AGENTS.md` encadre le travail des agents.

**Vision :** un observatoire personnel des investissements. Atlas permet de voir immédiatement la valeur, les gains/pertes et les mouvements de ses portefeuilles, puis d'approfondir à la demande. L'application doit être **riche, mais hiérarchisée** : ni interface vide ni cockpit saturé d'indicateurs.

**Signature émotionnelle :** calme, précision, maîtrise, plaisir d'utilisation. Références de qualité : finition de Linear, rapidité de Raycast, lisibilité des interfaces financières modernes ; **ne pas les copier**.

**Principe non négociable :** une belle interface qui affiche une donnée financière fausse ou ambiguë est une mauvaise interface. Aucune donnée fictive ne doit paraître réelle hors d'un environnement de démonstration explicitement signalé.

## 2. Principes UX

1. **Compréhension immédiate :** valeur consolidée, gain/perte et évolution visibles sans exploration préalable.
2. **Progressive disclosure :** détails, métriques et actions secondaires accessibles sans envahir l'accueil.
3. **Une valeur, un contexte :** indiquer la période, la devise et la nature du chiffre (cours du jour, P&L latent, rendement total, etc.).
4. **Séparer marché et portefeuille :** « variation du cours » ne signifie jamais « gain personnel ».
5. **Lisibilité dense :** privilégier des listes comparables à des grilles de cartes répétitives ; aligner nombres et unités.
6. **Traçabilité accessible :** dernier cours, fournisseur, horodatage et état de fraîcheur à portée d'un clic ou d'une interaction explicite.
7. **Saisie sans friction :** formulaires guidés, champs pertinents seulement, validation honnête.
8. **Fiabilité avant spectaculaire :** jamais de graphiques factices, projections déguisées en faits ou indicateurs sans données suffisantes.
9. **Mobile réellement utilisable :** priorité à la lecture et à l'enregistrement d'une opération, pas à la reproduction miniature du desktop.
10. **Accessibilité native :** keyboard, contrastes, focus, lecteurs d'écran et réduction des mouvements.

## 3. Identité visuelle

### 3.1 Couleurs — dark (tokens canoniques)

| Token | Valeur | Usage |
| --- | --- | --- |
| `--bg-canvas` | `#0B0F14` | Fond de page |
| `--bg-sidebar` | `#0F141B` | Navigation |
| `--bg-surface` | `#141B23` | Panneaux et cartes |
| `--bg-raised` | `#1B2530` | Surfaces interactives |
| `--bg-overlay` | `#222E3B` | Popovers/dialogues |
| `--text-primary` | `#EDF3F6` | Montants et titres |
| `--text-secondary` | `#A3B1BE` | Libellés et descriptions |
| `--text-tertiary` | `#778695` | Métadonnées |
| `--border-subtle` | `#26313D` | Séparateurs |
| `--border-strong` | `#394958` | Contrôles |
| `--accent` | `#67E2CF` | Action primaire, sélection |
| `--accent-hover` | `#8DEBDD` | Survol |
| `--accent-pressed` | `#46C7B3` | Pression |
| `--accent-tint` | `rgba(103,226,207,.10)` | Fond sélectionné |
| `--accent-border` | `rgba(103,226,207,.28)` | Bordure sélectionnée |
| `--accent-ink` | `#09231F` | Texte sur bouton accent |
| `--secondary-accent` | `#B6A4F6` | Comparaison, séries secondaires |
| `--success` | `#6DD6A4` | Variation positive selon contexte |
| `--warning` | `#F1C27D` | Incertitude, ancienneté |
| `--danger` | `#F28F93` | Variation négative ou erreur selon contexte |
| `--focus-ring` | `#9DF5E7` | Focus clavier |

### 3.2 Couleurs — light

| Token | Valeur |
| --- | --- |
| `--bg-canvas` | `#F5F7F8` |
| `--bg-sidebar` | `#EDF1F3` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-raised` | `#E8F0F2` |
| `--bg-overlay` | `#FFFFFF` |
| `--text-primary` | `#15212B` |
| `--text-secondary` | `#4B5C68` |
| `--text-tertiary` | `#637380` |
| `--border-subtle` | `#DCE4E8` |
| `--border-strong` | `#BBC9D0` |
| `--accent` | `#087B70` |
| `--accent-hover` | `#06685F` |
| `--accent-pressed` | `#05564E` |
| `--accent-tint` | `rgba(8,123,112,.08)` |
| `--accent-border` | `rgba(8,123,112,.24)` |
| `--accent-ink` | `#FFFFFF` |
| `--secondary-accent` | `#7053B1` |
| `--success` | `#166B48` |
| `--warning` | `#935B12` |
| `--danger` | `#AE3541` |
| `--focus-ring` | `#087B70` |

- Le turquoise est **l'accent de navigation/action**, pas la couleur universelle des gains ; le positif et le négatif utilisent leur sémantique propre.
- Utiliser texte, signe `+`/`−`, flèches et libellés en complément des couleurs ; ne jamais communiquer uniquement par vert/rouge.
- Un **résultat négatif** et une **erreur système** peuvent partager une famille chromatique, mais se distinguent par la formulation et l'iconographie.
- Pas de gradients de pleine page, néons agressifs ou glassmorphism sur les données.
- Thèmes `dark`, `light`, `system` ; mémoriser la préférence utilisateur. Le sombre est l'identité principale, le clair est entièrement supporté.

### 3.3 Typographie

- UI : `Inter`, repli `system-ui, sans-serif`.
- Titres : `Manrope`, repli `Inter, system-ui, sans-serif`.
- Nombres financiers : `Inter` avec `font-variant-numeric: tabular-nums` ; `JetBrains Mono` uniquement pour identifiants techniques/code, pas pour toutes les sommes.
- Hiérarchie : display `32/40`, H1 `26/34`, H2 `20/28`, H3 `16/24`, body `14/22`, secondaire `13/19`, métadonnées `12/18` (px).
- Montant principal : 32–40 px desktop ; 28–34 px mobile ; ne jamais sacrifier la lisibilité d'un montant long.
- Éviter tout texte crucial en 12 px ; à 200 % de zoom, l'information doit rester accessible.
- Nombres alignés à droite dans tableaux et listes comparatives, avec chiffres tabulaires.

### 3.4 Espacement et surfaces

- Grille 4 px ; espacements `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` px.
- Panneaux : rayon 14 px ; grandes surfaces : 18 px ; champs/menus : 10 px ; petites pastilles : 6 px.
- Boutons/champs : hauteur standard 40 px ; cible tactile visée 44 × 44 px.
- Sidebar desktop : 252 px déployée / 68 px compacte. Header : 60 px.
- Padding page : 32 px desktop / 20 px tablette / 16 px mobile.
- Les panneaux se séparent en priorité par surface et bordure subtile, pas par empilement de grandes ombres.

### 3.5 Signature Atlas

Un petit motif de constellation/orbite peut apparaître sur l'icône, l'onboarding et les empty states. Il ne doit ni concurrencer les chiffres ni se transformer en graphique d'investissement fictif.

## 4. Architecture de l'information

La navigation principale du MVP suit `PRD.md` :

| Destination | Question utilisateur | Contenu prioritaire |
| --- | --- | --- |
| **Accueil** | « Où en suis-je ? » | Valeur consolidée, P&L, courbe, répartition, portefeuilles, top 10 |
| **Portefeuilles** | « Où sont détenus mes investissements ? » | Regroupements logiques, comptes, liquidités, positions |
| **Actifs** | « Qu'est-ce qui monte ou baisse ? » | Liste/filtre, cours vs performance personnelle, fiche actif |
| **Activité** | « Qu'ai-je fait ? » | Opérations, filtres, détails, duplication, correction et imports selon phase |

- **Administration** et **Paramètres** sont secondaires et soumis aux autorisations. Ne pas introduire un onglet Research ou un assistant IA avant leur phase dans le PRD.
- Desktop : sidebar persistante ; zone centrale flexible ; panneau de détail optionnel uniquement s'il est utile.
- Mobile : barre de navigation inférieure ou navigation équivalente visible, actions prioritaires accessibles au pouce, tableaux convertis en lignes compactes ; ne pas dépendre du hover.
- Tablette : navigation compacte, grille à colonnes réduites.
- Recherche et raccourcis (`Ctrl/Cmd+K`) possibles pour les contenus *implémentés*, mais la command palette n'est pas une obligation MVP.
- Le dashboard peut devenir personnalisable en V1 ; **ne pas développer le drag-and-drop au MVP**.

## 5. Écrans de référence et composition

### 5.1 Accueil / Dashboard (MVP)

**Ordre recommandé au premier affichage :**

1. Header : titre « Vue d'ensemble », date/heure de dernière actualisation, action « Ajouter une opération ».
2. Hero : **valeur totale consolidée** en EUR et **gain/perte total** en EUR et %. Libellé temporel explicite. Si la valeur est partielle, la qualifier directement.
3. Graphique principal : évolution historique sur une période clairement sélectionnée ; valeur vs performance si le PRD et les données le permettent. La période par défaut longue reste à arbitrer (PRD Q-08).
4. Synthèse des portefeuilles : cartes compactes ou lignes avec nom, valeur, gain/perte et état de donnée.
5. Allocation : répartition actions, ETF, crypto, épargne et liquidités ; catégories non applicables masquées, jamais inventées.
6. Mes actifs : jusqu'à **10 lignes** et action « Voir tous les actifs » ; valeur, variation de cours, P&L de position selon disponibilité.
7. Principales hausses/baisses : de préférence dans un module compact, en indiquant clairement le classement (variation du cours **ou** P&L personnel) et la période.
8. Avertissements de qualité : anciens cours, prix manquants, historique incomplet, échecs de collecte, sous forme de message discret mais jamais invisible.

Ne pas tout placer « above the fold » à n'importe quel prix. Le premier viewport est centré sur les trois informations essentielles ; le reste se découvre en descendant. Pas de mur de KPI ou de tuiles identiques.

### 5.2 Portefeuilles et comptes

- Liste : nom, valeur, gain/perte, part du patrimoine, fraîcheur des prix concernés.
- Détail : synthèse du portefeuille, comptes rattachés, positions, liquidités, historique.
- Actions contextualisées : renommer, archiver, ajouter un compte, enregistrer une opération.
- Vue globale : un actif détenu dans plusieurs comptes peut être consolidé, avec décomposition visible sur demande.
- Livret A / PEL : afficher **solde** et **intérêts crédités** ; ne pas simuler un cours de marché ni assimiler un taux attendu à un gain acquis.

### 5.3 Liste et détail d'actif

- Liste : nom + ticker + identifiant désambiguïsant si nécessaire (place/ISIN), quantité, valeur, variation de marché, P&L personnel ; tri explicite et filtres simples.
- Détail : cours et variation de marché (période), quantité, PRU/CMP, coût restant, valeur actuelle, gains latents/réalisés et opérations passées selon données disponibles.
- **Variation du marché** et **résultat de détention** doivent avoir des libellés et espaces distincts : un actif peut être en hausse aujourd'hui mais en moins-value depuis son acquisition.
- Les périodes du graphique d'actif et celles de la performance personnelle doivent être distinguées.
- En cas de cours manquant, montrer l'indisponibilité et l'ancien cours daté ; pas de zéro de substitution.

### 5.4 Activité / opérations

- Liste chronologique, filtrable par compte, portefeuille, type et date ; chaque opération affiche type, actif, quantité/montant, devise, frais, statut, date.
- Détail d'opération avec provenance (saisie ou import), valeurs d'origine, éventuelle correction et audit adapté.
- Actions de duplication/correction visibles mais non ambiguës ; jamais afficher « enregistré » avant confirmation serveur.
- Import CSV : sélection de fichier → analyse → aperçu des lignes → erreurs/doublons → confirmation → rapport ; ne pas masquer les données rejetées.
- Import PDF : **pas de parcours promis au MVP** ; seulement après prise en charge réelle d'un format identifié (PRD P1).

### 5.5 Premier lancement / empty states

- Première page sans patrimoine : « Ajoute ton premier portefeuille » avec un seul CTA principal.
- Puis compte et première opération, ou import compatible s'il est déjà disponible.
- Ne jamais préremplir le dashboard avec des chiffres fictifs présentés comme personnels.
- Environnements de démonstration : bannière explicite « Données de démonstration » et séparation stricte des comptes réels.

### 5.6 Paramètres et administration

- Préférences : thème, affichage/locale, paramètres de compte.
- Administration technique (selon phase) : santé instance, fournisseurs, synchronisation, sauvegardes ; jamais tableau transversal des investissements des utilisateurs.
- L'administration ne donne pas un droit implicite de lecture sur les données financières privées.

## 6. Visualisations financières

### 6.1 Principe de véracité

- Toute série représente des points de données réellement disponibles ou une **simulation explicitement identifiée comme telle** (V1).
- Ne pas lisser ou interpoler un trou de données sans indication visuelle explicite ; distinguer intervalle non couvert et chute réelle.
- Ne pas faire commencer une courbe à zéro pour dramatiser les évolutions ni choisir une échelle trompeuse ; indiquer les axes et unités pertinents.
- Un graphique de **valeur** n'est pas un graphique de **rendement**. Les apports/retraits doivent être contextualisés.
- Distinguer valorisation ponctuelle, performance depuis l'achat, variation journalière et rendement sur période.
- Éviter les camemberts complexes ; privilégier barres de répartition et légendes lisibles pour de nombreuses catégories.

### 6.2 Interactions graphiques

- Tooltips : date/heure, montant, devise, type de série, mention de prix ancien si besoin.
- Périodes courantes : 1J, 1S, 1M, 1A, Tout, **uniquement si la série et les calculs existent** ; états désactivés expliqués.
- Sur mobile, utiliser tap/focus et une légende accessible ; ne jamais rendre l'information essentielle uniquement disponible au hover.
- Couleur d'une courbe : neutre ou accent pour la valeur, `success`/`danger` pour une performance positive/négative **sur la période nommée**.
- Les projections et benchmarks V1 ont un style visuellement distinct des données réalisées ; sources et hypothèses visibles.
- Prévoir une alternative textuelle ou tabulaire aux graphiques pour lecteurs d'écran.

### 6.3 États de qualité de données

| État | Présentation | Règle |
| --- | --- | --- |
| Courant | Affichage normal + horodatage accessible | Ne pas affirmer « temps réel » sans garantie |
| Différé | Mention « Différé » + heure du cours | Ne pas confondre avec direct |
| Marché fermé | Mention « Marché fermé » si statut fiable | Dernier cours connu, daté |
| Ancien | Message discret `warning` + âge du cours | Éviter les conclusions de performance trompeuses |
| Manquant | Valeur `—` + explication | Ne jamais remplacer par `0` |
| Historique incomplet | Avertissement dans synthèse et détails | Ne pas afficher un rendement total non justifié |
| Erreur de fournisseur | Indication + action de réessai si utile | Ne pas supprimer les données valides en cache |

## 7. Montants, dates et libellés

- Locale par défaut `fr-FR`, devise d'affichage EUR ; format illustratif : `12 345,67 €`, `+1 234,50 €`, `−3,25 %`.
- Toujours afficher un signe pour gain/perte non nul. Un `0,00 €` est neutre, pas un gain.
- Dans les listes, chiffres tabulaires et colonnes alignées à droite ; ne pas tronquer une somme importante sans mécanisme d'accès au montant exact.
- La quantité crypto peut avoir plus de deux décimales ; précision adaptée à l'actif et possibilité de consulter la valeur exacte.
- Distinguer **date d'opération**, **date du cours**, **date de rafraîchissement** et **date de calcul**.
- Pas de pourcentage sans dénominateur pertinent et données suffisantes : afficher `—` + explication.
- Labels à privilégier : « Valeur actuelle », « Montant investi », « Gain/perte latent(e) », « Gain/perte réalisé(e) », « Variation du cours », « Dernier cours connu ».
- Les formats n'autorisent aucun arrondi dans le moteur financier : cette spécification ne concerne que l'affichage.

## 8. Formulaires et interaction métier

### 8.1 Ajouter une opération

- Une action primaire claire « Ajouter une opération » ; la sélection de type présente uniquement les types **implémentés**.
- Préremplir le portefeuille/compte depuis le contexte si disponible ; tous les champs restent contrôlables.
- Achat : actif, compte, date, montant total, prix et frais pertinents ; Atlas calcule la quantité dans le contexte décrit par le PRD.
- Vente : même logique, quantité disponible lisible et avertissement/blocage en cas de dépassement.
- Dépôt/retrait, transfert, dividende et récompense de staking : formulaires adaptés et moins chargés que le formulaire d'achat.
- Récapitulatif avant soumission : actif, quantité, prix, frais, devise, total et compte.
- Validation inline côté client pour l'ergonomie, **validation métier définitive côté serveur**.
- Pendant l'enregistrement : bouton désactivé ou état de progression, prévention des doubles soumissions ; succès seulement après confirmation.
- En cas d'erreur : conserver toutes les valeurs saisies, expliquer le problème et proposer correction/reprise.
- L'utilisateur ne doit jamais avoir à renseigner des identifiants ou notions comptables internes (transaction legs, snapshots, etc.).

### 8.2 Imports

- Zone de dépôt accessible aussi par sélecteur de fichier ; afficher formats réellement supportés.
- Aperçu paginé ou tabulaire avec colonnes date, type, actif, quantité, montant, devise, frais, statut.
- Grouper les lignes « nouvelles », « doublons », « invalides », « à confirmer » ; afficher les motifs.
- Contrôles de mapping visibles si nécessaire ; ne jamais importer en silence une opération ambiguë.
- Écran final avec nombres acceptés/rejetés/en attente ; accès au rapport.

### 8.3 Composants génériques

- Inputs : hauteur 40 px, radius 10 px, label persistant, aide et erreur associés sémantiquement.
- Bouton primaire : réservé à l'action dominante d'une zone ; actions secondaires neutres ; destructives confirmées.
- Tables : tri indiqué, en-têtes lisibles, défilement maîtrisé et adaptation en liste mobile.
- Dialogues : piège de focus, Escape pour fermer si non destructif, retour du focus au déclencheur.
- Tooltips : jamais seuls détenteurs d'une information essentielle.
- Menu d'action : ne jamais masquer une fonction centrale derrière trois niveaux de sous-menus.

## 9. Mouvement et micro-interactions

| Interaction | Durée cible | Intention |
| --- | --- | --- |
| Hover/focus d'une ligne | 120–160 ms | Réactivité |
| Navigation/panneau | 180–240 ms | Continuité spatiale |
| Dialogues | 160–220 ms | Transition claire |
| Toast | 160–200 ms | Feedback discret |
| Changement de période graphique | 180–300 ms | Mise à jour perceptible, sans falsifier le tracé |
| Skeleton | 1200–1600 ms, léger | Attente, sans flash |

- Animer `opacity`/`transform` si possible ; éviter de réanimer toute une liste à chaque cotation.
- Le changement d'un cours ne doit pas déclencher d'effet lumineux continu ni de saut de mise en page.
- Favoriser la stabilité des colonnes/chiffres pendant les mises à jour.
- Respecter `prefers-reduced-motion`; pas d'animation indispensable à la compréhension.
- Les animations ajoutent du plaisir d'usage **sans attirer artificiellement l'attention sur les fluctuations**.

## 10. États, feedback et confiance

Tous les composants pertinents couvrent : `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `empty`, `partial`, `error`, `success`.

- `loading` : skeleton proche de la structure finale ; pas de faux chiffres.
- `empty` : explication courte + action concrète.
- `partial` : ce qui est connu reste lisible et la limite de complétude est explicite.
- `error` : cause compréhensible et possibilité de reprise ; données en cours de saisie préservées.
- `success` : uniquement après confirmation effective.
- `offline` : dernière synchronisation connue ; ne jamais promettre une saisie synchronisée si elle ne l'est pas.
- `permissions` : pas de révélation de données d'autres utilisateurs dans erreurs, suggestions ou journaux.
- Les alertes financières ne doivent pas ressembler à des recommandations d'achat/vente ; rester factuelles.

## 11. Responsive, accessibilité et langue

- Cible WCAG 2.2 AA, contraste 4.5:1 pour texte normal et 3:1 pour grand texte et composants non textuels applicables.
- Navigation clavier complète ; focus visible ; ordre logique ; cibles tactiles adaptées ; contrôles avec noms accessibles.
- Responsive : desktop ≥ 1200 px, tablette 768–1199 px, mobile < 768 px comme **repères de conception**, pas contraintes de framework.
- Les listes/tabulaires doivent rester consultables en mode portrait sans scroll horizontal du site complet ; un tableau technique peut défiler localement avec indication visuelle.
- Mobile : hero compact, cartes empilées, graphiques exploitables au toucher, formulaire en écran/modal suffisamment large.
- Conserver la valeur et la performance visibles avant les analyses secondaires.
- Éviter toute dépendance aux gestes non documentés ou au survol.
- Textes UI en français au lancement, structure compatible i18n ; libellés compréhensibles sans connaissance financière avancée.
- Respecter taille de police système, zoom 200 %, et préférences de mouvement.

## 12. CSS de référence

```css
:root {
  color-scheme: dark;
  --bg-canvas: #0B0F14;
  --bg-sidebar: #0F141B;
  --bg-surface: #141B23;
  --bg-raised: #1B2530;
  --bg-overlay: #222E3B;
  --text-primary: #EDF3F6;
  --text-secondary: #A3B1BE;
  --text-tertiary: #778695;
  --border-subtle: #26313D;
  --border-strong: #394958;
  --accent: #67E2CF;
  --accent-hover: #8DEBDD;
  --accent-pressed: #46C7B3;
  --accent-tint: rgba(103,226,207,.10);
  --accent-border: rgba(103,226,207,.28);
  --accent-ink: #09231F;
  --secondary-accent: #B6A4F6;
  --success: #6DD6A4;
  --warning: #F1C27D;
  --danger: #F28F93;
  --focus-ring: #9DF5E7;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --sidebar-width: 252px;
  --sidebar-collapsed-width: 68px;
  --topbar-height: 60px;
}
:root[data-theme="light"] {
  color-scheme: light;
  --bg-canvas: #F5F7F8;
  --bg-sidebar: #EDF1F3;
  --bg-surface: #FFFFFF;
  --bg-raised: #E8F0F2;
  --bg-overlay: #FFFFFF;
  --text-primary: #15212B;
  --text-secondary: #4B5C68;
  --text-tertiary: #637380;
  --border-subtle: #DCE4E8;
  --border-strong: #BBC9D0;
  --accent: #087B70;
  --accent-hover: #06685F;
  --accent-pressed: #05564E;
  --accent-tint: rgba(8,123,112,.08);
  --accent-border: rgba(8,123,112,.24);
  --accent-ink: #FFFFFF;
  --secondary-accent: #7053B1;
  --success: #166B48;
  --warning: #935B12;
  --danger: #AE3541;
  --focus-ring: #087B70;
}
.financial-number { font-variant-numeric: tabular-nums; }
:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Adapter ces variables au système de thème retenu (CSS, Tailwind ou librairie UI). Ne pas disperser des valeurs hexadécimales dans les composants.

## 13. Anti-patterns

**À faire :**
- Faire ressortir valeur et résultats avant les analyses.
- Afficher les valeurs, dates, devises et provenances adéquates.
- Séparer mouvements de marché, P&L personnel et versements.
- Utiliser des tableaux/listes sobres, denses et scannables.
- Soigner transitions, accessibilité et petites interactions.
- Tester avec actifs longs, devises différentes, valeurs négatives, positions nulles et historiques partiels.

**À éviter :**
- Reproduire la surcharge visuelle de plateformes d'analyse financière.
- Ajouter un ratio technique au dashboard sans besoin PRD explicite.
- Créer des graphiques décoratifs ou les remplir avec des cours inventés.
- Employer le vert pour toute information favorable sans contexte, ni le rouge pour toute baisse comme s'il s'agissait d'une alerte critique.
- Assimiler Livret A/PEL à une action cotée.
- Confondre montant déposé et gain de marché.
- Multiplier cartes, gradients, animations ou palettes concurrentes.
- Ajouter un onglet IA/Research avant sa phase produit.
- Utiliser une maquette visuelle comme preuve de fonctionnalité.

## 14. Recette visuelle et UX

Une livraison UI ne peut être déclarée terminée sans vérification des points applicables :

- [ ] **Hiérarchie :** valeur totale, gain/perte et période immédiatement compréhensibles.
- [ ] **Sémantique :** distinction variation de marché / P&L personnel / rendement.
- [ ] **Confiance :** cours différés, anciens ou manquants correctement signalés.
- [ ] **Zéro données fictives :** hors démo explicitement balisée.
- [ ] **Navigation :** Accueil, Portefeuilles, Actifs, Activité cohérents avec les fonctions disponibles.
- [ ] **Saisie :** champs essentiels, récapitulatif, validation, erreurs conservant les valeurs.
- [ ] **Actifs :** jusqu'à 10 éléments sur l'accueil, liste détaillée lisible et triable.
- [ ] **Épargne :** solde et intérêts crédités distingués des cours de marché.
- [ ] **Thèmes :** sombre, clair, système ; contraste acceptable.
- [ ] **Responsive :** desktop, tablette, smartphone testés.
- [ ] **Accessibilité :** clavier, focus, contraste, labels, lecteurs d'écran et reduced motion.
- [ ] **États :** empty, loading, partial, error, disabled, success visibles et honnêtes.
- [ ] **Mouvement :** agréable mais sans distraction, sans saut de layout ni fausse urgence.
- [ ] **Intégration :** aucune interface simulant une opération réussie non persistée.

## 15. Instructions aux agents

1. Lire `PRD.md`, ce document et les ADR pertinents avant toute implémentation UI.
2. Vérifier la phase de `ROADMAP.md` : ne pas construire les fonctionnalités V1/Futur en avance.
3. Implémenter d'abord les tokens et primitives réutilisables, puis les écrans réels du périmètre livré.
4. Conserver le thème Midnight Observatory, en adaptant sa composition au contenu financier, **pas** au modèle de notes/knowledge graph de la version antérieure.
5. Utiliser des données de test clairement fictives en développement uniquement ; les données financières réelles viennent des contrats backend, avec état de fraîcheur.
6. Inspecter visuellement en desktop et mobile, ainsi que les états vides/erreurs, dès que l'outillage le permet.
7. Si une règle de calcul, un état de prix ou un libellé financier est ambigu, vérifier le PRD ; ne pas inventer une définition dans le frontend.
8. Toute nouvelle composante de design réutilisable doit être ajoutée ici, pas codée comme exception isolée.

**Résultat attendu :** à chaque ouverture, Atlas donne une compréhension rapide et fiable de sa situation financière, tout en offrant une expérience sobre, précise et agréable à explorer.
