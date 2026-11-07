# P5.1 — Lecture externe de l’export, 7 novembre 2026

F-020, PRD §12 critère 10, lot P5.1. Branche `work/atlas-export-reader`, suite de `3a565d5` (P5.7). L’export privé complet existait ; ce lot ajoute une preuve de lecture indépendante. Aucun schéma, migration, calcul métier, contrat financier ou endpoint modifié.

## Livré

- `scripts/read-export.py` : lecteur hors ligne Python standard, format/version/conventions explicites, collections/références/audit, nombres exacts via Fraction, tri à la nanoseconde. Résumé sans noms ni IDs ; option journal explicitement privée. Aucune écriture, API, DB ou exécution de contenu du fichier.
- Limite lecteur 64 Mio, chaînes numériques 8192 caractères, diagnostics fixes ; refus des fichiers tronqués, clés JSON dupliquées, valeurs non finies, nombres financiers flottants et chaînes de correction incohérentes.
- Tests Python du contrat et invocations du lecteur dans les E2E portefeuille/courtiers ; job documentation étendu aux tests Python. [Guide de lecture](../usage/read-export.md) et contrat export reliés.

## Vérifications exécutées localement

`python3 -B -m unittest discover -s scripts/tests -v` : sept tests réussis, dont dix-sept variantes structurelles négatives ; exactitude `0.1 + 0.2 = 3/10`, fraction `100/3`, grande valeur décimale, chaîne de plus de 4300 chiffres, nanosecondes avec décalage, rangs à même instant, annulation, cycle et erreur d’arrondi de prix. Le CLI conserve les octets du fichier, refuse une entrée >64 Mio et n’affiche pas les valeurs privées dans ses erreurs.

`npm run test:portfolio` contre API Go et PostgreSQL 18.6 réels : téléchargement par l’interface, 1 portefeuille/compte/actif, 4 opérations dont 3 actives, 1 lien de correction, 1 observation. Le lecteur retrouve l’achat corrigé montant exact 450 et prix 90 ; aucune quantité source inventée pour cet achat par total. Puis le parcours vente partielle/rejet de vente excessive, valorisation, rechargement et les 22 audits axe à trois largeurs réussissent.

`npm run test:brokers` contre la même instance dédiée : lecteur sur le vrai export de 2 comptes, 2 actifs, 4 opérations actives, lots d’import et transfert de quantité 1. Aperçus/confirmations et consolidation entre comptes réussis. Fixtures courtiers exclusivement synthétiques ; aucune donnée personnelle utilisée.

Le premier ajout au test portefeuille attendait à tort une quantité source pour un achat saisi par total ; cette assertion a été corrigée selon le contrat réellement exporté, sans changement de l’application. Les contrôles finaux ci-dessus passent.

`npm run lint`, contrôles des liens et configurations Compose documentées, syntaxe Python/workflow et `git diff --check` réussis. Le serveur testé est le binaire applicatif P5.5, code applicatif inchangé depuis ; seule la lecture/test/documentation change. Les services de recette lancés pour ce lot sont arrêtés après validation, volumes conservés.

## Limites et publication

Cette preuve satisfait la lecture externe de P5.1 ; elle ne démontre ni un réimport JSON ni un recalcul indépendant complet du ledger. Le lecteur valide la structure utile, pas toute la sémantique métier ou l’authenticité d’un export. Charge très volumineuse et restauration sur serveur cible restent ouvertes. Les critères restants du MVP ne changent pas de statut.

CI hébergée de ce lot non exécutée avant publication. La [CI du parent P5.7](https://github.com/Madi-Toumani-benmohamed/Atlas/actions/runs/42364212004) a six jobs réussis ; elle n’est pas présentée comme une preuve des nouveaux contrôles.
