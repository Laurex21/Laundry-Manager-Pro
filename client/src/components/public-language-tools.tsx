import { useEffect } from "react";
import { useTranslation } from "react-i18next";

type Lang = "en" | "fr" | "pt";

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "pt", label: "PT" },
];

const text: Record<Lang, Record<string, string>> = {
  fr: {},
  en: {
    "Découvrez le véritable niveau professionnel de votre pressing": "Discover the true professional level of your laundry business",
    "Recevez un diagnostic détaillé basé sur les standards modernes du secteur.": "Receive a detailed diagnostic based on modern industry standards.",
    "Informations personnelles": "Personal information",
    "Nom complet *": "Full name *",
    "Téléphone WhatsApp *": "WhatsApp phone *",
    "Email": "Email",
    "Pays *": "Country *",
    "Ville *": "City *",
    "Sélectionner...": "Select...",
    "Informations business": "Business information",
    "Nom du pressing": "Laundry name",
    "Année de création": "Year founded",
    "Nombre d'employés": "Number of employees",
    "Type d'activité": "Business type",
    "Je ne sais pas encore": "I do not know yet",
    "Objectif principal": "Main objective",
    "(plusieurs possibles)": "(multiple possible)",
    "Augmenter mes revenus": "Increase my revenue",
    "Réduire les pertes": "Reduce losses",
    "Professionnaliser mon activité": "Professionalize my business",
    "Former mon personnel": "Train my staff",
    "Attirer une clientèle premium": "Attract premium customers",
    "Ouvrir un pressing moderne": "Open a modern laundry",
    "Enregistrement...": "Saving...",
    "Démarrer mon Diagnostic": "Start my diagnostic",
    "Vos données sont confidentielles et sécurisées.": "Your data is confidential and secure.",
    "Votre diagnostic commence maintenant": "Your diagnostic starts now",
    "Ce diagnostic évalue votre niveau réel d'expertise textile, d'organisation et de professionnalisation.": "This diagnostic evaluates your real level of textile expertise, organization, and professional maturity.",
    "20 questions": "20 questions",
    "5 blocs thématiques": "5 thematic sections",
    "5 minutes": "5 minutes",
    "Durée estimée": "Estimated time",
    "Score sur 60": "Score out of 60",
    "Résultat immédiat": "Immediate result",
    "Recommandations": "Recommendations",
    "Personnalisées": "Personalized",
    "Commencer le Diagnostic": "Start the diagnostic",
    "Retour à l'accueil": "Back to home",
    "Question suivante": "Next question",
    "Voir mes résultats": "See my results",
    "Précédent": "Previous",
    "Diagnostic complété": "Diagnostic completed",
    "Résultats de votre diagnostic": "Your diagnostic results",
    "Voici votre rapport professionnel personnalisé": "Here is your personalized professional report",
    "Score obtenu": "Score achieved",
    "Indice de risque textile": "Textile risk index",
    "Niveau de risque": "Risk level",
    "Potentiel de montée en gamme": "Upgrade potential",
    "Recommandations prioritaires": "Priority recommendations",
    "Points forts identifiés": "Identified strengths",
    "Axes d'amélioration": "Areas for improvement",
    "Télécharger mon rapport PDF": "Download my PDF report",
    "Parler à un expert": "Talk to an expert",
    "Créer mon compte XpressPro": "Create my XpressPro account",
    "Calculez votre Budget": "Calculate your budget",
    "Lancement Pressing": "Laundry launch",
    "Notre IA analyse les coûts locaux, les équipements, les loyers et le marché afin de générer": "Our AI analyzes local costs, equipment, rent, and the market to generate",
    "une estimation réaliste adaptée à votre pays.": "a realistic estimate adapted to your country.",
    "Propulsé par Intelligence Artificielle Gemini": "Powered by Gemini AI",
    "20+ pays": "20+ countries",
    "couverts": "covered",
    "en temps réel": "in real time",
    "3 scénarios": "3 scenarios",
    "de budget": "budget options",
    "résultat": "result",
    "Commencer l'estimation gratuite": "Start the free estimate",
    "Aucun paiement requis": "No payment required",
    "rapport PDF inclus": "PDF report included",
    "Votre projet": "Your project",
    "Vos coordonnées": "Your contact details",
    "Configuration du pressing": "Laundry configuration",
    "Votre objectif principal": "Your main objective",
    "L'IA adapte ses recommandations à votre vision": "The AI adapts its recommendations to your vision",
    "L'IA analyse votre marché...": "The AI is analyzing your market...",
    "Cela peut prendre 20 à 40 secondes...": "This can take 20 to 40 seconds...",
    "Résultats de votre simulation": "Your simulation results",
    "3 Scénarios de Budget": "3 budget scenarios",
    "Rapport en cours de chargement...": "Report loading...",
    "Recommandé": "Recommended",
    "Faisabilité": "Feasibility",
    "Budget total estimé": "Estimated total budget",
    "Charges/mois": "Costs/month",
    "Revenus/mois": "Revenue/month",
    "Bénéfice/mois": "Profit/month",
    "ROI estimé": "Estimated ROI",
    "Risque": "Risk",
    "Comparaison des budgets": "Budget comparison",
    "Analyse de marché": "Market analysis",
    "Niveau de demande": "Demand level",
    "Fourchette de prix locale": "Local price range",
    "Recommandations IA": "AI recommendations",
    "Points de vigilance": "Watch points",
    "Télécharger le rapport PDF complet": "Download the full PDF report",
    "Passez à l'étape suivante": "Move to the next step",
    "Formation Lancement Pressing": "Laundry launch training",
    "Consultation Expert Premium": "Premium expert consultation",
    "Gérez votre pressing avec XpressPro": "Manage your laundry with XpressPro",
    "Essayer gratuitement": "Try free",
    "Demander une démo": "Request a demo",
    "Modifier mes données": "Edit my data",
    "Rapport introuvable": "Report not found",
    "Ce rapport n'existe pas ou a expiré.": "This report does not exist or has expired.",
    "Créer mon rapport": "Create my report",
    "Imprimer": "Print",
    "Essai gratuit 14 jours": "14-day free trial",
    "Copier le lien": "Copy link",
    "Copié !": "Copied!",
    "Budget de démarrage estimé": "Estimated startup budget",
    "Télécharger le rapport": "Download report",
    "Format PDF": "PDF format",
    "Réponse WhatsApp rapide": "Fast WhatsApp reply",
    "Résumé": "Summary",
    "Voir le détail complet de l'estimation": "View full estimate details",
    "Équipements": "Equipment",
    "Aménagement & Installation": "Setup & installation",
    "Démarches administratives": "Administrative steps",
    "Charges mensuelles": "Monthly charges",
    "Analyse de rentabilité": "Profitability analysis",
    "Contexte local": "Local context",
    "Prêt à ouvrir votre pressing ?": "Ready to open your laundry?",
    "Démarrer mon essai gratuit": "Start my free trial",
    "Étape suivante": "Next step",
    "Continuer": "Continue",
    "Retour": "Back",
    "Estimé": "Estimated",
  },
  pt: {
    "Découvrez le véritable niveau professionnel de votre pressing": "Descubra o verdadeiro nível profissional da sua lavandaria",
    "Recevez un diagnostic détaillé basé sur les standards modernes du secteur.": "Receba um diagnóstico detalhado baseado nos padrões modernos do setor.",
    "Informations personnelles": "Informações pessoais",
    "Nom complet *": "Nome completo *",
    "Téléphone WhatsApp *": "Telefone WhatsApp *",
    "Email": "Email",
    "Pays *": "País *",
    "Ville *": "Cidade *",
    "Sélectionner...": "Selecionar...",
    "Informations business": "Informações do negócio",
    "Nom du pressing": "Nome da lavandaria",
    "Année de création": "Ano de criação",
    "Nombre d'employés": "Número de funcionários",
    "Type d'activité": "Tipo de atividade",
    "Je ne sais pas encore": "Ainda não sei",
    "Objectif principal": "Objetivo principal",
    "(plusieurs possibles)": "(várias opções)",
    "Augmenter mes revenus": "Aumentar a receita",
    "Réduire les pertes": "Reduzir perdas",
    "Professionnaliser mon activité": "Profissionalizar o meu negócio",
    "Former mon personnel": "Formar a minha equipa",
    "Attirer une clientèle premium": "Atrair clientes premium",
    "Ouvrir un pressing moderne": "Abrir uma lavandaria moderna",
    "Enregistrement...": "A guardar...",
    "Démarrer mon Diagnostic": "Iniciar o diagnóstico",
    "Vos données sont confidentielles et sécurisées.": "Os seus dados são confidenciais e seguros.",
    "Votre diagnostic commence maintenant": "O seu diagnóstico começa agora",
    "Ce diagnostic évalue votre niveau réel d'expertise textile, d'organisation et de professionnalisation.": "Este diagnóstico avalia o seu nível real de experiência têxtil, organização e profissionalização.",
    "20 questions": "20 perguntas",
    "5 blocs thématiques": "5 blocos temáticos",
    "5 minutes": "5 minutos",
    "Durée estimée": "Duração estimada",
    "Score sur 60": "Pontuação em 60",
    "Résultat immédiat": "Resultado imediato",
    "Recommandations": "Recomendações",
    "Personnalisées": "Personalizadas",
    "Commencer le Diagnostic": "Começar o diagnóstico",
    "Retour à l'accueil": "Voltar ao início",
    "Question suivante": "Próxima pergunta",
    "Voir mes résultats": "Ver os resultados",
    "Précédent": "Anterior",
    "Diagnostic complété": "Diagnóstico concluído",
    "Résultats de votre diagnostic": "Resultados do seu diagnóstico",
    "Voici votre rapport professionnel personnalisé": "Aqui está o seu relatório profissional personalizado",
    "Score obtenu": "Pontuação obtida",
    "Indice de risque textile": "Índice de risco têxtil",
    "Niveau de risque": "Nível de risco",
    "Potentiel de montée en gamme": "Potencial de evolução",
    "Recommandations prioritaires": "Recomendações prioritárias",
    "Points forts identifiés": "Pontos fortes identificados",
    "Axes d'amélioration": "Áreas de melhoria",
    "Télécharger mon rapport PDF": "Descarregar o meu relatório PDF",
    "Parler à un expert": "Falar com um especialista",
    "Créer mon compte XpressPro": "Criar a minha conta XpressPro",
    "Calculez votre Budget": "Calcule o seu orçamento",
    "Lancement Pressing": "Lançamento de lavandaria",
    "Notre IA analyse les coûts locaux, les équipements, les loyers et le marché afin de générer": "A nossa IA analisa custos locais, equipamentos, rendas e mercado para gerar",
    "une estimation réaliste adaptée à votre pays.": "uma estimativa realista adaptada ao seu país.",
    "Propulsé par Intelligence Artificielle Gemini": "Com tecnologia de IA Gemini",
    "20+ pays": "20+ países",
    "couverts": "cobertos",
    "en temps réel": "em tempo real",
    "3 scénarios": "3 cenários",
    "de budget": "de orçamento",
    "résultat": "resultado",
    "Commencer l'estimation gratuite": "Começar a estimativa gratuita",
    "Aucun paiement requis": "Sem pagamento necessário",
    "rapport PDF inclus": "relatório PDF incluído",
    "Votre projet": "O seu projeto",
    "Vos coordonnées": "Os seus contactos",
    "Configuration du pressing": "Configuração da lavandaria",
    "Votre objectif principal": "O seu objetivo principal",
    "L'IA adapte ses recommandations à votre vision": "A IA adapta as recomendações à sua visão",
    "L'IA analyse votre marché...": "A IA está a analisar o seu mercado...",
    "Cela peut prendre 20 à 40 secondes...": "Isto pode demorar 20 a 40 segundos...",
    "Résultats de votre simulation": "Resultados da sua simulação",
    "3 Scénarios de Budget": "3 cenários de orçamento",
    "Rapport en cours de chargement...": "Relatório a carregar...",
    "Recommandé": "Recomendado",
    "Faisabilité": "Viabilidade",
    "Budget total estimé": "Orçamento total estimado",
    "Charges/mois": "Custos/mês",
    "Revenus/mois": "Receita/mês",
    "Bénéfice/mois": "Lucro/mês",
    "ROI estimé": "ROI estimado",
    "Risque": "Risco",
    "Comparaison des budgets": "Comparação de orçamentos",
    "Analyse de marché": "Análise de mercado",
    "Niveau de demande": "Nível de procura",
    "Fourchette de prix locale": "Faixa de preços local",
    "Recommandations IA": "Recomendações da IA",
    "Points de vigilance": "Pontos de atenção",
    "Télécharger le rapport PDF complet": "Descarregar relatório PDF completo",
    "Passez à l'étape suivante": "Avance para o próximo passo",
    "Formation Lancement Pressing": "Formação para lançar lavandaria",
    "Consultation Expert Premium": "Consulta premium com especialista",
    "Gérez votre pressing avec XpressPro": "Gira a sua lavandaria com XpressPro",
    "Essayer gratuitement": "Experimentar grátis",
    "Demander une démo": "Pedir demonstração",
    "Modifier mes données": "Editar os meus dados",
    "Rapport introuvable": "Relatório não encontrado",
    "Ce rapport n'existe pas ou a expiré.": "Este relatório não existe ou expirou.",
    "Créer mon rapport": "Criar o meu relatório",
    "Imprimer": "Imprimir",
    "Essai gratuit 14 jours": "Teste grátis de 14 dias",
    "Copier le lien": "Copiar link",
    "Copié !": "Copiado!",
    "Budget de démarrage estimé": "Orçamento inicial estimado",
    "Télécharger le rapport": "Descarregar relatório",
    "Format PDF": "Formato PDF",
    "Réponse WhatsApp rapide": "Resposta rápida no WhatsApp",
    "Résumé": "Resumo",
    "Voir le détail complet de l'estimation": "Ver detalhes completos da estimativa",
    "Équipements": "Equipamentos",
    "Aménagement & Installation": "Preparação e instalação",
    "Démarches administratives": "Procedimentos administrativos",
    "Charges mensuelles": "Custos mensais",
    "Analyse de rentabilité": "Análise de rentabilidade",
    "Contexte local": "Contexto local",
    "Prêt à ouvrir votre pressing ?": "Pronto para abrir a sua lavandaria?",
    "Démarrer mon essai gratuit": "Iniciar o teste grátis",
    "Étape suivante": "Próximo passo",
    "Continuer": "Continuar",
    "Retour": "Voltar",
    "Estimé": "Estimado",
  },
};

const placeholders: Record<Lang, Record<string, string>> = {
  fr: {},
  en: {
    "Jean Dupont": "John Smith",
    "vous@exemple.com": "you@example.com",
    "Mon Pressing": "My Laundry",
    "ex: Douala, Yaoundé...": "e.g. Douala, Yaounde...",
    "ex: Dakar, Thiès...": "e.g. Dakar, Thies...",
    "ex: Abidjan, Bouaké...": "e.g. Abidjan, Bouake...",
    "votre@email.com": "your@email.com",
  },
  pt: {
    "Jean Dupont": "Joao Silva",
    "vous@exemple.com": "voce@exemplo.com",
    "Mon Pressing": "Minha Lavandaria",
    "ex: Douala, Yaoundé...": "ex: Douala, Yaounde...",
    "ex: Dakar, Thiès...": "ex: Dakar, Thies...",
    "ex: Abidjan, Bouaké...": "ex: Abidjan, Bouake...",
    "votre@email.com": "seu@email.com",
  },
};

function getLang(language: string): Lang {
  if (language.startsWith("fr")) return "fr";
  if (language.startsWith("pt")) return "pt";
  return "en";
}

function translateExact(value: string, lang: Lang) {
  const trimmed = value.trim();
  if (!trimmed || lang === "fr") return value;
  return text[lang][trimmed] ?? value;
}

function translateTextNode(node: Text, lang: Lang) {
  const value = node.nodeValue ?? "";
  const translated = translateExact(value, lang);
  if (translated !== value) {
    const leading = value.match(/^\s*/)?.[0] ?? "";
    const trailing = value.match(/\s*$/)?.[0] ?? "";
    node.nodeValue = `${leading}${translated}${trailing}`;
  }
}

function translatePublicPage(root: HTMLElement, lang: Lang) {
  if (lang === "fr") return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => translateTextNode(node, lang));

  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[placeholder]").forEach((el) => {
    const current = el.getAttribute("placeholder") ?? "";
    const translated = placeholders[lang][current] ?? text[lang][current];
    if (translated) el.setAttribute("placeholder", translated);
  });
}

export function PublicLanguageTools() {
  const { i18n } = useTranslation();
  const lang = getLang(i18n.language);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-public-tool-root]");
    if (!root) return;
    translatePublicPage(root, lang);

    const observer = new MutationObserver(() => translatePublicPage(root, lang));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [lang]);

  return (
    <div className="fixed right-3 top-3 z-50 print:hidden" aria-label="Language selector">
      <div className="flex rounded-full border border-white/30 bg-background/90 p-1 shadow-lg backdrop-blur">
        {LANGUAGES.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => i18n.changeLanguage(item.code)}
            className={`h-8 min-w-9 rounded-full px-2 text-xs font-semibold transition-colors ${
              lang === item.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function publicLangCode(language: string) {
  return getLang(language);
}
