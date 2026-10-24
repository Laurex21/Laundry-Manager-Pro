# Suspension temporaire de la maintenance automatique

Réglage serveur : `XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED=true`.

Ce réglage est indépendant de pawaPay. Pour la publication de contrôle, conserver aussi `SAAS_BILLING_MODE=disabled` et `SAAS_LIVE_ENABLED=false`.

## Effets

- Suspend les corrections automatiques des liens compte/organisation et la synchronisation des administrateurs configurés au démarrage.
- Suspend les tâches quotidiennes (notifications/expiration des abonnements clients et expiration des points de fidélité).
- Suspend les recalculs périodiques des indicateurs clients, les transitions SaaS et le rapprochement automatique pawaPay.
- Remplace les ajustements implicites du schéma des vêtements, des paramètres boutique et de la précision des quantités par des contrôles de structure en lecture seule. Un schéma incomplet doit être traité par une migration revue ; il n'est pas réparé silencieusement.

Le réglage est absent ou vaut `false` par défaut : le comportement habituel est conservé. Revenir à `false` puis redémarrer réactive les tâches ; elles pourront alors traiter les échéances accumulées. La suspension ne doit pas rester activée durablement.

## Limites

Ce réglage suspend la maintenance automatique ; il ne transforme pas l'application en base de données en lecture seule. Les opérations explicites des utilisateurs, les sessions de connexion et les journaux techniques continuent de fonctionner normalement. Pour les vérifications de publication, consulter les données existantes sans soumettre de formulaire de modification. Les migrations manuelles restent des opérations distinctes.

## Mise en place ultérieure

1. Faire relire et intégrer cette correction dans les sources destinées à Replit.
2. Configurer le réglage dans les Secrets du déploiement, en gardant pawaPay désactivé et la copie du développement vers la production décochée.
3. Après autorisation de publication, vérifier le message `[maintenance] Automatic maintenance suspended for release verification.` et les écrans métier, sans modifier les données métier.
4. Réactiver les traitements seulement après la fenêtre de vérification autorisée.

## Validation

`npm run test:automatic-maintenance` utilise exclusivement PGlite en mémoire, des données fictives et une URL inutilisable. Il contrôle l'absence de connexion/écriture/programmation des traitements suspendus, y compris quand SaaS Sandbox est configuré avec une clé factice ; les contrôles de schéma restent des SELECT et refusent une colonne absente. Il vérifie la conservation des données fictives, les opérations explicites et la reprise des traitements quand le réglage est absent ou vaut false.

Aucune installation en production ni publication n'est effectuée par ce document ou le modèle de configuration.
