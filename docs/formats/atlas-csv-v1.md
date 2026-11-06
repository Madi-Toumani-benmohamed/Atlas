# CSV Atlas v1

Format ouvert et nommé pour F-012, C-08. Il ne prétend pas reconnaître les exports Coinbase ou Trade Republic.

Encodage UTF-8, séparateur virgule, guillemets CSV standards, en-tête unique. BOM UTF-8 accepté. Au plus 500 lignes et 1 Mio de corps JSON par prévisualisation ; aucune troncature silencieuse. Colonnes inconnues/dupliquées et nombres ambigus refusés.

Colonnes obligatoires : `external_id`, `kind`, `account_id`, `occurred_at`.

Colonnes optionnelles selon l’opération : `target_account_id`, `asset_id`, `quantity`, `price`, `amount`, `fees`, `cost`, `price_source`, `price_observed_at`, `fx_to_eur`, `fx_source`, `fx_observed_at`, `exchange_rate`, `note`.

- Identifiants de comptes/actifs : ceux du propriétaire, disponibles dans son export JSON. Une ressource étrangère/inexistante rend la ligne invalide.
- `external_id` : identifiant stable dans le compte. La clé de dédoublonnage combine compte et identifiant externe. Même contenu = doublon ; contenu différent sous la même clé = conflit, jamais correction automatique.
- Dates : RFC3339 avec fuseau, normalisées en UTC. Pas de date future. Ordre économique : date effective puis ordre stable d’enregistrement ; une correction conserve l’ordre logique de l’original.
- Nombres : chaînes décimales positives ou nulles selon le champ, point décimal, pas de milliers, pas d’exposant. Maximum 36 chiffres entiers / 18 décimales.
- `quantity` accepte aussi une fraction exacte `entier/entier` positive, notamment pour vendre la totalité d’une quantité calculée non terminante ; pas de division implicite dans les autres champs.
- `kind` : `deposit`, `withdrawal`, `buy`, `sell`, `transfer`, `fee`, `dividend`, `interest`, `staking`, `opening_cash`, `opening_position`.
- Achat : prix et soit quantité, soit total `amount` frais inclus. Si les deux sont fournis, ils doivent correspondre exactement. Vente : quantité, prix et frais ; un éventuel `amount` doit égaler les recettes nettes.
- Ouverture de position : quantité et coût total `cost` s’il est connu ; sinon coût inconnu, pas zéro implicite. Les ouvertures marquent l’historique incomplet.
- Staking : quantité, prix unitaire dans la devise du compte, `price_source` et `price_observed_at` à réception. Valeur reconnue comme revenu et coût d’acquisition.
- Transfert : compte destinataire ; montant cash, ou actif/quantité. Entre devises, `exchange_rate` explicite et source/date du taux. Les transferts ne sont pas des apports externes.
- FX historique : `fx_to_eur` pour une unité de la devise du compte en EUR, `fx_source` et `fx_observed_at` du jour de l’opération, pas après celle-ci. Un manque peut rendre le résultat consolidé non calculable.
- Les frais/revenus cash séparés utilisent `amount`. Les intérêts ne sont admis que sur un compte d’épargne. Les swaps sont refusés explicitement.

Exemple **de format uniquement**, à compléter avec un vrai identifiant de compte et ses propres données :

```csv
external_id,kind,account_id,occurred_at,amount
mon-depot-001,deposit,REMPLACER_COMPTE,2020-01-01T12:00:00Z,100
```

API : `POST /api/v1/imports/preview` avec `{"format":"atlas-csv-v1","csv":"..."}`. Retour : ID du lot, lignes, doublons, anomalies, validation globale et droit de confirmation. La prévisualisation conserve un rapport privé, sans écrire d’opération financière.

`POST /api/v1/imports/{id}/confirm` revalide droits, archivage, doublons et cohérence de tout l’historique. Le lot est écrit dans une seule transaction ou rejeté intégralement. La confirmation répétée n’ajoute rien. Changer les fins de ligne du fichier ne contourne pas la clé externe. Les corrections passent par le parcours d’audit, jamais par remplacement d’un CSV déjà confirmé.
