# Préparation WhatsApp Flows — Xpress Pro

État : prototype technique testable, sans connexion à Meta. Aucun message envoyé et aucun endpoint Flows monté en production.

## Éléments préparés

- `integrations/whatsapp-flows/storefront-order.draft.json` : écrans vêtements → panier → confirmation, ajout de plusieurs lignes et estimation explicite. Flow JSON 7.3, Data API 4.0, message en mode draft.
- `server/lib/storefront-flows.ts` : adaptateur qui utilise `publicShop`, `quote` et `submit` du moteur existant. Les demandes apparaissent dans la même boîte de réception et suivent ensuite le parcours habituel de validation au dépôt.
- `server/lib/storefront-flow-transport.ts` : traitement chiffré indépendant, signature HMAC obligatoire sur les octets bruts, RSA-OAEP/SHA-256 et AES-128-GCM, inversion de l'IV de réponse. Aucun journal de données déchiffrées.
- `scripts/demo-storefront-flow.ts` : démonstration sans réseau ni base réelle. Trois t-shirts enfant, deux chemises adulte et un jean adolescent donnent 1 300 FCFA, puis une demande fictive.

## Sessions et limites

Une connexion doit être résolue côté serveur via `resolveBinding`, depuis un registre Meta vérifié. Le prototype ne fournit volontairement pas de registre de production ou de route permettant de déclarer librement un rattachement. `launch` reçoit le destinataire vérifié d'une conversation autorisée et prépare un message ; il ne l'envoie pas.

Les jetons de lancement et de panier sont chiffrés/authentifiés avec une clé serveur dédiée de 32 octets. Ils expirent après 30 minutes, restent liés à une agence et à un destinataire, et sont vérifiés à chaque échange. Le panier n'a pas besoin d'un cache mémoire pour être repris entre instances. La clé doit être gérée dans un coffre de secrets avec une procédure de rotation ; sa perte invalide les sessions ouvertes.

Les tarifs et poids viennent exclusivement du serveur. Le numéro du client est lié à la session, jamais remplacé par un champ libre transmis dans le formulaire. Une nouvelle estimation est présentée si le tarif a changé ; l'initialisation de l'accord doit être vérifiée dans le validateur et sur les clients WhatsApp avant activation. La confirmation utilise la clé d'idempotence de la session et le contrôle de version du moteur boutique.

Le prototype couvre la préparation et l'enregistrement de la demande. Il ne traite pas encore les notifications WhatsApp, le suivi et l'acceptation du devis final dans la conversation. Il n'effectue aucun paiement.

## Raccordement restant avant pilote WhatsApp

1. Confirmer l'application Meta, les permissions, l'éligibilité des WABA/numéros et le mode de connexion des pressings. Un numéro saisi dans la boutique ne prouve pas sa propriété.
2. Construire le registre vérifié organisation/agence → WABA → phone_number_id → flow_id, avec secrets côté serveur et révocation. Ne jamais utiliser un identifiant d'agence fourni librement par un client.
3. Installer les clés publiques pour les numéros concernés et un endpoint HTTPS à chemin dédié. Brancher le transport uniquement derrière un dispositif d'activation explicite, des limites de fréquence/taille et la vérification de signature sur le corps brut.
4. Brancher le webhook Meta vérifié et dédupliqué pour lancer le Flow à la demande du client, selon les fenêtres et modèles de messagerie applicables. Un envoi ou l'approbation d'un modèle ne sont pas réalisés par ce prototype.
5. Importer le JSON en brouillon dans WhatsApp Manager, vérifier la compatibilité Data API, le routage retour, les champs et la remise à zéro du consentement après un nouveau devis. Corriger tout rejet avant publication.
6. Tester réellement sur Android/iOS : panier mixte, plusieurs ajouts, retour/modification, erreur de saisie, délai réseau, fermeture de boutique, tarif modifié, double confirmation et arrivée dans la bonne agence.
7. Préparer le suivi et l'acceptation du devis définitif dans WhatsApp. Le devis initial au kilo reste une estimation ; un accord initial ne vaut pas acceptation de n'importe quel montant final.

## Vérification locale

`npm run test:storefront:experience` teste les signatures absentes/fausses, le chiffrement aller-retour, les sessions expirées, la connexion révoquée, l'autre agence/destinataire, le rejeu, le tarif modifié, le poids inconnu et la boutique fermée. La suite vérifie aussi que les données renvoyées aux écrans sont déclarées dans le JSON.

Ces contrôles ne remplacent pas la compilation officielle du Flow par Meta. Aucun essai réel dans WhatsApp n'est revendiqué.

## Références officielles consultées le 20 novembre 2026

- https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/flowjson
- https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/changelog
- https://github.com/WhatsApp/WhatsApp-Flows-Tools/tree/main/examples/endpoint/nodejs/basic
- https://whatsappbusiness.com/products/whatsapp-flows/

Le prototype suit Data API 4.0 annoncé dans le changelog. Le guide général consulté mentionne encore 3.0 : confirmer la version acceptée dans WhatsApp Manager lors du raccordement.
