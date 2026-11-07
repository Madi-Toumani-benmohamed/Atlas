# P5.9 / NFR-12 — Profils synthétiques du rejeu

7 novembre 2026. Mesures du moteur exact, pas de la fluidité du dashboard ni du serveur cible. Le responsable produit reporte son déploiement Linux x86 ; aucun matériel de référence utilisateur ou SLO n’est inventé.

## Profil et reproductibilité

`backend/internal/ledger/benchmark_test.go` génère 100, 1000 et 5000 achats/ventes, soit 201, 2001 et 10001 événements avec le dépôt initial. Quantité 1, achat 100 et frais 1, vente 105 et frais 1 : résultat exact attendu 3 par aller-retour, frais enregistrés 2, quantité et coût final nuls, cash initial 1 000 000 plus le réalisé. Deux ordres d’entrée : chronologique et inversé.

La préparation et une validation numérique complète sont hors du chronomètre ; chaque itération mesurée rejoue un historique complet, sans SQL, API, cours externe ou donnée utilisateur. Aucun calcul du moteur n’est modifié pour ces mesures.

Depuis `backend/`, avec Go 1.27.3 :

```sh
GOMAXPROCS=2 go test ./internal/ledger -run '^$' -bench '^BenchmarkReplaySyntheticHistory$' -benchtime=100ms -count=1
```

Le job backend exécute ces profils et conserve temps, octets/allocation et CPU dans son log. Le succès vérifie les valeurs exactes et la terminaison ; il n’applique aucun seuil de latence. Pour une vraie comparaison, conserver version Go, CPU/architecture, charge de l’hôte, GOMAXPROCS et profil, puis augmenter durée/répétitions sur la machine choisie.

## Observation locale initiale

Linux AMD64, Go 1.27.3, CPU AMD EPYC 9V74, GOMAXPROCS=2, CGO désactivé. Les caches et fichiers temporaires de compilation sont placés dans un espace mémoire autorisé pour ne pas remplir le disque du laboratoire. Commande ci-dessus avec `-p 2`, six profils réussis ; `go vet -p 2 ./internal/ledger` et gofmt réussis.

| Événements | Ordre | ns par rejeu observés | Octets par rejeu observés |
| --- | --- | ---: | ---: |
| 201 | Chronologique | 859234 | 720314 |
| 201 | Inversé | 1167477 | 720316 |
| 2001 | Chronologique | 10558624 | 7114488 |
| 2001 | Inversé | 13381160 | 7114456 |
| 10001 | Chronologique | 52208198 | 35530856 |
| 10001 | Inversé | 77146981 | 35530800 |

Échantillons courts et peu d’itérations sur le plus grand profil : valeurs descriptives, pas une garantie ou une comparaison de produits. Le profil mono-compte/mono-actif ne prétend pas représenter le portefeuille réel du responsable produit. Les frais et résultats sont des fixtures explicitement synthétiques.

## Limites et suites

NFR-12 reste partiel : mesurer ensuite API/SQL, historique affiché et navigateur avec un historique personnel représentatif sur la machine de référence. Les preuves d’accessibilité et les 15 critères MVP restent dans [la matrice](MVP-readiness.md). [Quality 42394952786](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42394952786), commit `c0424999` : sept jobs réussis ; les six profils sont exécutés dans le job backend et leurs mesures conservées dans son log. Les contrôles numériques, la détection de concurrence et les parcours financiers/clavier restent verts.

Dans ce même lot documentaire, ADR-0006/0009 passent à accepted après **validation explicite** du responsable produit ; ADR-0007 et les licences de cotation restent ouverts. BTC/ETH sont retenus et le S&P 500 doit être un ETF encore à identifier : [couverture et décisions](../decisions/market-coverage.md). Aucun fournisseur ou instrument coté n’est choisi par inférence.
