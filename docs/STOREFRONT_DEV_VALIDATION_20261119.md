# Boutique WhatsApp — validation en développement

Le 19 novembre 2026, le parcours boutique → devis révisé → accord client → commande → acompte → solde → reçus PDF a été exécuté dans les vrais écrans Chrome de Xpress Pro, contre la base locale de développement Replit. Les enregistrements ont ensuite été rapprochés par des requêtes SQL en lecture seule. Aucun encaissement bancaire, envoi WhatsApp ou déploiement de production n’a été effectué.

Ce bilan ne contient ni adresse de compte, ni URL d’environnement, ni identifiant de dossier, ni chemin privé. Le compte rendu détaillé et les preuves sont conservés localement par l’opérateur de l’essai.

## Installation vérifiée

- Application complète dans une copie de travail isolée, avec authentification normale et boutique activée.
- Corrections récentes de reçus conservées ; aucun des quatre fichiers protégés de téléchargement modifié.
- Cible de développement vérifiée avant toute écriture. Aucune utilisation des anciennes variables de connexion à une base externe.
- Migration additive appliquée explicitement. Les quatre tables et leurs 50 noms de colonnes correspondent à la migration : événements 8, demandes 22, services 4, boutiques 16.
- Sans session, la gestion retourne HTTP 401. Une boutique inconnue retourne HTTP 404, sans erreur de table manquante.
- Maintenances automatiques, collecte SaaS réelle et envois commerciaux suspendus pendant l’essai.
- Nouveau compte fictif créé sur demande explicite de l’utilisateur, avec une organisation et une agence réservées aux tests. Aucun droit administrateur de plateforme.
- Le préalable légal du compte fictif est marqué comme donnée synthétique, sans représenter le consentement d’une personne réelle. Le mot de passe généré reste dans un fichier privé temporaire hors Git.

## Parcours constaté avec des données entièrement fictives

| Étape | Résultat observé |
| --- | --- |
| Connexion du propriétaire fictif | Tableau de bord et menu Boutique WhatsApp disponibles |
| Configuration par les écrans habituels | Services au kilo, à la pièce et sur devis publiés ; barème pilote examiné |
| Panier mobile | 3 T-shirts enfant + 2 chemises adulte + 1 jean adolescent |
| Estimation | 1,3 kg × 1 000 FCFA = 1 300 FCFA |
| Demande enregistrée | Visible dans la boîte de réception du pressing |
| Devis après pesée fictive | 1,45 kg × 1 000 FCFA = 1 450 FCFA |
| Accord client | Accord conservé sur la version du devis facturée |
| Conversion | Une commande créée, référence permanente affichée |
| Lignes | Une ligne 1,45 kg à 1 000 FCFA ; inventaire physique séparé de 6 vêtements |
| Acompte fictif | 500 FCFA, statut partiel, reste 950 FCFA |
| Solde fictif | 950 FCFA, statut payé, aucune commande dans la file des impayés |
| Suivi invité | Référence de commande affichée et « Paiement : réglé » |
| PDF d’acompte | 500 FCFA reçus, 950 FCFA restants, quantité 1,45 kg et six vêtements |
| PDF du solde | 500 FCFA déjà payés + 950 FCFA reçus, « ENTIÈREMENT PAYÉ » |
| PDF complet de la commande | Total 1 450 FCFA, historique des deux paiements, solde entièrement payé |

Les trois PDF ont été téléchargés depuis les menus de l’application, puis rendus et inspectés visuellement. Une page par PDF, sans troncature des montants ni de l’inventaire. Ils portent des mentions explicites de test sans valeur commerciale ni paiement réel. Sept captures documentent les étapes du panier au suivi réglé.

Le rapprochement SQL confirme : demande convertie, version acceptée égale à la version facturée, total de 1 450 FCFA, exactement deux paiements totalisant 1 450 FCFA, un lot de 1,45 kg et six vêtements.

## Vérifications reproductibles

- `npm run test:storefront` comprend désormais le module d’encaissement existant : acompte, répétition idempotente sans doublon, solde, suivi réglé et HTML des reçus.
- TypeScript sans cache incrémental : réussi après ajout des scripts de lancement et du compte fictif.
- Après synchronisation avec main : 36 contrôles métier boutique et trois tests de protection des reçus réussis.
- `npm run dev:storefront:replit` refuse les déploiements de production et les bases externes avant toute connexion.

## Reprise et limites

Le pilote utilise une copie de travail isolée, sans modifier le lanceur du workspace principal. Il reste lié au cycle de vie de l’environnement de développement. Lorsque le port applicatif est libre, relancer depuis la copie de la branche boutique avec `npm run dev:storefront:replit`, en conservant les paramètres de stockage et les exclusions de maintenance existants.

Le compte est conservé en base, mais son fichier privé d’identifiants est temporaire. Ne jamais réinitialiser silencieusement le mot de passe d’un compte déjà créé.

La collecte SaaS étant désactivée, les archives `saas_receipt_snapshots` ne sont pas alimentées pendant ce scénario. Le téléchargement des PDF est vérifié ; l’archivage SaaS dans sa configuration active n’est pas certifié par cet essai.

Le forfait conventionnel et le minimum restent couverts par les tests métier. Cet essai connecté porte sur la pesée avec paiement en espèces fictif, en XAF. Ni paiement mobile réel, ni envoi automatique WhatsApp, ni validation multidevise ou appareil Android physique n’est inclus. La commande test reste au statut opérationnel « reçu » : le règlement au dépôt ne simule pas le lavage ou la livraison.
