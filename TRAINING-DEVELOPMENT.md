# Formation vidéo — développement uniquement

Route : /formation. Accès par Formation dans le menu ou Aide > Formation vidéo.
Versions françaises PC 16:9 et mobile 9:16, voix intégrée, sans lecture automatique.
Progression locale au navigateur et au compte, distincte par leçon et format (pas de synchronisation entre appareils).

## Stockage
Bucket Replit dédié : xpresspro-training-development.
ID : replit-objstore-4f8b19e6-9284-45ab-b71e-5a5c8d64df8f.
18 leçons, 36 objets PC/mobile référencés dans shared/training.ts. Les MP4 ne sont pas versionnés.
25 vidéos comportent la voix fournie ; 11 sont explicitement signalées sans narration.
Les versions sans voix : leçon 11 PC ; leçons 12, 14, 16, 17 et 18 PC/mobile.
La commande npm run dev définit TRAINING_BUCKET_ID. Le serveur de développement a été relancé avec cette variable ; journal de démarrage confirmé avec maintenance suspendue.
Aucune modification du déploiement ou de la production n'a été effectuée.
Les routes serveur répondent 404 hors NODE_ENV=development ; le menu et la route frontend sont également limités au développement.
L'authentification existante protège les fichiers. Aucun changement de droits d'abonnement.
Le catalogue utilisateur comporte 17 leçons. /api/training/admin et les deux vidéos super-admin passent par requirePlatformAdmin (authentification MFA existante).
Les tests CI utilisent uniquement des médias fictifs : aucun bucket, base de données ou service email requis.

## Vérifications effectuées
- TypeScript : OK local et Replit.
- Tests HTTP : authentification, formats, plages de lecture, cache, erreur temporaire et refus production : OK local et Replit.
- Lecture des 36 objets réels depuis Replit : empreintes SHA256 et requêtes partielles validées.
- Compilation Replit : réussie.
- Copie locale isolée : lecture PC 1920x1080 / mobile 1080x1920, reprise après recharge, menu mobile et absence de débordement à 390px.
- Aperçu : http://127.0.0.1:5340/formation (serveur fictif sans base ni emails).
- Protections existantes Replit : SALES_EMAIL_ENABLED=false ; exclusions 3,100,112,193 ; commande dev maintenance suspendue, billing disabled, live false.

## Réexécuter
npm run test:training
npm run check
NODE_ENV=development TRAINING_BUCKET_ID=replit-objstore-4f8b19e6-9284-45ab-b71e-5a5c8d64df8f node --import tsx scripts/verify-training-storage.ts

La copie de démonstration locale peut être lancée avec TRAINING_LOCAL_MEDIA_DIR=.local/training-media node --import tsx scripts/training-preview-local.ts.
Ce script n'importe aucune base ni service métier. Il n'est pas utilisé dans le démarrage de l'application ou en production.
