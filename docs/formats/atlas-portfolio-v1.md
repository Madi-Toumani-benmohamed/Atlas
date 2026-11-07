# Export JSON Atlas Portfolio v1

F-020, PRD §12 critère 10 ; documentation P5.7. Contrat observé dans `ledger.export` et `catalog.ReadExport`. Fichier privé destiné à la lecture externe ; **aucun import JSON de restauration applicative n’est livré**.

## Obtenir et identifier

Le bouton « Exporter mes données » utilise `GET /api/v1/financial-export`, sous session du propriétaire. Réponse JSON non cacheable, téléchargement `atlas-portfolio.json`. Les lectures SQL utilisent un instantané repeatable-read cohérent, en lecture seule.

Reconnaître `format="atlas-portfolio"` et `version=1`. Un lecteur doit refuser une version inconnue ou annoncer qu’il ne sait pas l’interpréter. Les champs supplémentaires peuvent être conservés sans les inventer ou les convertir ; un fichier tronqué/non JSON n’est pas un export réussi.

| Champ | Contenu |
| --- | --- |
| `exported_at` | Heure UTC de génération ; ce n’est pas l’heure du relevé d’un courtier |
| `portfolios` | ID, nom, archivage et date de création |
| `accounts` | ID, portefeuille, nom, type, devise, fournisseur déclaré, produit d’épargne, archivage, création |
| `assets` | ID, nom, type, symbole, namespace/place, référence, devise, archivage, création |
| `operations` | Journal et audit, dont versions remplacées et annulations logiques |
| `prices` | Observations de prix/FX datées, source, type, référence BCE éventuelle et représentation numérique |
| `imports` | Lots d’import : ID, empreinte, lignes/événements normalisés, erreurs/doublons, confirmation et création |
| `replay_ordering` | Convention de rejeu des opérations actives |
| `number_encoding` | Convention des chaînes numériques et calculs exacts |
| `attributions` | Liens d’attribution, notamment BCE |

Les IDs sont des identifiants privés opaques, pas des tickers ou coordonnées publiques. `portfolio_id`, `account_id`, `target_account_id`, `asset_id` et `corrects` lient les éléments. Les ressources archivées restent incluses ; les noms et métadonnées sont ceux de l’instantané actuel, pas un journal historique des renommages.

Le seul catalogue peut aussi être obtenu par `GET /api/v1/export`, identifié `atlas-catalog`. Ce dernier exclut explicitement opérations, prix et FX : ne pas le confondre avec l’export financier complet de l’interface.

## Nombres, unités et dates

Les valeurs financières sont des **chaînes**, pas des nombres flottants JSON. Les sources sont décimales selon leurs champs ; les quantités exactes et les taux dérivés peuvent contenir une fraction telle que `100/3` ou `10/11`. La représentation `value_number` des observations comprend `exact`, `display` et `approximate`.

Pour lire ou recalculer, utiliser décimaux exacts/rationnels. `display` sert à l’affichage ; ne pas le réinjecter dans un calcul, ni convertir les chaînes avec `parseFloat` pour un résultat financier. Préserver les unités : prix et montants ne sont pas des quantités, et les devises de compte ne se substituent pas au taux historique réellement enregistré.

Les timestamps portent leur décalage/UTC et peuvent contenir des fractions de seconde. Les comparer comme des instants sans réduire leur précision. `reference_date` d’un taux BCE est une date de référence, distincte de `observed_at`, heure où l’observation a été conservée ; elle n’invente pas une heure de publication historique.

## Rejouer le journal

1. Conserver **toutes** les versions pour l’audit.
2. Pour calculer, sélectionner uniquement `active=true`.
3. Trier par `occurred_at`, puis par `replay_order` lorsque l’instant est identique.
4. Appliquer les contrats exacts du [journal et moteur](../decisions/C-03-C-09.md) et de la [politique financière](../decisions/financial-policy.md).

`replay_order` est un rang relatif à cet export/propriétaire, pas la séquence globale PostgreSQL. Une correction peut partager le rang de l’original : une seule version de cette chaîne doit être active. `corrects` et `reason` expliquent remplacement ou annulation ; l’absence de version active ne doit pas se transformer en suppression de l’audit.

Une ouverture et un historique partiel ne donnent pas automatiquement un coût connu ou une performance complète. L’export ne contient pas de résultat fiscal garanti, de TWR inventé ou de positions historiques obtenues en appliquant les seules détentions actuelles au passé.

## Conservation et limites

Les mots de passe, leurs hashes, sessions, cookies et secrets ne sont pas inclus dans cet export applicatif. Les noms de comptes, notes, transactions et observations sont néanmoins des données financières privées ; conserver le fichier en conséquence.

Les rapports de rapprochement sont téléchargés séparément et non persistés sur le serveur. Les CSV bruts des courtiers ne sont pas reconstitués : les événements normalisés et rapports disponibles ne remplacent pas le fichier source personnel.

Le plafond de 32 Mio du catalogue concerne ces seules métadonnées ; il ne signifie pas que tout l’export financier est plafonné à 32 Mio ou diffusé en streaming. Un historique très volumineux exige une recette de taille/temps adaptée ; aucune garantie de charge universelle n’est annoncée.

Pour restaurer **l’instance** avec utilisateurs et sessions, utiliser [la sauvegarde chiffrée PostgreSQL](../operations/backup-restore.md), pas ce JSON. Les droits de réutilisation de cours tiers restent distincts de la licence du code ; conserver les attributions.
