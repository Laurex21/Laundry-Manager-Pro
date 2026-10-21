# Cahier des charges — abonnements SaaS XPress Pro — v5

Version du 21 octobre 2026. Ajustements commerciaux validés par le propriétaire dans la conversation. Cette version remplace la v4 pour les règles ci-dessous.

**Phase actuelle autorisée :** mettre à jour ce document et auditer l’existant. L’implémentation de la facturation et la connexion aux paiements réels viennent après cet audit ; aucune publication, migration de production ou transaction réelle n’est autorisée par ce document.

Le futur travail porte sur le dépôt `Laundry-Manager-Pro` de XPress Pro et sur le nouveau modèle d'abonnement **SaaS des pressings** ci-dessous. Ne le confonds pas avec les abonnements/fidélité que les pressings vendent à leurs propres clients : ce sont deux domaines distincts. Travaille dans une branche dédiée, sans modifier les données de production et sans déployer sur Replit avant validation explicite.

## 1. Avant de coder

1. Inspecte le schéma DB, l'authentification, les organisations/sites/personnels, les permissions, le paiement SaaS existant et les pages réelles : commandes, clients, services, reçus/paramètres, paiements, dépenses, rapports, analytics, machines, qualité, rapports quotidiens et abonnements clients.
2. Fais une matrice **fonction existante / partielle / absente**. Ne présente pas une fonction partielle comme prête à commercialiser.
3. Identifie tous les points d'entrée API et UI à protéger. Propose les migrations, la stratégie de compatibilité pour les organisations existantes et les cas de rétrogradation. Reprends les décisions commerciales confirmées de la section 10. Livrer d’abord l’audit et les blocages ; ne pas commencer l’intégration dans la phase actuelle.
4. Le fournisseur retenu est **pawaPay**. Auditer et réutiliser les composants Sandbox existants qui conviennent ; leur présence ne prouve pas qu’une intégration de production est terminée. Ne pas introduire un autre fournisseur.

## 2. Formules mensuelles (FCFA)

| Formule | Prix | Boutiques | Personnel actif | Commandes |
|---|---:|---:|---:|---|
| Starter | 0 | 1 | 0 personnel ; propriétaire seul | Illimitées |
| Pro | 10 999 | 1 | 2 membres du personnel actifs + propriétaire hors quota | Illimitées |
| Business | 18 999 | 2 | 5 membres du personnel actifs + propriétaire hors quota | Illimitées |

**Starter n’accepte aucune option de personnel : le propriétaire reste seul. Sur Pro et Business**, un membre du personnel actif au-delà du quota coûte **2 000 FCFA par mois**. Le compte propriétaire ne compte jamais dans le quota. Une même personne disposant d’un accès à plusieurs boutiques de la même organisation compte **une seule fois**. Le quota concerne les comptes de personnel actifs disposant d’un accès à la plateforme ; une fiche RH sans accès ne crée pas automatiquement une place facturable. **La création et l’exploitation de boutiques au-delà de la boutique unique sont réservées à Business. Aucune option de boutique supplémentaire sur Starter, Pro ou pendant l’essai Pro.** Sur Business uniquement : **+5 000 FCFA par mois par boutique supplémentaire** au-delà des deux incluses. **Chaque boutique supplémentaire ajoute aussi 2 places de personnel actif**, en plus du quota de base de 5. Ces places suivent la boutique et disparaissent du quota actif si elle est retirée, sans suppression des comptes. Exemple : 3 boutiques = 23 999 FCFA/mois ; 4 = 28 999 FCFA/mois. Le montant doit être calculé côté serveur et clairement détaillé sur l'écran de paiement et la facture SaaS.

Exemples de facturation mensuelle : Pro avec 3 employés actifs = **12 999 FCFA** ; Business avec 3 boutiques et 7 employés actifs = **23 999 FCFA** ; avec 8 employés actifs = **25 999 FCFA**. Les places incluses sont consommées avant toute place supplémentaire payante.

Ne réintroduis pas la formule à 6 999 FCFA. Les prix, quotas et droits doivent être centralisés dans une configuration unique, pas disséminés dans les composants.

## 3. Droits par formule

### Starter
- Création et suivi de commandes **sans limite de volume**, articles, statuts, recherche et historique.
- Fiches clients, catalogue de services et tarifs.
- Paiements, soldes et reçus standard imprimables/partageables et téléchargeables en **HTML, PDF sur une seule page et image PNG haute définition**. Les trois formats restent accessibles en Starter ; la personnalisation est réservée aux formules payantes. Les informations légalement nécessaires restent visibles.
- Tableau de bord simple et dépenses de base.
- Enregistrement et suivi de base des retours/réclamations.
- Une boutique et accès du propriétaire uniquement.
- Conservation et consultation de toutes les données créées auparavant, y compris pendant l'essai Pro. Ne promets pas un export général CSV : il n'a pas été confirmé comme fonction existante.

### Pro
Tout Starter, plus. Ces modules existent dans le produit ; vérifier leurs parcours complets, calculs et permissions avant de les présenter comme inclus :
- Jusqu'à 2 membres du personnel actifs, avec rôles/permissions adaptés ; places additionnelles à 2 000 FCFA/mois, propriétaire exclu et décompte unique par organisation. Une boutique maximum, sans option multi-boutique.
- Personnalisation des reçus : logo, couleur d'en-tête, note de pied, QR et options de présentation existantes. **Ne jamais bloquer la génération du reçu standard.**
- Rapports et analyses détaillés : ventes, paiements, dépenses, marges, tendances, employés et machines, selon les calculs existants et vérifiés.
- Pilotage machines, productivité, qualité/retours et rapports quotidiens avancés.
- Abonnements/fidélisation des clients du pressing, si le module actuel est fiable et peut être isolé proprement par droit SaaS.

### Business
Tout Pro, plus :
- **Accès multi-boutique réservé à Business** : 2 boutiques incluses ; boutiques supplémentaires à 5 000 FCFA/mois chacune, avec 2 places de personnel supplémentaires par boutique additionnelle.
- Jusqu'à 5 membres du personnel actifs dans le forfait de base.
- Affectation du personnel et permissions par boutique.
- Vue consolidée et comparaison des boutiques ; rapports par site.

**Commun à toutes les formules :** authentification, sécurité, isolation des données entre organisations/sites, intégrité des paiements et accès aux données propres du client. Ces protections ne sont jamais des options payantes.

Les SMS/WhatsApp sortants ne sont **pas** inclus implicitement. S'il existe déjà une fonction opérationnelle, en documenter le coût et la règle de facturation séparée. Ne pas annoncer ni activer un envoi non confirmé.

## 4. Essai Pro à l'inscription

- À la création d'une **nouvelle organisation**, activer automatiquement **30 jours d'essai Pro** ; aucun moyen de paiement obligatoire et aucune facturation automatique implicite.
- L'essai est attaché à l'organisation, pas à chaque utilisateur. Une invitation, un nouvel employé ou une reconnexion ne redémarre jamais l'essai. Empêcher les doubles essais triviaux sans bloquer abusivement des entreprises légitimes.
- Stocker `trial_started_at` et `trial_ends_at` en UTC ; afficher la date et le compte à rebours dans le fuseau local. La durée est de 30 × 24 heures à compter de l'activation, calculée côté serveur.
- Afficher clairement dès l'inscription : « 30 jours de Pro gratuits, puis Starter gratuit si vous ne vous abonnez pas ».
- Le paiement Pro confirmé pendant l'essai transforme l'organisation en Pro payant sans interruption. Si Business est acheté, appliquer Business après paiement confirmé.

## 5. Notifications de fin d'essai

- À partir de **J23** (7 jours avant l'échéance) et jusqu'à **J30**, afficher **au maximum une notification in-app par jour** invitant le propriétaire à s'abonner, avec le nombre de jours/heures restants et un lien vers les formules. Ne pas notifier les employés.
- Dédupliquer par organisation et date locale ; ne pas renvoyer lors de chaque connexion. Arrêter immédiatement après paiement confirmé.
- Ne pas envoyer de SMS, WhatsApp ou e-mail quotidien automatiquement. Ces canaux exigent une décision produit distincte, consentement, contrôle des coûts et mécanisme anti-spam.
- À l'expiration, afficher une notification unique expliquant le passage à Starter et comment réactiver Pro.

## 6. À l'expiration des 30 jours sans paiement

- Basculer automatiquement et de façon idempotente sur Starter **à l'instant `trial_ends_at`**, y compris si personne n'est connecté. Le contrôle d'accès aux requêtes doit également détecter une échéance passée si une tâche planifiée a du retard.
- Désactiver les **actions** Pro côté serveur et côté UI : personnalisation, génération de nouveaux rapports avancés, gestion d'équipe et autres droits Pro. Les rapports déjà conservés restent consultables par le propriétaire ; cela n’autorise pas la création de nouvelles analyses premium. Ne pas se limiter à cacher des boutons.
- Préserver toutes les commandes, données clients, paiements, reçus déjà générés, réglages et rapports historiques. Ne rien supprimer ni réécrire.
- Au retour à Starter, le propriétaire choisit **une boutique active**. Les autres boutiques passent en **consultation historique uniquement pour le propriétaire** : pas de nouvelle commande, paiement, modification, invitation, action de production ni nouvelle opération commerciale. Le serveur doit distinguer lecture et écriture, y compris via une session déjà ouverte. Les historiques, commandes, paiements et reçus restent consultables et téléchargeables. Une boutique ainsi suspendue ne redevient exploitable que sous Business confirmé et dans le quota payé.
- En Business → Pro, le propriétaire choisit également une seule boutique active ; les autres gardent le même accès historique.
- Les membres du personnel au-delà du quota Starter passent en état suspendu par abonnement, **pas supprimés**. Le propriétaire conserve son accès. Empêcher que des sessions de personnel déjà ouvertes continuent à utiliser les droits Pro.
- Les réglages Pro antérieurs restent stockés mais ne s'appliquent plus aux nouveaux reçus Starter ; un abonnement payant les restaure sans ressaisie. Les anciens reçus restent inchangés.
- Un paiement confirmé plus tard réactive immédiatement les droits, les réglages et les comptes autorisés par le quota souscrit. Si plus de comptes sont stockés que le quota, demander au propriétaire de choisir les comptes actifs, sans suppression automatique.
- À la fin d’une période payante sans renouvellement confirmé, ou après paiement échoué à l’échéance, **retour immédiat à Starter, sans période de grâce**. Préserver toutes les données et envoyer une notification de changement de formule. Une transaction encore en cours est affichée **« En attente de confirmation »**, jamais comme payée ou échouée sans preuve. Sans paiement confirmé à l’échéance, les droits payants expirent selon la règle sans grâce ; la transaction reste en attente et peut réactiver les droits une fois confirmée, une seule fois. Une réconciliation serveur et un journal de transitions doivent éviter les doubles bascules et doubles activations.

## 7. Changement de formule et facturation

- **Pro → Business en cours de cycle : créditer la valeur des jours Pro payés et non utilisés** sur la première facture Business. Calculer le crédit sur les dates exactes du cycle : `crédit Pro = prix de base Pro réellement payé × durée restante / durée totale du cycle`, arrondi une fois au FCFA. Un essai gratuit ne crée aucun crédit. Le montant à payer est le tarif Business et ses options choisies, moins le crédit Pro éligible, sans montant négatif ni remboursement automatique en espèces. Afficher séparément le prix Business, le crédit, les options et le montant final avant confirmation. Après paiement confirmé, Business démarre immédiatement un nouveau cycle mensuel et l’ancien cycle Pro est clos ; le crédit ne peut être utilisé qu’une seule fois. Le devis doit avoir une durée de validité pour éviter un montant changeant pendant le paiement.
- Le traitement du reliquat des options de personnel déjà payées lors de ce changement reste à préciser avant de coder ce cas : ne pas inventer de règle ni facturer deux fois les mêmes droits.
- Starter/essai → Pro ou Business : facturer le prix mensuel intégral de la formule choisie et démarrer un nouveau cycle à la confirmation du paiement.
- Business → Pro ou formule payante → Starter à la demande du client : changement au prochain renouvellement, sans second prélèvement immédiat. Une échéance impayée entraîne en revanche le retour immédiat à Starter déjà défini.
- Boutique Business supplémentaire (5 000 FCFA/mois, Business exclusivement) et personnel au-delà du quota **Pro ou Business** (2 000 FCFA/mois par membre actif, propriétaire exclu) : si l’option est ajoutée en cours de cycle, facturer immédiatement **au prorata du temps restant dans le cycle de la formule payante courante**, sans changer la date de renouvellement. Au renouvellement, inclure le plein tarif de toutes les options actives dans **une seule facture de la formule courante**. Exemple illustratif : 10 jours sur 30 restants → boutique 5 000 × 10/30 = 1 667 FCFA après arrondi au FCFA ; employé 2 000 × 10/30 = 667 FCFA. Calculer avec les dates exactes du cycle réel, ne pas supposer que chaque mois a 30 jours. Afficher montant et prochaine échéance avant paiement ; activer après confirmation.
- Retrait d’une boutique ou d’un employé optionnel : prendre effet au prochain renouvellement ; ne jamais supprimer les données ni les comptes. Si le nouveau quota devient insuffisant, demander quels comptes restent actifs.
- Garantir un calcul déterministe, une seule activation par paiement confirmé et des reçus SaaS séparés des reçus de commandes du pressing.

## 8. Architecture et intégrité

- Introduire une source de vérité des *entitlements* SaaS par organisation : plan, état (`trialing`, `active`, `starter`, `past_due` si pertinent), dates, quotas et nombre de boutiques additionnelles payées.
- Appliquer les quotas sur les API de création/activation des sites et membres du personnel, ainsi que sur les API premium. Toutes les vérifications sont tenant-scoped, atomiques et testées contre les accès inter-organisations.
- Le changement de plan et le paiement doivent être idempotents ; les webhooks authentifiés font foi. Ne jamais accorder Pro/Business sur simple retour navigateur ou promesse de paiement.
- Migration des organisations existantes : celles âgées de **plus de 30 jours au lancement** reçoivent **7 jours de maintien temporaire des droits Pro**, à compter de l’activation du nouveau système pour leur organisation, avec notifications in-app quotidiennes invitant à s’abonner. Sans paiement confirmé au terme des 7 jours, retour à Starter sans perte de données. Les organisations de 30 jours ou moins terminent leur essai initial ; garantir au minimum 7 jours de préavis à partir de la migration avant tout downgrade. Produire la liste des états existants et un plan de migration à approuver avant application en production.
- Journaliser les changements de formule, d'essai et de quotas sans exposer de données sensibles. Prévoir le cas d'une boutique additionnelle retirée : données conservées, consultation historique par le propriétaire, nouvelles opérations bloquées ; une réactivation multi-boutique exige Business et les droits payés correspondants.
- Faire passer les tests de build/types et les tests tenant/permissions existants.

## 9. Interfaces et tests d'acceptation

Créer une page de comparaison des formules, un écran « abonnement actuel », la date de fin d'essai, les quotas consommés, la liste des boutiques additionnelles et une CTA d'upgrade. Distinguer clairement l'abonnement SaaS XPress Pro des abonnements vendus aux clients d'un pressing.

Tester au minimum : inscription → Pro essai → notifications J23–J30 → Starter J30 ; paiement Pro/Business avant et après échéance ; paiement échoué ; webhooks doublés/hors ordre ; fuseau horaire ; deux sessions simultanées ; comptes du personnel suspendus ; reçus standard après downgrade ; réactivation des paramètres ; limite sites/utilisateurs ; prorata des options en cours de cycle, arrondi au FCFA, renouvellement sur une facture unique et retrait au cycle suivant ; isolation inter-tenant ; organisations préexistantes. Faire une passe « avocat du diable » sur abus d'essai, contournement d'API, perte de données et coûts d'envoi.

Livrer : matrice des fonctions vérifiées, migrations, code et tests, captures d'écrans, résultats de build, risques résiduels et plan de déploiement/rollback. **Ne pas annoncer les plans comme disponibles ni déployer sur Replit sans vérification et autorisation explicite.**

## 10. Décisions commerciales confirmées et validation technique

1. **Confirmé :** chaque boutique Business additionnelle inclut 2 places de personnel actif. L’expiration d’une période payante sans paiement confirmé entraîne un retour immédiat à Starter. Les organisations existantes de plus de 30 jours bénéficient de 7 jours transitoires avec notifications.
2. **Confirmé :** le propriétaire est toujours exclu du quota. Un même compte actif affecté à plusieurs boutiques compte une fois dans l’organisation. Starter reste propriétaire seul ; seuls Pro et Business peuvent acheter des places de personnel supplémentaires.
3. **Confirmé, remplace la v4 :** un passage Pro → Business crédite au prorata le prix de base Pro payé non utilisé, puis démarre un nouveau cycle Business à la confirmation du paiement. Aucun crédit pour un essai gratuit. Le devis expose le crédit et le montant net ; un downgrade demandé reste planifié au prochain renouvellement. Les options déjà payées nécessitent la précision indiquée en section 7.
4. **Confirmé :** chaque membre du personnel actif au-delà du quota coûte **2 000 FCFA/mois** ; propriétaire hors quota. Les comptes suspendus ne sont pas facturés.
5. **Confirmé :** les boutiques et employés optionnels ajoutés en cours de mois sont facturés au prorata du cycle **Pro ou Business** restant, selon la formule active ; les options de boutique demeurent exclusivement Business. La date de renouvellement de la formule payante ne change pas ; les options actives apparaissent ensuite à plein tarif sur une seule facture mensuelle. Cette règle est distincte du crédit Pro et du démarrage d’un nouveau cycle lors du passage à Business.
6. Les fonctions Pro existent dans l’app. Confirmer leurs parcours complets et leurs permissions avant publication : un écran présent n’est pas une preuve que le droit SaaS est effectivement appliqué côté serveur.

7. **Confirmé :** les trois formules restent Starter 0 FCFA, Pro 10 999 FCFA et Business 18 999 FCFA par mois, commandes illimitées. Aucun quatrième plan commercial dans ce modèle.
8. **Confirmé :** les boutiques au-delà d’une seule sont réservées à Business, avec 2 incluses et +5 000 FCFA/mois par boutique additionnelle incluant 2 places de personnel. Une boutique suspendue reste consultable par le propriétaire, sans nouvelles opérations.
9. **Confirmé :** les trois formats de reçu standard HTML/PDF/PNG HD restent disponibles en Starter. La personnalisation est Pro/Business ; aucune perte d’accès aux reçus historiques.
10. **À décider avant le parcours de paiement :** renouvellement manuel ou automatique. Recommandation de lancement : renouvellement manuel, sans mandat ni prélèvement automatique implicite. La validation générale des recommandations n’est pas une autorisation de créer un prélèvement automatique.
11. **À préciser avant implémentation :** traitement des options Pro déjà payées lors du passage Business ; règle de fin de mois pour un anniversaire mensuel tombant le 29, 30 ou 31 ; présentation commerciale des prix (frais éventuels inclus ou ajoutés). Ces précisions ne changent pas les trois tarifs validés.

## 11. Historique des ajustements v5

- Remplacement de l’upgrade au plein tarif sans crédit par le crédit Pro non utilisé.
- Propriétaire hors quota, décompte unique du personnel par organisation et options de personnel réservées à Pro/Business.
- Multi-boutique strictement Business, y compris réactivation après rétrogradation.
- Prorata des options harmonisé entre Pro et Business ; facturation mensuelle regroupée conservée.
- Maintien des trois formats standards de reçu sur Starter.
- Conservation des boutiques hors quota en consultation historique, sans opérations nouvelles.
- Paiement en attente distinct du succès et de l’échec ; pas d’activation avant confirmation.
- pawaPay retenu, audit de l’existant préalable et absence de publication.
