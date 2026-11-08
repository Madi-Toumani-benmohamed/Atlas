# P3.6 — Récapitulatif d’achat avant confirmation

7–8 novembre 2026. F-008/F-010/F-013, US-002 étapes 3–6, NFR-01/08/09 ; phase 3 et recette P5.9. Application des formules déjà approuvées dans C-03–C-09, sans nouvelle politique financière.

Le formulaire d’achat montre, avant enregistrement, le compte et sa devise, l’identité de l’actif, la quantité calculée, le prix, les frais et le total débité frais inclus. En mode total : `(total − frais) / prix`. En mode quantité : `quantité × prix + frais`. Les calculs utilisent des fractions BigInt, jamais des nombres flottants. L’arrondi d’affichage est séparé (quantité/prix huit décimales, monnaie deux), signalé par `≈` ; les valeurs exactes restent disponibles, avec détail dépliable pour la quantité non représentable à huit décimales.

L’aperçu lit les champs du formulaire sans les modifier, sans requête supplémentaire et sans écriture. Le serveur conserve la validation définitive des liquidités, de la date, des droits, des devises et de l’historique. Une saisie incomplète/invalide n’affiche pas un résultat plausible. Les écritures de fractions non canoniques historiques restent interprétées par le backend existant ; l’aperçu peut être indisponible sans bloquer leur soumission. Les valeurs calculées dans l’aperçu ne sont pas injectées dans la requête d’écriture.

Aucune migration, dépendance ou modification du moteur Go. Désactivation pendant écriture, brouillon et réessai idempotent existants préservés. Retour arrière : revenir ensemble sur le composant, son helper et l’inclusion dans Finance ; aucune conversion de données.

## Vérification

Local : `npm run lint`, `npm run build`, `npm test` réussis. Les tests numériques couvrent les deux modes, les frais, les décimales françaises, les divisions non terminantes, les bornes des sources, les frais supérieurs/égaux au total, zéro/négatifs/exposants et la quantité dérivée de 37 chiffres. Ils vérifient valeurs exactes et arrondis séparément. Le navigateur local vérifie les deux modes, la fraction et les frais, six scans axe et le responsive avec API simulée ; capture à 320 px inspectée. Cette preuve UI ne remplace pas PostgreSQL.

Le parcours `npm run test:purchase-preview`, ajouté à Quality, utilise l’API et PostgreSQL réels sur une instance synthétique dédiée. Il vérifie l’absence d’achat avant confirmation, le passage entre modes, les frais, une quantité `1/3`, une insuffisance de liquidités sans perte du brouillon, puis quantité exacte `1/3` et cash `9` après achat de `1` sur dépôt de `10`. Six analyses axe et absence de débordement sur 1440/390/320 px en sombre/clair. Ce parcours réel doit réussir dans la PR avant fusion ; aucun succès SQL local n’est revendiqué.
