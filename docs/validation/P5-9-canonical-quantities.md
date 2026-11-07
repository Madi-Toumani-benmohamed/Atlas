# P5.9 — Liquidation d’une quantité canonique dérivée

7 novembre 2026. F-008/F-010/F-013/F-020, US-002/US-003, NFR-01/02/03/07 ; application des ADR-0006/0009 approuvés. Aucun changement de CMP, frais, cash, propriété ou méthode de performance.

## Régression reproduite

Le journal accepte un achat par total dont la quantité exacte calculée dépasse 36 chiffres entiers. `big.Rat.RatString` et l’API renvoient alors un entier canonique ; le parseur des quantités le renvoyait à la borne des décimaux sources et refusait la vente avec `invalid_decimal`. Pourtant la même valeur écrite `n/1` était déjà acceptée dans la limite de 8192 caractères.

Fixture synthétique : dépôt et achat au total `1000000000000000000`, prix `0.000000000000000001` → quantité exacte `1` suivie de 36 zéros. Avant correctif, le test d’achat puis vente complète échoue réellement sur `invalid_decimal` ; les cas d’entiers longs échouent aussi, tandis que la fraction équivalente passe.

## Correctif borné

`quantityNumber` accepte aussi l’entier positif canonique de plus de 36 chiffres lorsque sa forme équivalente `n/1` tient dans la limite déjà existante : au plus 8190 chiffres. Pas de signe, notation exponentielle ou zéro initial nouveau ; les décimaux sources, montants et prix gardent leurs bornes. Les fractions déjà acceptées et les opérations enregistrées gardent leur interprétation. Ce correctif n’autorise pas une taille illimitée des quantités dérivées.

Aucune migration ni conversion de journal. Un client peut reprendre l’écriture entière exacte renvoyée par l’API, sans ajouter artificiellement `/1`, sans nombre flottant ni arrondi. Les plafonds JSON/CSV et d’encodage existants demeurent applicables.

## Vérifications

Local, Go 1.27.3, Linux AMD64, CGO désactivé et espace de compilation temporaire en mémoire :

```sh
go test ./internal/ledger -run 'TestCanonical|TestFinancialScenarios|TestRejectedHistories|TestValuationsAndHistory' -count=1
go vet ./internal/ledger
```

Tests de représentation et de rejeu réussis : liquidation totale → capital initial restauré exactement, quantité/coût/réalisé nuls ; équivalence entier/fraction ; borne 8190 acceptée, 8191 refusée ; négatif, zéro initial et notation exponentielle refusés. Les scénarios financiers existants sélectionnés restent verts.

Le scénario SQL/API ajouté utilise un compte synthétique distinct : achat, lecture de la quantité exacte dans la synthèse, vente complète, tentative étrangère refusée, réessai avec même clé sans double événement et export conservant la quantité. La [CI Quality 42396759034](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42396759034), commit `bfcab2f5`, réussit les sept jobs, dont les tests PostgreSQL du backend, les parcours E2E et les builds Docker AMD64/ARM64. Aucun succès SQL local n’est revendiqué. Gofmt, liens et diff contrôlés. Correctif fusionné par la PR #10.
