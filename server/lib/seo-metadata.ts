export interface RouteMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: "summary" | "summary_large_image";
  noscriptHtml: string;
  structuredData?: Record<string, unknown>;
}

const BASE_URL = "https://xpresspro.app";
const OG_IMAGE = `${BASE_URL}/og-image.png`;

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "XpressPro — Logiciel de Gestion Pressing & Laverie | Commandes, Reçus, Analytiques",
    description:
      "XpressPro est le logiciel tout-en-un pour gérer votre pressing ou laverie : clients, commandes, paiements, reçus, suivi de livraison et analytiques métier depuis un seul tableau de bord.",
    canonical: `${BASE_URL}/`,
    ogTitle: "XpressPro — Logiciel de Gestion Pressing & Laverie",
    ogDescription:
      "Gérez vos clients, commandes, paiements et analytiques pressing depuis un seul tableau de bord. Essai gratuit disponible.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    noscriptHtml: `
      <main>
        <h1>XpressPro — Logiciel de Gestion Pressing &amp; Laverie</h1>
        <p>XpressPro est le logiciel tout-en-un pour gérer votre pressing ou laverie : clients, commandes, paiements, reçus, suivi de livraison et analytiques métier depuis un seul tableau de bord.</p>
        <ul>
          <li>Suivi des commandes en temps réel — 7 étapes de traitement</li>
          <li>Reçus de dépôt automatiques avec liste des articles</li>
          <li>Analytiques métier : chiffre d'affaires, dépenses, rentabilité</li>
        </ul>
        <p><a href="/auth">Créer un compte gratuitement</a> ou <a href="/auth">Se connecter</a></p>
        <p>Outils gratuits : <a href="/calculateur">Calculateur de budget lancement pressing</a> | <a href="/diagnostic">Diagnostic pressing professionnel</a> | <a href="/rentabilite">Calculateur de rentabilité pressing</a></p>
      </main>`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "XpressPro",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Logiciel de gestion pressing et laverie : commandes, clients, paiements, reçus et analytiques.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "XAF" },
      url: BASE_URL,
    },
  },

  "/auth": {
    title: "Connexion / Inscription — XpressPro Logiciel Pressing",
    description:
      "Connectez-vous à XpressPro ou créez votre compte gratuitement pour gérer votre pressing : commandes, clients, paiements et analytiques depuis un tableau de bord professionnel.",
    canonical: `${BASE_URL}/auth`,
    ogTitle: "Connexion / Inscription — XpressPro",
    ogDescription:
      "Créez votre compte XpressPro gratuitement ou connectez-vous pour gérer votre pressing.",
    ogImage: OG_IMAGE,
    twitterCard: "summary",
    noscriptHtml: `
      <main>
        <h1>Connexion à XpressPro — Gestion Pressing</h1>
        <p>Connectez-vous ou créez un compte gratuit pour accéder à votre tableau de bord pressing : commandes, clients, paiements, reçus et analytiques.</p>
        <p>Outils gratuits disponibles sans inscription : <a href="/calculateur">Calculateur de budget lancement</a> · <a href="/diagnostic">Diagnostic professionnel</a> · <a href="/rentabilite">Calculateur de rentabilité</a></p>
      </main>`,
  },

  "/calculateur": {
    title: "Calculateur Budget Lancement Pressing Gratuit — Estimation IA par Pays | XpressPro",
    description:
      "Estimez le budget pour lancer votre pressing ou laverie grâce à notre calculateur IA gratuit. Coûts des équipements, loyer, personnel et fonds de roulement analysés par pays en moins de 60 secondes.",
    canonical: `${BASE_URL}/calculateur`,
    ogTitle: "Calculateur Budget Lancement Pressing — Estimation IA Gratuite",
    ogDescription:
      "Obtenez une estimation réaliste du budget pour ouvrir votre pressing ou laverie. Notre IA Gemini analyse les coûts locaux pour 20+ pays africains.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    noscriptHtml: `
      <main>
        <h1>Calculateur Budget Lancement Pressing — Estimation par Intelligence Artificielle</h1>
        <p>Notre calculateur propulsé par l'IA Gemini analyse les coûts locaux, les équipements, les loyers et le marché afin de générer une estimation réaliste du budget pour lancer votre pressing ou laverie, adaptée à votre pays.</p>
        <ul>
          <li>Couverture : 20+ pays africains</li>
          <li>3 scénarios de budget (économique, standard, premium)</li>
          <li>Résultat en moins de 60 secondes</li>
          <li>Aucune inscription requise</li>
        </ul>
        <p>Renseignez votre pays, votre ville et vos capacités pour obtenir votre estimation personnalisée.</p>
        <p>Voir aussi : <a href="/diagnostic">Diagnostic pressing professionnel</a> | <a href="/rentabilite">Calculateur de rentabilité pressing</a></p>
      </main>`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Calculateur Budget Lancement Pressing — XpressPro",
      applicationCategory: "BusinessApplication",
      description:
        "Calculateur gratuit pour estimer le budget de lancement d'un pressing ou d'une laverie, basé sur l'IA Gemini.",
      url: `${BASE_URL}/calculateur`,
      featureList: [
        "Estimation budget pressing par pays",
        "3 scénarios de coût",
        "Analyse IA Gemini",
        "Couverture 20+ pays",
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "XAF" },
    },
  },

  "/diagnostic": {
    title: "Diagnostic Professionnel Pressing Gratuit — Évaluation Niveau & Standards | XpressPro",
    description:
      "Évaluez gratuitement le niveau professionnel de votre pressing ou laverie. Recevez un diagnostic détaillé basé sur les standards modernes du secteur : qualité, équipements, process et rentabilité.",
    canonical: `${BASE_URL}/diagnostic`,
    ogTitle: "Diagnostic Pressing Professionnel Gratuit — Évaluation Niveau & Standards",
    ogDescription:
      "Découvrez le véritable niveau professionnel de votre pressing. Diagnostic IA gratuit basé sur les standards modernes du secteur. Résultats personnalisés envoyés par email.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    noscriptHtml: `
      <main>
        <h1>Diagnostic Professionnel Pressing — Évaluez le Niveau de Votre Laverie</h1>
        <p>Découvrez le véritable niveau professionnel de votre pressing. Recevez un diagnostic détaillé basé sur les standards modernes du secteur : qualité de traitement, équipements, organisation, relation client et rentabilité.</p>
        <ul>
          <li>Évaluation complète en quelques minutes</li>
          <li>Résultats personnalisés et rapport détaillé</li>
          <li>Recommandations concrètes pour améliorer votre pressing</li>
          <li>Outil gratuit, aucune inscription requise</li>
        </ul>
        <p>Voir aussi : <a href="/calculateur">Calculateur budget lancement pressing</a> | <a href="/rentabilite">Calculateur de rentabilité</a></p>
      </main>`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Diagnostic Pressing Professionnel — XpressPro",
      applicationCategory: "BusinessApplication",
      description:
        "Outil de diagnostic gratuit pour évaluer le niveau professionnel d'un pressing ou d'une laverie selon les standards du secteur.",
      url: `${BASE_URL}/diagnostic`,
      featureList: [
        "Diagnostic professionnel pressing",
        "Évaluation standards secteur",
        "Rapport personnalisé",
        "Recommandations concrètes",
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "XAF" },
    },
  },

  "/rentabilite": {
    title: "Calculateur Rentabilité Pressing Gratuit — Coûts, Marges & Bénéfices | XpressPro",
    description:
      "Calculez la rentabilité réelle de votre pressing ou laverie : coûts fixes, charges variables, marges et bénéfice net. Obtenez votre rapport personnalisé de rentabilité même sans formation comptable.",
    canonical: `${BASE_URL}/rentabilite`,
    ogTitle: "Calculateur Rentabilité Pressing — Coûts, Marges & Bénéfices Réels",
    ogDescription:
      "Calculez la rentabilité réelle de votre pressing. Rapport personnalisé de coûts, marges et bénéfices — même sans formation comptable. Outil gratuit.",
    ogImage: OG_IMAGE,
    twitterCard: "summary_large_image",
    noscriptHtml: `
      <main>
        <h1>Calculateur de Rentabilité Pressing — Coûts, Marges et Bénéfices</h1>
        <p>Calculez la rentabilité réelle de votre pressing ou laverie : obtenez votre rapport personnalisé de coûts fixes, charges variables, marges et bénéfice net — même sans formation comptable.</p>
        <ul>
          <li>Analyse des coûts fixes et variables</li>
          <li>Calcul des marges et du bénéfice net</li>
          <li>Rapport de rentabilité personnalisé</li>
          <li>Aucune formation comptable requise</li>
          <li>Outil gratuit, résultats par email</li>
        </ul>
        <p>Voir aussi : <a href="/calculateur">Calculateur budget lancement pressing</a> | <a href="/diagnostic">Diagnostic pressing professionnel</a></p>
      </main>`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Calculateur Rentabilité Pressing — XpressPro",
      applicationCategory: "BusinessApplication",
      description:
        "Calculateur gratuit de rentabilité pour pressing et laverie : coûts, marges, bénéfice net, rapport personnalisé.",
      url: `${BASE_URL}/rentabilite`,
      featureList: [
        "Calcul rentabilité pressing",
        "Analyse coûts et marges",
        "Rapport personnalisé",
        "Bénéfice net estimé",
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "XAF" },
    },
  },
};

export function getRouteMeta(pathname: string): RouteMeta | null {
  const p = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return ROUTE_META[p] ?? null;
}

export function injectMetaIntoHtml(html: string, meta: RouteMeta): string {
  const structuredDataBlock = meta.structuredData
    ? `<script type="application/ld+json">\n      ${JSON.stringify(meta.structuredData, null, 2)}\n    </script>`
    : "";

  const headBlock = `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}" />
    <link rel="canonical" href="${meta.canonical}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${meta.ogTitle}" />
    <meta property="og:description" content="${meta.ogDescription}" />
    <meta property="og:url" content="${meta.canonical}" />
    <meta property="og:image" content="${meta.ogImage}" />
    <meta name="twitter:card" content="${meta.twitterCard}" />
    <meta name="twitter:title" content="${meta.ogTitle}" />
    <meta name="twitter:description" content="${meta.ogDescription}" />
    <meta name="twitter:image" content="${meta.ogImage}" />
    ${structuredDataBlock}
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">`;

  const noscriptBlock = `<noscript><style>#root{display:none}</style>${meta.noscriptHtml}</noscript>`;

  return html
    .replace(/<head>[\s\S]*?<\/head>/, `<head>\n    ${headBlock}\n  </head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root"></div>\n    ${noscriptBlock}`);
}
