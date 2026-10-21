# Test marchand pawaPay Sandbox — 21 octobre 2026

## Résultats constatés

Des paiements ont réellement été traités par l’API et le checkout **Sandbox de pawaPay**, avec le numéro MTN de démonstration officiel `237653456789`. Aucun portefeuille réel, argent réel ou donnée client réelle utilisé.

| Parcours | Montant fictif XAF | Résultat |
|---|---:|---|
| Essai Pro → Pro payé | 10 999 | Fournisseur COMPLETED ; facture paid ; formule active automatiquement |
| Pro payé → Business | 8 001 | Prix 18 999 moins crédit Pro restant 10 998 ; nouveau cycle Business activé |
| Ajout d’une place Business | 2 000 | Paiement confirmé ; quota augmenté |
| Ajout d’une deuxième place Business | 2 000 | Paiement confirmé ; deux places optionnelles actives |

Référence du premier checkout : `beba1969-fd16-4f7c-802e-57346bfe5f08`. Référence du dernier : `92f43cb7-a97d-40b6-af10-49bf5a40eb35`. Dépôt correspondant : `33984321-6a4a-44d3-8ac4-b4fb8f1e37c9`.

L’activation automatique sans bouton de rafraîchissement a été observée par lecture seule de `/api/saas/current` et `/api/saas/invoices`. Les premières notifications étant rejetées, la réconciliation automatique par API a assuré cette activation. Ne pas attribuer ces premières activations à un webhook réussi.

Après correction, une notification de dépôt **signée par pawaPay**, réémise par le fournisseur pour ce paiement déjà réussi, a reçu **HTTP 200** avec `{"received":true}`. Réception observée à **20 h 24 min 49 s, heure de Douala** (19:24:49 UTC). L’état Business actif et ses deux options est resté identique : aucune nouvelle période ni double crédit lors de ce traitement répété.

Limite de preuve : le succès marchand et l’activation automatique via réconciliation sont validés ; le HTTP 200 réel après correction est prouvé sur le renvoi d’une notification Deposit. La première livraison d’un nouveau callback Checkout déclenchant seule l’activation, sans que la réconciliation intervienne, n’a pas été isolée comme scénario distinct.

## Isolation

- Copie serveur de facturation dans `/tmp/xpresspro-saas-isolated-20261021` sur l’environnement de développement Replit. Sources applicatives, authentification, routes SaaS et schéma réutilisés ; aucune modification du projet de production.
- PGlite **en mémoire**, schéma complet créé uniquement dans cette base fictive, propriétaire/organisation/boutique synthétiques. Les instantanés de redémarrage contiennent exclusivement ces données de démonstration.
- `DATABASE_URL` remplacée avant l’import du module DB par une adresse inutilisable `127.0.0.1:1`, puis adaptateurs DB et pool reliés à PGlite. Aucun import du compte de production pour initialiser le test.
- API avec session fictive accessible seulement sur `127.0.0.1:5174`. Les ports publics temporaires ne laissent passer que le chemin de callback, dont la signature reste obligatoire.
- La clé `PAWAPAY_SANDBOX_API_TOKEN` est restée dans les Secrets du Replit ; jamais copiée dans le chat, les sources ou les preuves. Tous les appels fournisseur utilisent exclusivement `api.sandbox.pawapay.io`.
- Aucun Publish/Republish, push GitHub ni migration de production.

## Écarts réels corrigés

1. **Adresse de retour** : le fournisseur refuse `http://localhost`. La fixture marchande exige une origine HTTPS ; l’aperçu local simulé reste un outil distinct.
2. **Proxy Replit** : le port public est retiré de `Host`, ce qui casse la signature RFC 9421. `SAAS_SANDBOX_CALLBACK_ORIGIN` permet de vérifier l’autorité publique exacte configurée côté serveur. Aucun recours à un en-tête `X-Forwarded-Host` non fiable ; hôte inconnu rejeté. Signature, empreinte et délai de validité restent vérifiés.
3. **Structure du callback Checkout** : le fournisseur envoie `amount`, `currency`, `country` à la racine, alors que son API de statut expose `amounts[]`. Les deux structures sont validées, toujours avec contrôle du dépôt réussi et de son montant.
4. **Notification Deposit associée** : une notification signée peut identifier la facture par `clientReferenceId` ou `metadata.invoiceId`. Le serveur vérifie le montant et rapproche le checkout par son API ; il ne crée jamais de droits à partir de la seule notification de dépôt.

Des signatures périmées ont été rejetées lors du diagnostic, conformément à la protection contre les relectures. Aucun délai de validité n’a été désactivé pour faire passer les tests.

## Vérifications et outils

- TypeScript et build client/serveur réussis. Suite complète : **84 fichiers réussis sur 91** ; les 7 échecs sont les mêmes anomalies préexistantes déjà reproduites avant ce travail (voir le rapport v5). Les trois suites SaaS, dont le nouveau test de proxy/signature, réussissent.
- Cas ajoutés : vrai format de callback sans `amounts[]`, montant erroné rejeté, autorité avec port, corps altéré rejeté, notification Deposit signée répétée sans prolongation, origine invalide et hôte étranger rejetés.
- `scripts/test-saas-merchant-isolated.ts` : serveur de test isolé, exige les origines HTTPS du retour et du callback ; jamais un serveur de production.
- `scripts/test-saas-callback-probe.ts` : diagnostic temporaire sans DB ni jeton marchand ; conserve les signatures et corps synthétiques uniquement dans `/tmp` pour constater le code de réponse. Ces traces ne sont pas ajoutées au dépôt.
- Preuve locale : `saas-implementation-checks/merchant-success/signed-callback-200.png` dans le dossier parent du dépôt.

## Fin de session

Les quatre URL Sandbox temporaires ont été retirées, puis leur absence vérifiée après rechargement du tableau de bord. Les processus de test (PID 2627 et 2164) sont arrêtés. Replit avait ajouté automatiquement deux blocs de ports dans `.replit` : le diff ne contenait que ces deux blocs ; ils ont été retirés. Les paiements fictifs restent dans l’historique Sandbox du marchand pour traçabilité. Les données commerciales réelles restent inchangées.
