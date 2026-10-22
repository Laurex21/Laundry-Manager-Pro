# XpressClean: acquisition TikTok

## État de l’intégration

Pixel créé le 22 octobre 2026 : **XpressClean – Acquisition web** (`DBCLIORC77U3JBDSA280`), détenu par GENERAL ADVANCE SERVICES_bc.
La création du pixel ne signifie pas que le site envoie déjà des événements.

La correspondance automatique avancée, les cookies propriétaires et la collecte enrichie ont été désactivés lors de la configuration dans TikTok. Ne pas réactiver l’identification automatique ni installer le code générique dans tout le site.

Le code est désactivé par défaut. Pour une activation contrôlée, définir `VITE_TIKTOK_PIXEL_ENABLED=true` **au moment de la compilation et à l’exécution du serveur**. Sans ce drapeau le SDK TikTok n’est pas chargé et la politique de sécurité du serveur n’est pas élargie. Les modifications doivent être intégrées et publiées avant de pouvoir vérifier de vrais événements dans TikTok.

## Consentement et périmètre

Le visiteur peut accepter ou refuser avec des boutons de même présentation. Il peut rouvrir son choix sur les pages publiques. Le refus ne bloque pas le site ni l’inscription. Le consentement marketing est distinct de l’acceptation des conditions à l’inscription.

L’intégration est limitée aux pages `/`, `/xpresspro`, `/xpress-consulting`, `/xpress-clean`, `/rencontre` et `/auth?tab=register`, pour les visiteurs non connectés. Les pages internes, formulaires de connexion, liens de réinitialisation, rapports contenant un jeton et espaces administrateur sont exclus. Quitter ce périmètre recharge le document pour éliminer le SDK ; les documents des pages internes conservent leur CSP stricte.

Pas de `identify`, champ de formulaire, numéro WhatsApp, adresse e-mail, URL de destination, identifiant de client ou données de commande dans les paramètres envoyés. Le SDK reçoit néanmoins les informations techniques habituelles d’une connexion navigateur à TikTok, notamment l’adresse IP. Aucun SDK n’est chargé avant acceptation. Les paramètres d’URL non autorisés et les fragments empêchent le chargement initial du SDK.

La notice affichée sur le site informe du partage à TikTok. Relire les politiques de confidentialité et cookies avec les documents contractuels en vigueur avant l’activation en production ; cette intégration ne modifie pas leurs versions ni les acceptations enregistrées.

## Événements

| Action | Événement interne d’acquisition | TikTok | Signification |
|---|---|---|---|
| Consultation publique | `marketing_visit` | `ViewContent` | Page consultée après consentement |
| Clic WhatsApp | `marketing_whatsapp_clicked` | `Contact` | Intention de contact, pas une conversation ni un prospect qualifié confirmé |
| Ouverture de la démo | `marketing_demo_started` | `ViewContent` | Début demandé, pas une demande de démo commerciale ni une lecture complète |
| Clic pour s’inscrire | `marketing_signup_started` | `ClickButton` | Début de parcours |
| Inscription réussie | `marketing_signup_completed` | `CompleteRegistration` | Réponse serveur réussie à l’inscription propriétaire, jamais une connexion |

Le suivi Umami/Replit existant `signup_completed` est conservé. Ne pas additionner ce compteur historique avec le compteur d’acquisition : ce sont deux vues de la même action. L’envoi au pixel reste susceptible d’être bloqué par le navigateur ; ne pas le confondre avec les inscriptions effectivement enregistrées côté serveur.

## Liens utilisables

Ne pas mettre de nom, téléphone, e-mail ou données de client dans les UTM. Les valeurs de campagne sont explicitement autorisées dans `shared/marketing.ts` ; toute nouvelle valeur doit être ajoutée intentionnellement.

| Usage | Lien |
|---|---|
| Profil TikTok → présentation XpressPro | https://app.xpressclean.cm/xpresspro?utm_source=tiktok&utm_medium=profile&utm_campaign=xpresspro&utm_content=profil |
| Vidéo projet Tchad → accompagnement | https://app.xpressclean.cm/xpress-consulting?utm_source=tiktok&utm_medium=organic_social&utm_campaign=formation_pressing&utm_content=projet_tchad |
| Vidéo budget → lancement | https://app.xpressclean.cm/xpress-consulting?utm_source=tiktok&utm_medium=organic_social&utm_campaign=lancement_pressing&utm_content=budget_500k |
| LIVE → inscription XpressPro | https://app.xpressclean.cm/auth?tab=register&utm_source=tiktok&utm_medium=live&utm_campaign=xpresspro&utm_content=live_20261021 |
| Facebook → XpressPro | https://app.xpressclean.cm/xpresspro?utm_source=facebook&utm_medium=organic_social&utm_campaign=xpresspro&utm_content=profil |
| WhatsApp → XpressPro | https://app.xpressclean.cm/xpresspro?utm_source=whatsapp&utm_medium=referral&utm_campaign=xpresspro&utm_content=profil |

Les sources autorisées sont TikTok, Facebook, WhatsApp, LinkedIn et YouTube. L’attribution mémorisée correspond à la dernière campagne reconnue de la session de cet onglet, après consentement. Elle n’est pas une attribution multi-appareil ou multi-domaine. Des liens distincts ne sont utiles que si chacun est effectivement utilisé à sa destination.

## Vérification et tableau de résultats

1. Navigateur neuf : aucun script/requête TikTok avant consentement, y compris sur la page d’inscription.
2. Refuser : aucun événement d’acquisition ni sauvegarde des UTM ; inscription toujours possible.
3. Accepter sur un lien connu : vérifier `ViewContent`, puis `Contact` après clic WhatsApp dans **Test events** de TikTok, avec un navigateur de test et sans données personnelles.
4. Vérifier une inscription dans un environnement de test : une seule conversion, uniquement après succès serveur, aucune conversion lors d’un échec ou d’une connexion.
5. Entrer dans l’application : document rechargé et aucun SDK TikTok sur la page interne. Tester un lien direct vers `/dashboard` et `/orders`.
6. Retirer le consentement : le document est rechargé, les UTM de session effacés, aucun événement supplémentaire.
7. Bloqueur de publicité ou stockage désactivé : aucune interruption du formulaire.

Tableau de revue hebdomadaire : campagne, visites mesurées, clics WhatsApp, débuts d’inscription, inscriptions réussies, conversations confirmées, prospects qualifiés, rendez-vous et ventes confirmées. Les quatre derniers indicateurs sont à rapprocher du suivi commercial ; ils ne sont pas déduits d’un clic.

Formules : taux de clic contact = clics WhatsApp / visites mesurées ; taux d’inscription = inscriptions d’acquisition / visites mesurées. Ces ratios portent sur la population consentante mesurée, pas sur tous les visiteurs. Sans dépense publicitaire, ne pas afficher de coût d’acquisition calculé à partir des seules vues.

L’association TikTok reste distincte du pixel : scanner le QR dans l’application sous **@xpressclean6**, examiner les permissions, confirmer, puis vérifier que le compte apparaît dans Business Center. Le mode « Gérer le compte » couvre aussi publications, messages et statistiques ; seul le propriétaire peut approuver cette association.
