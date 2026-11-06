# CSV Atlas soldes v1 — rapprochement de relevé

P4.5, F-012/F-011, US-006/US-007, NFR-01/02/04. Format `atlas-balances-v1` ; distinct du CSV d’opérations et des exports natifs Coinbase/Trade Republic.

Le rapprochement compare un relevé fourni explicitement au journal courant corrigé, rejoué à l’instant du relevé. Aucun prix ni FX n’intervient : liquidités dans la devise du compte, positions en unités. Il n’enregistre ni dépôt, ni correction, ni ouverture implicite. Aucun appel à un courtier ou tiers.

## Fichier

UTF-8, virgules, en-tête `kind,asset_id,value` (les trois colonnes peuvent être réordonnées). BOM et fins de ligne CRLF acceptés, champs CSV cités selon les règles habituelles. Au plus 500 lignes. Pas de colonnes inconnues, de doublons d’en-tête, de ligne financière ignorée ou de total regroupé implicitement.

- `kind=cash` : `asset_id` vide, `value` solde de liquidités dans la devise du compte ; au plus une ligne cash.
- `kind=position` : ID privé Atlas d’un actif du propriétaire, `value` quantité ; au plus une ligne par actif. Les identifiants sont visibles dans l’export JSON et dans l’aide du formulaire.
- Valeurs décimales avec point (36 chiffres entiers, 18 décimales maximum). Les quantités acceptent aussi la représentation rationnelle exacte `100/3` utilisée par Atlas, bornée à 8 192 caractères. Les valeurs négatives du relevé peuvent être comparées : elles ne créent aucun découvert ou short dans le journal.
- Un fichier sans ligne de solde/position est refusé. Une ligne incohérente ou une ressource étrangère empêche tout le rapport ; aucun résultat partiel trompeur n’est présenté.

Exemple **synthétique**, remplacer l’ID par celui de son actif :

```csv
kind,asset_id,value
cash,,800
position,ID_PRIVE_ATLAS,2
```

Le compte, sa devise et l’instant du relevé sont choisis séparément. La date ne peut être future ; le formulaire précise le fuseau de saisie et le rapport conserve l’instant UTC exact. Un jour sans heure ne définit pas implicitement une fin de séance.

## Couverture explicite

Par défaut, seuls les éléments présents sont contrôlés. L’absence d’un actif signifie **non contrôlé**, pas une quantité nulle.

Si l’utilisateur déclare « Le relevé contient toutes les positions », les actifs effectivement détenus mais absents sont comparés à une référence nulle, identifiés `declared_absent`. Les positions déjà closes absentes ne produisent pas de lignes inutiles. Cette déclaration ne signifie pas que le relevé contient les liquidités : seule une ligne cash les contrôle. Résultat limité à 1 000 lignes ; au-delà, refus explicite et relevé partiel à utiliser.

Chaque ligne expose attendu, calculé et écart **Atlas − relevé**, sous forme exacte et arrondie pour affichage. L’égalité se décide sur les rationnels exacts, avec tolérance zéro : un écart inférieur à la précision affichée reste signalé et sa valeur exacte est visible. Cela ne qualifie pas automatiquement la cause (frais, arrondi, opération manquante, date ou erreur de saisie).

Le rapport indique la couverture, la date du relevé, l’heure de calcul et le caractère partiel de l’historique Atlas. Un résultat sans écart sur un relevé partiel n’est pas une certification globale. Une correction antidatée d’une opération modifie le prochain rapprochement historique ; il s’agit de l’historique corrigé actuel, pas de ce qu’Atlas connaissait à l’époque.

## API et conservation

`POST /api/v1/reconciliations/preview`, JSON strict, session/propriétaire et origine même site exigés :

```json
{
  "format": "atlas-balances-v1",
  "account_id": "ID_COMPTE_PRIVE",
  "currency": "EUR",
  "as_of": "2020-01-02T13:00:00Z",
  "complete_positions": false,
  "csv": "kind,asset_id,value\ncash,,800\n"
}
```

Corps borné à 128 Kio. La devise doit correspondre exactement à celle du compte. Les comptes et actifs archivés du propriétaire restent consultables. Ressource absente/étrangère : 404 sans distinction d’existence. Réponse privée non cacheable, transaction PostgreSQL repeatable-read en lecture seule. Aucun schéma ou lot d’import persistant ajouté.

Réponse `atlas-reconciliation-v1` exportable en JSON par l’utilisateur : `account_id`, `currency`, `as_of`, `calculated_at`, `partial_history`, `complete_positions`, `cash_checked`, `differences`, `rows` ; chaque ligne contient `kind`, actif éventuel, `origin`, `expected`, `actual`, `delta`, `matches`. Les valeurs financières comprennent `exact`, `display`, `approximate`.

Le rapport n’est pas conservé sur le serveur. Télécharger le JSON et conserver le relevé source pour ses archives privées si nécessaire. Après correction d’une opération, relancer explicitement la comparaison ; aucun rapport antérieur n’est silencieusement remplacé ou présumé encore actuel.
