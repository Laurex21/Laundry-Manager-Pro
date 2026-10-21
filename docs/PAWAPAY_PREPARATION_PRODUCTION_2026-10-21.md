# Préparation pawaPay Production — 21 octobre 2026

## Périmètre

Préparation locale seulement. Aucun déploiement, aucune migration sur une base externe, aucune lecture ou modification des données de production, aucune modification des Secrets de production et aucun paiement réel. Les tests utilisent une base PostgreSQL PGlite en mémoire et des comptes fictifs. Le renouvellement reste manuel.

Le mode réel est préparé dans le code mais n'est activé sur aucun environnement. Les essais de ce mode utilisent exclusivement un transport simulé : ils ne prouvent ni la validité d'une clé réelle, ni l'autorisation commerciale du compte marchand.

## Code prêt pour revue

- Sélection explicite `disabled` / `sandbox` / `live`. Sans configuration, le moteur reste désactivé. Le Sandbox reste inopérant sous `NODE_ENV=production`.
- `live` exige simultanément un processus de production, une activation explicite, une déclaration d'environnement de base, une clé de production dédiée et une origine HTTPS permanente. Une configuration réelle incomplète est refusée ; aucun repli vers les identifiants Sandbox.
- Hôtes API et checkout fixés dans le code. Origine de retour imposée par le serveur, jamais par le navigateur du client. Les hôtes de prévisualisation `*.replit.dev` sont refusés pour le réel.
- Clés de vérification des signatures téléchargées et mises en cache séparément pour chaque environnement. Une notification Sandbox est refusée sur le chemin réel et réciproquement.
- Chaque facture porte `provider_environment`. Les anciennes factures restent Sandbox. Lecture, confirmation, rapprochement et reprise d'un checkout sont limités à l'environnement courant. Les paiements réels sont tracés avec `payment_source=pawapay_live`.
- Interface FR/EN distincte : avertissement explicite en Sandbox ; paiement sécurisé et renouvellement manuel en réel.
- Aucun prélèvement récurrent et aucun remboursement automatique. Un encaissement sur devis devenu incompatible reste en vérification humaine, sans abandon de l'argent reçu.

## Vérifications reproductibles sans production

```bash
npm run test:saas-billing
npm run check
npm run build
node --import tsx scripts/check-saas-production-readiness.ts --example
```

Le dernier contrôle est hors ligne : aucune connexion à une base ou à pawaPay, aucun affichage de clé. `--example` utilise une adresse et une clé factices, sans modifier les variables du processus de l'application. Sans cette option, il examine seulement la configuration du processus du script ; il ne constitue pas une autorisation de bascule.

Tests ajoutés : première notification Checkout signée activant réellement le compte en mémoire, sans ordonnanceur ni appel de rapprochement ; répétition idempotente ; signature invalide ; mauvais montant/référence ; échec/expiration/annulation sans activation ; statut contradictoire rejeté ; séparation des factures Sandbox/réelles ; même route réelle exécutée avec une clé de signature locale, transport pawaPay simulé et DB mémoire.

Les deux migrations sont rejouées sur la base fictive, puis répétées après paiement. Les organisations existantes et l'abonnement payé sont conservés ; aucun abonnement n'est créé par la migration.

## Paramètres à installer plus tard, après autorisation

| Paramètre | Valeur cible |
| --- | --- |
| `NODE_ENV` | `production` |
| `SAAS_BILLING_MODE` | `live`, seulement au moment de la bascule autorisée |
| `SAAS_LIVE_ENABLED` | `true`, seulement après validation |
| `SAAS_DATABASE_ENVIRONMENT` | `production`, après vérification de la destination réelle de `DATABASE_URL` |
| `PAWAPAY_PRODUCTION_API_TOKEN` | Clé réelle, stockée exclusivement dans les Secrets serveur |
| `SAAS_PRODUCTION_ORIGIN` | Origine HTTPS permanente du déploiement, sans chemin ni paramètres |

La déclaration `SAAS_DATABASE_ENVIRONMENT` n'inspecte pas la base et ne remplace pas la vérification de `DATABASE_URL`. Ne jamais copier la base fictive ou les états Sandbox dans la base réelle. Les factures sont séparées par environnement ; les comptes d'abonnement nécessitent des bases distinctes pour les tests.

URL de notification Checkout **et Deposit** à configurer dans le compte marchand réel :

```text
https://DOMAINE-PERMANENT/api/saas/live/callback
```

Activer les notifications signées côté pawaPay. Conserver les protections de signature ; ne pas ajouter d'exception de sécurité pour accepter des notifications non signées. Le retour du navigateur ne valide jamais le paiement.

## Ordre de déploiement proposé — NON EXÉCUTÉ

1. Sauvegarder le code dans GitHub et revoir le diff de la branche. L'authentification Git locale est rétablie et le code validé a été envoyé sur `codex/saas-subscription-audit` ; aucun merge dans `main` n'est réalisé ici.
2. Confirmer l'activation commerciale du compte pawaPay réel, les encaissements CMR/XAF, les frais marchands et la destination des règlements. Le compte Production a depuis été consulté en lecture seule : portefeuille Cameroun/XAF et MTN/Orange indiqués actifs, trois clés actives listées, URL de notification vides et signature des callbacks désactivée. Aucune valeur de clé consultée ni capacité d'encaissement réelle testée ; les frais et limites restent à confirmer.
3. Choisir le domaine permanent et vérifier son certificat HTTPS. Fixer la politique commerciale des crédits excédentaires (actuellement bloqués pour revue) et examiner les anciens abonnements déjà payés, qui ne sont pas convertis automatiquement.
4. Avec autorisation distincte, sauvegarder la base réelle et effectuer une restauration de contrôle dans une base séparée. Aucun fichier de sauvegarde réel n'est créé pendant cette préparation. Relever le commit et les variables du déploiement précédent.
5. Pendant une fenêtre contrôlée, garder `SAAS_BILLING_MODE=disabled`, vérifier la destination de la base, puis appliquer **uniquement les migrations revues** `20261021_saas_billing_v5.sql` et `20261021_saas_provider_environment.sql` dans cet ordre. Ces migrations n'ont été exécutées ici que sur PGlite. Ne pas lancer `db:push` en production, ni un rattrapage général des migrations non examinées.
6. Vérifier les tables/index attendus, la présence de `provider_environment`, l'absence de données d'essai copiées et la conservation des données métier. Installer la configuration réelle dans les Secrets sans afficher les valeurs. Configurer les URL signées chez pawaPay.
7. Après accord final de publication, déployer le commit vérifié et activer le mode réel. Le contrôle hors ligne ne remplace pas ce consentement.
8. Faire un petit paiement réel avec une autorisation précisant compte pilote, montant et portefeuille. Vérifier encaissement pawaPay, facture, unique événement `payment_applied`, droits accordés, notification HTTP 200 et rapprochement de secours. Tester chaque opérateur que l'on ouvrira aux clients. Ne pas ouvrir largement les encaissements avant ce contrôle.

## Surveillance et retour arrière

Surveiller les factures `pending` prolongées, `review`, les erreurs de signature, l'accessibilité HTTPS et les écarts entre encaissements pawaPay et factures. En cas de panne de notification, la tâche de rapprochement authentifié conserve les paiements en attente et réessaie ; un timeout n'est jamais transformé en réussite.

En cas d'incident de lancement : arrêter l'ouverture de nouveaux paiements, relever toutes les références en cours, conserver le code courant capable de recevoir les notifications et rapprocher les encaissements avant de retirer l'intégration. Ne pas restaurer une ancienne base par-dessus un paiement réellement encaissé.

Une fois les paiements en cours traités, `SAAS_BILLING_MODE=disabled` puis redémarrage arrête le nouveau moteur et rétablit le parcours historique. **Ce n'est pas un gel des droits : les contrôles SaaS sont alors désactivés.** Prévoir la gestion manuelle des accès pendant l'incident. Ne pas supprimer les tables, factures, événements ou notifications. Un simple `SAAS_LIVE_ENABLED=false` avec `mode=live` est une configuration invalide, pas la commande de retour arrière.

## Références officielles

- [Passage en production](https://docs.pawapay.io/v2/docs/going_live)
- [Fonctionnement des checkouts et tentatives](https://docs.pawapay.io/v2/docs/checkouts)
- [Notifications Checkout](https://docs.pawapay.io/v2/api-reference/checkouts/checkout-callback)
- [Numéros fictifs du Sandbox](https://docs.pawapay.io/v2/docs/test_numbers)

## Résultat final du test marchand et nettoyage

Le dernier paiement Sandbox Pro de **10 999 XAF** a réussi. Facture `3eb8c0d8-972b-4fee-8ae4-4c342129eb61`, checkout `50fc7531-8f9b-484f-8f93-63862f786395`. Première notification **Checkout réellement signée par pawaPay** reçue le 21 octobre 2026 à **21:11:09.635 UTC, soit 22:11:09 à Douala** : HTTP 200, réponse `{"received":true}`, compte fictif passé de `trialing` à `active`, facture `paid` (`paid_at=21:11:09.625 UTC`). Aucun clic sur Actualiser et aucune tâche de rapprochement en arrière-plan : `backgroundJobs:false`. Ce contrôle complète le précédent test de renvoi Deposit sur une facture déjà payée.

Le diagnostic précédent avait révélé un callback Checkout sans `amounts[]` ni montant à la racine. La correction accepte cette forme réelle mais exige toujours, pour toute réussite, un dépôt `COMPLETED` du montant exact en XAF/CMR. Les champs monétaires facultatifs restent contrôlés lorsqu'ils sont fournis. Des tests refusent un dépôt absent ou d'un montant différent.

Après le test : les quatre URL temporaires Sandbox (Checkout, Deposit, Payout, Refund) ont été vidées ; leur absence a été vérifiée après rechargement. Le seul processus de test de cette reprise, PID 458, a été arrêté ; le bloc temporaire Replit `localPort=3001 / externalPort=3002` a été retiré après vérification du diff. Aucune clé révoquée, aucun Secret modifié, aucune modification des sources de l'application Replit ; uniquement un programme jetable dans `/tmp`. Les paiements fictifs restent dans l'historique Sandbox.

Vérifications locales : **93 fichiers de tests sur 93 passent**, TypeScript validé. La compilation du commit final est vérifiée séparément avant livraison. Les tests du mode réel utilisent une clé factice et un transport simulé ; aucun appel réel de production.

Preuves locales dans `../saas-implementation-checks/production-preparation/` : `first-checkout-callback-200.png`, `sandbox-final-completed.png`, `sandbox-callbacks-cleared-final.png` et `cleanup-verified-final.png`.

## Préparation de l'intégration Replit, sans installation

- Replit utilise `main` au commit `5ef5a28601cc77a07a9f513554c6fe87c09f398c`, également présent sur GitHub. La page de déploiement indique une publication antérieure ; aucun bouton de publication n'a été utilisé.
- Domaines relevés dans le panneau Replit : `laundry-manager-pro.replit.app`, `superadmin.xpressclean.cm`, `app.xpressclean.cm`. Origine proposée pour les clients : **`https://app.xpressclean.cm`**. Une requête HEAD publique a renvoyé HTTP 200, sans redirection et avec validation TLS réussie. Aucune connexion utilisateur ni consultation de données métier.
- Callback réel préparé : **`https://app.xpressclean.cm/api/saas/live/callback`**. Cette adresse n'a pas été installée chez pawaPay ; le nouveau chemin n'a pas été appelé sur le déploiement actuel.
- Modèle de configuration : [`../deploy/pawapay-production.env.example`](../deploy/pawapay-production.env.example). Il garde `SAAS_BILLING_MODE=disabled` et `SAAS_LIVE_ENABLED=false`, sans clé ni URL de base. Il n'est chargé automatiquement par aucun script ni par Replit.
- Répétition locale de fusion : sept conflits dus aux historiques distincts ont été résolus sur la branche de préparation. Le commit de fusion `6776444` conserve **exactement le même arbre de fichiers** que le commit validé `6b2bb1e` (`d78ee58c1b9bb8a6c1e4f326d8e3b3e3090fb254`). Les corrections de reçus HTML/PDF/PNG et de l'accueil sont conservées. `main` distant et le checkout Replit ne sont pas fusionnés pendant cette préparation.
- Un port de test résiduel `3001 → 3002` avait été réinscrit dans `.replit` après le premier nettoyage. Il a été retiré de nouveau après vérification qu'aucun processus du programme de test n'était actif. Seul ce diff a été annulé ; aucune source métier Replit n'a été remplacée.

**Point à traiter avant tout pull dans le Replit actuel :** le serveur existant exécute déjà des contrôles/migrations de schéma au démarrage (`ensureAuthSchema`, contrôle de précision des quantités). Désactiver le nouveau moteur SaaS n'empêche pas ces opérations historiques. Un changement de sources peut redémarrer automatiquement le serveur de développement. Il faut donc vérifier la séparation entre base de développement et base de production, et disposer d'une sauvegarde restaurable autorisée, avant d'y installer le code. Cette préparation n'a ni interrogé ni modifié ces bases et n'a pas changé les Secrets.

Prochaine opération proposée : vérifier la destination des bases sans exposer les identifiants, puis réaliser une sauvegarde/restauration de contrôle dans un environnement séparé avec l'autorisation correspondante. La migration réelle et la publication restent exclues du périmètre actuel.
