# Licence et dépendances distribuées

P5.8, NFR-14/15. La licence du code Atlas est déjà [Apache 2.0](../../LICENSE) ; ce lot ne la change pas. Les dépendances gardent leurs licences et avis propres. Le fichier [dependencies.json](dependencies.json) décrit les versions réellement compilées dans les commandes Go et présentes dans le graphe npm de production, avec empreintes SHA-256 des notices examinées.

## Inventaire actuel

| Composants | Licence / conservation |
| --- | --- |
| pgx/v5, pgpassfile, pgservicefile, puddle/v2 | MIT : conserver copyright, permission et exclusion de garantie |
| golang.org/x/crypto, x/sync, x/text ; bibliothèque/toolchain Go | BSD-3-Clause : conserver conditions et avertissement ; ne pas utiliser les noms des auteurs pour promotion ; fichiers PATENTS des modules conservés |
| react, react-dom, scheduler | MIT : conserver la notice complète, y compris la dépendance transitive scheduler |
| Code Atlas | Apache-2.0 : licence existante, conditions et avis applicables conservés |

Les textes MIT et BSD-3-Clause examinés permettent cette distribution avec Atlas sous Apache 2.0, en conservant leurs propres avis ; ils ne sont pas remplacés par la licence Atlas. La collecte embarque les fichiers complets disponibles, pas seulement leurs identifiants SPDX.

## Contrôles reproductibles

Avec la version Go du `go.mod` et `npm ci` effectué dans `web/` :

```sh
python3 scripts/check-licenses.py
```

Le script compare versions et octets des notices au manifeste revu. Une dépendance Go inconnue, une licence npm hors du périmètre MIT actuel, une version divergente ou une notice modifiée fait échouer le contrôle. Il utilise les dépendances des commandes distribuées et `npm ls --omit=dev --parseable --all`, pas la seule liste des dépendances directes.

Après revue d’une modification des sources et textes applicables, `python3 scripts/check-licenses.py --write` régénère un candidat à relire dans le diff. Ne pas accepter un changement d’empreinte uniquement pour rendre la CI verte. Le contrôle n’est pas un moteur universel de compatibilité de licences.

Les builds collectent les avis dans `/web/licenses/` et `/licenses/`. Après extraction de `/web/licenses/` d’une image, vérifier :

```sh
python3 scripts/check-licenses.py --artifact-dir /CHEMIN_DES_NOTICES_EXTRAITES
```

Cette variante vérifie les 15 fichiers attendus de l’artefact contre le manifeste, sans exiger Go/npm sur l’hôte. Elle est distincte de la vérification du graphe source. La CI réalise les deux et contrôle les images AMD64/ARM64.

Une omission réelle a été détectée dans l’ancienne image : la collecte frontend sans `--all` excluait `scheduler`. Le correctif conserve maintenant son avis MIT et le contrôle d’artefact refuse l’image incomplète. [Preuves et réserves](../validation/P5-operations-hardening.md).

## Périmètre séparé

Les outils de développement/build non redistribués dans l’image scratch ne sont pas assimilés aux bibliothèques runtime du manifeste. Ce fichier n’est pas un SBOM exhaustif des images de services externes. PostgreSQL et Caddy restent des images distinctes avec leurs licences et notices d’amont ; ne pas les retirer lors d’une redistribution de ces images. Le runtime Atlas scratch ne copie pas les exécutables Node ou Alpine du builder.

Les cours tiers ne deviennent pas Apache 2.0 avec le code. Seule la source automatique FX BCE est implémentée, avec attribution et transformations explicites ; les observations manuelles restent privées et leurs droits ne sont pas attestés par l’application. Les droits de flux actions/ETF/crypto restent à valider avant ajout, selon [couverture marché](../decisions/market-coverage.md). Aucun droit universel de redistribution de ces flux n’est annoncé.
