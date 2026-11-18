# Suivi des contacts dans le superadmin

Le tableau « Accompagnement » affiche les nouveaux pressings de la période choisie et les organisations disposant déjà d’un suivi, même plus anciennes. Les comptes exclus du pilotage restent exclus de ce module. L’accès est réservé aux administrateurs de plateforme avec une session MFA valide.

La fiche propose trois espaces : contact et prochaine action, message à valider, historique. Les dates de contact et de prochaine action sont exprimées en heure de Douala. Les contacts et changements de suivi conservent leur auteur, leur date d’enregistrement et leur contenu. L’historique est paginé et n’est pas modifiable par l’interface.

Les propositions françaises et anglaises utilisent l’activité réelle, les paiements et les droits d’accès. Un brouillon doit être enregistré avant validation. La validation ne déclenche aucun envoi. Pour WhatsApp, un modèle texte approuvé par Meta peut être personnalisé, enregistré et validé, puis envoyé avec un bouton distinct après confirmation du destinataire et de son accord. Les statuts fournisseur sont conservés dans l’historique. Un contact effectif doit être enregistré séparément. Les textes libres, emails et SMS restent copiables pour un envoi manuel ; cette version active uniquement le raccordement WhatsApp. Aucun ordonnanceur ni activation de maintenance n’est ajouté.

Les suivis en pause, terminés ou « Ne plus contacter » ne permettent pas de valider ni de copier un message validé. Toute modification du contexte (activité, abonnement, paiement, coordonnées, historique des contacts ou prochaine action) impose une nouvelle revue. Le contexte est revérifié à la validation et avant la copie. Une modification du texte retire son ancienne validation lors de l’enregistrement.

Les mutations utilisent un numéro de version, un identifiant de requête réutilisable et un verrou par organisation. L’écriture du suivi, de son événement et de l’audit administrateur s’effectue dans une transaction unique. Un échec d’audit annule toute l’opération. Les notes et messages sont rendus comme du texte et ne sont pas insérés dans le journal général des requêtes.

## Envoi WhatsApp

Le raccordement utilise l’API officielle Meta Cloud. Le catalogue est lu auprès du compte professionnel configuré ; seuls les modèles `APPROVED` de catégorie `UTILITY` ou `MARKETING`, avec corps texte à paramètres positionnels et pied de page statique facultatif, sont proposés. Les modèles à média, boutons, paramètres nommés ou authentification ne sont pas pris en charge dans cette première version. Le contenu approuvé est revérifié auprès de Meta avant l’envoi ; une modification impose une nouvelle revue.

Le numéro expéditeur est choisi avant l’enregistrement du brouillon. Seuls les identifiants explicitement autorisés et retournés `CONNECTED` par Meta dans le compte configuré sont proposés. Son identifiant, son numéro, son nom et son compte sont conservés avec la validation et chaque tentative. Modifier l’expéditeur exige un nouvel enregistrement et une nouvelle validation ; aucune bascule automatique vers un autre numéro n’est possible. Un numéro retiré, déconnecté ou modifié chez Meta bloque l’envoi. Les anciens brouillons de modèle sans expéditeur doivent être enregistrés et validés à nouveau.

La réservation d’envoi, la copie immuable du message/destinataire, la confirmation de consentement et l’audit sont enregistrés avant l’appel réseau. Un identifiant de validation ne peut produire qu’une tentative. Un timeout ou un résultat ambigu n’est jamais réessayé automatiquement, même avec un nouvel identifiant de requête. Une tentative non résolue bloque les nouvelles relances de ce pressing ; le retour signé du fournisseur peut la réconcilier grâce à `biz_opaque_callback_data`. Sans retour, vérifier dans WhatsApp Manager avant toute intervention opérateur ; aucune commande de remise à zéro risquant un double envoi n’est exposée.

`Accepté` signifie seulement que Meta a accepté la requête. `Envoyé`, `Livré`, `Lu` et `Échec` proviennent des notifications signées. Les événements répétés ne dupliquent pas l’historique et les événements reçus en retard ne font pas régresser un statut livré/lu. Les conversations entrantes ne sont pas importées dans ce module.

### Configuration protégée

Renseigner dans les secrets Replit de l’environnement cible, jamais dans Git ni dans le navigateur client :

- `WHATSAPP_ACCESS_TOKEN` : jeton système du compte professionnel avec les permissions WhatsApp nécessaires.
- `WHATSAPP_PHONE_NUMBER_ID` : identifiant Meta du numéro professionnel, différent du numéro téléphonique.
- `WHATSAPP_ADDITIONAL_PHONE_NUMBER_IDS` : facultatif, autres identifiants Meta autorisés du même compte, séparés par des virgules (10 numéros maximum au total). Ajouter un numéro dans Meta ne l’active pas automatiquement dans le superadmin. Ne renseigner que les numéros dont le raccordement est terminé.
- `WHATSAPP_BUSINESS_ACCOUNT_ID` : identifiant du compte WhatsApp Business.
- `META_APP_SECRET` : secret de l’application, pour vérifier les signatures HMAC SHA-256.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` : valeur aléatoire d’au moins 32 caractères, pour la vérification du webhook.
- `WHATSAPP_GRAPH_VERSION` : `v27.0` par défaut.
- `PLATFORM_CONTACT_WHATSAPP_ENABLED=true` : activation explicite une fois la configuration et le test opérateur terminés. Absente ou différente de `true`, aucun envoi n’est possible.

Configurer dans Meta le callback `https://superadmin.xpressclean.cm/api/webhooks/platform-whatsapp`, avec le même jeton de vérification, et souscrire au champ `messages` du compte professionnel. Le POST vérifie `X-Hub-Signature-256` sur le corps brut, puis vérifie les identifiants du compte et du numéro contre l’expéditeur conservé dans la tentative avant tout changement. Un retour concernant un autre numéro autorisé ne peut pas modifier cette tentative. Ces retours fonctionnent même lorsque l’envoi est désactivé. Ils ne dépendent pas de la maintenance automatique générale. Les comptes en pause, fermés ou « Ne plus contacter », les coordonnées modifiées et les situations devenues obsolètes bloquent l’envoi.

L’activation d’un numéro peut nécessiter des actions du propriétaire dans Meta (authentification, vérification du numéro, conditions et configuration du compte). Aucun de ces états n’est déduit de la simple présence d’un numéro dans une fiche. Les secrets ne sont pas exposés par le diagnostic du superadmin.

Sources officielles : [modèles](https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/), [règles d’envoi](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages), [statuts fournisseur](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages).

## Installation

Exécuter explicitement `npm run db:migrate:platform-contacts` sur la base cible avant de publier cette interface. Le script applique uniquement `migrations/20261118_platform_contacts.sql`, qui ajoute deux tables et leurs index. Il ne modifie aucune commande, facture, organisation, formule ni permission. Il peut être exécuté plusieurs fois. Aucune migration automatique au démarrage et aucun `db:push` ne sont nécessaires.

Appliquer ensuite `npm run db:migrate:platform-contact-deliveries`, uniquement `migrations/20261119_platform_contact_deliveries.sql`. Cette migration ajoute le registre des tentatives et étend la contrainte des événements. Sur Replit, appliquer les deux migrations dans les bases développement et production avant publication pour éviter une proposition automatique de suppression liée à leur divergence de schéma. Ne jamais recopier les données développement vers production.

Le choix de plusieurs expéditeurs utilise les instantanés JSON existants et ne nécessite aucune nouvelle migration.

Le déploiement peut revenir au code précédent en conservant ces deux tables : les anciennes fonctionnalités les ignorent et l’historique reste disponible pour une reprise ultérieure. Ne pas supprimer les tables pour un retour arrière du code.

## Vérification

`npm run test:platform-contacts` utilise PostgreSQL en mémoire et des données fictives. Les contrôles couvrent les lectures sans écriture, l’historique, les dates, l’audit transactionnel, la validation sans envoi, les contextes périmés, les doubles requêtes, les accès MFA et l’origine des mutations. Les scénarios WhatsApp utilisent un fournisseur simulé et couvrent les réservations durables, les doublons, les modèles modifiés, les erreurs certaines/ambiguës, les signatures, la corrélation des retours et leur arrivée dans le désordre. Aucun message réel n’est envoyé par les tests. Les tests des paiements et du tableau de décision existants restent requis.
