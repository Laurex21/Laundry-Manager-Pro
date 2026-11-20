# Migration boutique V2 à revoir avant production

Cible future : base de production de Xpress Pro, table `public.storefronts`. Aucun changement de production effectué pour cette version.

SQL proposé :

```sql
BEGIN;
ALTER TABLE public.storefronts ADD COLUMN branding jsonb NOT NULL DEFAULT
  '{"template":"classic","accent":"#125d4e","welcome":"Du linge frais. Du temps pour vous.","logo":"","cover":"","serviceImages":{}}'::jsonb;
COMMIT;
```

Une colonne supplémentaire contient uniquement l'apparence de la boutique. Les lignes existantes reçoivent des valeurs par défaut. Aucune suppression, modification de tarifs, changement de devise, commande ou encaissement. Les tests exécutent ce SQL sur une table contenant déjà une boutique et vérifient la conservation de ses valeurs.

Le code V2 exige cette colonne. En développement local/Replit, après revue de la cible, la commande explicite est `XPRESSPRO_SCHEMA_CHANGE_TARGET=development npm run db:migrate:storefront-branding:dev`. Le script refuse les déploiements et les hôtes distants ; aucune migration n'est exécutée au démarrage ou pendant la compilation.

Avant production : comparer le **diff réel proposé par Replit** à ce fichier, vérifier les trois protections PostgreSQL et présenter ce diff avec la révision source au propriétaire. Une validation du projet ou des tests ne remplace pas la nouvelle validation explicite du SQL exigée par `AGENTS.md` et `docs/releases/storefront-approval.md`.

Prévoir une fenêtre contrôlée, une sauvegarde et une procédure revue qui remet les protections avant validation de la transaction. Aucun mécanisme de contournement ni déverrouillage automatique n'est fourni.

Retour arrière : avant validation, annuler la transaction. Après validation, revenir à une révision applicative compatible tout en conservant la colonne et ses images. Ne pas supprimer la colonne pour revenir en arrière : cela détruirait les personnalisations. Maintenir les ancres de protection des reçus et du superadministrateur.
