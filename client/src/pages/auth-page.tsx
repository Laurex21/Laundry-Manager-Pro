import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shirt, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

function AuthForm({ tab, setTab }: { tab: "login" | "register"; setTab: (t: "login" | "register") => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = tab === "login"
        ? { email, password }
        : { email, password, firstName, lastName, phone, businessName };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur", description: data.message || "Échec de l'authentification", variant: "destructive" });
        return;
      }

      queryClient.setQueryData(["/api/auth/user"], data);
      setLocation("/");
    } catch {
      toast({ title: "Erreur", description: "Erreur réseau. Veuillez réessayer.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold font-display tracking-tight text-foreground">
          {tab === "login" ? "Bienvenue" : "Créer un compte"}
        </h2>
        <p className="text-muted-foreground">
          {tab === "login" ? "Connectez-vous pour accéder à votre tableau de bord" : "Configurez votre compte de pressing"}
        </p>
      </div>

      <div className="flex bg-muted rounded-lg p-1">
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          onClick={() => setTab("login")}
          data-testid="tab-login"
        >
          Se connecter
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${tab === "register" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          onClick={() => setTab("register")}
          data-testid="tab-register"
        >
          S'inscrire
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 bg-card border border-border rounded-2xl shadow-xl shadow-black/5 space-y-4">
        {tab === "register" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prénom</label>
                <Input
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nom</label>
                <Input
                  placeholder="Dupont"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Numéro de téléphone</label>
              <Input
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nom de l'établissement</label>
              <Input
                placeholder="Mon Pressing"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                data-testid="input-business-name"
              />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{tab === "login" ? "Email ou Numéro de téléphone" : "Email"}</label>
          <Input
            type={tab === "login" ? "text" : "email"}
            placeholder={tab === "login" ? "vous@exemple.com ou +237 6XX XXX XXX" : "vous@exemple.com"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="input-email"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Mot de passe</label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="pr-10"
              data-testid="input-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full font-semibold h-12 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
          disabled={submitting}
          data-testid="button-auth-submit"
        >
          {submitting ? "Veuillez patienter..." : tab === "login" ? "Se connecter" : "Créer mon compte"}
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-3">
          {tab === "login" ? (
            <>Pas encore de compte ?{" "}<button type="button" className="text-primary font-medium hover:underline" onClick={() => setTab("register")}>S'inscrire</button></>
          ) : (
            <>Déjà un compte ?{" "}<button type="button" className="text-primary font-medium hover:underline" onClick={() => setTab("login")}>Se connecter</button></>
          )}
        </p>
      </form>
    </div>
  );
}

const FEATURES = [
  "Suivi des commandes en temps réel",
  "Gestion des profils clients",
  "Facturation & reçus automatisés",
];

const TOOLS = [
  {
    icon: "📋",
    iconBg: "bg-blue-50",
    title: "Diagnostic Professionnel de Pressing",
    description: "Identifier les axes d'amélioration opérationnelle et financière.",
    buttonLabel: "Lancer le Diagnostic",
    href: "/calculateur",
    testId: "link-diagnostic",
  },
  {
    icon: "🚀",
    iconBg: "bg-orange-50",
    title: "Calculateur lancement pressing",
    description: "Estimer vos coûts totaux de démarrage.",
    buttonLabel: "Estimer les Coûts",
    href: "/calculateur",
    testId: "link-calculator",
  },
  {
    icon: "💰",
    iconBg: "bg-green-50",
    title: "Calculateur de rentabilité",
    description: "Projeter vos profits mensuels sur la base d'indicateurs clés.",
    buttonLabel: "Analyser les Profits",
    href: "/calculateur",
    testId: "link-profitability",
  },
];

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"login" | "register">("login");

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-background">

      {/* ── Blue hero ──────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-5%] w-[500px] h-[500px] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-[-20%] left-[-5%] w-[400px] h-[400px] rounded-full bg-blue-400/20 blur-3xl" />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-10 md:py-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shirt className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">CleanEase</span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-bold text-3xl md:text-5xl leading-tight mb-3">
            Gestion de pressing,{" "}
            <span className="text-blue-200">simplifiée.</span>
          </h1>
          <p className="text-blue-100 text-base md:text-lg max-w-xl mb-6 leading-relaxed">
            La plateforme tout-en-un pour gérer vos commandes, clients et opérations efficacement.
          </p>

          {/* Feature bullets */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {FEATURES.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-300 flex-shrink-0" />
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tools section ──────────────────────────────────────────── */}
      <div className="bg-blue-50 dark:bg-blue-950/30 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-muted-foreground text-sm font-medium mb-6 tracking-wide uppercase">
            Accédez à nos Outils de Pilotage
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TOOLS.map((tool) => (
              <div
                key={tool.testId}
                className="bg-white dark:bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center text-center gap-4"
              >
                <div className={`w-16 h-16 rounded-2xl ${tool.iconBg} flex items-center justify-center text-3xl`}>
                  {tool.icon}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm leading-snug mb-1">{tool.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                </div>
                <a
                  href={tool.href}
                  className="w-full"
                  data-testid={tool.testId}
                >
                  <Button className="w-full text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    {tool.buttonLabel}
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Login form ─────────────────────────────────────────────── */}
      <div className="px-6 py-12 bg-background">
        <div className="max-w-md mx-auto">
          <AuthForm tab={tab} setTab={setTab} />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pb-8">
        © {new Date().getFullYear()} CleanEase Inc. Tous droits réservés.
      </div>

    </div>
  );
}
