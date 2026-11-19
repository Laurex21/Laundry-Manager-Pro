# Boutiques, personnel et coût dans le superadmin

Dans **Organisations → Voir → Abonnement**, le récapitulatif distingue :

- Les boutiques et places de personnel incluses dans la formule.
- Les places supplémentaires souscrites ou accordées manuellement, et les deux places de personnel incluses avec chaque boutique supplémentaire.
- Les accès actuellement autorisés et utilisés, séparés des boutiques et comptes enregistrés. Le propriétaire ne consomme pas une place de personnel.
- Le tarif mensuel de référence et le dernier devis/paiement réel, avec son statut, ses options et sa promotion. Un devis non payé ne modifie pas les droits actuels.
- Une période déjà réservée ou un changement programmé, lorsqu’il existe.

## Attribution manuelle

Pour une formule Pro ou Business active, ouvrir **Ajouter des places et activer des accès**. Indiquer le total de places supplémentaires souhaité, sélectionner les boutiques et membres du personnel déjà rattachés à l’organisation, puis saisir un motif. La prévisualisation affiche les droits et accès avant/après, le coût de référence et l’échéance conservée. Confirmer applique l’attribution avec une trace d’audit.

L’attribution n’enregistre aucun paiement et conserve les crédits réellement payés. Les places sont ajoutées à la période en cours. Le renouvellement reste manuel ; seules les places de personnel supplémentaires utilisées seront facturées lors du calcul du devis de renouvellement.

Les droits existants ne peuvent pas être réduits par cette action. Business est nécessaire pour exploiter plusieurs boutiques. Une boutique désactivée ne peut pas être réactivée par ce contrôle d’accès ; un employé doit déjà être rattaché à une boutique sélectionnée. Pour un compte Starter, attribuer d’abord une formule active dans la section d’attribution de formule existante. Les essais automatiques, contrats historiques et organisations exclues restent protégés.

Un paiement en attente, une période réservée ou un changement programmé bloque l’attribution pour éviter les conflits. Une modification des droits ou des rattachements après prévisualisation impose une nouvelle vérification. Les devis non payés existants expirent après attribution afin d’être recalculés.

## Validation

`npm run test:admin-capacity` utilise exclusivement une base PGlite fictive et des rendus FR/EN sans réseau. Les tests couvrent les montants, l’usage, les devis non payés, les droits inter-organisations, les rattachements, les quotas, les changements concurrents, la conservation des échéances et des crédits, l’audit transactionnel et l’expiration des anciens devis.

Aucune migration de base n’est nécessaire. Les API utilisent la session superadmin avec double authentification existante. Les lectures ne modifient aucun compte.
