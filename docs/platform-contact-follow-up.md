# Suivi des contacts dans le superadmin

Le tableau « Accompagnement » affiche les nouveaux pressings de la période choisie et les organisations disposant déjà d’un suivi, même plus anciennes. Les comptes exclus du pilotage restent exclus de ce module. L’accès est réservé aux administrateurs de plateforme avec une session MFA valide.

La fiche propose trois espaces : contact et prochaine action, message à valider, historique. Les dates de contact et de prochaine action sont exprimées en heure de Douala. Les contacts et changements de suivi conservent leur auteur, leur date d’enregistrement et leur contenu. L’historique est paginé et n’est pas modifiable par l’interface.

Les propositions françaises et anglaises utilisent l’activité réelle, les paiements et les droits d’accès. Un brouillon doit être enregistré avant validation. La validation ne déclenche aucun envoi ; le texte validé peut être copié pour un envoi manuel. Un contact effectif doit être enregistré séparément. Aucun lien wa.me, appel fournisseur, ordonnanceur ou activation de maintenance n’est ajouté.

Les suivis en pause, terminés ou « Ne plus contacter » ne permettent pas de valider ni de copier un message validé. Toute modification du contexte (activité, abonnement, paiement, coordonnées, historique des contacts ou prochaine action) impose une nouvelle revue. Le contexte est revérifié à la validation et avant la copie. Une modification du texte retire son ancienne validation lors de l’enregistrement.

Les mutations utilisent un numéro de version, un identifiant de requête réutilisable et un verrou par organisation. L’écriture du suivi, de son événement et de l’audit administrateur s’effectue dans une transaction unique. Un échec d’audit annule toute l’opération. Les notes et messages sont rendus comme du texte et ne sont pas insérés dans le journal général des requêtes.

## Installation

Exécuter explicitement `npm run db:migrate:platform-contacts` sur la base cible avant de publier cette interface. Le script applique uniquement `migrations/20261118_platform_contacts.sql`, qui ajoute deux tables et leurs index. Il ne modifie aucune commande, facture, organisation, formule ni permission. Il peut être exécuté plusieurs fois. Aucune migration automatique au démarrage et aucun `db:push` ne sont nécessaires.

Le déploiement peut revenir au code précédent en conservant ces deux tables : les anciennes fonctionnalités les ignorent et l’historique reste disponible pour une reprise ultérieure. Ne pas supprimer les tables pour un retour arrière du code.

## Vérification

`npm run test:platform-contacts` utilise PostgreSQL en mémoire et des données fictives. Les contrôles couvrent les lectures sans écriture, l’historique, les dates, l’audit transactionnel, la validation sans envoi, les contextes périmés, les doubles requêtes, les accès MFA et l’origine des mutations. Les tests des paiements et du tableau de décision existants restent requis.
