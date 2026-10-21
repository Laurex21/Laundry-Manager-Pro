# Abonnements v5 — livraison locale du 21 octobre 2026

## État et limites

Implémentation sur `codex/saas-subscription-audit`, sans publication, modification du Replit actuel, ni accès à une base de production. Les tests DB utilisent PGlite en mémoire. La clé Sandbox n’est pas disponible dans l’environnement local. Un contrôle marchand réel a été exécuté depuis le Shell Replit sans base de données : clés publiques disponibles, checkout `ACCEPTED`, statut `FOUND / WAITING_PAYMENT`, puis expiration `EXPIRED`. Référence de test : `8d2a64e4-361c-4595-ad47-7e2acd1666a3`. Aucun portefeuille ni paiement Mobile Money sollicité. La présence de `PAWAPAY_SANDBOX_API_TOKEN` dans les Secrets du Replit actuel a été confirmée sans afficher sa valeur.

Le raccordement API Sandbox est codé. Une simulation locale a vérifié l’intégralité devis → checkout en attente → callback cryptographiquement signé → activation → facture confirmée, via les véritables routes serveur. Cette simulation ne constitue pas un paiement réalisé auprès de pawaPay. Le contrôle marchand confirme séparément l’authentification et le contrat de création/lecture/expiration, pas encore le callback d’un paiement réussi chez le fournisseur.

## Règles livrées

- Catalogue central : Starter gratuit, Pro 10 999 XAF, Business 18 999 XAF. Commandes illimitées. Multi-boutique exclusivement Business ; options boutique 5 000 XAF incluant 2 places ; personnel supplémentaire 2 000 XAF.
- Essai Pro de 30 jours ; transition minimale de 7 jours pour les organisations préexistantes ; rappels quotidiens uniques par organisation/date locale en dernière semaine.
- Renouvellement manuel, possible en avance, aucune autorisation de prélèvement. Expiration appliquée dès la requête suivante même si le planificateur est arrêté.
- Prorata exact en FCFA, crédits du prix Pro payé **et des places Pro payées restantes** sur l’upgrade Business ; nouveau mois à la confirmation. Retraits et rétrogradations au prochain cycle. Anniversaire conservé lors des fins de mois.
- Les places supplémentaires inutilisées ne sont pas refacturées au renouvellement. Propriétaire exclu et compte partagé entre boutiques compté une seule fois.
- Un crédit supérieur à la facture bloque le devis pour vérification : pas de paiement, remboursement automatique ni abandon silencieux du reliquat. Le traitement commercial de ce cas exceptionnel reste à valider avant lancement.
- Contrôles côté serveur et créations de boutiques/personnel dans la transaction de quota. Choix explicite des accès actifs ; boutiques historiques conservées en lecture pour le propriétaire.
- Starter conserve les opérations essentielles, les paiements des contrats clients existants, les retours de base et les reçus HTML/PDF/PNG HD. Personnalisation sauvegardée mais désactivée ; anciens rapports quotidiens consultables.
- Archivage immuable du premier HTML téléchargé par reçu en mode SaaS. Les fichiers déjà délivrés ne sont pas modifiés. Limite : aucun ancien reçu non archivé ne peut être reconstruit rétroactivement à l’identique ; l’impression thermique/A4 historique utilise encore le générateur existant.
- Anciens abonnements SaaS actifs exclus de toute conversion automatique : accès existants conservés, migration à examiner individuellement.

## Paiement et sécurité

Le serveur impose montant, XAF/CMR, référence facture, organisation et version du devis. UUID enregistré avant appel fournisseur et réutilisé après timeout. Un retour navigateur ne valide rien. Seule une notification signée vérifiée ou une réconciliation API authentifiée peut confirmer ; contrôle du dépôt réellement réussi, pas seulement du montant proposé. Doublons idempotents, statuts finaux contradictoires rejetés ; paiement sur devis devenu incompatible conservé pour vérification. Une facture nette de zéro est soldée par crédit interne sans appel pawaPay.

Hôte fournisseur fixé dans le code à `api.sandbox.pawapay.io`. Pas de mode Live. `SAAS_BILLING_MODE=sandbox` requis et volontairement inopérant sous `NODE_ENV=production`. Secrets exclusivement serveur.

Références : [Checkouts](https://docs.pawapay.io/v2/docs/checkouts), [création](https://docs.pawapay.io/v2/api-reference/checkouts/initiate-checkout), [callback](https://docs.pawapay.io/v2/api-reference/checkouts/checkout-callback), [statut](https://docs.pawapay.io/v2/api-reference/checkouts/check-checkout-status), [expiration](https://docs.pawapay.io/v2/api-reference/checkouts/expire-checkout).

## Installation sur environnement de test séparé — non exécutée

1. Créer une base de test isolée et y appliquer les migrations existantes, puis la migration additive `migrations/20261021_saas_billing_v5.sql`. Aucun DDL nouveau au démarrage et aucun backfill massif.
2. Configurer `SAAS_BILLING_MODE=sandbox`, `PAWAPAY_SANDBOX_API_TOKEN`, `SAAS_SANDBOX_RETURN_ORIGIN` (origine HTTPS de ce test), `NODE_ENV=development` ou `test`. Ne jamais réutiliser l’URL de base de production.
3. Enregistrer l’URL HTTPS de test `/api/saas/sandbox/callback` dans le compte marchand Sandbox ; la réconciliation reste disponible si un callback est retardé.
4. Vérifier les clés avec `node --import tsx scripts/check-saas-pawapay-sandbox.ts`. Avec `--create-and-expire`, ce script crée puis expire un checkout Sandbox sans DB et sans payer un portefeuille. Il refuse NODE_ENV=production et ne journalise aucun secret.
5. Tester depuis la copie isolée de l’application un vrai paiement de démonstration Sandbox et son callback, puis annulation, échec, timeout et renouvellement. Le contrôle sans DB de création/lecture/expiration a réussi ; ce parcours complet fournisseur reste à faire.
6. Avant production, revoir les anciens abonnements actifs, les éventuels frais marchands, le crédit excédentaire, la conservation des reçus et l’activation explicite du mode réel. Aucun mode réel n’est fourni ici.

Rollback du test : désactiver `SAAS_BILLING_MODE`, conserver tables/factures/événements pour audit ; ne pas supprimer l’historique et ne pas revenir à un checkout non réconcilié. Les anciens parcours restent disponibles lorsque le nouveau mode est désactivé.

## Vérifications

- TypeScript et build client/serveur réussis ; vérification des bundles de production réussie. Avertissement de taille des bundles existant, non bloquant.
- Deux nouvelles suites DB isolées : crédits Pro/personnel, calendrier, essai/transition, renouvellement, prorata zéro, quotas et isolation, doublons de paiement, confirmation serveur, accès Starter/historiques, transaction réelle de création boutique, reçus immuables, désactivation en production.
- Suite élargie : **83 fichiers réussis sur 90** ; 7 échecs préexistants reproduits sur les sources HEAD avant modifications : `auth-conversion-regression`, `decimal-order-quantity`, `landing-v3-regression`, `order-customer-visibility`, `payment-ledger`, `pilotage-hub`, `subscription-dashboard-localization`. Ils ne sont pas annoncés comme corrigés par cette livraison.
- Vérification navigateur FR/EN sur bureau et iframe mobile de 390 px. Devis, attente, callback signé simulé et confirmation visibles. Aperçu reproductible : `node --import tsx scripts/preview-saas-isolated.ts`, adresse affichée par le script ; base mémoire et fournisseur fictif imposés, écoute locale uniquement. Fixtures hors des sources client de production.

Les tests ne constituent pas une autorisation de publier ni une preuve de paiement Sandbox marchand réel.
