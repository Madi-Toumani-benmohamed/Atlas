# Cartographie vérifiée — socle C-01

- `backend/cmd/atlas/main.go` : serveur HTTP, écoute locale par défaut, délais et arrêt sur signal.
- `backend/internal/httpserver/handler.go` : `GET /healthz`, vitalité uniquement ; aucune route financière. Test de méthodes, chemin absent et absence de cache dans `handler_test.go`.
- `backend/go.mod` : Go 1.27.3, dépendances pgx et x/crypto (versions dans go.mod).
- `web/src/index.ts` : export technique React createRoot, aucune page produit.
- `web/vite.config.ts` : compilation ES module, React externalisé ; `tsconfig.json` : types stricts ; ESLint : règles TypeScript.
- `web/test/build.test.mjs` : import du résultat de compilation ; build requis avant test.
- `.github/workflows/ci.yml` : contrôles Go et frontend indépendants.

Flux réel : requête HTTP → route de vitalité → JSON sans données privées. Pas de lien frontend/backend, de fournisseur ou de moteur financier. L’identité PostgreSQL est ajoutée ci-dessous. Les modules métier d’ARCHITECTURE.md restent une cible.

Commandes et limitations : README.md. Versions exactes frontend : package.json et package-lock.json. Configuration unique du serveur : ATLAS_ADDR ; aucun secret requis.

## Conteneurisation du socle

`docker-compose.yml` construit `backend/Dockerfile` en deux étapes (Go puis scratch). Le service api publie 0.0.0.0:${ATLAS_PORT:-8080} vers 8080 ; `/healthcheck`, compilé depuis `backend/cmd/healthcheck`, vérifie la vitalité. Aucun volume ni DB. Commandes : `docker compose config --quiet`, `docker compose up --build -d --wait`.

## C-02 — Identité

`internal/identity` : schéma SQL embarqué v1, migration transactionnelle sous verrou, bcrypt, sessions opaques et routes register/login/logout/me. Le serveur active ces routes uniquement avec DATABASE_URL et une origine valide. `docker-compose.auth.yml` ajoute PostgreSQL 18.6, volume persistant et rôle non superuser via deploy/postgres/01-app-role.sh. Tests d’intégration conditionnés à ATLAS_TEST_DATABASE_URL ; CI fournit PostgreSQL. Aucun endpoint financier ni interface de connexion.
