# P3.4 — Détail des liquidités et positions d’un compte

8 novembre 2026. F-003/F-004/F-005/F-013/F-019/F-021, US-005, NFR-08/09 ; phase 3.

La vue Portefeuilles existante conserve sa sélection de portefeuille et ses comptes. Son détail de compte présente désormais les liquidités dans leur devise d’origine, leur valeur EUR et la source/date du taux disponible, puis chaque position du compte : identité de l’actif, quantité, valeur EUR, coût restant, PRU économique et résultats latent/réalisé dans la devise du compte.

Le composant ne calcule ni sommes ni rendement. Il filtre uniquement `summary.cash` et `summary.positions` par l’identifiant du compte et présente les valeurs serveur. Un même actif reste séparé entre comptes ; aucune position globale consolidée n’est utilisée à sa place. La valeur totale du compte affichée par la vue existante reste issue de `account_values_eur`.

Coût inconnu, cours ou FX absent restent explicites et non calculables ; aucun zéro de substitution. Une vraie position clôturée est distinguée d’un cours manquant. La provenance et la date du dernier cours sont montrées, avec signalement d’une date antérieure à la synthèse, sans supposer une fermeture de marché. Les comptes sans position ont un état vide. Pour l’épargne, le libellé est un solde enregistré incluant uniquement les intérêts crédités, sans prévision.

Aucune migration, API, dépendance, politique de flux ou performance par portefeuille ajoutée. Les vues d’évolution et de répartition propres à un portefeuille restent ouvertes ; cette tranche ne clôture ni P3.4 ni US-005 globalement. Retour arrière : rétablir le contenu de détail précédent dans Workspace et retirer le composant, sans toucher aux données.

## Vérification

Local : lint, build TypeScript/Vite, tests npm et diff réussis. Navigateur avec API explicitement simulée : coûts connus/inconnus, FX absent, six analyses axe et absence de débordement à 1440/390/320 px dans les deux thèmes ; capture mobile inspectée.

`npm run test:account-holdings` fait partie du job E2E Quality et doit réussir avant fusion sur PostgreSQL réel. Fixture synthétique : dépôt EUR 100, achat 2 à 10 avec frais 1, puis vente 1 à 15 avec frais 1, cours daté 12 → cash 93, quantité 1, coût/PRU 10,5, réalisé 3,5, latent 1,5, valeur du compte 105. Le même actif est ouvert sans coût dans un compte USD distinct, cash 50 sans FX : quantité 3, coût/résultats et total EUR indisponibles. Un compte vide d’un autre portefeuille a un vrai solde zéro, sans positions. Contrôles de séparation des comptes, changement de portefeuille, six scans axe et responsive. Aucun succès SQL local n’est revendiqué.

Premier run Quality 42466823761 : six jobs réussis ; E2E arrêté au bootstrap par le quota partagé inscription/connexion (HTTP 429), avant les assertions du nouveau compte. Le helper de session synthétique respecte désormais Retry-After, avec deux réessais maximum, uniquement pour l’authentification. Aucune écriture financière n’est réessayée par ce helper ; limite applicative inchangée. Tests unitaires de délai, bornes et refus des erreurs non 429 ajoutés. Nouvelle CI requise avant fusion.

Validation finale : [Quality 42467199721](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42467199721), commit `a8293f8e`, sept jobs réussis. Le marqueur E2E confirme comptes, coûts/résultats attendus, états incomplets, compte vide, navigation et six analyses axe sur PostgreSQL réel. PR #13 fusionnée.
