# P5.4 — Dépendances de développement, 7 novembre 2026

NFR-04/05/13/14, suite de la revue sécurité. Les premiers audits conservaient des alertes modérées sur le graphe de développement ; cette réserve est traitée séparément des bibliothèques livrées dans le runtime.

## Constat et correction

`npm audit --json` avant modification : **10 alertes modérées**, dont minimatch et ses dépendants ESLint/TypeScript-ESLint. Avis [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), amplification de globparts, plage affectée `>=7.0.0 <11.0.1`. La version installée était 10.2.6.

Un override npm ciblé fixe minimatch à **11.0.1**, avec son helper `@isaacs/nonrecursive-glob-match` 1.1.0. Ce changement de version majeure transitive est limité aux outils de développement : pas de mise à jour forcée d’ESLint/TypeScript, pas de changement des trois paquets runtime React/react-dom/scheduler, ni du graphe Go. Le lockfile ne change que ces deux entrées. Le moteur Node déclaré par minimatch accepte la chaîne Node 22.22.1 utilisée en CI.

Les deux textes BlueOak-1.0.0 des archives npm publiées ont été lus ; ils requièrent de conserver leur texte ou lien en cas de redistribution de ces outils. Ils ne sont pas copiés dans l’image scratch d’Atlas et ne remplacent pas les licences des dix dépendances runtime. La licence Atlas reste Apache 2.0.

La CI exécute maintenant `npm audit` sur le graphe **complet**, au lieu d’omettre les dépendances de développement. La protection précédente du graphe de production n’est pas abaissée. L’override devra être réévalué lors d’une mise à jour amont compatible ; ne pas le retirer sans audit et vérification des consommateurs.

## Validation locale

- Installation ciblée : un paquet ajouté, un remplacé ; `npm ls minimatch --all` confirme 11.0.1 pour ESLint et TypeScript-ESLint.
- Audit du lockfile candidat puis du projet installé : **0 vulnérabilité** à tous niveaux dans la base d’avis consultée ce jour, retour 0.
- `npm run lint`, `npm run build`, `npm test` : réussis ; cinq tests HTTP frontend. CSS/JS de production conservent les mêmes noms de contenu (`index-BeDCWMLw.css`, `index-DObdhabG.js`) observés avant correction.
- Les versions/métadonnées des paquets de production sont identiques dans le lockfile ; contrôle des licences runtime conservé.

Les sept jobs CI et les parcours clavier/finance réels doivent encore confirmer la compatibilité de cet override avant fusion. Cette mesure datée ne promet pas l’absence d’avis futurs.
