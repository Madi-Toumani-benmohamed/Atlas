# Sources et couverture — 2026-11-06

F-018/F-019 ; C-06. Le responsable produit retient le 7 novembre 2026 BTC, ETH et un ETF S&P 500 encore à préciser (nom/ISIN/place). Q-05 est donc partiellement renseignée ; Q-06 sur les sources/droits reste ouverte. Aucune couverture boursière ou crypto automatique ne peut être revendiquée sans validation de source et d’identité.

## Implémenté

- Cours d’actifs manuels : positifs, datés, sourcés, privés, jamais annoncés comme du temps réel.
- FX manuel vers EUR : mêmes exigences.
- FX automatique **BCE** : flux officiel eurofxref-daily.xml, sans identifiants ni positions privées transmis. Valeurs d’origine contre EUR inversées exactement pour exprimer une unité de devise étrangère en EUR. Référence quotidienne conservée dans `reference_date`, heure réelle de réception dans `observed_at`, origine et transformation identifiées. Pas de reconstruction rétroactive à une heure où le taux n’était pas encore connu de l’application.
- Cache public en mémoire six heures, persistance privée par utilisateur, dédoublonnage par devise/date/valeur, délai HTTP six secondes et taille XML bornée. Pas d’effacement du dernier taux lors d’une panne. Pas d’URL fournisseur fournie par le navigateur ; redirections refusées pour le client de production.
- Le taux de référence n’est pas un taux d’exécution d’une transaction. L’utilisateur conserve les taux réellement appliqués dans son journal.

Sources primaires vérifiées : [BCE, taux de référence](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), [flux XML officiel](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml), [conditions de réutilisation et attribution](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html). La réutilisation doit rester exacte, identifier la BCE et les transformations ; les données de référence ne sont pas une garantie de prix de transaction.

## Non revendiqué

Aucun connecteur actions/ETF ou crypto n’est livré comme « connecté ». La recherche CoinGecko a identifié des distinctions de plans/licences et des restrictions concernant l’accès redistribuable, y compris les données mises en cache/exportables. Le plan gratuit n’est pas présumé couvrir une instance publique multi-utilisateur avec export de cours réutilisables : [documentation officielle des licences](https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses), [conditions API](https://www.coingecko.com/en/api_terms). Aucun appel CoinGecko n’a été ajouté ni aucune clé demandée au navigateur.

Le code Atlas est Apache 2.0 ; cela ne donne pas automatiquement une licence sur des flux de marché tiers. Q-01 : le choix des formats a été délégué le 6 novembre 2026. Atlas v1 et les adaptateurs limités Coinbase/Trade Republic sont décrits dans [broker-csv.md](../formats/broker-csv.md).

## Politique de qualité

- Prix/FX absent : valeur complète absente, jamais zéro ; valeur connue séparée si la consolidation est partielle.
- Dernière observation d’une date antérieure : source/date visibles et bannière dédiée ; ce n’est ni une preuve de cours actuel ni une preuve de marché fermé.
- Variation jour/semaine/mois/année : calcul uniquement si les deux dates nécessaires sont couvertes par des observations compatibles ; pas de variation nulle fabriquée avec le même ancien cours.
- Historique : positions de chaque date, observations connues à cette date, interruptions explicites pour les jours incomplets. Pas de backfill artificiel avec les positions actuelles.

## Pilotes exprimés le 7 novembre 2026

BTC et ETH sont les premiers symboles demandés. Pour le S&P 500, le responsable produit précise vouloir un **ETF**, pas l’indice lui-même ; le fonds exact et la place restent à confirmer. Aucun ISIN, ticker coté ou compte réel n’est inventé ; aucune position ni ressource privée n’est créée par cette sélection. La sélection ne vaut pas validation d’un fournisseur, d’une licence de données ou de son quota. ADR-0007 reste proposé.
