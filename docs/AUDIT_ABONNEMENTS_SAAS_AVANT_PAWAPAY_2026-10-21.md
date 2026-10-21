# Audit des abonnements SaaS avant intégration pawaPay

Date : 21 octobre 2026. Référence commerciale : [cahier des charges v5](PROMPT_IMPLEMENTATION_ABONNEMENTS_XPRESSPRO_v5.md).

## Conclusion

Les fonctions métier du pressing et une base pawaPay Sandbox existent. Le nouveau modèle commercial Starter gratuit / Pro 10 999 / Business 18 999 FCFA n’est pas encore implémenté. Il faut construire les droits SaaS et le cycle de facturation avant de connecter un paiement confirmé à l’activation d’une formule. Brancher simplement un bouton pawaPay ne suffirait pas.

Cet audit modifie uniquement la documentation. Aucun code applicatif, tarif en base, compte, paiement, droit, secret, schéma ou déploiement n’a été modifié. Aucun checkout, appel de paiement réel ou test impliquant un débit n’a été déclenché.

## Périmètre et preuves

- Code local : commit `88a6220` (exports des reçus inclus).
- Replit, lecture du terminal et de l’API locale publique : commit `5ef5a28`, `GET http://localhost:5000/api/plans`. Les arbres Git local et Replit sont identiques : `663639055d29d6fa7c763b43452b200ecd1efa87`.
- Analyse du schéma, des chemins serveur/UI, de l’authentification, du Sandbox et de tests existants.
- 18 fichiers de tests ciblés exécutés localement : **18 réussites, 0 échec**. Le test pawaPay vérifie une signature synthétique en mémoire ; il ne constitue pas un paiement chez le fournisseur.
- Les parcours de toutes les pages authentifiées n’ont pas été rejoués dans un compte utilisateur. La configuration du compte marchand, ses capacités de production, les secrets Replit, les réglages du tableau de bord pawaPay et la base de production n’ont pas été vérifiés. Une présence dans le code n’est pas une certification commerciale.

## 1. Tarifs réellement servis par l’instance de développement

| Formule actuellement renvoyée par `/api/plans` | Prix mensuel | Commandes | Utilisateurs |
|---|---:|---:|---:|
| Starter | 6 000 FCFA | 100 | 1 |
| Pro | 15 000 FCFA | 500 | 3 |
| Business | 30 000 FCFA | 2 000 | 10 |
| Enterprise | 50 000 FCFA | Sans limite indiquée | Sans limite indiquée |

Ces valeurs correspondent au seed de `server/storage.ts:1196`. Elles diffèrent de la v5. Le seed existant ne remplace d’ailleurs pas les prix d’un catalogue déjà rempli : il met surtout à jour les textes de fonctionnalités. Il ne faut donc pas lancer simplement `seed-plans` pour migrer le modèle commercial.

Le site public contient encore un autre catalogue : Discover, Starter 3 900, Professional 12 900, Business 24 900 et Enterprise 49 900 FCFA ; il promet aussi « 30 jours OU 50 commandes, selon ce qui dure le plus longtemps ». Source du catalogue et des offres d’appel : `client/src/pages/landing.tsx:25`. Toutes les surfaces FR/EN/PT devront être harmonisées avec le même catalogue, après validation fonctionnelle.

## 2. Matrice de l’existant

« Existant » signifie qu’un module et ses chemins sont présents, pas que tous ses parcours ont été validés. Le niveau commercial v5 est indiqué séparément.

| Fonction | État constaté | Écart avec la v5 / vérification requise |
|---|---|---|
| Commandes, clients, services, statuts et historique | Existant | Réutiliser ; maintenir les commandes illimitées sans introduire les anciens plafonds du catalogue. |
| Paiements des commandes, avances, soldes, crédit client | Existant ; tests d’intégrité réussis | Domaine distinct des paiements SaaS. Aucun webhook SaaS ne doit alimenter les paiements des commandes. |
| Reçus HTML, PDF une page et PNG HD | Existant ; tests de reçu réussis et vérification visuelle effectuée lors du chantier précédent | Les trois formats standards restent Starter ; dissocier la personnalisation Pro des données réglementaires et financières. |
| Logo, couleurs, QR, note de pied et options de reçu | Existant | L’API de paramètres contrôle le rôle propriétaire, pas un droit SaaS de personnalisation. Conserver les réglages lors du downgrade et appliquer un modèle standard aux nouveaux reçus Starter. |
| Tableau de bord et dépenses | Existant | Séparer explicitement le socle gratuit des calculs/analyses payants. Parcours et calculs complets à valider avant commercialisation. |
| Rapports, analytics, machines, productivité, qualité/retours, rapports quotidiens | Modules existants ; tests ciblés retours/rapports quotidiens réussis | Droits de rôle et protections de site présents, mais protection SaaS incomplète. Définir quels actes précis sont avancés ; ne pas bloquer le suivi de base des réclamations Starter. |
| Abonnements/fidélité vendus aux clients du pressing | Existant ; tests ciblés réussis | Tables et logique distinctes du SaaS. `requirePlanManager` contrôle propriétaire/manager, et ne prouve pas un abonnement SaaS Pro. Ajouter le droit premium sans casser les engagements existants des clients du pressing. |
| Organisations, boutiques, invitations et rôles | Existant ; tests de frontière réussis | Pas de quota SaaS atomique de boutiques/personnel dans les chemins inspectés. Distinguer une fiche RH d’un compte avec accès. |
| Vue consolidée et comparaisons de boutiques | Existant dans dashboard/analytics | Restreindre l’exploitation multi-boutique à Business ; préserver les historiques du propriétaire hors quota. Valider les agrégats par site. |
| Page « abonnement actuel » et catalogue SaaS | Partiel | Anciens plans/quotas et activation gratuite ; manque les options, le devis détaillé, les quotas consommés et les décisions de rétrogradation. |
| Essai Pro 30 × 24 h par organisation | Absent dans les chemins SaaS inspectés | Pas de `trial_started_at` / `trial_ends_at` dédiés, ni création d’essai dans le chemin d’inscription inspecté. |
| Notifications SaaS J23–J30 et transition 7 jours | Absent | Le job existant traite les abonnements des clients du pressing et les points de fidélité ; ce n’est pas le rappel d’essai SaaS. |
| Expiration SaaS avec contrôle à chaque requête | Absent/incomplet | La lecture de l’abonnement actif ne filtre pas `endDate`. Pas de suspension SaaS des sessions de personnel déjà ouvertes. |
| Crédit Pro → Business, prorata des options, renouvellement regroupé | Absent | Pas de modèle de devis/facture/lignes/options/crédit/downgrade différé correspondant à la v5. |
| Boutiques historiques en lecture seule | Absent comme état SaaS distinct | `sites.isActive` existe, mais ne suffit pas à distinguer droit d’exploitation, archivage et consultation historique. |
| pawaPay Checkout et signature de callback | Partiel : Sandbox | Montant de test fixe, accès restreint, aucune activation de formule ni reçu SaaS après paiement. |
| Activation commerciale après confirmation fournisseur | Absente | À réaliser avec rapprochement facture/montant/devise/organisation, transaction atomique et idempotence. |
| Reçus/factures SaaS distincts | Partiel au niveau données, parcours complet absent | `subscription_payments` existe, mais ne représente pas encore les factures détaillées et transactions fournisseur de la v5. |

## 3. Blocages prioritaires avant l’encaissement

### A. Une formule peut être activée sans payer

`POST /api/subscriptions/activate` (`server/routes.ts:1783`) vérifie le propriétaire puis appelle `createSubscription`. Cette méthode ferme l’abonnement actif et crée immédiatement un abonnement actif avec une date de fin à un mois (`server/storage.ts:1227`), sans vérifier de paiement. Le bouton correspondant est encore présent dans `client/src/pages/subscriptions.tsx`.

C’est un fonctionnement actuel, pas une faille d’authentification constatée : il est réservé au propriétaire. Mais il contournerait la future vente des formules s’il restait disponible. Il devra être remplacé, ou limité à un droit gratuit/essai explicitement admissible. Les activations administratives (`server/lib/platform-admin-routes.ts:691`) devront rester des dérogations tracées, distinctes d’une facture payée ; le chemin existant indique déjà `paymentRecorded: false`.

### B. Les droits SaaS ne sont pas centralisés

Le schéma `subscriptions` est attaché à `userId`, pas directement à `organisationId` (`shared/schema.ts:343`). Certaines lectures retrouvent le propriétaire pour déterminer la formule. Cela ne constitue pas encore une source de vérité complète par entreprise.

La carte de fonctionnalités côté navigateur (`client/src/hooks/use-auth.ts:88`) conserve Enterprise et autorise machines/employés en Starter. `canAccess` est surtout une matrice de rôles. Côté serveur, un contrôle de formule explicite existe notamment pour `/api/analytics/advanced` (`server/routes.ts:2330`), avec Business/Enterprise. Cela ne protège pas l’ensemble des modules premium et ne correspond pas encore aux droits Pro de la v5.

### C. Expiration et quotas non appliqués selon la v5

`getUserSubscription` sélectionne un statut `active` sans comparer la date de fin au moment courant (`server/storage.ts:1219`). Les dates ne suffisent donc pas à démontrer une expiration effective.

La création de boutique vérifie le propriétaire (`server/routes.ts:2413`), puis `createSite` insère le site et son appartenance propriétaire (`server/storage.ts:1721`) sans verrou/quota SaaS. La création d’invitation, son acceptation, l’activation de comptes et les chemins de création/modification d’employés doivent être répertoriés ensemble, pour éviter un contournement par un deuxième chemin ou deux requêtes simultanées.

### D. Le Sandbox ne constitue pas un encaissement commercial

- `server/lib/pawapay-sandbox-service.ts:5` utilise uniquement `https://api.sandbox.pawapay.io/v2/checkouts` et un montant fixe de **1 000 XAF**, même si un `planId` est fourni.
- Les routes administrateur et le test utilisateur sous liste d’autorisation existent (`server/lib/pawapay-sandbox-checkout-routes.ts`). Le retour utilisateur pointe vers `app.xpressclean.cm/subscriptions` ; il faudra paramétrer des URL séparées par environnement.
- Le callback vérifie une signature ECDSA, le digest du corps, l’horodatage, les montants et le code du checkout. Les callbacks répétés de même statut sont tolérés ; les statuts terminaux contradictoires sont rejetés. Le test cryptographique local réussit.
- Une réconciliation périodique existe pour les checkouts récents encore en attente. Elle n’est pas un moteur complet de facturation SaaS, et ne couvre pas à elle seule les confirmations très tardives ou une panne prolongée.
- Le callback met à jour l’état Sandbox et précise qu’il ne modifie ni paiement ni abonnement. C’est une séparation utile à conserver pour les tests.
- La table Sandbox peut être créée/complétée par du DDL au premier usage (`server/lib/pawapay-sandbox-schema.ts`). Ne pas généraliser ce mécanisme au nouveau moteur de production : préparer des migrations versionnées, revues et appliquées séparément.

## 4. Carte des points à protéger lors de l’implémentation

Cette liste regroupe les familles identifiées ; le futur audit de couverture devra suivre chaque handler et ses services jusqu’à l’écriture, plutôt que protéger uniquement les URL listées.

| Domaine | Entrées principales | Contrôle requis |
|---|---|---|
| Identité / contexte | Inscription, connexion propriétaire/personnel, `buildUserResponse`, `isAuthenticated`, changement de site | Organisation, fin d’essai/cycle et suspension d’accès résolues côté serveur ; propriétaire toujours préservé. |
| Formule | `/api/plans`, `/api/subscriptions/current`, `/activate`, ancien `/pay`, outils superadmin | Catalogue commun, statut financier exact, suppression du raccourci d’activation payante gratuite ; dérogation admin auditée. |
| Boutiques | `/api/sites`, sélection de site, vues agrégées, routes site-spécifiques | Une boutique exploitable en Starter/Pro ; Business au-delà ; consultation historique séparée des écritures et des agrégats premium. |
| Personnel | `/api/invitations`, acceptation/join, rôles, `site_members`, création/activation des accès d’employés | Décompte unique des comptes actifs par organisation, propriétaire exclu ; contrôle atomique à l’activation et sur les sessions ouvertes. |
| Reçus | `/api/settings`, générateurs de reçu, reçu abonné côté serveur | Standards gratuits dans les trois formats, options de personnalisation premium ; ancien document conservé. Vérifier si les reçus sont réellement archivés ou régénérés. |
| Rapports / pilotage | `/api/reports/*`, `/api/analytics/*`, machines/cycles, `/api/daily-site-reports*` | Droits SaaS précis par action, en plus des rôles et du tenant ; historique gratuit préservé selon v5. |
| Retours / fidélité | `/api/garment-returns*`, `membership-routes.ts`, dashboards/notifications d’abonnements clients | Retours de base Starter ; avancé Pro ; module clients isolé du paiement SaaS. Décider de la poursuite des engagements clients déjà souscrits lors d’un downgrade du pressing. |
| Paiement SaaS | Création de devis/checkout, callback, réconciliation, expiration | Prix serveur, référence immuable, devise XAF, confirmation vérifiée, activation exactement une fois ; jamais sur retour navigateur. |

## 5. Architecture et migrations proposées — non appliquées

1. **Catalogue unique versionné** : trois formules, droits par action, boutiques incluses, places de personnel et tarifs d’options. Le propriétaire n’est jamais une place ; les commandes n’ont aucun plafond commercial. Les prix SaaS XAF ne doivent pas être réétiquetés avec une autre devise choisie dans les paramètres du pressing.
2. **Abonnement par organisation** : état d’essai/période active/Starter, dates UTC avec fuseau explicite, prochaine modification demandée, boutique exploitée sélectionnée et compteurs de droits. Ajouter un état de suspension par abonnement pour les accès ; ne pas supprimer les utilisateurs ni employer le même indicateur pour tous les motifs d’inactivité.
3. **Factures et lignes SaaS** : prix figés, options, crédit de l’upgrade, montants XAF arrondis déterministement et lien avec organisation, version du catalogue et période. Conserver l’historique du montant réellement payé ; ne pas le recalculer depuis le tarif actuel.
4. **Transactions fournisseur** : référence unique interne et pawaPay, identifiant de tentative, montant/devise attendus, état en attente/final et événements signés ; contrainte d’unicité empêchant la double application. Transaction atomique pour rapprocher la facture, enregistrer le paiement et appliquer les droits.
5. **Cycle et réconciliation** : un contrôleur d’accès calcule les droits effectifs avec l’heure serveur même si un job est en retard. Un job matérialise les transitions et notifications dédupliquées par organisation/date locale. Une transaction en attente reste en attente ; elle ne prolonge pas implicitement les droits expirés et pourra activer un nouveau cycle après confirmation.
6. **Compatibilité** : introduire d’abord les tables/champs complémentaires et leur validation, puis les lecteurs compatibles, puis la migration d’états, enfin les protections et le paiement. Les anciennes références de plans et reçus ne sont pas supprimées ; les anciennes offres disparaissent seulement de la vente nouvelle.
7. **Inventaire préalable de données** : compter organisations, dates de création, abonnements actifs/expirés, paiements réellement justifiés, doublons d’abonnement actif, boutiques et comptes actifs distincts. Classer les anomalies ; aucun réassignement automatique entre organisations.
8. **Transition commerciale** : appliquer les sept jours prévus par la v5 seulement selon un plan de migration approuvé ; garantir au moins sept jours de préavis. Examiner séparément les périodes déjà payées et les dérogations administratives, sans transformer une activation gratuite historique en preuve de paiement ni supprimer un droit payé valable sur le seul critère d’âge du compte.
9. **Downgrade** : recueillir le choix de boutique/comptes avant échéance ; définir un comportement déterministe si le propriétaire ne répond pas. Conserver une boutique propriétaire utilisable et toutes les données historiques. Le choix automatique de secours doit être approuvé avant migration.
10. **Déploiement ultérieur** : migrations revues hors démarrage, sauvegarde et répétition sur copie isolée, tests Sandbox, activation progressive par organisation, journalisation sans secrets, puis décision explicite de publication. Aucun appel de paiement réel tant que le parcours n’a pas été validé.

## 6. Ordre de travail recommandé

1. Régler les détails commerciaux encore ouverts ci-dessous et figer le catalogue v5.
2. Implémenter les droits/essai/quotas et les lectures historiques dans une branche dédiée, avec un prestataire de paiement simulé pour les tests, sans accorder de droits sur une promesse de paiement.
3. Implémenter les factures, devis, crédit et options ; vérifier le moteur de dates et montants.
4. Raccorder le Sandbox pawaPay existant à ce moteur et tester le parcours complet avec des données fictives.
5. Préparer l’inventaire et la migration des organisations, puis la revue du parcours et des paramètres du compte marchand.
6. Préparer la production et son rollback ; publication et éventuelle transaction réelle restent des étapes distinctes à autoriser.

## 7. Décisions restantes

- Renouvellement manuel ou automatique : la recommandation est **manuel au lancement**, sans prélèvement automatique implicite ; le document v5 distingue cela d’une décision déjà prise.
- Crédit des options de personnel Pro déjà payées lors d’un passage Business : éviter la double facturation des mêmes places, définir la règle avant ce cas d’usage.
- Anniversaire au 29/30/31 et frais éventuels dans le prix affiché : préciser les règles de date et l’affichage avant paiement.
- Boutique/comptes retenus si aucun choix n’a été fait avant une rétrogradation ; traitement des prestations déjà promises aux clients du pressing dans son module fidélité.
- Archivage des anciens reçus/rapports : un document régénéré avec les réglages du moment n’est pas la conservation d’un document d’origine. Vérifier la persistance réelle et prévoir un instantané si nécessaire.

Ces précisions n’empêchent pas de valider les trois tarifs et la règle multi-boutique Business ; elles empêchent simplement de présenter un parcours de paiement comme terminé avant de les traiter.

## 8. Tests exécutés et limites

18/18 tests réussis : `pawapay-sandbox-callback`, `auth-organisation-boundary`, `staff-invitation-account-boundary`, `tenant-isolation`, `platform-admin-security`, `order-integrity.integration`, `subscription-security`, `subscription-payment-cycle`, `subscription-payment-receipt`, `subscription-dashboard`, `subscriber-receipt-design`, `company-receipt-qr`, `receipt-display`, `receipt-export`, `daily-site-reports`, `daily-site-reports-schema`, `garment-return-routes`, `garment-return-ui` (fichiers dans `server/lib`).

Les tests `subscription-*` concernant les clients d’un pressing ne prouvent pas le fonctionnement du futur SaaS. Les tests de frontières et plusieurs tests de surface inspectent le source ; ils ne remplacent pas tous les scénarios HTTP concurrents avec une base isolée. Les tests pawaPay actuels n’établissent pas une validation de tous les callbacks hors ordre ou des pannes fournisseur. Il faudra ajouter les tests d’acceptation v5, les cas de paiement confirmé exactement une fois, de devis expiré, de crédit, de quota concurrent et de sessions ouvertes suspendues.

Aucun nouveau build nécessaire pour cet audit de documentation ; la version applicative de référence avait passé les vérifications de type/build et sa suite précédente de 46 contrôles dans Replit lors du chantier des reçus.
