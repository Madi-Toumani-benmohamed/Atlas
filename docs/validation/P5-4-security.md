# P5.4 — Revue de sécurité, 7 novembre 2026

F-001/F-002/F-022, NFR-02/04/05/13 ; lot P5.4. Base `main` : `f14b72ce088ace099c5b19c21c963e78420cbfed`. Revue interne du périmètre réellement implémenté, sans certification de sécurité ou affirmation de résistance à un hôte compromis. Aucun changement de politique financière, rôle utilisateur, schéma SQL ou source de marché.

## Corrections livrées

### Confinement du serveur web

Le serveur utilisait `os.Stat` puis `http.FileServer(http.Dir(...))` : un lien symbolique dans un build configuré pouvait servir un fichier extérieur. Aucun upload ne permet à un utilisateur Atlas de créer ce lien ; le défaut concerne un répertoire web préparé incorrectement ou modifié sur l’hôte. L’image de production contient normalement des fichiers réguliers et une racine en lecture seule.

`httpserver/web.go` ouvre désormais le répertoire par `os.OpenRoot`, valide chaque composant, puis ouvre le contenu via ce même Root. Les liens symboliques et chemins cachés sont refusés ; les lectures ne peuvent sortir de cette racine sur Linux, même si une cible extérieure remplace le chemin entre vérification et ouverture. La vérification du descripteur n’accepte que les fichiers réguliers ; l’ouverture non bloquante et le contrôle préalable empêchent de rester en attente sur un FIFO.

Les en-têtes CSP, nosniff et no-store sont conservés aussi lors des refus statiques. Les fichiers `/assets/` réguliers gardent leur cache immutable ; les réponses HEAD et Range sont vérifiées. La racine sans index ne liste pas son contenu. Aucun fallback HTML n’est ajouté aux routes API. Le répertoire web et son montage restent une configuration de confiance ; l’outil ne protège pas d’un exploitant malveillant ayant accès à la base ou au système.

### Secret d’initialisation PostgreSQL

`deploy/postgres/01-app-role.sh` ne passe plus le mot de passe dans `--set=app_password=...`. `psql` 18.6 lit `ATLAS_DATABASE_PASSWORD` par `\getenv` dans le heredoc non développé par le shell. Les droits NOSUPERUSER/NOCREATEDB/NOCREATEROLE et le refus de secrets identiques restent inchangés. Ce correctif ne modifie pas les mots de passe des volumes existants ; leur rotation reste la procédure opérateur documentée.

## Matrice de revue

| Domaine | Implémentation et preuves |
| --- | --- |
| Authentification | bcrypt coût 12, limites 12–72 octets, réponse d’inscription générique, faux hash en cas d’utilisateur absent ; tests identité et frontières Unicode |
| Sessions | Jetons aléatoires 32 octets, seul SHA-256 stocké ; expiration 12 h, rotation et révocation ; cookie HTTPS `__Host-`, Secure/HttpOnly/Strict, pas de repli legacy ; tests identité SQL et E2E |
| Isolation | WithUser sur les ressources privées, propriétaire dans les requêtes et FK composites ; tests catalogue/journal/export/import/rapprochement à deux utilisateurs ; aucun rôle administrateur financier implicite |
| CSRF et authentification abusive | Origine exacte sur les écritures, Sec-Fetch-Site cross-site refusé, pas de CORS permissif ; limite instance 20 essais/minute et Retry-After, tests de refus |
| Entrées et SQL | Corps JSON bornés, champs inconnus et contenu après JSON refusés, pagination bornée, identifiants SQL fixes ou noms de restauration stricts ; valeurs paramétrées |
| Fichiers web | Root, refus des liens symboliques/fichiers spéciaux/cachés et des listes de répertoires ; tests de non-divulgation et du contenu public |
| Transport et exposition | HTTPS exigé pour données réelles, proxy Caddy/HSTS, port API retiré en TLS, DB non publiée, rôle applicatif non privilégié ; Compose vérifié, anciennes preuves HTTPS dans C-03–C-09 ; vrai domaine cible distinct |
| Sources externes | URL BCE fixe, redirections refusées, limites taille/temps, backoff, cache public sans positions ; tests fournisseur et état privé par propriétaire |
| Secrets et logs | Secrets distincts, pas de secret psql en argv, logs fournisseur bornés/expurgés, erreurs DB génériques, contexte de build excluant .env/clés/archives ; pas de trace financière ajoutée |
| Dépendances | Versions verrouillées, npm audit production et govulncheck en CI ; licences des dix dépendances runtime et quinze avis par image ; alertes modérées de développement conservées comme réserve, pas annoncées résolues |
| Sauvegarde et récupération | AES-256-GCM, authentification avant plaintext, refus d’écrasement et de cible existante ; reprise réelle en CI et export identique ; clé hors Git ; restauration cible et planification encore ouvertes |
| Signalement | SECURITY.md ne publie ni contact inventé ni détail sensible ; canal privé GitHub conditionnel à son activation |

Références source/tests : [identité](../../backend/internal/identity/identity_test.go), [catalogue](../../backend/internal/catalog/catalog_test.go), [journal](../../backend/internal/ledger/server_test.go), [fournisseur](../../backend/internal/ledger/provider_test.go), [serveur web](../../backend/internal/httpserver/web_test.go), [script de rôle](../../scripts/tests/test_app_role.py). Preuves antérieures : [C-03–C-09](C-03-C-09.md), [observabilité](P5-5-observability.md), [reprise](P5-operations-hardening.md).

## Vérification du lot

Local : gofmt, syntaxe shell, `git diff --check`, liens documentaires et **13 tests Python** réussis. Les deux nouveaux tests shell vérifient l’absence de secret dans les arguments/entrée standard et le refus des secrets identiques, avec un psql de test ; ils ne sont pas présentés comme une connexion PostgreSQL. Le bootstrap réel est exercé par les intégrations et le Compose en CI.

Trois nouveaux tests Go couvrent les liens/chemins privés, les fichiers spéciaux, HEAD/Range et le maintien des en-têtes, avec le test du build existant. Le laboratoire local restant limité en disque, aucune compilation Go ou exécution de ces nouveaux tests n’est revendiquée localement. Ils réussissent dans la CI de la branche de vérification avant publication sur main.

Les tests financiers/intégration/E2E/build/vuln existants restent requis dans les sept jobs. [Quality 42388263087](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42388263087), commit `1eb226fcb2829124b1c1b4242654e61f72d2acfb` : **sept jobs réussis**. Go vet/race/build/vuln et intégrations PostgreSQL réels passent, ainsi que les parcours navigateur, les builds AMD64/ARM64, licences et documentation. La recette Compose neuve confirme le rôle applicatif utilisable avec le nouveau bootstrap, la sauvegarde chiffrée, la restauration distincte et l’original préservé.

P5.4 clôturé pour ce périmètre de revue interne. Les réserves d’exploitation ci-dessous restent ouvertes ; cette clôture ne signifie pas une certification ni une absence de vulnérabilité future.

## Réserves d’exploitation

P5.3, P5.9 et P5.10 gardent leurs gates : serveur cible, sauvegarde quotidienne activée/copie hors machine, recette produit globale et publication stable. Les alertes de dépendances de développement, la recette lecteur d’écran et la charge restent documentées. Aucun déploiement distant, tag, timer système ou suppression de données n’est effectué par ce lot. Les nouvelles protections n’ajoutent aucun fournisseur ni permission d’accès aux portefeuilles.
