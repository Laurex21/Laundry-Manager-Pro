# Pilote WhatsApp Flows

Le client écrit **commander**, **commande** ou **boutique** au numéro connecté. Le webhook signé résout l'agence autorisée, vérifie le numéro et le Flow auprès de Meta, puis répond avec le bouton natif. Le formulaire chiffre les échanges de services, gabarits, quantités et devis. La confirmation crée une demande dans la boîte Xpress Pro existante, sans créer de facture ni encaisser avant validation du pressing.

## Statut et périmètre

Implémentation locale : endpoint chiffré, challenge du webhook, lancement à la demande, liste de testeurs, vérification du WABA/numéro/Flow et déduplication persistante. Le JSON reste un brouillon à compiler dans Meta. Les tests simulent Meta et une agence nommée Laurepressing dans une base isolée ; ils ne constituent pas un test sur le vrai téléphone ou le compte de production.

Ce pilote raccorde une seule agence et un seul numéro, avec au maximum dix destinataires explicitement autorisés. Il ne fournit pas encore l'inscription autonome de tous les pressings (Embedded Signup), la gestion de leurs jetons, les modèles hors fenêtre, le suivi et l'accord du devis définitif dans WhatsApp, ni un paiement WhatsApp. Le suivi web actuel demeure valable.

## Configuration exclusivement serveur

Variables dédiées, sans réutiliser les accès WhatsApp du superadministrateur :

- `XPRESSPRO_WHATSAPP_FLOWS_ENABLED=true` et `XPRESSPRO_STOREFRONT_ENABLED=true` pour activer. Sans ces deux valeurs, les routes restent fermées et aucun appel Meta n'a lieu.
- `XPRESSPRO_WHATSAPP_FLOWS_PILOT` : JSON au format ci-dessous, provisionné par l'opérateur après validation du propriétaire. Aucun secret ni véritable numéro de test dans Git.
- `XPRESSPRO_FLOWS_ACCESS_TOKEN` : jeton Meta autorisé pour le WABA, conservé dans les secrets Replit.
- `XPRESSPRO_FLOWS_APP_SECRET` : secret de l'application qui signe les webhooks et les échanges du Flow.
- `XPRESSPRO_FLOWS_VERIFY_TOKEN` : valeur aléatoire dédiée d'au moins 32 caractères.
- `XPRESSPRO_FLOWS_SESSION_KEY` : 32 octets aléatoires, encodés en 64 caractères hexadécimaux minuscules.
- `XPRESSPRO_FLOWS_PRIVATE_KEY` : clé RSA PEM dédiée d'au moins 2048 bits. La clé publique correspondante doit être installée sur le numéro Meta.
- `XPRESSPRO_FLOWS_GRAPH_VERSION` : version de Graph API confirmée pour l'application, au format `vN.0`.

```json
{
  "connectionId": "pilot-pressing",
  "organisationId": 1,
  "siteId": 1,
  "actorUserId": "VERIFIED_OWNER_USER_ID",
  "wabaId": "100",
  "phoneNumberId": "101",
  "flowId": "102",
  "phone": "+237600000000",
  "endpoint": "https://app.xpressclean.cm/api/integrations/whatsapp-flows/data",
  "recipients": ["+237600000001"],
  "mode": "draft"
}
```

Ces identifiants sont fictifs. Le serveur exige un numéro `CONNECTED` correspondant exactement au numéro approuvé, un Flow appartenant au même WABA avec le statut demandé, Data API 4.0, aucune erreur de validation, et l'endpoint exact. Le Flow doit être publié avant de passer en `published`. Un changement de configuration requiert un redémarrage ; couper le drapeau ou retirer les secrets désactive le pilote. Ne pas remplacer le fournisseur déjà connecté sans vérifier sa coexistence et obtenir l'accord pour toute modification d'accès.

## Installation contrôlée

1. Choisir le numéro du pilote et le téléphone testeur. Vérifier la propriété du WABA, l'application autorisée, l'éligibilité Flows et les restrictions affichées par Meta.
2. Faire compiler `integrations/whatsapp-flows/storefront-order.draft.json` dans WhatsApp Manager. Confirmer Data API 4.0, le retour vers le panier et l'accord remis à zéro après changement de tarif. Le validateur Meta reste la référence.
3. Préparer les secrets sans les afficher. Vérifier la signature de la clé publique et le test de santé chiffré dans Meta. Aucun jeton dans un URL de navigation, journal ou dépôt.
4. Revoir et faire approuver **avant exécution** `integrations/whatsapp-flows/pilot-schema.REVIEW.sql`. Il crée uniquement le schéma privé `xpresspro_flow_pilot` et une table d'empreintes des messages et résultats d'envoi. Il ne touche pas aux tables storefront, tarifs, paiements ou protections. Il n'est pas dans le répertoire des migrations automatiques et n'est jamais exécuté au démarrage. Un échec doit annuler toute la transaction. Ne pas supprimer la table pour revenir en arrière : les empreintes empêchent les renvois.
5. Publier la révision revue après les tests de reçus, superadministrateur et build. Inspecter le diff réel Replit et conserver tous les verrous.
6. Activer les deux drapeaux et une boutique de test identifiée. Abonner l'application au WABA avec la configuration existante du fournisseur prise en compte. Callback : `/api/integrations/whatsapp-flows/webhook`. Le GET vérifie le challenge, le POST vérifie la signature sur le corps brut.
7. Depuis le téléphone autorisé, envoyer `commander`. Vérifier le bouton dans WhatsApp, le panier mixte, l'estimation, la confirmation et l'arrivée dans la bonne agence. Vérifier sur Android/iOS ; une prévisualisation web ne suffit pas.
8. Fermer le pilote et la boutique de test après l'essai jusqu'à validation d'ouverture. Conserver les références et les preuves privées.

## Envois et reprise

Seules les commandes entrantes signées de moins de cinq minutes sont traitées. Les accusés de réception, messages ordinaires, autres WABA/numéros et destinataires non autorisés n'envoient rien. Il n'y a pas de campagne ou de modèle proactif. Meta peut néanmoins refuser l'envoi selon les droits, la facturation ou l'éligibilité du compte.

La réservation PostgreSQL unique est validée avant l'appel Meta. Un résultat incertain ou un crash n'entraîne aucun renvoi automatique sur le même message ; le client peut envoyer un nouveau `commander`. Cette garantie « au plus une tentative » privilégie l'absence de doublons, pas une livraison garantie. Les résultats sont `accepted`, `failed` ou `unknown`, sans conserver le texte, le téléphone ou le jeton dans le registre. Aucun nettoyage automatique du registre pendant le pilote.

## Validation

`npm run test:storefront:flows-pilot` ouvre seulement un serveur local et une base PGlite. Meta est simulé. Il teste les signatures, le challenge, la sélection du WABA, les numéros, les destinataires, l'ancienneté, les doublons concurrents, l'envoi incertain, le panier chiffré de trois gabarits, la confirmation répétée et l'isolation des agences. `npm run test:storefront:experience` couvre le moteur, les poids inconnus, changements de prix, révocation, changement de Flow, expiration et fermeture.

Références : [exemple officiel d'endpoint Meta](https://github.com/WhatsApp/WhatsApp-Flows-Tools/tree/main/examples/endpoint/nodejs/basic), [changelog Flows](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/changelog/).

## Connexion des pressings depuis Xpress Pro

La boutique par lien reste le parcours de base. Un administrateur de boutique peut ouvrir **Ouvrir et partager → Connecter mon WhatsApp** après avoir enregistré son numéro. Cette page dédiée charge le SDK Meta après l'action du pressing. Les autorisations du navigateur pour le SDK sont limitées à cette page.

L'inscription intégrée v4 prépare une connexion par agence. Xpress Pro vérifie le numéro dans le compte autorisé par Meta, rattache la tentative à l'agence et à la session, chiffre le jeton, puis enregistre un état **activation en attente**. Un numéro n'est associé qu'à une agence. La présence d'une ligne dans ce registre ne déclenche aucun envoi. L'activation du Flow de chaque pressing, la vérification de son état de santé et le choix de la facturation restent à raccorder avant ouverture générale.

Pour essayer l'inscription avec une application Meta prête aux essais, utiliser un domaine HTTPS déclaré dans Facebook Login for Business, prévoir un compte Meta de test autorisé et installer le SQL de revue `integrations/whatsapp-flows/signup-schema.REVIEW.sql` dans l'environnement de test. Ce SQL ajoute un registre indépendant du pilote existant et n'est pas exécuté au déploiement. Configurer côté serveur :

- `XPRESSPRO_FLOW_SIGNUP_ENABLED=true` et `XPRESSPRO_STOREFRONT_ENABLED=true`
- `XPRESSPRO_FLOW_SIGNUP_APP_ID` et `XPRESSPRO_FLOW_SIGNUP_CONFIG_ID` avec les identifiants de l'application et de la configuration Embedded Signup v4
- `XPRESSPRO_FLOWS_GRAPH_VERSION` et `XPRESSPRO_FLOWS_APP_SECRET` pour cette application
- `XPRESSPRO_FLOW_SIGNUP_ENCRYPTION_KEY` avec une clé distincte de 32 octets, encodée en 64 chiffres hexadécimaux minuscules

L'application Meta doit être autorisée pour l'inscription des entreprises. La configuration doit être testée avec le numéro réellement contrôlé par le pressing. Voir [l'implémentation officielle](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/). Le code fourni prépare le raccordement et conserve la connexion vérifiée en attente. Le webhook et le Flow du pilote continuent d'utiliser leur configuration dédiée.
