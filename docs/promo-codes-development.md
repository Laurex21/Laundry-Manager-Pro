# Codes promo — développement uniquement

Ajout au Super Admin, onglet Ambassadeurs : création/génération, dates locales, réduction entière en pourcentage ou FCFA, formules Pro et Business (incluant les options personnalisées), plafond global, premier paiement ou renouvellement, ambassadeur facultatif, désactivation/réactivation. Les règles d'un code sont immuables après création.

Le compte ambassadeur consulte uniquement ses codes et les compteurs agrégés de paiements confirmés/réservés. Un code ne remplace pas une attribution antérieure et ne crée aucune commission.

Dans Abonnement, le client renseigne le code avant le devis. Le serveur calcule et conserve le prix initial, la remise et le montant final. Paiements mensuels uniquement : pas de cumul avec les remises de durée, pas de changement de formule en cours de période à prix réduit. Minimum final : 50 FCFA. Une utilisation par organisation et par code. Les droits et dates déjà acquis restent gérés par le moteur d'abonnement existant.

## Quotas et confirmation

Les devis ne consomment pas de quota. La réservation du paiement verrouille le code, revalide ses règles et réserve une place. Pending/review réservent une place ; paid la consomme ; failed la libère. Une réservation engagée reste honorée après désactivation du code. Les confirmations répétées sont idempotentes. Les crédits futurs reposent sur le prix réellement payé.

## Migration

`migrations/20261110_saas_promos.sql` est additive et explicite : tables codes/audit et index sur les factures. Elle a été exécutée deux fois sur une base PGlite fictive, puis sur la base de développement Replit après vérification de son isolation. Aucune migration de production n'a été effectuée. Toute application en production devra suivre le processus de validation avant publication.

## Vérification

- `npm run check`
- `npm run test:saas-promos` : dates, plans, montants, premier paiement, limites, concurrence de réservations, échec, confirmation répétée, désactivation après réservation, conservation de l'attribution, renouvellement et crédit réel, séparation des environnements/exclusions.
- Régressions facturation, ouverture aux tarifs normaux, parcours de paiement, sécurité Super Admin et TOTP.
- Compilation client/serveur et vérification des bundles.

Pas d'email ni de paiement réel. Les tests utilisent une base en mémoire, avec maintenance suspendue et exclusions 3, 100, 112, 193. Aucun réglage de production n'est modifié.

Recette Super Admin réalisée dans Replit : génération de code, création d'un code fictif à 10 %, recherche et rattachement à un ambassadeur fictif, refus du doublon, désactivation et conservation après rechargement. Code et rôle fictifs désactivés après vérification. Le calcul du devis, la confirmation et la séparation des listes sont couverts par les tests isolés ; aucun paiement interactif n'a été activé dans Replit.

Cette branche cible le moteur présent sur main. Replit possède également des changements non fusionnés concernant les durées et conversions de paiement : son adaptation conserve ces fonctions. Lors d'une prochaine synchronisation, préserver ces changements, notamment l'argument de durée avant le code promo, sans écraser le développement avec les anciennes signatures.
