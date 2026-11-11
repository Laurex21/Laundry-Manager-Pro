# Caisse : séparation du développement

Le module reste exclusivement en développement. Ses dix tables, leurs séquences et ses six fonctions résident dans `cashbook_development`, et non dans `public`. Les références SQL du module et la capture des encaissements des abonnements clients visent explicitement ce schéma. Les fonctions des déclencheurs utilisent un search_path fixé ; leurs relations avec les tables métier de développement sont conservées.

Les migrations expérimentales se trouvent dans `migrations/development/cashbook`. Ne pas les inclure dans une migration de production. Ne pas utiliser un outil de synchronisation globale avec suppression automatique des schémas inconnus.

## Commandes manuelles, dans le Shell de développement Replit seulement

Conserver les exclusions `3,100,112,193` et `SALES_EMAIL_ENABLED=false` dans les réglages du développement. Les autres variables ci-dessous correspondent au script `npm run dev`.

```sh
node --test scripts/cashbook-development-schema.test.mjs
NODE_ENV=development XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED=true SAAS_LIVE_ENABLED=false SAAS_BILLING_MODE=disabled node scripts/cashbook-development-schema.mjs --verify
NODE_ENV=development XPRESSPRO_AUTOMATIC_MAINTENANCE_SUSPENDED=true SAAS_LIVE_ENABLED=false SAAS_BILLING_MODE=disabled npx tsx scripts/cashbook-development-smoke.mts
```

Le script refuse la production, un déploiement Replit, une base autre que la base locale helium/heliumdb et des protections incompatibles. Il ne tourne jamais automatiquement au démarrage ni au build.

- `--move` : sauvegarde complète du développement, déplacement transactionnel des tables et fonctions existantes, comparaison des empreintes de toutes les lignes caisse. Réexécutable sans déplacement supplémentaire.
- `--install` : réservé à un développement sans aucune table caisse ; sauvegarde préalable puis installation dans l’ordre des dépendances.
- `--verify` : contrôle en lecture seule.
- Le smoke test lit les comptes, calcule les synthèses, vérifie les captures existantes et la protection des clôtures. Ses écritures et son essai d’installation neuve sont annulés par ROLLBACK.

## Publications suivantes

Conserver le schéma caisse en développement ; ne plus déplacer temporairement ses tables avant et après une publication. Le garde-fou `NODE_ENV === development` reste obligatoire pour les routes et la capture d’abonnements. Les réglages emails, traitements automatiques et exclusions ne doivent pas être modifiés.

La dernière publication a montré que Replit ne proposait plus les dix tables lorsqu’elles étaient hors de public. Le présent travail vérifie leur séparation permanente, sans déclencher de publication. Lors de la prochaine publication autorisée, arrêter si Replit propose néanmoins des modifications caisse : ne pas les approuver.

## Retour arrière

Ne pas supprimer les tables ni restaurer une sauvegarde sur une base active. Un retour au code antérieur requiert aussi de remettre, transactionnellement et en développement seulement, les dix tables et les six fonctions dans public, puis de rétablir leur search_path. Cela réintroduirait le problème des propositions de migration ; privilégier une correction dans le schéma dédié. La sauvegarde complète précède le déplacement et reste privée.


Le build exécute automatiquement les 12 contrôles sans connexion à une base. Un retour accidentel aux tables caisse non qualifiées ou aux migrations caisse dans la racine bloque la compilation.

## Périmètre GitHub

Le module caisse existait uniquement dans la copie Replit. Cette PR apporte ses sources nécessaires (interface de développement, moteur, routes et capture des encaissements) ainsi que leur séparation. Les autres changements Replit ne sont pas inclus. L'interface est conditionnée à `import.meta.env.DEV` et les routes exigent `NODE_ENV=development` et `XPRESSPRO_CASHBOOK_DEVELOPMENT=true` ; aucun indicateur de déploiement n'est activé par cette PR. Le fuseau de stockage historique doit être explicitement confirmé via `XPRESSPRO_CASHBOOK_LEGACY_STORAGE_TIMEZONE` (UTC dans la copie Replit vérifiée).

En complément des 12 contrôles de séparation, la CI vérifie les calculs de caisse et exécute un test d'inactivité réelle des routes et de l'accès base en production. Aucun test automatique de la PR ne contacte une base ni n'applique les migrations.
