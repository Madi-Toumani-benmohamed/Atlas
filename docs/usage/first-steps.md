# Premiers pas dans Atlas

F-001 à F-017, P5.7. Utiliser l’origine fournie par l’exploitant. Pour des données réelles, l’accès doit être en HTTPS ; le [laboratoire HTTP](../operations/installation.md) est réservé aux essais synthétiques.

## Compte et espace privé

L’inscription n’est possible que si l’exploitant l’a activée. Une demande reçue ne signifie pas que vous êtes connecté : revenir à la connexion avec l’adresse et le mot de passe choisis. Aucune identité, position ou donnée de démonstration n’est chargée par défaut. La fermeture des inscriptions ne supprime pas les comptes existants.

Après connexion, créer dans **Portefeuilles** un regroupement puis un compte. Choisir le type et la devise réellement utilisés. Livret A et PEL sont des comptes d’épargne en EUR ; les intérêts ne sont enregistrés que lorsqu’ils sont effectivement crédités. Type, devise et rattachement du compte restent fixes ; un mauvais choix se traite par un autre compte et des mouvements explicites, pas par une conversion silencieuse de l’historique.

## Catalogue et première opération

Dans **Actifs**, déclarer les instruments nécessaires. Pour une action/ETF, renseigner ISIN et place MIC ; une vérification de structure ne certifie pas l’existence ni la place réelle d’un titre. Pour une crypto/stablecoin, utiliser un réseau/namespace et une référence explicites : le symbole seul n’est pas une identité suffisante.

Dans **Activité**, enregistrer le dépôt réellement reçu ou une ouverture déclarée avant un achat si nécessaire. Ne pas inventer un dépôt pour forcer l’acceptation d’un historique. Un achat peut utiliser un montant total frais inclus et un prix ; Atlas calcule la quantité exactement. Les ventes exigent la quantité détenue à leur date, même si une opération plus récente donne aujourd’hui un solde suffisant.

Avant confirmation d’un achat, le récapitulatif montre quantité, prix, frais et total dans la devise du compte. Pour une nouvelle vente, « Vérifier la quantité à cette date » lit les titres détenus après les opérations déjà enregistrées à cet instant. « Utiliser la quantité exacte » reprend la fraction du serveur dans le champ, sans enregistrer de vente. Ce contrôle ne réserve pas les titres ; la confirmation peut encore refuser un historique incohérent.

Une ouverture explicite permet de reprendre un historique partiel. Elle ne transforme pas cette reprise en historique complet : résultat global ou coût de position peuvent rester non calculables. Les [règles financières](../decisions/financial-policy.md) sont économiques, pas fiscales.

Pour un transfert entre vos comptes, choisir la contrepartie au lieu de créer un dépôt externe qui doublerait les apports. Un transfert entre devises nécessite son taux effectif et sa provenance. Les récompenses simples de staking exigent un cours daté à réception ; ce cours forme revenu et coût d’acquisition selon le contrat approuvé.

## Valeur et qualité des données

Les cours d’actifs sont actuellement manuels, positifs, datés et sourcés. Les taux de référence BCE peuvent être récupérés à la demande dans Activité ; ils ne remplacent pas les taux effectivement exécutés pour une transaction. Le panneau « État de la récupération BCE » lit le diagnostic sans contacter le fournisseur ; une panne ne supprime pas les taux déjà enregistrés.

Sur **Accueil**, distinguer le résultat personnel de la variation du cours du marché. Un apport n’est pas un profit ; un transfert interne n’est pas un nouvel apport. Une absence de cours ou de FX produit une valeur incomplète, pas un zéro fictif. Les dates et sources anciennes restent visibles.

Dans **Actifs**, « Cours et historique de cet actif » expose les observations même sans détention. La devise du cours reste celle de la source ; les positions par compte distinguent arrondi (`≈`) et valeurs exactes. Un échec de lecture des cours ne devient pas un prix zéro.

Dans **Portefeuilles**, consulter la répartition des valeurs connues et l’évolution de valeur du portefeuille sélectionné. Cours/FX manquants ou anciens restent signalés. Les transferts et apports changent cette courbe : ce n’est pas un rendement personnel. Un portefeuille sans compte a une vraie valeur zéro ; un total inconnu reste non calculable.

Choisir explicitement les bornes de l’historique, au plus 366 jours par demande. Les positions de chaque date sont utilisées ; un manque de données interrompt la série. L’historique ne réécrit pas le passé avec les seules positions d’aujourd’hui.

## Corriger, importer, rapprocher

Une erreur d’opération se corrige depuis Activité avec un motif, par remplacement ou annulation logique. L’original reste dans l’audit. Atlas refuse une correction qui rendrait un autre point de l’historique incohérent. Les saisies refusées restent disponibles pour correction.

Dans **Imports**, choisir le format nommé avant de charger le CSV. Les [adaptateurs Coinbase/Trade Republic](../formats/broker-csv.md) demandent un compte et des correspondances d’actifs explicites. Lire les anomalies et la couverture ; une ligne ambiguë peut empêcher la confirmation du lot entier. Ne pas assimiler un transfert ou swap à un apport pour contourner ce contrôle.

Le [rapprochement](../formats/atlas-balances-v1.md) utilise un fichier de soldes, pas un fichier de transactions. Sans déclaration de complétude, les positions omises ne sont pas contrôlées. Une déclaration de relevé complet permet de détecter une détention absente ; elle ne contrôle pas les liquidités sans ligne cash. Un écart exact reste visible même s’il est inférieur à la précision arrondie. Le rapport n’ajoute ni correction ni ouverture.

## Export et conservation

« Exporter mes données » télécharge le JSON privé : comptes, portefeuilles, actifs, journal/audit, observations et rapports d’import disponibles. Il est lisible hors Atlas, mais n’est pas un bouton de restauration JSON. Le rapport de rapprochement possède son propre téléchargement. Conserver les fichiers dans un emplacement privé ; ils contiennent des informations financières.

L’export utilisateur ne remplace pas une sauvegarde chiffrée complète de l’instance avec ses comptes et sessions. L’exploitant suit [la procédure de sauvegarde/restauration](../operations/backup-restore.md). Se déconnecter sur un poste partagé ; le manifeste d’application ne promet pas de consultation financière hors ligne.
