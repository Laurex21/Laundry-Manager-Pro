# Mise à jour de sécurité Zod 4

La branche utilise Zod 4.6.7, drizzle-zod 0.8.3 et un connecteur de formulaires compatible Zod 4 (version verrouillée : @hookform/resolvers 5.9.2). La dépendance inutilisée zod-validation-error est supprimée. body-parser passe à 2.4.0 avec les versions compatibles de qs et iconv-lite.

Les réponses de validation serveur utilisent désormais `ZodError.issues`. Les dictionnaires JSON déclarent explicitement leurs clés textuelles. Le formulaire de commande distingue les valeurs saisies des valeurs validées et converties ; FormField transmet également le type de sortie. Le pourcentage accepte toujours une saisie textuelle numérique et reste limité entre 0 et 100.

`npm run test:zod-migration` vérifie les schémas réellement utilisés pour les commandes, clients, services et encaissements, le connecteur de formulaires, les erreurs par champ, les dates, les valeurs par défaut et les limites JSON. Le test des remises vérifie le comportement du schéma plutôt que sa syntaxe TypeScript. Les tests métier et de facturation utilisent uniquement des données fictives, sans Secrets ni base de production.

L'audit des dépendances de production conserve le seuil existant : `npm audit --omit=dev --audit-level=low`. Aucune exception d'audit n'est ajoutée. La CI exécute aussi le test de migration Zod.

Cette modification concerne les sources et dépendances GitHub. Elle ne lance ni migration SQL, ni publication Replit, ni paiement. Les réglages de production ne sont pas modifiés ; la suspension des traitements automatiques reste en place. Une installation ultérieure dans Replit doit utiliser le verrou complet et être vérifiée séparément avant toute publication.

Références officielles :
- https://github.com/advisories/GHSA-27r3-jxmh-p828
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://zod.dev/v4/changelog
- https://github.com/react-hook-form/resolvers
