# Sécurité et signalement

Atlas est en développement. Il n’existe pas encore de version stable taguée accompagnée d’un engagement de support ou d’un délai de réponse garanti. Utiliser des commits dont les contrôles ont réussi et lire leurs réserves ; une CI verte n’est pas un audit de sécurité complet.

## Signaler une vulnérabilité

Ne pas publier d’exploit détaillé, donnée financière réelle, mot de passe, cookie, clé d’archive, dump ou `.env` dans une issue ou une PR.

Si le dépôt propose le bouton GitHub **Security → Report a vulnerability**, utiliser ce canal privé. Sa disponibilité dépend des réglages du dépôt ; ce document n’affirme pas qu’il est activé. Sans canal privé publié, ouvrir uniquement une demande de contact au titre neutre, sans détail sensible, puis attendre un moyen privé avant de transmettre la reproduction.

Pour un problème propre à votre instance, contacter son exploitant par le moyen qu’il vous a communiqué. Aucune adresse de sécurité ou identité d’exploitant n’est inventée par le projet.

Préparer une reproduction synthétique minimale : commit, type d’installation, zone affectée, comportement attendu/observé et conditions nécessaires. Conserver les journaux utiles en privé ; masquer les identifiants et données avant tout partage. Les dates d’export, traces d’audit et versions aident l’analyse sans exiger un portefeuille réel.

## Pour l’exploitant

- Utiliser HTTPS pour les identifiants et données réels. Le HTTP explicite est un laboratoire, pas une alternative chiffrée.
- Garder le secret administrateur DB distinct du secret applicatif ; fermer les inscriptions quand elles ne sont plus voulues. Aucun premier inscrit n’est administrateur financier.
- Conserver les volumes et sauvegardes chiffrées. La clé d’archive reste privée et séparée ; sa perte empêche la récupération.
- Consulter [les sondes et diagnostics](docs/operations/observability.md), [la mise à jour](docs/operations/upgrades.md) et [la restauration](docs/operations/backup-restore.md).

La récupération de compte, l’administration financière globale et le partage public de portefeuilles ne sont pas livrés. Un administrateur d’infrastructure pouvant accéder au système et à PostgreSQL est distinct d’un rôle applicatif : ne pas présenter l’isolation entre utilisateurs comme une protection contre un hôte compromis.

En cas d’incident, préserver les preuves, limiter l’exposition de l’instance et faire évaluer les rotations/révocations par son exploitant. Restaurer un snapshot peut restaurer des sessions encore valides ; cela ne remplace pas leur révocation lors d’un incident de sécurité.
