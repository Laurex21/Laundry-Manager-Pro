# Pilote d’encaissement de 50 FCFA — préparation, sans activation

Le pilote est un encaissement technique distinct d’un abonnement. Le prix Pro reste 10 999 FCFA. Les 50 FCFA ne créent aucun droit, période, renouvellement ou crédit d’abonnement et ne sont pas remboursés automatiquement.

## Périmètre préparé

- Laurepressing, propriétaire vérifié : laure2025xx@gmail.com, organisation 424.
- Lecture seule de production : Starter actif, ancien Enterprise annulé, une boutique, aucun employé. Il s’agit encore du catalogue historique ; aucune migration vers Starter v5 n’est effectuée.
- Paiements maintenus désactivés, traitements automatiques suspendus. Aucun paiement réel, changement d’abonnement ou publication pendant cette préparation.
- La future option `SAAS_LIVE_PILOT_PURPOSE=collection` doit être utilisée avec un identifiant d’organisation vérifié. Elle ne suffit pas à activer les paiements : les protections Production existantes restent obligatoires.

## Comportement

Le serveur fixe le montant à 50 XAF. Le navigateur ne choisit ni montant ni formule. Seul le propriétaire de l’organisation pilote peut créer ou ouvrir la demande. Les autres comptes et les employés sont refusés.

Une demande unique est conservée par organisation et environnement, sous verrou de l’organisation. Une confirmation, un échec ou une expiration ne crée pas une nouvelle demande. Les répétitions réutilisent le même identifiant pawaPay ; après un statut final, un nouvel encaissement exige une décision et un changement séparés. Une demande expirée avant ouverture nécessite également une vérification, pas une recréation automatique.

Les confirmations utilisent le récepteur signé existant. Le montant du dépôt, la devise XAF, le pays CMR, la référence et le code de paiement sont contrôlés. Une réponse de création perdue est récupérée par lecture de l’état pawaPay. Une notification reçue deux fois n’enregistre qu’une seule confirmation. Une incohérence reste bloquée.

Les seules écritures prévues lors d’un futur test réel sont la demande/paiement dans `saas_invoices` et les événements techniques dans `saas_events`. Le chemin de test ne crée pas de compte SaaS et n’appelle pas la lecture susceptible de réconcilier un abonnement. Les abonnements historiques et SaaS, leurs dates, les accès et les données métier sont conservés. Les factures de ce pilote sont séparées de la liste des factures d’abonnement. Aucune migration de schéma n’est nécessaire.

## Vérification réalisée

- Test d’intégration : PGlite en mémoire, fausse clé, fournisseur simulé et notifications signées par une clé locale de test. Aucune connexion à la base réelle ni à pawaPay.
- Paiements désactivés : aucun accès au fournisseur ni création de demande.
- Isolation propriétaire/employé/autre organisation ; refus de montants ou sélections fournis par le navigateur.
- Demandes simultanées, montant altéré, succès signé, doublon, référence/code/devise/montant incorrects, absence de dépôt, échec, annulation, expiration et récupération d’une réponse perdue.
- Comparaison avant/après des tables métier et d’abonnement, avec Starter historique et avec un abonnement historique Enterprise et un état SaaS préexistant.
- Parcours UI isolé, français/anglais et largeur mobile de 390 px. La démonstration d’écran simule le résultat ; la vérification cryptographique est testée séparément dans le test d’intégration.
- Tests existants des abonnements, du lancement pilote, des accès, de la maintenance et TypeScript.

Ce travail prépare le pilote. Il ne prouve pas encore un encaissement réel de 50 FCFA, ni les frais effectifs, ni l’achat d’une formule. Avant un futur test réel : installation revue, sauvegarde fraîche, vérification de la configuration Production, décision explicite de publication/activation du seul pilote, puis autorisation Mobile Money par le propriétaire.
