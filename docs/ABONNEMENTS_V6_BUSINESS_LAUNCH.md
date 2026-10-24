# Conditions commerciales v6 — préparation du 24 octobre 2026

Cette révision reprend les décisions validées dans la conversation et remplace les règles v5 d'essai Pro et de démarrage immédiat de la période payante pendant l'essai. Implémentation installée et vérifiée en développement Replit, puis préparée sur une branche GitHub séparée. Aucune publication ni modification de production et aucune activation générale des paiements effectuées.

## Formules et présentation

Starter gratuit : 1 boutique, propriétaire seul. Pro : 10 999 FCFA/mois, 1 boutique, 2 places employés. Business : 18 999 FCFA/mois, 2 boutiques, 5 places employés. Le propriétaire est toujours hors quota.

Une quatrième carte « Personnalisé / Custom » utilise Business comme base. Chaque boutique supplémentaire coûte 5 000 FCFA/mois et inclut 2 places employés ; chaque place supplémentaire au-delà des places incluses coûte 2 000 FCFA/mois. Pas de nouveau slug de plan : devis et droits utilisent Business avec `extraSites` et `extraStaff`. Le total visuel réutilise les mêmes fonctions de prix que le serveur. Exemple : 3 boutiques, 7 places = 23 999 FCFA ; 3 boutiques, 8 places = 25 999 FCFA. Une place supplémentaire choisie désigne une place au-delà du quota inclus, pas le nombre total de personnes.

## Essai et transition

- L'option technique explicite `SAAS_BUSINESS_LAUNCH_ENABLED=true` choisit le nouveau parcours pour les organisations sans compte SaaS déjà initialisé. Sans cette option, le comportement v5 et sa protection des abonnements historiques restent actifs.
- Business offert pendant l'essai. Les fonctions d'abonnement ne bloquent pas les boutiques et employés déjà autorisés pendant cet essai, y compris une troisième boutique. Les permissions métier, rôles et frontières entre organisations restent appliqués. Les nouvelles boutiques et places pendant l'essai ne déclenchent aucune facture.
- Organisation ayant au moins 30 × 24 h à sa première initialisation : échéance commune au 1er novembre 2026 à 00:00:00, heure du Cameroun, soit `2026-10-31T23:00:00.000Z`. La bannière annonce le dernier instant offert, « 31 octobre 2026 à 23:59 ».
- Organisation de moins de 30 jours : échéance à création de l'organisation + 30 × 24 h. La reconnexion et le redémarrage ne réinitialisent jamais cette échéance. Bannière uniquement à 7 jours ou moins.
- Une période historique active avec date de fin future repousse si nécessaire la fin de l'offre jusqu'à cette date, sans modifier l'ancienne ligne ni inventer un crédit financier. Une date historique active inconnue est refusée pour examen (`LEGACY_PERIOD_REQUIRES_REVIEW`). Les comptes SaaS déjà présents ne sont pas écrasés automatiquement.
- À l'échéance sans période payante confirmée : Starter gratuit, conservation des historiques et réglages. Le contrôle se fait aux requêtes même si les tâches automatiques restent suspendues. Aucune nouvelle opération n'est nécessaire sur les anciennes lignes d'abonnement.

## Paiement pendant l'essai

Le paiement est permis dès l'ouverture du parcours, sans attendre le 1er novembre. La confirmation authentifiée réserve le mois payé à partir de la fin de l'essai/protection acquise. Business offert reste accessible jusqu'à cette fin, même si Pro a été acheté. Aucun prélèvement automatique. Pas de deuxième facture après réservation confirmée. Les rappels d'achat d'essai cessent après paiement. Choisir Starter pendant l'essai programme l'issue gratuite sans écourter les jours offerts.

Les signatures, montant, devise, organisation, références, environnement et doublons de notification restent contrôlés par les récepteurs existants. Le modèle de collecte pilote de 50 FCFA reste distinct et ne finance aucun abonnement.

## Mise en service à venir

1. Développement Replit installé et vérifié : catalogue v6 chargé, paiements réels désactivés, maintenance suspendue. Le basculement Business reste désactivé. La copie utilise la base de développement.
2. Avant publication : sauvegarde récente, contrôle du schéma, confirmation du nombre de comptes SaaS déjà présents et des périodes à protéger. Le dernier inventaire réel avait zéro compte SaaS ; ne pas supposer que cette valeur reste vraie.
3. Une ouverture générale devra retirer explicitement les restrictions du pilote (`SAAS_LIVE_PILOT_ORGANISATION_ID`, `SAAS_LIVE_PILOT_PURPOSE`, `SAAS_LIVE_PILOT_RETRY_INVOICE_ID`) et activer explicitement le parcours Business. Ne jamais supprimer les paiements/factures du pilote.
4. Garder `XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED=true`. L'option de lancement ne désactive ni les gardes de production, ni la nécessité d'une clé Production et d'une origine HTTPS permanente. Ne pas modifier les Secrets pour cette préparation.
5. Une fois publiée et la configuration explicitement activée, les premiers accès initialiseront `saas_accounts` et journaliseront les essais ; ce sont des écritures attendues du nouveau fonctionnement, pas une migration déjà exécutée par cette préparation. Aucune activation silencieuse par date seule.

## Vérifications locales

Tests PGlite en mémoire, données et clés de signature synthétiques : échéance Cameroun à la milliseconde, 30 jours exacts, rappel J7, dates historiques conservées, troisième/quatrième boutique offerte, calcul serveur Personnalisé, réservation après essai, doublons, Starter à l'échéance et maintenance suspendue. Parcours UI réel sur copie locale avec checkout simulé et notification signée HTTP 200 ; français, anglais et mobile 390 px. Aucun appel au fournisseur réel, aucun accès aux données de production pendant l'implémentation.
