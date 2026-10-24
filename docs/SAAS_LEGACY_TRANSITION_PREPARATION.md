# Reprise des abonnements historiques — préparation locale

Statut : proposition technique à examiner avant installation. Aucun changement de production, aucune publication, aucune migration de comptes exécutée. Les traitements automatiques restent suspendus.

## Constat vérifié dans le code et sur données fictives

Le nouveau moteur refuse de créer un compte SaaS si le propriétaire possède une ligne historique de statut `active` : `LEGACY_SUBSCRIPTION_REQUIRES_REVIEW`. Le contrôle porte sur le statut, même si la date de fin est passée. La demande de devis est bloquée sans créer de facture. Les droits historiques restent gérés par le parcours existant. Une activation globale du nouveau catalogue ne suffit donc pas pour ouvrir les paiements aux anciens comptes.

Le catalogue historique et le catalogue v5 sont distincts. En particulier, un ancien Starter payant ne doit pas être converti automatiquement en Starter v5 gratuit à partir de son seul nom. Le prix du catalogue n'est pas une preuve du montant réellement payé. Une ancienne ligne de paiement marquée completed n'est pas une preuve pawaPay vérifiée.

## Règles proposées de reprise

- Conserver intégralement les anciennes lignes, reçus et dates ; aucune suppression, aucun recalcul des anciennes factures.
- Avant reprise, établir un aperçu par organisation : propriétaire, période active, formule historique, droits actuels, boutiques, employés, paiements justifiés, factures en attente et éventuel compte SaaS déjà présent.
- Toute période payée restante est conservée. Ne pas redémarrer un mois à la date de reprise, ne pas créer de nouvel essai gratuit et ne pas réduire les droits déjà acquis avant l'échéance.
- Revoir explicitement la correspondance de formule. Une situation non représentable par Pro/Business v5 reste sur l'ancien système jusqu'à décision ; ne pas lui attribuer silencieusement des droits ou tarifs différents.
- Un renouvellement de même niveau démarre après la période conservée. Une baisse de gamme démarre à l'échéance. Une montée de gamme immédiate nécessite un montant payé et un reliquat vérifiables, y compris les places d'employés ; sinon, bloquer le paiement avec explication et examen manuel.
- Plusieurs abonnements actifs, date manquante, montant incertain, propriétaire ambigu, facture en cours ou compte SaaS déjà présent : revue obligatoire, aucun écrasement.
- Une future opération de reprise doit être explicite, transactionnelle et idempotente ; verrouiller le compte, vérifier que l'aperçu est toujours actuel, enregistrer les références historiques et l'auteur. Un second passage doit être sans effet.
- La suspension des tâches de fond reste active. Pour les comptes repris dans v5, les échéances et droits sont évalués à chaque requête. Les anciens comptes non repris continuent de dépendre de leurs règles historiques ; ne pas leur appliquer la garantie v5 sans test.

## Vérifications effectuées

La répétition du parcours complet en mémoire passe : notification signée, activation Pro, employé supplémentaire, crédit Pro et employés lors du passage Business, deuxième boutique, baisse différée, renouvellement sans jours perdus et expiration sur requête sans tâche de fond. Un compte historique fictif conserve exactement ses lignes et dates après refus d'initialisation et de devis. Une ancienne période écoulée encore active est également bloquée pour examen.

## Travail restant avant ouverture

1. Préparer un outil d'aperçu en lecture seule et son affichage compréhensible pour le propriétaire/administrateur.
2. Décider la correspondance des cas historiques ambigus, puis implémenter et tester la reprise explicite sur copie isolée, avec période et droits conservés.
3. Tester aussi les écrans et messages des comptes bloqués ; les essais actuels sont des intégrations serveur, pas une validation visuelle de tous les écrans.
4. Ouvrir ensuite à un petit groupe identifié, sur autorisation distincte de publication et de configuration. Retirer le mode collecte 50 FCFA seulement à cette étape, tout en conservant son historique et la suspension de maintenance.

Cette préparation ne contient aucun programme exécutable contre la production et n'affirme pas que la reprise est déjà implémentée.

## Aperçu et conversion sur copie isolée — tests du 23 octobre

Un planificateur pur non raccordé à l’application (`server/lib/saas-legacy-preview.ts`) produit un aperçu et une empreinte du dossier examiné. Il ne lit aucune base et ne vérifie pas lui-même les preuves de paiement : les montants et les droits sont des données déjà examinées, fictives dans ces essais. Une référence de paiement seule ne constitue pas une preuve.

Le convertisseur existe exclusivement dans `saas-legacy-conversion.integration.test.ts`, sur une nouvelle base PGlite en mémoire. Aucun endpoint ou outil de conversion contre une base externe n'est fourni. Trois reprises simulées réussissent (Pro, Starter payant avec fonctions préservées par Pro, Business avec capacité employés conservée). Six dossiers ambigus restent bloqués. Dates exactes, droits, historique, absence de facture de reprise, répétition, interruption transactionnelle et refus d’un aperçu périmé sont testés. Renouvellement et crédit historique après conversion passent aussi. Les tâches automatiques restent suspendues.

L’aperçu HTML livré contient uniquement des comptes fictifs. Il ne représente pas un inventaire actualisé des comptes de production. Les décisions de correspondance et la vérification des pièces des comptes réels restent à faire avant toute reprise réelle.
