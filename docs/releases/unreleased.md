# Notes préparatoires — Unreleased

P5.10. Ces notes décrivent le code actuel et les changements candidats à la prochaine livraison ; **aucun tag ni version stable n’est publié par ce document**. Tant que la recette MVP n’est pas complète, sélectionner un commit vérifié et conserver son SHA.

## Fonctionnalités disponibles

- Identité locale par mot de passe, sessions privées et portefeuilles/comptes/actifs isolés.
- Journal exact, ouvertures déclarées, cash, achats/ventes/frais/transferts, intérêts crédités et staking simple selon le contrat approuvé ; corrections auditées.
- Valorisation manuelle datée, FX BCE, synthèse et historique sans valeur fictive, consolidation d’instruments entre comptes.
- Récapitulatif exact d’achat avant confirmation ; détail des liquidités/coûts/résultats par compte ; historique des cours et des opérations d’un actif avec audit conservé.
- Série de valeur historique par portefeuille, période explicite et transferts inclus ; aucune assimilation de cette variation à un rendement.
- Répartition exacte par portefeuille, sous-total connu et données manquantes/antérieures distincts ; cours du catalogue même sans position et fractions de positions consultables sans arrondi caché.
- Quantité à vendre lue à la date saisie et copie exacte sans écriture ; variations calendaires de cours du catalogue sans obligation de détention, à dates/devises compatibles.
- Graphique des observations de cours par devise et période explicites, points sans interpolation et liste exacte des sources, y compris sans détention.
- CSV nommés avec aperçu/contrôle de doublons et rapport ; rapprochement readonly ; export JSON et lecteur externe indépendant.
- Image Linux AMD64/ARM64, HTTPS optionnel, sondes de vitalité/readiness et diagnostic BCE ; sources privées non envoyées au fournisseur.

## Durcissement récent

- Reprise réelle d’une archive chiffrée en base distincte, contrôle de l’original conservé.
- Vérification GCM sans fichier plaintext, authentification avant publication de sauvegarde et contrôle d’âge configurable par l’exploitant.
- Serveur web confiné à ses fichiers réguliers ; secret de bootstrap PostgreSQL absent des arguments psql.
- Notices de dépendances transitives, inventaire runtime et contrôle des deux architectures.
- Parcours financier réel au clavier, duplication avec confirmation, erreur récupérable, noms longs et thèmes à trois largeurs.
- Remédiation ciblée de minimatch côté développement et audit npm du graphe complet ; preuves dans [le rapport dédié](../validation/P5-4-development-dependencies.md).

## Installation et compatibilité

Lire [installation](../operations/installation.md), [mise à jour](../operations/upgrades.md) et [sauvegarde/restauration](../operations/backup-restore.md). Conserver projet Compose, volumes, secrets et clé ; vérifier une archive avant changement et restaurer en base distincte si nécessaire.

Les scripts de sauvegarde récents exigent le binaire archive du même commit, incluant `verify`. Mettre à jour l’outil extrait après mise à jour de l’image ; utiliser l’ancien script avec l’ancien outil pour le point de retour précédant le changement. Format chiffré v1 conservé. Aucun import JSON d’instance, suppression de volume ou migration destructive n’est ajouté.

Le runtime n’exige pas Node sur le serveur ; les outils de développement restent sur Node 22.22.1 et Go 1.27.3. Le projet cible Linux ; les builds AMD64/ARM64 ne constituent pas une recette de chaque matériel physique.

## Gates avant une version stable

La [matrice MVP](../validation/MVP-readiness.md) et l’[audit de roadmap](../validation/P5-9-roadmap-audit.md) font référence : cours d’actifs/places pilotes et droits des sources à valider, exports courtiers réels à qualifier, écarts de vues détaillées, lecteur d’écran et charge sur machine de référence, sauvegarde quotidienne/copie hors machine et restauration cible. Les ADR encore proposés ne deviennent pas acceptés parce que le code existe.

Le responsable produit reporte le déploiement de sa machine Linux x86. L’authentification actuelle reste par mot de passe ; le SSO est envisagé ultérieurement et n’est pas livré. Aucune fonction de trading, conseil fiscal, PDF universel, synchronisation de courtier, offline financier ou Research/IA n’est annoncée.

Après levée des gates : choisir explicitement la version, taguer le commit vérifié, joindre les preuves et notes finales et appliquer la procédure de reprise validée. P5.10 reste ouvert jusque-là.
