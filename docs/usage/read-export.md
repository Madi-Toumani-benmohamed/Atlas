# Lire un export sans Atlas

F-020, P5.1, PRD §12 critère 10. Le [format JSON v1](../formats/atlas-portfolio-v1.md) reste la référence ; le fichier original conserve le catalogue, le journal/audit, les observations et les rapports d’import disponibles.

## Lecteur indépendant

Depuis un checkout, avec Python 3.10 ou ultérieur :

```sh
python3 scripts/read-export.py /CHEMIN_PRIVE/atlas-portfolio.json
```

Le [script](../../scripts/read-export.py) utilise uniquement la bibliothèque standard Python : aucune importation du backend Go, connexion PostgreSQL, requête réseau ou modification du fichier. Il reste utilisable quand Atlas est arrêté. Le chemin ne doit pas être une URL ; choisir un fichier local de confiance, conservé dans un répertoire privé.

La sortie JSON `atlas-export-inspection` donne les nombres de portefeuilles, comptes, actifs, opérations, observations et lots d’import ; les nombres d’opérations actives/inactives et de liens de correction ; les types d’opérations actives et le nombre de valeurs exactes lues. Ce sont des informations privées, même sans noms ni identifiants. Ne pas publier le rapport ou le fichier d’origine.

Le lecteur accepte uniquement `atlas-portfolio`, version 1, avec les conventions de nombres/rejeu connues. L’export catalogue seul est refusé. Il contrôle les collections, identifiants uniques, références entre ressources, chaînes de correction et représentations numériques exactes des opérations/prix. Une référence absente, une chaîne cyclique ou plusieurs versions actives d’un même rang sont refusées. Il ne remplace ni une validation exhaustive du schéma métier ni une preuve cryptographique d’authenticité ; un fichier modifié peut rester structurellement cohérent.

## Examiner le journal actif

```sh
python3 scripts/read-export.py --journal /CHEMIN_PRIVE/atlas-portfolio.json
```

Cette option ajoute `active_journal`, qui contient des **données financières privées**, dont notes, identifiants et sources. Le tri respecte les instants RFC3339 jusqu’à neuf décimales et leurs décalages, puis `replay_order`. Les versions inactives restent dans le fichier original et sont comptées dans le rapport ; elles ne sont pas rejouées comme actives.

Chaque opération expose ses champs v1 connus et `exact_numbers`, les valeurs sources interprétées en rationnels exacts : `450.00` devient `450`, `100/3` reste `100/3`, `0.1` devient `1/10`. Les champs source restent présents dans l’opération. Un achat saisi par total peut n’avoir que `amount` et `price` : le lecteur ne fabrique pas une quantité source absente. Il ne calcule ni positions, ni valorisation, ni performance, ni résultat fiscal.

Les champs supplémentaires sont ignorés dans le rapport, conservés dans le fichier original intact. Les métadonnées du catalogue et les rapports d’import peuvent être lus directement dans ce JSON ; le journal réduit n’est pas un remplacement de l’export original.

## Refus et limites

Un succès renvoie le code 0 ; lecture impossible ou fichier refusé : code 1, sans valeur d’entrée ni chemin privé dans le diagnostic du lecteur. Une erreur d’usage des arguments renvoie 2. Aucun fichier de sortie n’est créé par le programme.

Le lecteur limite sa propre entrée à **64 Mio**, indépendamment des limites de l’API. Les chaînes numériques sont bornées à 8192 caractères ; les fractions exactes et les grandes valeurs restent des chaînes. La commande ne doit pas être utilisée pour ouvrir un flux spécial sans fin. Elle charge le fichier en mémoire ; une recette de taille supérieure demande un lecteur adapté. Les chaînes JSON échappées restent des données, jamais du code exécuté.

Un succès n’installe rien et ne restaure ni utilisateurs, ni sessions, ni base. Pour restaurer l’instance, utiliser [la procédure PostgreSQL chiffrée](../operations/backup-restore.md). L’absence de signature signifie qu’il faut conserver l’original et les sauvegardes protégés.

## Preuves et reproductibilité

```sh
python3 -B -m unittest discover -s scripts/tests -v
```

Les tests synthétiques couvrent exactitude décimale/rationnelle, grandes chaînes, nanosecondes/décalages, audit/annulation, versions inconnues et fichiers corrompus. Les parcours `npm run test:portfolio` et `npm run test:brokers`, sur instance dédiée, exécutent aussi ce lecteur sur le JSON réel téléchargé depuis l’interface/API et vérifient que les octets du fichier source restent identiques. Les bibliothèques du moteur Go ne sont pas utilisées par le lecteur. Voir [le rapport P5.1](../validation/P5-1-export-reader.md).
