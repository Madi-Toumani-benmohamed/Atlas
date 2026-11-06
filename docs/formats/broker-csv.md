# Exports Coinbase et Trade Republic — adaptateurs v1

F-012, C-08. Choix des formats délégué par le responsable produit le 6 novembre 2026. Import local sur l’instance Atlas : aucun identifiant de courtier, accès API, envoi à un fournisseur ou connexion de trading.

## Formats retenus

- **Coinbase `coinbase-transactions-v1`** : historique de transactions en anglais avec `ID,Timestamp,Transaction Type,Asset,Quantity Transacted,Price Currency,Price at Transaction,Subtotal,Total (inclusive of fees and/or spread),Fees and/or Spread,Notes`. Préambule de rapport limité à 19 enregistrements ; variantes avec `Sender Address,Recipient Address` acceptées. Anciennes colonnes « Spot Price » et exports Advanced non pris en charge dans cette version.
- **Trade Republic `trade-republic-transactions-v1`** : export de transactions officiel à 23 colonnes, première colonne `datetime`, identifiant `transaction_id`, valeurs machine en anglais, séparateur virgule et décimales point. Les exports communautaires pytr à points-virgules et relevés PDF sont distincts et refusés.

Sources de reconnaissance : [Coinbase, historique](https://help.coinbase.com/en/coinbase/getting-started/getting-started-with-coinbase/transaction-history), [description des colonnes Coinbase](https://grid.cryptact.com/exchanges/coinbase), [observations communautaires du format Trade Republic](https://github.com/aritzmmartinez/libtraderepublic/blob/main/SCHEMA.md). Ces observations ne constituent pas une garantie de stabilité du fournisseur. L’adaptateur est écrit dans Atlas, sans ajout de dépendance ou copie de bibliothèque externe. Tests Atlas sur fichiers synthétiques ; aucun export personnel n’a été fourni.

## Contrat prudent

Choisir un compte EUR et associer explicitement chaque symbole Coinbase ou ISIN Trade Republic à un actif privé préexistant. Aucune création automatique d’actif, déduction de place à partir du seul ISIN, dépôt supposé ou solde inventé.

- Coinbase : Buy, Sell, Staking Income ; prix, quantité, sous-total, frais et total doivent concorder exactement. La colonne frais/spread n’est pas présentée comme une commission fiscale. Staking : valorisation EUR à réception, coût et revenu selon le contrat approuvé.
- Trade Republic : TRADING BUY/SELL, CASH INTEREST_PAYMENT/DIVIDEND ; signe des quantités et montants vérifié. EUR, compte DEFAULT, absence de conversion et de retenue fiscale non nulle. Les retenues nécessitent une vérification manuelle ; elles ne deviennent pas des frais de courtage.
- Les frais négatifs et les lignes dont le total ne permet pas de déterminer sans ambiguïté si les frais sont inclus sont refusés dans cette version. Certaines variantes réelles Trade Republic utilisent ces conventions ; leur import nécessite une vérification manuelle, sans supposer une écriture cash supplémentaire.
- Les écarts dus aux arrondis des exports sont signalés et bloquent la confirmation : aucune modification silencieuse du prix ou de la quantité.
- Transferts entrants/sortants : anomalie explicite, car un transfert peut relier deux comptes suivis et ne doit pas être transformé en apport/retrait externe. Saisie manuelle avec contrepartie explicite.
- Conversions, swaps, cartes, corporate actions, taxes, types inconnus et colonnes inattendues : refus explicite, jamais ignorés. Corriger/convertir manuellement vers Atlas CSV v1 après vérification si nécessaire.

500 lignes au maximum, UTF-8, corps JSON limité à 1 Mio. Aperçu obligatoire ; une anomalie empêche **tout le lot** de s’appliquer. Confirmation atomique et nouvelle validation des ressources/droits/historique. Déduplication par compte + fournisseur + ID ; même ID avec contenu différent = conflit, y compris sur un autre fichier. L’empreinte de l’aperçu inclut le format, le compte et les correspondances d’actifs.

API `POST /api/v1/imports/preview` : `format`, `csv`, `account_id`, `assets` (objet identifiant externe → ID privé Atlas). Réponse et confirmation identiques à Atlas v1. L’export JSON conserve les événements normalisés et rapports d’import ; le CSV source reste à conserver séparément par l’utilisateur pour ses archives.
