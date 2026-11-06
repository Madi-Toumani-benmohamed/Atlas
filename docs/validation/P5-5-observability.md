# P5.5 — Observabilité minimale, 6 novembre 2026

Références : F-018/F-019/F-022, NFR-04/05/06/07/13 ; lot P5.5 de la roadmap. Branche `work/atlas-observability`, suite de `work/atlas-reconciliation` ; pas de migration ni de règle financière modifiée.

## Livré

- `/healthz` pour la vitalité ; `/readyz` pour la disponibilité PostgreSQL, générique, sondes mutualisées cinq secondes et tentative DB bornée à une seconde.
- Sonde conteneur sélectionnant un chemin strictement autorisé ; stack authentifiée sur readiness, socle sans DB sur liveness, refus des redirections.
- Cache BCE séparant verrou d’état et réseau ; une récupération simultanée, délai HTTP six secondes, conservation des données en panne et backoff borné/Retry-After.
- État du cache public consultable sans déclencher de récupération, métadonnées de persistance privées filtrées par propriétaire ; informations utiles dans Activité.
- Logs JSON d’événements fournisseur bornés et expurgés ; pas d’IDs privés, valeurs financières, URLs internes ou corps d’erreur bruts.

Contrats et diagnostic : [guide d’exploitation](../operations/observability.md).

## Vérifications locales

`go vet ./...`, `ATLAS_TEST_DATABASE_URL=… go test -race ./...` et compilations des binaires serveur/healthcheck réussis avec PostgreSQL 18.6 réel et rôle applicatif non privilégié.

Tests unitaires : vitalité avec DB absente, disponibilité/caches/échec/reprise, timeout DB, vingt sondes concurrentes donnant une tentative ; destination du healthcheck strictement bornée, mauvais corps/statut et redirection refusés. Fournisseur : HTTP 429 et délais, Retry-After secondes/date et limites, cache conservé, reprise, huit clients donnant un seul appel, état consultable pendant la récupération, annulation cliente sans faux backoff, messages sensibles de client/upstream exclus des logs.

Tests SQL : état anonyme refusé, consultation n’appelant pas le fournisseur, panne sans mutation des observations déjà enregistrées, refus pendant backoff sans nouvel appel, récupération et persistance privée après reprise ; autre utilisateur sans date de persistance du premier. L’état partagé ne contient que des métadonnées du flux public.

`npm run lint`, `npm run build` et `npm test` réussis. `npm run test:market-status` : vrai endpoint privé puis fixtures **explicitement synthétiques** pour les états never-fetched/backoff de l’interface ; quatre analyses axe dark/light, 1440/320 px, sans violation et sans débordement. La fixture UI n’est pas une assertion de panne réelle de la BCE ; les pannes sont exercées par les serveurs HTTP de tests Go.

`npm run test:readiness` : arrêt réel du conteneur PostgreSQL de recette, readiness **200 → 503**, liveness **200**, commande readiness en échec et liveness réussie ; redémarrage de la même DB sans suppression de volume, reprise readiness **503 → 200**, commande à nouveau réussie. Aucune opération privée requise pour les sondes publiques. Le scénario restaure la DB dans un bloc `finally` même en cas d’échec du test.

Le parcours portefeuille achat/vente/correction/CSV/export et ses 22 analyses axe sont rejoués pour vérifier l’absence de régression de l’écran Activité. La CI inclut les nouvelles suites, la construction du healthcheck et une panne de son propre service PostgreSQL isolé, après les parcours financiers.

Compilation statique Linux ARM64 du serveur et de la sonde réussie. La sonde ARM64 a aussi été exécutée sous QEMU contre le serveur local AMD64 et retourne 0 sur `/readyz` disponible ; cela ne constitue pas une exécution du serveur complet sur matériel ARM64 physique.

## Limites

Pas de fournisseur de cours d’actifs ajouté, de métriques commerciales, de tableau d’administration financière ou d’agent de supervision obligatoire. Les quotas présentés sont ceux de la politique locale ; aucun quota tiers restant n’est inventé. La DB peut être prête avec des cours manquants ou un fournisseur dégradé. Les délais Docker de passage unhealthy restent ceux du Compose.

La publication MVP globale, les licences/couvertures de cours d’actifs et le déploiement sur la machine cible restent ouverts. Résultats GitHub à vérifier sur le commit publié ; ce rapport décrit les preuves locales avant publication.
