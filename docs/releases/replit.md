# Publication Replit et protection des reçus

Les téléchargements Android et le cadrage nom/logo ont été validés sur Tecno Spark 20 / Chrome et sur PC le 19 novembre 2026 (PR #89 et #90). Une publication provenant d'une ancienne branche les avait déjà remplacés.

## Protection permanente dans Replit

La variable **de production** `NODE_OPTIONS` doit conserver :

```
--require=./scripts/replit-release-anchor.cjs
```

Ce réglage vit dans Publishing → Adjust settings → Production app secrets, hors du dépôt. Préserver les autres options Node existantes. Une ancienne version sans ce fichier échoue avant de démarrer, même si elle possède d'anciens scripts de compilation. Ne pas retirer cette option pour contourner un échec de publication. L'ancre ne fait aucun accès Git ou réseau au démarrage du serveur.

Première installation : publier le code de protection, puis ajouter l'option et republier. Ainsi la version déjà en service contient le fichier lorsque le réglage est activé.

## Chaque publication

1. Partir d'une révision revue et fusionnée de `origin/main`, avec l'historique Git complet (`git fetch --unshallow origin` si nécessaire). Préserver séparément le travail de développement non publié.
2. Lancer `npm run test:receipt-release` et `npm run build`. La compilation vérifie l'ascendance de PR #90, les empreintes des fichiers des reçus, les limites de résolution et les délais réseau. Elle s'arrête avant de remplacer `dist` si un contrôle échoue.
3. Publier cette révision précise. Ne jamais utiliser un ancien dossier de publication comme source sans le mettre à jour.
4. Vérifier `/build-manifest.json` en production : `commit` doit correspondre à la révision prévue et `receiptReleaseGuard.version` doit valoir `1`. Vérifier un PDF, l'arrêt de l'icône, le nom et le logo.

Le contrôle accepte aussi les branches récentes qui contiennent les correctifs. Il ne valide pas automatiquement leurs autres changements. Pour revenir sur un autre problème, faire un nouveau commit de revert au-dessus de la version protégée ; ne pas republier un ancien instantané.

## Faire évoluer les reçus

`scripts/receipt-release-lock.json` protège quatre fichiers de téléchargement. Une modification, même légitime, bloque la compilation jusqu'à sa validation. Après les tests automatisés et les essais PDF sur mobile et PC (reçu normal, abonné, avec logo et archive avec barre d'outils), mettre à jour **uniquement les empreintes concernées** dans une demande de revue. Le scénario visuel est dans `client/src/lib/receipt-export.browser-test.ts`. Ne pas régénérer les empreintes automatiquement pendant la compilation.

Cette protection vise les remplacements accidentels. Un administrateur peut volontairement la supprimer en changeant les réglages Replit ; les restaurations d'images déjà publiées doivent donc aussi respecter la version minimale protégée.
