# Publication Replit : reçus et superadmin

Les téléchargements Android et le cadrage nom/logo ont été validés sur Tecno Spark 20 / Chrome et sur PC le 19 novembre 2026 (PR #89 et #90). Une publication provenant d'une ancienne branche les avait déjà remplacés. Le récapitulatif boutiques/personnel/coût et les attributions manuelles du superadmin (PR #88) sont également protégés.

## Protection permanente dans Replit

La variable **de production** `NODE_OPTIONS` doit conserver :

```
--require=./scripts/replit-release-anchor.cjs --require=./scripts/replit-superadmin-release-anchor.cjs
```

Ce réglage vit dans Publishing → Adjust settings → Production app secrets, hors du dépôt. Préserver les autres options Node existantes. Une ancienne version sans l’un de ces fichiers échoue avant de démarrer, même si elle possède d'anciens scripts de compilation. Ne pas retirer cette option pour contourner un échec de publication. Les ancres ne font aucun accès Git ou réseau au démarrage du serveur.

Première installation : publier le code de protection, puis ajouter l'option et republier. Ainsi la version déjà en service contient le fichier lorsque le réglage est activé.

## Chaque publication

**Storefront :** une nouvelle validation explicite du propriétaire est requise
avant toute migration de production. Contrôler les trois verrous PostgreSQL et
le SQL réellement proposé par Replit selon
[`storefront-approval.md`](storefront-approval.md). Une ancienne autorisation de
publication, une fusion Git ou un test réussi ne vaut pas validation. Annuler
la publication si elle propose une migration storefront non validée.

1. Partir d'une révision revue et fusionnée de `origin/main`, avec l'historique Git complet (`git fetch --unshallow origin` si nécessaire). Préserver séparément le travail de développement non publié.
2. Lancer `npm run test:receipt-release`, `npm run test:superadmin-release` et `npm run build`. La compilation vérifie l'ascendance de PR #90, les empreintes des fichiers des reçus, les limites de résolution et les délais réseau. Elle s'arrête avant de remplacer `dist` si un contrôle échoue.
3. Publier cette révision précise. Ne jamais utiliser un ancien dossier de publication comme source sans le mettre à jour.
4. Vérifier `/build-manifest.json` en production : `commit` doit correspondre à la révision prévue et `receiptReleaseGuard.version` et `superadminReleaseGuard.version` doivent valoir `1`. Les deux journaux `Receipt release anchor active` et `Superadmin release anchor active` confirment le chargement des protections au démarrage. Vérifier un PDF, l'arrêt de l'icône, le nom et le logo.

Le contrôle accepte aussi les branches récentes qui contiennent les correctifs. Il ne valide pas automatiquement leurs autres changements. Pour revenir sur un autre problème, faire un nouveau commit de revert au-dessus de la version protégée ; ne pas republier un ancien instantané.

## Faire évoluer les reçus

`scripts/receipt-release-lock.json` protège quatre fichiers de téléchargement. Une modification, même légitime, bloque la compilation jusqu'à sa validation. Après les tests automatisés et les essais PDF sur mobile et PC (reçu normal, abonné, avec logo et archive avec barre d'outils), mettre à jour **uniquement les empreintes concernées** dans une demande de revue. Le scénario visuel est dans `client/src/lib/receipt-export.browser-test.ts`. Ne pas régénérer les empreintes automatiquement pendant la compilation.

Cette protection vise les remplacements accidentels. Un administrateur peut volontairement la supprimer en changeant les réglages Replit ; les restaurations d'images déjà publiées doivent donc aussi respecter la version minimale protégée.

## Faire évoluer le superadmin

`scripts/superadmin-release-lock.json` protège le composant de récapitulatif/activation, le service d’attribution et le calcul partagé des capacités/coûts. Toute modification nécessite une validation explicite des empreintes en revue, après `npm run test:admin-capacity` et vérification visuelle. Les autres parties de la grande page superadmin restent modifiables ; le contrôle analyse son JSX pour empêcher la suppression ou la mise en commentaire du panneau de l’onglet Abonnement. La compilation vérifie aussi sa présence dans le bundle client et les routes/audits dans le serveur.

Les tests d’activation complète utilisent uniquement une base PGlite fictive, sans paiement ni compte réel. En production, vérifier le récapitulatif et une prévisualisation, puis annuler. Ne pas attribuer des droits supplémentaires à un client pour tester une publication.
