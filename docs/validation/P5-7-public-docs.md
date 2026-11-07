# P5.7 — Documentation publique, 7 novembre 2026

Références : P5.7, F-020/F-022, PRD §12. Branche locale `work/atlas-public-docs`, base applicative `562146d`. Aucune migration ni modification du moteur financier.

## Livrables

[Index public](../index.md), guides d’installation/configuration, premiers pas, mises à jour et retour arrière ; contrat JSON atlas-portfolio v1, contribution, signalement de sécurité et modèle de PR. Les procédures de sauvegarde existantes restent la référence. La [matrice de recette](MVP-readiness.md) expose les quinze critères et leurs réserves sans déclarer P5.9 terminé.

Deux fichiers Compose facultatifs : exposition API sur loopback pour laboratoire synthétique ; sélection explicite d’une base déjà restaurée dans le même projet et volume. Le Compose de base conserve ses ports. Aucun conteneur, restauration, suppression ou déploiement exécuté par ces fichiers de configuration seuls.

## Contrôles

`python3 scripts/check-docs.py` vérifie les cibles locales explicites Markdown, sans réseau ni contrôle d’ancres. Fixtures temporaires : liens relatifs, référence, espace encodé, image, liens cassés, chemins hors checkout et fichier symlink hors checkout ; code fenced ignoré.

`python3 scripts/check-compose-docs.py` rend les configurations avec `.env.example` : loopback seul, TLS sans publication API, base restaurée conservant le service DB et les volumes ; absence du nom de restauration refusée. Aucun conteneur lancé, aucun secret réel utilisé ou affiché.

La commande documentée de création `.env` est exécutée dans un répertoire temporaire : deux secrets hexadécimaux distincts, permissions 0600, aucune sortie contenant les secrets, refus d’écrasement et contenu initial conservé. Syntaxe Python/YAML et `git diff --check` contrôlés.

Un job documentation est ajouté au workflow Quality existant. Ces contrôles locaux ne constituent pas une exécution hébergée du nouveau job. Les suites applicatives antérieures ne sont pas présentées comme réexécutées pour ce lot documentaire ; les cinq jobs existants restent inchangés. Installation/restauration sur serveur cible, vrai certificat public, lecteur d’écran, qualification d’exports courtiers réels et couverture automatique de cours restent ouverts.
