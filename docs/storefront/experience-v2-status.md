# Boutique V2 — version de développement vérifiée

## Comportement livré

La configuration passe par trois étapes : identité et apparence, services, ouverture et partage. Une nouvelle boutique reprend l'agence et présélectionne ses services actifs. Les tarifs restent administrés dans Services. Le barème n'est demandé que pour les services au kilo. Le premier enregistrement fixe toujours le lien et la devise de l'organisation.

La vitrine propose trois styles, une couleur, un message d'accueil, un logo, une couverture et jusqu'à douze photos de services. L'aperçu reflète ces réglages. Les images importées sont redimensionnées, contrôlées et réencodées sans métadonnées côté serveur. Les images déjà validées ne sont pas recompressées à chaque sauvegarde. Les données visuelles sont bornées à 650 000 caractères JSON au total et stockées avec la boutique ; une évolution vers un stockage de médias séparé restera possible.

Le client choisit ses vêtements avec +/−, voit l'estimation automatique puis confirme ses coordonnées. Son panier survit au rechargement de l'onglet. Une réponse de calcul tardive ne remplace pas le panier courant ; changer le panier révoque l'accord précédent. Les demandes, contrôles de pesée, accords, commandes et encaissements réutilisent le moteur V1.

WhatsApp Flows dispose d'un adaptateur et d'un transport chiffré testés, d'un Flow JSON brouillon et d'une démonstration hors ligne. Aucun endpoint Flows n'est monté dans le serveur de production et aucun message n'est envoyé. Voir [le dossier d'intégration](whatsapp-flows-integration.md).

## Vérifications réalisées

- TypeScript et compilation complète, contrôles reçus/superadministrateur/caisse inclus.
- Suite métier boutique : 39 vérifications, HTTP/auth/isolement, devise commune, paiement partiel et final, rejeu idempotent, reçus HTML.
- Personnalisation : migration sur une boutique existante sans perte de données, images réelles, taille, métadonnées, entrées malveillantes, agence étrangère, conservation depuis un ancien client et barème conditionnel.
- Navigateur Chrome : panier mobile → demande → pesée → accord → commande, fermeture/réouverture, suivi conservé, personnalisation et copie du lien.
- Import de logo/couverture/photo, rechargement, réponses de calcul désordonnées, révocation de l'accord après modification, pièce sans question de gabarit.
- Absence de débordement à 320/390 px côté client et 390 px côté administrateur.
- Première création sur une base locale vierge, ouverture d'une boutique à la pièce sans barème, lien et QR disponibles.
- Flows : tarifs partagés, panier mixte, demande unique dans la boîte de réception, liaison agence/destinataire, session expirée/révoquée, tarif modifié, article à peser, signatures et chiffrement RSA/AES.
- Protections des migrations, des reçus et du superadministrateur conservées et testées.

Les vérifications navigateur sont réalisées sur des fenêtres simulant un téléphone, pas sur des téléphones physiques. Le Flow JSON doit encore être validé par WhatsApp Manager et testé dans WhatsApp sur Android/iOS.

## Essayer localement

Utiliser Node 20 ou une version compatible plus récente et les dépendances du dépôt.

```sh
STOREFRONT_PREVIEW_PORT=5133 npm run dev:storefront
# http://127.0.0.1:5133/b/pressing-horizon
# http://127.0.0.1:5133/boutique
```

Pour une boutique encore non créée : `STOREFRONT_PREVIEW_PORT=5135 npm run dev:storefront -- --new-shop` puis ouvrir `/boutique`. Les aperçus n'écoutent que sur 127.0.0.1, utilisent des données fictives en mémoire et ne sont jamais chargés dans le serveur publié.

```sh
npm run test:storefront
npm run test:storefront:experience
npm run demo:storefront-flow
npm run test:storefront:browser
```

Le dernier script requiert Playwright/Chrome et l'aperçu sur le port 5133. `PLAYWRIGHT_MODULE`, `STOREFRONT_TEST_ORIGIN` (boucle locale uniquement) et `STOREFRONT_SCREENSHOTS` peuvent préciser le module, l'URL et le dossier d'images. Les tests navigateur ajoutent uniquement des données fictives à cet aperçu.

## Publication

Aucune migration ni publication de production effectuée pour V2. La colonne `branding` est requise avant d'utiliser ce code sur une base existante. Lire [la migration](../../migrations/20261120_storefront_branding.sql) et [sa note de revue](branding-migration-review.md).

La recette sur le compte réel désigné par le propriétaire reste à effectuer après accès au compte et publication approuvée. L'identité de ce compte et les captures sont conservées hors Git dans le dossier privé de validation.
