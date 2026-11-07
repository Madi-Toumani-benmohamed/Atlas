# Exploitation — santé, disponibilité et BCE

P5.5, F-018/F-019/F-022, NFR-04/05/06/07/13. Aucun service de supervision payant, rôle administrateur applicatif ou accès financier implicite ajouté.

## Vitalité et disponibilité

| Sonde | Contrat public | Dépendance |
| --- | --- | --- |
| `GET /healthz` | 200, `{"status":"ok"}` | Processus HTTP vivant ; ne certifie ni DB ni fournisseur |
| `GET /readyz` | 200 `ok` ou 503 `unavailable` | Authentification/DB configurée et `PingContext` PostgreSQL réussi |

JSON générique, `Cache-Control: no-store`, aucun nom de base, DSN, erreur de driver ou donnée privée. Les sondes readiness partagent un résultat en mémoire cinq secondes ; un contrôle DB prend au plus une seconde et ne dépend pas de l’annulation d’un client observateur. Détection d’un changement en environ six secondes au plus hors congestion du serveur. Le cache ne dispense pas l’application de gérer les erreurs de chaque vraie requête.

Une application sans DB configurée peut être vivante et non prête. Une panne BCE **ne rend pas la DB indisponible** : les écritures manuelles et données conservées restent utilisables. `/readyz` ne teste aucun fournisseur, ni la fraîcheur des cours, ni le succès d’une sauvegarde, ni toutes les autorisations SQL.

```sh
curl -fsS https://atlas.example.org/healthz
curl -fsS https://atlas.example.org/readyz
docker compose ps
docker compose logs --tail=100 api
```

La commande `/healthcheck` est destinée au port interne fixe `127.0.0.1:8080`. `ATLAS_HEALTHCHECK_PATH` n’accepte que `/healthz` et `/readyz`, sans URL externe, query string ou redirection. Délai total trois secondes ; code 0 si réponse 200 et corps JSON exact, sinon 1. Compose sans DB garde `/healthz` ; `docker-compose.auth.yml` sélectionne `/readyz`. Une ancienne image ne lit pas ce nouveau réglage : reconstruire l’image lors de cette mise à jour.

Docker applique aussi ses intervalles et seuils de healthcheck : le statut du conteneur n’évolue pas nécessairement dès le premier 503. `restart: unless-stopped` ne redémarre pas à lui seul un conteneur simplement marqué unhealthy. Après incident, rétablir la DB, vérifier son état puis `/readyz` ; les connexions se rétablissent sans réinitialiser les volumes. Ne jamais supprimer de base pour « réparer » une sonde.

## État BCE et synchronisation privée

`GET /api/v1/market/status` exige une session. La consultation n’appelle pas la BCE et ne modifie aucune observation. L’écran Activité → « État de la récupération BCE » consulte le même contrat, sur ouverture ou vérification volontaire, puis après une tentative explicite de récupération.

- `provider` : état du **cache public commun** (`never_fetched`, `refreshing`, `cached`, `stale`, `backoff`, `unavailable`), dernières tentatives/réponses/erreurs, expiration, date de référence et prochain appel autorisé par la politique locale. Aucun portefeuille, utilisateur, quantité, cours numérique, URL interne ou message brut fournisseur.
- `synchronization` : date des derniers nouveaux taux BCE persistés et référence du **seul propriétaire authentifié**. Un autre utilisateur ne voit pas cette persistance. Une récupération externe réussie n’implique pas que chaque utilisateur a enregistré ces taux ; une réponse d’import sans nouvelle ligne ne réécrit pas la date des observations existantes.
- `automatic_asset_prices=false` : cette instrumentation ne crée pas de source automatique actions/ETF/crypto.

Cache partagé six heures, une seule récupération externe simultanée. Pendant le réseau, la lecture de l’état n’attend pas le verrou de récupération. Chaque appel externe est borné à six secondes, corps de réponse à 512 Kio ; URL officielle fixe et absence de redirections conservées. Aucun identifiant ou portefeuille envoyé au fournisseur.

Après échec : délais exponentiels locaux 30 s, 60 s, 120 s… jusqu’à 30 min. Un `Retry-After` fournisseur valide (secondes ou date HTTP) peut augmenter ce délai, plafonné à une heure. L’API de récupération conserve son échec 503 avec code stable et en-tête `Retry-After`. Les demandes pendant le délai n’appellent pas le fournisseur. Annuler une requête cliente ne crée pas un faux incident fournisseur ou nouveau backoff.

Le dernier cache et les observations persistées restent conservés lors d’une panne, mais le cache expiré n’est pas renvoyé comme une nouvelle récupération réussie. La récupération suivante explicitement demandée peut reprendre après le délai ; succès = remise à zéro du backoff. Aucun rafraîchissement de fond ou planification automatique ajouté.

Ces limites sont une **politique locale de protection**, pas une déclaration de quota officiel restant chez la BCE. Cache, délais et état technique sont en mémoire et repartent au redémarrage ; les taux privés déjà enregistrés restent dans PostgreSQL. Une réponse nouvellement récupérée peut avoir une date de référence antérieure : elle n’est jamais présentée comme un taux d’exécution ou une preuve de marché ouvert.

## Logs techniques

Le serveur émet du JSON structuré. Pour les seules récupérations externes réelles : événement `market_provider_fetch`, `source=ECB`, `outcome=success|failure|cancelled`, `error_code` borné. Les échecs sont au niveau WARN ; succès et annulations au niveau INFO. Cache hits et consultations d’état n’ajoutent pas de faux événements de synchronisation.

Les erreurs réseau/driver brutes, corps de réponse, endpoints internes, cookies, identifiants privés et valeurs financières ne sont pas inscrits dans cet événement. Le compteur éventuel d’événements serait une activité du flux public commun, jamais le nombre d’opérations ou utilisateurs. Aucun journal d’accès HTTP contenant les requêtes n’est ajouté.

Consulter les logs et l’état, attendre l’échéance en cas de limite fournisseur, conserver les données, et utiliser si nécessaire une observation manuelle datée/sourcée. Ne pas masquer une panne par un prix nul, ni annoncer une récupération réussie sur la seule base de la vitalité du processus.
