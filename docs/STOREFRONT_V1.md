# Boutique WhatsApp Xpress Pro — première version testable

## Livré dans cette branche

- Une boutique mobile par agence, ouverte depuis un lien partagé dans WhatsApp : `/b/:slug`.
- Configuration et réception des demandes dans Xpress Pro : `/boutique`, propriétaire et responsable de l’agence uniquement.
- Catalogue provenant des services **actifs de l’agence** ; modes pièce, kilogramme et sur devis. Les anciens services sans agence doivent être rattachés avant de pouvoir les publier.
- Barème modifiable enfant / adolescent / adulte, en grammes. Le client peut mélanger les gabarits dans un panier.
- Estimation calculée côté serveur, minimum appliqué une seule fois par lot de service. Un poids ou prix inconnu laisse le total « à confirmer ».
- Demande invitée enregistrée avant l’ouverture facultative d’un message WhatsApp prérempli.
- Réception au pressing, poids net sec mesuré **ou** forfait fondé sur le barème conventionnel ; consentement du client sur le devis final.
- Conversion transactionnelle et idempotente vers les tables de commandes, articles, vêtements et historique déjà utilisées par Xpress Pro. Les prix acceptés restent figés si le catalogue évolue. Paiement dans le parcours existant.
- Suivi personnel du devis et de l’état réel de la commande sur `/suivi-boutique#secret`.

Le code est intégré au routeur et au menu de l’application. Le 19 novembre 2026, il a été connecté à la base de développement Replit et vérifié jusqu’aux paiements fictifs et aux PDF : voir [le compte rendu de validation](STOREFRONT_DEV_VALIDATION_20261119.md). La démonstration locale ci-dessous reste disponible avec une base PostgreSQL PGlite fictive en mémoire.

## Lancer la démonstration locale

Prérequis : Node 22.12+ ou 24, dépendances du projet installées.

```sh
npm run dev:storefront
```

- Client : `http://127.0.0.1:5123/b/pressing-horizon`
- Pressing : `http://127.0.0.1:5123/boutique`
- Port HTTP 5123 ; serveur de développement Vite local 5124.
- Aucune lecture de `DATABASE_URL` par ce scénario ; aucune base externe utilisée.
- Aucune authentification dans **ce lanceur local uniquement**, qui écoute sur `127.0.0.1`. Un bandeau signale les données fictives sur toutes ses pages.
- Les données sont effacées à l’arrêt. Le numéro +237600000000 est fictif. Ne pas envoyer les messages de démonstration.
- Le lien vers la commande ouvre un aperçu des enregistrements réellement créés dans la base locale. Les paiements, reçus et authentifications de l’application complète ne sont pas simulés dans cet aperçu.
- L’entrée `client/src/storefront-preview.tsx` n’est pas importée par l’application de production.

## Essai pas à pas

1. Dans la vue client, choisir « Lavage & pliage », ajouter 3 T-shirts enfant, 2 chemises adulte et 1 jean adolescent.
2. Calculer l’estimation : **1,3 kg × 1 000 FCFA = 1 300 FCFA**.
3. Saisir un nom fictif et un téléphone international fictif, accepter le caractère estimatif et envoyer.
4. Ouvrir le lien personnel de suivi et le conserver dans cet onglet.
5. Dans un deuxième onglet, ouvrir la vue pressing, examiner la demande, saisir un message et accepter le dépôt.
6. Confirmer la réception et la correspondance des vêtements. Saisir **1,45 kg**, expliquer la pesée sans sac, soumettre le devis.
7. Dans le suivi client, actualiser et accepter **1 450 FCFA**.
8. Dans la vue pressing, attendre l’actualisation ou recharger, puis créer la commande. Son paiement reste non réglé.
9. Refaire l’essai avec « Forfait selon le poids conventionnel » : le devis reste à **1 300 FCFA** et précise qu’il ne s’agit pas d’une pesée réelle.
10. Ajouter une robe de soirée au kilo : aucun poids arbitraire n’est annoncé ; une pesée est nécessaire. Le service « Tenue délicate » montre le parcours sur devis avec prix par pièce à renseigner au dépôt.

## Structure et garanties

`shared/storefront.ts` : contrats Zod et barème pilote. `server/lib/storefront-pricing.ts` : calculs décimaux exacts. `storefront-service.ts` : transactions et transitions. `storefront-routes.ts` : validation HTTP, contrôle d’origine et dépendances d’authentification. Les trois pages `storefront-*.tsx` présentent la boutique, la gestion et le suivi.

Quatre tables additives dans `shared/schema.ts` et `migrations/20261119_storefront_v1.sql` : `storefronts`, `storefront_services`, `storefront_requests`, `storefront_events`. Aucun DDL au démarrage. Les devis, tarifs, barèmes, versions et décisions sont conservés. Le secret de suivi de 256 bits est haché en base ; il voyage dans le fragment de l’URL et l’en-tête Authorization, jamais dans un paramètre de requête. Les réponses sont `no-store`. Les routes publiques utilisent le limiteur SQL existant ; les mutations rejettent une origine externe.

Une demande ne peut être convertie qu’après réception et accord sur **la version courante**. Une révision retire l’ancien accord. Le verrou de ligne et le lien de conversion unique empêchent les doubles commandes. La création du client, de la commande, des lignes et des événements est atomique. Le rapprochement avec un client existant est proposé uniquement au personnel de la même agence, après vérification au comptoir. Le téléphone ne constitue pas une preuve d’identité.

Un minimum au kilo crée, si nécessaire, une ligne explicite « Complément minimum (boutique) » sur la commande, avec un service interne inactif. Le poids facturé n’est pas artificiellement augmenté. La somme des lignes égale le montant accepté. La liste physique des vêtements reste distincte de la quantité en kg.

## Activer sur une base de développement Xpress Pro

1. Examiner la migration et la comparaison Drizzle avec le schéma de la base de développement choisie. Ne pas utiliser une base de production pour ce premier essai.
2. Après avoir vérifié la cible `DATABASE_URL`, exécuter explicitement :

   ```sh
   NODE_ENV=development XPRESSPRO_SCHEMA_CHANGE_TARGET=development npm run db:migrate:storefront
   ```

   Le lanceur refuse `NODE_ENV=production`, ne recrée pas les quatre tables déjà présentes et bloque un schéma partiel. S’il trouve les tables, il ne certifie pas leur conformité : comparer les colonnes avant activation.
3. Définir `XPRESSPRO_STOREFRONT_ENABLED=true`, redémarrer l’application, se connecter et sélectionner une agence précise. « Toutes les agences » ne permet pas de configurer une boutique.
4. Renseigner adresse, numéro réel et horaires ; sélectionner des services de cette agence ; vérifier les poids puis ouvrir la boutique. L’identifiant du lien et la devise deviennent fixes à la première sauvegarde.
5. Exécuter l’essai complet avec authentification réelle, paiement de test et reçu, puis comparer le devis accepté, les lignes et le montant encaissé.

Le drapeau est désactivé par défaut ; les nouvelles routes ne touchent pas les tables tant qu’il est désactivé. La navigation affiche alors un message d’indisponibilité. Fermer une boutique avec sa case d’ouverture arrête les nouvelles demandes tout en conservant les suivis existants. La migration a été appliquée uniquement à `helium/heliumdb` dans Replit développement, sans publication ni migration de production.

Le lanceur `npm run dev:storefront:replit` démarre l’application complète avec son authentification habituelle. Il exige un domaine Replit de développement et la base locale `helium/heliumdb`, et refuse les déploiements, la production et les bases externes. Il suspend les maintenances automatiques et la collecte SaaS réelle pour cet essai. Il ne remplace pas le lanceur fictif `dev:storefront`.

## Limites du premier pilote

- Dépôt et paiement au pressing. Pas de collecte/livraison planifiée, de paiement mobile ni de messages WhatsApp automatiques. Le partage et l’envoi du message sont effectués par la personne dans WhatsApp.
- Interface pilote en français ; internationalisation détaillée à compléter avant ouverture à d’autres langues.
- Les quantités/types sont contrôlés à réception mais pas modifiables sur une demande. En cas d’écart, établir une nouvelle demande corrigée avant facturation.
- Les 100 dernières demandes sont visibles ; pagination, recherche, relances et clôture des demandes abandonnées restent à ajouter pour un déploiement large.
- Les devis conservent leur devise. Xpress Pro utilise actuellement une préférence d’affichage pour ses commandes et reçus existants : ce pilote doit fonctionner avec **une devise cohérente pour l’agence et tous ses utilisateurs**, en XAF dans la démonstration. Le rapprochement serveur des devis avec la devise des encaissements et des reçus est un point à verrouiller avant un usage multidevise. Aucun change n’est calculé.
- Le lien de suivi est un accès personnel par possession. Récupération de lien, révocation et politique de conservation/anonymisation doivent être définies avant ouverture large.
- Les valeurs enfant/adolescent sont largement extrapolées. Elles doivent être calibrées avec les vêtements secs du pressing. La taille, le tissu et la coupe comptent davantage qu’une tranche d’âge rigide.

## Origine du barème

Les repères documentés pendant la conception ne sont pas un échantillon statistique représentatif. [Bosch, notice 9000254735](https://media3.bosch-home.com/Documents/9000254735_A.pdf), [Bosch Laundry Load Guide](https://media3.bosch-home.com/Documents/MCDOC03053317_BOS-MarchCampaign-Flyer-Online-LaundryGuide.pdf) et [Kogan KAMHTDRY8NA](https://assets.kogan.com/files/usermanuals/KAMHTDRY8NA_UG_V2.pdf) donnent des ordres de grandeur de vêtements secs, sans barème complet par âge. Le T-shirt enfant de 100 g est arrondi depuis l’exemple produit de 102 g [Patagonia 62146](https://www.patagonia.com.au/products/kids-graphic-t-shirt-62146-ponn). Les autres valeurs enfant et toutes les valeurs adolescent sont des hypothèses de travail. Une robe ordinaire ne permet pas de déduire le poids d’une robe de soirée, laissé vide.

## Vérifications reproductibles

```sh
npm run test:storefront
npx tsc --noEmit --incremental false
node --import tsx server/lib/order-integrity.integration.test.ts
node --import tsx script/build.ts
node --import tsx scripts/verify-production-build.ts
```

Les tests métier appliquent la **migration SQL livrée** sur une base PGlite vierge contenant le schéma antérieur. Ils couvrent calcul exact, gabarits mélangés, devis incomplet, pesée, forfait, minimum, changement de tarif, versions, doublons, rollback et isolation entre organisations. Les tests de routes vérifient authentification, rôle, activation, limiteur, origine et validation. Le test `storefront-payment.integration.test.ts` utilise aussi le module d’encaissement existant : acompte, répétition idempotente, solde, suivi réglé et contenu des deux types de reçus.

Le scénario `scripts/storefront.browser.test.mjs` utilise Playwright avec Chrome, contre le lanceur local déjà ouvert. Définir `PLAYWRIGHT_MODULE` si Playwright est fourni hors du projet, et éventuellement `STOREFRONT_SCREENSHOTS` pour conserver les six captures. Il traverse les écrans sur un mobile de 390 px et un bureau de 1440 px, vérifie la commande créée, l’absence de débordement mobile et d’erreurs JavaScript.

La validation du build constate également l’avertissement préexistant sur les gros paquets JavaScript. Les tests d’intégrité des commandes existantes vérifient la création atomique, les avances, les compteurs et l’authentification entre organisations.

## Résultats du premier essai local, le 19 novembre 2026

| Vérification | Résultat |
| --- | --- |
| TypeScript, sans cache incrémental | Réussi, aucune erreur |
| Migration réelle + scénario métier PGlite | 36 vérifications réussies |
| Contrôles des routes HTTP | Réussis |
| Parcours Chrome mobile et bureau | Réussi, aucune erreur JavaScript |
| Sauvegarde, fermeture et réouverture de boutique | Réussies ; suivi existant conservé |
| Création des commandes existantes et authentification entre organisations | Tests de non-régression réussis |
| Build client et serveur + vérification du build | Réussis |
| Isolation du module caisse de développement | Trois suites réussies |
| Lanceur fictif dans les fichiers de production | Aucun marqueur du lanceur trouvé |
| Base externe, paiement réel et publication | Non exécutés |

La commande du premier test navigateur passe de l’estimation de 1 300 FCFA à un devis pesé de 1 450 FCFA, accepté par le client, puis enregistré comme commande non réglée. Les tests de calcul vérifient également les lignes du supplément minimum. L’essai connecté suivant a confirmé l’encaissement de 500 puis 950 FCFA, le suivi réglé et les trois PDF téléchargés, détaillés dans le compte rendu de développement.
