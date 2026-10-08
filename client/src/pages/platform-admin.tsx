import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  FileClock,
  Loader2,
  LockKeyhole,
  LogOut,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import QRCode from "qrcode";
import i18n from "@/lib/i18n";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Overview = {
  organisationCount: number;
  activeSiteCount: number;
  userCount: number;
  staffCount: number;
  activeSubscriptionCount: number;
  activeFreePlanCount: number;
  activePaidPlanCount: number;
  withoutPlanCount: number;
  subscriptionRevenueMonth: number;
  expiringSoonCount: number;
};

type AdminPlan = { id: number; name: string; slug: string; price: number };
type SandboxCheckout = { checkoutId: string; amountXaf: number; status: string; providerStatus: string | null;
  redirectUrl: string | null; callbackReceivedAt: string | null; createdAt: string };

type Subscriber = {
  id: number;
  name: string;
  createdAt: string;
  owner: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
  siteCount: number;
  staffCount: number;
  subscription: {
    status: string;
    startDate: string | null;
    endDate: string | null;
    planSlug: string;
    planName: string;
  } | null;
};

type SubscriberPage = { items: Subscriber[]; total: number; limit: number; offset: number };

type AuditEvent = {
  id: number;
  organisationName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
};

type OrganisationDetail = {
  id: number;
  name: string;
  createdAt: string;
  owner: Subscriber["owner"];
  subscription: (NonNullable<Subscriber["subscription"]> & {
    id: number;
    ordersUsed: number;
    planPrice: number;
  }) | null;
  footprint: {
    sites: Array<{ id: number; name: string; city: string | null; active: boolean; createdAt: string }>;
    roles: Array<{ role: string; count: number }>;
  };
  usage: {
    orderCount: number;
    ordersLast30Days: number;
    revenueLast30Days: number;
    lastOrderAt: string | null;
    customerCount: number;
    customersLast30Days: number;
  };
  billing: {
    completedRevenue: number;
    successfulPaymentCount: number;
    payments: Array<{ id: number; amount: number; method: string; status: string; createdAt: string; planName: string }>;
  };
  audit: Array<{ id: number; action: string; targetType: string; targetId: string | null; actorEmail: string | null; createdAt: string }>;
};

type AdminStatus = {
  isPlatformAdmin: boolean;
  mfaEnrolled: boolean;
  mfaVerified: boolean;
  pendingAuthentication: boolean;
};

type AdminAuthStep = "credentials" | "enroll" | "verify";

const ADMIN_FR: Record<string, string> = {
  "PawaPay sandbox test": "Test PawaPay Sandbox",
  "This 1,000 FCFA sandbox checkout does not activate a plan or record a real payment.": "Ce checkout de 1 000 FCFA en Sandbox n’active aucune formule et n’enregistre aucun paiement réel.",
  "Create test checkout": "Créer un checkout de test",
  "Creating…": "Création…",
  "Loading…": "Chargement…",
  "Checking…": "Vérification…",
  "Refresh status": "Actualiser le statut",
  "Check with PawaPay": "Vérifier auprès de PawaPay",
  "PawaPay check": "Vérification PawaPay",
  "Signed callback received": "Callback signé reçu",
  "No signed callback received": "Aucun callback signé reçu",
  "Status refreshed": "Statut actualisé",
  "Open PawaPay sandbox checkout": "Ouvrir le checkout PawaPay Sandbox",
  "Open test": "Ouvrir le test",
  "Sandbox checkout failed": "Échec du checkout Sandbox",
  "Organisation workspace": "Fiche organisation",
  "Controlled administration": "Administration encadrée",
  "Only plan assignment is editable here. It is audited and does not record a payment. Other operational data remains read-only.": "Seule l’attribution de formule est modifiable ici. Elle est auditée et ne crée aucun paiement. Les autres données restent en lecture seule.",
  "Assign a plan manually": "Attribuer une formule manuellement",
  "Select a plan": "Choisir une formule",
  "End date": "Date de fin",
  "Ends": "Fin",
  "Reason": "Motif",
  "Reason for manual assignment": "Motif de l’attribution manuelle",
  "The previous active plan will end. No payment will be recorded.": "La formule active précédente prendra fin. Aucun paiement ne sera enregistré.",
  "No payment will be recorded.": "Aucun paiement ne sera enregistré.",
  "Plan assigned successfully. No payment recorded.": "Formule attribuée. Aucun paiement enregistré.",
  "Confirm plan assignment": "Confirmer l’attribution de formule",
  "Plan assignment failed": "Échec de l’attribution de formule",
  "Saving…": "Enregistrement…",
  "Assign plan": "Attribuer la formule",
  "Subscription payments marked completed this month": "Paiements d’abonnement marqués terminés ce mois",
  "Organisations with an active plan": "Organisations avec formule active",
  "Active plans by price": "Formules actives par prix",
  "Free": "Gratuites",
  "Paid plan, not necessarily paid": "Payantes, sans paiement nécessairement enregistré",
  "Plan assignment does not count as a payment.": "L’attribution d’une formule ne constitue pas un paiement.",
  "Access is recorded and limited to authorised platform administrators.": "Accès réservé et journalisé pour les administrateurs autorisés.",
  "Account owner": "Propriétaire du compte", "Accounts by role": "Comptes par rôle", "Activation snapshot": "État des activations",
  "Active": "Actif", "Active plan rate": "Taux de formules actives", "Active plans": "Formules actives", "Active sites": "Boutiques actives",
  "Active subscriptions": "Abonnements actifs", "Activity snapshot": "Aperçu de l’activité", "Added": "Ajouté le", "Administrator sign in": "Connexion administrateur",
  "All orders": "Toutes les commandes", "All organisations created": "Toutes les organisations créées", "All statuses": "Tous les statuts",
  "Attention needed": "À examiner", "Audit": "Audit", "City not set": "Ville non renseignée", "Close": "Fermer",
  "Completed revenue · latest 20 payments": "Encaissements confirmés · 20 derniers paiements", "Continue securely": "Continuer en sécurité",
  "Current subscription": "Abonnement actuel", "Customers": "Clients", "Details": "Détails", "Email address": "Adresse e-mail",
  "Enable MFA": "Activer la double authentification", "Enter the six-digit code from your authenticator app.": "Saisissez le code à six chiffres de votre application d’authentification.",
  "Executive control centre": "Centre de pilotage", "Expired": "Expiré", "Expiring soon": "Échéance proche", "Expiring within 14 days": "Échéance sous 14 jours",
  "Focus on revenue, activation risk, renewals and audited platform activity.": "Suivez les revenus, les activations, les échéances et l’activité auditée de la plateforme.",
  "Inactive": "Inactif", "Joined": "Créée le", "Last order": "Dernière commande", "Latest audited actions across organisations. Administration remains read-only.": "Dernières actions auditées. L’administration reste en lecture seule.",
  "Loading organisation workspace": "Chargement de la fiche organisation", "Loading organisations": "Chargement des organisations", "Loading renewals…": "Chargement des échéances…",
  "Manage the platform without crossing subscriber boundaries.": "Pilotez la plateforme sans franchir les limites des organisations.",
  "MFA setup failed": "Échec de la configuration de la double authentification", "Monthly subscription revenue": "Revenus des abonnements du mois",
  "Monitor organisations, subscriptions, sites, and security activity from one controlled workspace.": "Suivez les organisations, les abonnements, les boutiques et la sécurité depuis un espace contrôlé.",
  "New customers · 30 days": "Nouveaux clients · 30 jours", "Next": "Suivant", "No audited activity yet.": "Aucune activité auditée.",
  "No email": "E-mail non renseigné", "No organisations match these filters.": "Aucune organisation ne correspond à ces filtres.",
  "No phone": "Téléphone non renseigné", "No plan": "Sans formule", "No renewals due in the next 14 days.": "Aucune échéance dans les 14 prochains jours.",
  "No sites registered.": "Aucune boutique enregistrée.", "No subscription payment recorded.": "Aucun paiement d’abonnement enregistré.",
  "No user accounts registered.": "Aucun compte utilisateur enregistré.", "Not set": "Non défini", "Only aggregate role counts are shown to minimise unnecessary exposure of personal data.": "Seuls les totaux par rôle sont affichés afin de limiter l’exposition des données personnelles.",
  "Operational receipts · 30 days": "Encaissements opérationnels · 30 jours", "Orders · 30 days": "Commandes · 30 jours",
  "Organisation": "Organisation", "Organisation audit activity": "Audit de l’organisation", "Organisation directory": "Annuaire des organisations",
  "Organisation workspace · read-only": "Fiche organisation · lecture seule", "Organisations": "Organisations", "Organisations requiring attention": "Organisations à examiner",
  "Organisations without plan": "Organisations sans formule", "Overview": "Vue d’ensemble", "Owner": "Propriétaire",
  "Owner and account": "Propriétaire et compte", "Owner, plan, footprint and renewal status in one place.": "Propriétaire, formule, boutiques et échéance au même endroit.",
  "Password": "Mot de passe", "Payments": "Paiements", "Plan": "Formule", "Plan / status": "Formule / statut", "Plan price": "Prix de la formule",
  "Platform administration": "Administration de la plateforme", "Platform health and subscriber growth": "Santé de la plateforme et croissance des abonnés",
  "Previous": "Précédent", "Priority queue": "Priorités", "Read-only boundary": "Accès en lecture seule", "Read-only controls": "Commandes en lecture seule",
  "Recent subscription payments": "Paiements d’abonnement récents", "Registered": "Inscrites", "Registered organisations": "Organisations inscrites",
  "Renewal": "Échéance", "Renewal date": "Date d’échéance", "Renewals": "Échéances", "Renewals due in 14 days": "Échéances sous 14 jours",
  "Renewals due within 14 days": "Échéances dans les 14 jours", "Request failed": "Échec de la requête",
  "Requires activation review": "Activation à examiner", "Restricted operations portal": "Portail d’administration sécurisé",
  "Scan this code with an authenticator app, then enter the current six-digit code.": "Scannez ce code avec une application d’authentification, puis saisissez le code à six chiffres.",
  "Search business or owner": "Rechercher une organisation ou un propriétaire", "Secure your account": "Sécurisez votre compte",
  "Security": "Sécurité", "Security and audit activity": "Sécurité et journal d’audit", "Separate registered organisations from organisations with active plans.": "Distinguez les organisations inscrites de celles ayant une formule active.",
  "Sign in failed": "Échec de la connexion", "Sign out": "Se déconnecter", "Sites": "Boutiques", "Sites / staff": "Boutiques / personnel",
  "Six-digit code": "Code à six chiffres", "Started": "Début", "Subscription": "Abonnement", "Successful payments shown": "Paiements réussis affichés",
  "Summary": "Résumé", "This workspace exposes operational evidence without plan changes, suspensions, impersonation or user-management actions.": "Cet espace présente les données opérationnelles sans modification des formules, suspension, usurpation ou gestion des utilisateurs.",
  "Trial": "Essai", "Users": "Utilisateurs", "User accounts": "Comptes utilisateurs", "Verification code": "Code de vérification",
  "Verification failed": "Échec de la vérification", "Verify and open portal": "Vérifier et ouvrir le portail", "View": "Voir",
  "Without plan": "Sans formule", "XpressPro Control": "XpressPro Pilotage",
  "Active subscriptions, soonest renewal first. Select an organisation for its subscription and payment history.": "Abonnements actifs, par date d’échéance. Ouvrez une organisation pour consulter son abonnement et ses paiements.",
  "Organisation created": "Organisation créée le", "Orders used": "Commandes utilisées",
  "Renews / ends": "Renouvellement / fin", "of registered": "des inscrites", "of": "sur", "renewals": "échéances", "organisations": "organisations",
  "View organisations expiring within 14 days": "Voir les organisations dont la formule expire sous 14 jours",
  "View organisations without plan": "Voir les organisations sans formule", "View subscription for": "Voir l’abonnement de",
  "Platform": "Plateforme", "System": "Système", "No audited organisation activity yet.": "Aucune activité auditée pour cette organisation.",
  "Cancelled": "Annulé", "Completed": "Terminé",
  "Use an account authorised for platform administration.": "Utilisez un compte autorisé à administrer la plateforme.",
  "Authenticator setup QR code": "QR code de configuration de l’authentification",
};

function adminText(english: string): string {
  return i18n.language.startsWith("fr") ? ADMIN_FR[english] || english : english;
}

function adminStatus(status: string | null | undefined): string {
  if (!status) return adminText("Inactive");
  const english: Record<string, string> = { active: "Active", trial: "Trial", expired: "Expired", cancelled: "Cancelled", inactive: "Inactive", completed: "Completed" };
  return adminText(english[status] || status);
}

function AdminLanguageSwitch({ dark = false }: { dark?: boolean }) {
  const { i18n: currentI18n } = useTranslation();
  const selected = currentI18n.language.startsWith("fr") ? "fr" : "en";
  return <div className={`inline-flex rounded-lg border p-1 ${dark ? "border-white/20 bg-white/5" : "border-slate-200 bg-slate-50"}`} role="group" aria-label="Language / Langue">
    {(["fr", "en"] as const).map(language => <button key={language} type="button" onClick={() => currentI18n.changeLanguage(language)} aria-pressed={selected === language} aria-label={language === "fr" ? "Français" : "English"}
      className={`min-h-9 min-w-11 rounded-md px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${selected === language ? "bg-cyan-400 text-slate-950" : dark ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-200"}`}>
      {language.toUpperCase()}
    </button>)}
  </div>;
}

async function apiJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || adminText('Request failed'));
  }
  return response.json();
}

function formatDate(value: string | null | undefined) {
  if (!value) return adminText('Not set');
  return new Intl.DateTimeFormat(i18n.language.startsWith("fr") ? "fr-FR" : undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value);
}

function AdminLogin({ initialStep = "credentials" }: { initialStep?: AdminAuthStep }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<AdminAuthStep>(initialStep);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string; qrCode: string } | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "enroll" || setup) return;
    fetch("/api/platform-admin/mfa/setup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message || adminText('MFA setup failed'));
        return payload as { secret: string; otpauthUri: string };
      })
      .then(async (payload) => setSetup({ ...payload, qrCode: await QRCode.toDataURL(payload.otpauthUri, { width: 220, margin: 1 }) }))
      .catch((error) => setSetupError(error instanceof Error ? error.message : adminText('MFA setup failed')));
  }, [setup, step]);

  const login = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/platform-admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || adminText('Sign in failed'));
      return payload;
    },
    onSuccess: (payload) => {
      setPassword("");
      setStep(payload.enrollmentRequired ? "enroll" : "verify");
    },
  });

  const verify = useMutation({
    mutationFn: async () => {
      const endpoint = step === "enroll" ? "/api/platform-admin/mfa/confirm" : "/api/platform-admin/mfa/verify";
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || adminText('Verification failed'));
      return payload;
    },
    onSuccess: () => window.location.reload(),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step === "credentials") login.mutate();
    else verify.mutate();
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white grid lg:grid-cols-[1.15fr_0.85fr]">
      <section className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-white/10 bg-[radial-gradient(circle_at_10%_20%,rgba(14,165,233,0.18),transparent_40%),linear-gradient(155deg,#081524,#0a1727_60%,#07111f)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-400 text-slate-950 grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display font-bold tracking-tight">XpressPro</p>
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">{adminText('Platform administration')}</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-cyan-300 text-sm font-semibold uppercase tracking-[0.18em] mb-5">{adminText('Restricted operations portal')}</p>
          <h1 className="font-display text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
            {adminText("Manage the platform without crossing subscriber boundaries.")}
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300 max-w-lg">
            {adminText("Monitor organisations, subscriptions, sites, and security activity from one controlled workspace.")}
          </p>
        </div>
        <p className="text-xs text-slate-500">{adminText('Access is recorded and limited to authorised platform administrators.')}</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-end"><AdminLanguageSwitch dark /></div>
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-cyan-400 text-slate-950 grid place-items-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display font-bold">XpressPro</p>
              <p className="text-xs text-slate-400">{adminText('Platform administration')}</p>
            </div>
          </div>
          <div className="mb-8">
            <Badge className="bg-cyan-400/10 text-cyan-300 border-cyan-400/20 hover:bg-cyan-400/10">
              superadmin.xpressclean.cm
            </Badge>
            <h2 className="font-display text-3xl font-bold mt-5">
              {step === "credentials" ? adminText('Administrator sign in') : step === "enroll" ? adminText('Secure your account') : adminText('Verification code')}
            </h2>
            <p className="text-slate-400 mt-2">
              {step === "credentials"
                ? adminText('Use an account authorised for platform administration.')
                : step === "enroll"
                  ? adminText('Scan this code with an authenticator app, then enter the current six-digit code.')
                  : adminText('Enter the six-digit code from your authenticator app.')}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            {step === "credentials" ? <>
            <div>
              <label htmlFor="admin-email" className="text-sm font-medium text-slate-300">{adminText('Email address')}</label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-cyan-400"
                placeholder="admin@xpressclean.cm"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="text-sm font-medium text-slate-300">{adminText('Password')}</label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 bg-white/5 border-white/10 text-white focus-visible:ring-cyan-400"
              />
            </div>
            </> : <>
              {step === "enroll" && setup && (
                <div className="rounded-xl border border-white/10 bg-white p-4 text-center">
                  <img src={setup.qrCode} alt={adminText('Authenticator setup QR code')} className="mx-auto h-[220px] w-[220px]" />
                  <p className="mt-3 break-all font-mono text-xs text-slate-700">{setup.secret}</p>
                </div>
              )}
              {step === "enroll" && !setup && !setupError && <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>}
              <div>
                <label htmlFor="admin-code" className="text-sm font-medium text-slate-300">{adminText('Six-digit code')}</label>
                <Input
                  id="admin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-2 h-12 bg-white/5 border-white/10 text-center text-xl tracking-[0.35em] text-white focus-visible:ring-cyan-400"
                  placeholder="000000"
                />
              </div>
            </>}
            {(setupError || login.error || verify.error) && (
              <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200" role="alert">
                {setupError || (login.error || verify.error)?.message}
              </p>
            )}
            <Button
              type="submit"
              disabled={login.isPending || verify.isPending || (step === "enroll" && !setup)}
              className="w-full h-12 bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-semibold"
            >
              {(login.isPending || verify.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              {step === "credentials" ? adminText('Continue securely') : step === "enroll" ? adminText('Enable MFA') : adminText('Verify and open portal')}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Building2 }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="font-display text-2xl font-bold tracking-tight text-slate-950 mt-2">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-700 grid place-items-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function statusTone(status: string | undefined) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "trial") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (status === "expired" || status === "cancelled") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function AdminDashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [segment, setSegment] = useState("all");
  const [page, setPage] = useState(0);
  const [renewalPage, setRenewalPage] = useState(0);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);

  const overview = useQuery<Overview>({
    queryKey: ["/api/platform-admin/overview"],
    queryFn: () => apiJson("/api/platform-admin/overview"),
  });
  const preview = useQuery<SubscriberPage>({
    queryKey: ["/api/platform-admin/subscribers", "preview", searchTerm],
    queryFn: () => apiJson(`/api/platform-admin/subscribers?limit=8&search=${encodeURIComponent(searchTerm)}`),
  });
  const subscribers = useQuery<SubscriberPage>({
    queryKey: ["/api/platform-admin/subscribers", searchTerm, segment, page],
    queryFn: () => apiJson(`/api/platform-admin/subscribers?limit=25&offset=${page * 25}&search=${encodeURIComponent(searchTerm)}&segment=${encodeURIComponent(segment)}`),
  });
  const renewals = useQuery<SubscriberPage>({
    queryKey: ["/api/platform-admin/subscribers", "renewals", renewalPage],
    queryFn: () => apiJson(`/api/platform-admin/subscribers?limit=25&offset=${renewalPage * 25}&segment=expiring`),
    enabled: activeTab === "renewals",
  });
  const auditEvents = useQuery<AuditEvent[]>({
    queryKey: ["/api/platform-admin/audit-events"],
    queryFn: () => apiJson("/api/platform-admin/audit-events?limit=12"),
  });

  const metrics = overview.data;
  const organisations = subscribers.data?.items ?? [];
  const activePlanRate = metrics ? (metrics.organisationCount ? Math.round((metrics.activeSubscriptionCount / metrics.organisationCount) * 100) : 0) : null;
  const noPlanCount = metrics?.withoutPlanCount;
  const riskCount = metrics ? metrics.withoutPlanCount + metrics.expiringSoonCount : null;
  const submitSearch = () => { setPage(0); setSearchTerm(search.trim()); };
  const changeSegment = (value: string) => { setPage(0); setSegment(value); };
  const openPrioritySegment = (value: "expiring" | "no-plan") => {
    setSearch("");
    setSearchTerm("");
    changeSegment(value);
    setActiveTab("organisations");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-cyan-300"><ShieldCheck className="h-5 w-5" /></div>
            <div><p className="font-display font-bold leading-tight">{adminText('XpressPro Control')}</p><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{adminText('Platform administration')}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <AdminLanguageSwitch />
            <Badge variant="outline" className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 sm:flex"><span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />{adminText('Read-only controls')}</Badge>
            <Avatar className="hidden h-9 w-9 border border-slate-200 sm:flex"><AvatarFallback className="bg-slate-100 text-xs font-bold">SA</AvatarFallback></Avatar>
            <Button variant="ghost" size="icon" onClick={() => logout()} aria-label={adminText('Sign out')}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-semibold text-cyan-700">{adminText('Executive control centre')}</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{adminText('Platform health and subscriber growth')}</h1><p className="mt-2 max-w-2xl text-slate-500">{adminText('Focus on revenue, activation risk, renewals and audited platform activity.')}</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex"><div className="rounded-xl border border-slate-200 bg-white px-4 py-2"><p className="text-xs text-slate-500">{adminText('Active plan rate')}</p><p className="font-bold">{activePlanRate === null ? "—" : `${activePlanRate}%`}</p></div><div className="rounded-xl border border-slate-200 bg-white px-4 py-2"><p className="text-xs text-slate-500">{adminText('Attention needed')}</p><p className="font-bold text-amber-700">{riskCount ?? "—"}</p></div></div>
        </div>

        {overview.error && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{overview.error.message}</p>}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-7">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 sm:w-fit">
            <TabsTrigger value="overview" className="gap-2"><BarChart3 className="h-4 w-4" />{adminText('Overview')}</TabsTrigger>
            <TabsTrigger value="organisations" className="gap-2"><Building2 className="h-4 w-4" />{adminText('Organisations')}</TabsTrigger>
            <TabsTrigger value="renewals" className="gap-2"><CalendarClock className="h-4 w-4" />{adminText('Renewals')}</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><ShieldCheck className="h-4 w-4" />{adminText('Security')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={adminText('Subscription payments marked completed this month')} value={metrics ? formatMoney(metrics.subscriptionRevenueMonth) : "—"} icon={Activity} />
              <MetricCard label={adminText('Organisations with an active plan')} value={metrics?.activeSubscriptionCount ?? "—"} icon={CreditCard} />
              <MetricCard label={adminText('Registered organisations')} value={metrics?.organisationCount ?? "—"} icon={Building2} />
              <MetricCard label={adminText('Renewals due in 14 days')} value={metrics?.expiringSoonCount ?? "—"} icon={CalendarClock} />
            </section>
            {metrics && <p className="-mt-3 text-sm text-slate-500">{adminText('Active plans by price')}: {adminText('Free')} {metrics.activeFreePlanCount} · {adminText('Paid plan, not necessarily paid')} {metrics.activePaidPlanCount}. {adminText('Plan assignment does not count as a payment.')}</p>}

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader><CardTitle className="text-lg">{adminText('Activation snapshot')}</CardTitle><p className="text-sm text-slate-500">{adminText('Separate registered organisations from organisations with active plans.')}</p></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-400">{adminText('Registered')}</p><p className="mt-2 text-3xl font-bold">{metrics?.organisationCount ?? "—"}</p><p className="mt-2 text-xs text-slate-400">{adminText('All organisations created')}</p></div>
                  <div className="rounded-xl bg-emerald-50 p-5"><p className="text-sm text-emerald-700">{adminText('Active plans')}</p><p className="mt-2 text-3xl font-bold text-emerald-950">{metrics?.activeSubscriptionCount ?? "—"}</p><p className="mt-2 text-xs text-emerald-700">{activePlanRate === null ? "—" : `${activePlanRate}%`} {adminText("of registered")}</p></div>
                  <div className="rounded-xl bg-amber-50 p-5"><p className="text-sm text-amber-700">{adminText('Without plan')}</p><p className="mt-2 text-3xl font-bold text-amber-950">{noPlanCount ?? "—"}</p><p className="mt-2 text-xs text-amber-700">{adminText('Requires activation review')}</p></div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
                <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-amber-600" />{adminText('Priority queue')}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <button type="button" onClick={() => openPrioritySegment("expiring")} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" aria-label={adminText("View organisations expiring within 14 days")}>
                    <span>{adminText('Expiring within 14 days')}</span><span className="flex items-center gap-2"><strong>{metrics?.expiringSoonCount ?? "—"}</strong><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                  </button>
                  <button type="button" onClick={() => openPrioritySegment("no-plan")} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" aria-label={adminText("View organisations without plan")}>
                    <span>{adminText('Organisations without plan')}</span><span className="flex items-center gap-2"><strong>{noPlanCount ?? "—"}</strong><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                  </button>
                </CardContent>
              </Card>
            </section>

            <OrganisationDirectory loading={preview.isLoading} error={preview.error as Error | null} organisations={preview.data?.items ?? []} search={search} setSearch={setSearch} submitSearch={submitSearch} segment="all" setSegment={changeSegment} select={setSelectedSubscriber} compact />
          </TabsContent>

          <TabsContent value="organisations" className="mt-5">
            <OrganisationDirectory loading={subscribers.isLoading} error={subscribers.error as Error | null} organisations={organisations} search={search} setSearch={setSearch} submitSearch={submitSearch} segment={segment} setSegment={changeSegment} select={setSelectedSubscriber} page={page} total={subscribers.data?.total ?? 0} pageSize={25} onPageChange={setPage} />
          </TabsContent>

          <TabsContent value="renewals" className="mt-5">
            <Card className="overflow-hidden border-slate-200/80 shadow-sm">
              <CardHeader><CardTitle className="text-lg">{adminText('Renewals due within 14 days')}</CardTitle><p className="text-sm text-slate-500">{adminText('Active subscriptions, soonest renewal first. Select an organisation for its subscription and payment history.')}</p></CardHeader>
              <CardContent className="p-0">
                {renewals.error && <p className="p-6 text-sm text-red-600" role="alert">{renewals.error.message}</p>}
                <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">{adminText('Renewal date')}</th><th className="px-5 py-3">{adminText('Organisation')}</th><th className="px-5 py-3">{adminText('Owner')}</th><th className="px-5 py-3">{adminText('Plan')}</th><th className="px-5 py-3 text-right">{adminText('Details')}</th></tr></thead><tbody className="divide-y divide-slate-100">
                  {renewals.isLoading && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">{adminText('Loading renewals…')}</td></tr>}
                  {!renewals.isLoading && !renewals.error && renewals.data?.items.map(item => <tr key={item.id}><td className="whitespace-nowrap px-5 py-4 font-semibold text-amber-800">{formatDate(item.subscription?.endDate)}</td><td className="px-5 py-4 font-medium">{item.name}</td><td className="px-5 py-4 text-slate-600">{[item.owner.firstName, item.owner.lastName].filter(Boolean).join(" ") || item.owner.email || "—"}</td><td className="px-5 py-4">{item.subscription?.planName || "—"}</td><td className="px-5 py-4 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => setSelectedSubscriber(item)} aria-label={`${adminText("View subscription for")} ${item.name}`}>{adminText('View')} <ArrowRight className="ml-1 h-4 w-4" /></Button></td></tr>)}
                  {!renewals.isLoading && !renewals.error && !renewals.data?.items.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">{adminText('No renewals due in the next 14 days.')}</td></tr>}
                </tbody></table></div>
                {!!renewals.data?.total && <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-600"><span>{renewalPage * 25 + 1}–{Math.min((renewalPage + 1) * 25, renewals.data.total)} {adminText("of")} {renewals.data.total} {adminText("renewals")}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={renewalPage === 0} onClick={() => setRenewalPage(value => value - 1)}>{adminText('Previous')}</Button><Button type="button" variant="outline" size="sm" disabled={(renewalPage + 1) * 25 >= renewals.data.total} onClick={() => setRenewalPage(value => value + 1)}>{adminText('Next')}</Button></div></div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-5">
            <Card className="border-slate-200/80 shadow-sm"><CardHeader><CardTitle>{adminText('Security and audit activity')}</CardTitle><p className="text-sm text-slate-500">{adminText('Latest audited actions across organisations. Administration remains read-only.')}</p></CardHeader><CardContent className="divide-y divide-slate-100 p-0">{auditEvents.isLoading && <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>}{auditEvents.error && <p className="p-6 text-sm text-red-600">{auditEvents.error.message}</p>}{auditEvents.data?.map((event) => <div key={event.id} className="grid gap-2 px-6 py-4 sm:grid-cols-[1fr_220px_140px] sm:items-center"><div><p className="font-semibold capitalize">{event.action.replaceAll(".", " ")}</p><p className="mt-1 text-xs text-slate-500">{event.targetType}{event.targetId ? ` · ${event.targetId}` : ""}</p></div><p className="text-sm text-slate-600">{event.organisationName || adminText("Platform")}<br/><span className="text-xs text-slate-400">{event.actorEmail || adminText("System")}</span></p><p className="text-xs text-slate-500 sm:text-right">{formatDate(event.createdAt)}</p></div>)}{!auditEvents.isLoading && !auditEvents.data?.length && <p className="p-8 text-center text-sm text-slate-500">{adminText('No audited activity yet.')}</p>}</CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>

      {selectedSubscriber && <OrganisationPanel subscriber={selectedSubscriber} close={() => setSelectedSubscriber(null)} />}
    </div>
  );
}

function OrganisationDirectory({ loading, error, organisations, search, setSearch, submitSearch, segment, setSegment, select, compact = false, page = 0, total = 0, pageSize = 25, onPageChange }: { loading: boolean; error: Error | null; organisations: Subscriber[]; search: string; setSearch: (value: string) => void; submitSearch: () => void; segment: string; setSegment: (value: string) => void; select: (subscriber: Subscriber) => void; compact?: boolean; page?: number; total?: number; pageSize?: number; onPageChange?: (page: number) => void }) {
  return <Card className="overflow-hidden border-slate-200/80 shadow-sm"><CardHeader className="border-b border-slate-100"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><CardTitle className="text-lg">{compact ? adminText('Organisations requiring attention') : adminText('Organisation directory')}</CardTitle><p className="mt-1 text-sm text-slate-500">{adminText('Owner, plan, footprint and renewal status in one place.')}</p></div><div className="flex flex-col gap-2 sm:flex-row"><form className="relative w-full sm:w-80" onSubmit={(event) => { event.preventDefault(); submitSearch(); }}><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder={adminText('Search business or owner')} /></form>{!compact && <select value={segment} onChange={(event) => setSegment(event.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="all">{adminText('All statuses')}</option><option value="active">{adminText('Active')}</option><option value="trial">{adminText('Trial')}</option><option value="expiring">{adminText('Expiring soon')}</option><option value="no-plan">{adminText('No plan')}</option><option value="expired">{adminText('Expired')}</option></select>}</div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">{adminText('Organisation')}</th><th className="px-5 py-3">{adminText('Owner')}</th><th className="px-5 py-3">{adminText('Plan / status')}</th><th className="px-5 py-3">{adminText('Sites / staff')}</th><th className="px-5 py-3">{adminText('Renewal')}</th><th className="px-5 py-3 text-right">{adminText('Details')}</th></tr></thead><tbody className="divide-y divide-slate-100">{loading && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin"/>{adminText('Loading organisations')}</td></tr>}{!loading && error && <tr><td colSpan={6} className="px-5 py-10 text-center text-red-600">{error.message}</td></tr>}{!loading && !error && organisations.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">{adminText('No organisations match these filters.')}</td></tr>}{!loading && !error && organisations.map((subscriber) => { const ownerName = [subscriber.owner.firstName, subscriber.owner.lastName].filter(Boolean).join(" ") || adminText('Account owner'); return <tr key={subscriber.id} className="hover:bg-slate-50/80"><td className="px-5 py-4"><p className="font-semibold">{subscriber.name}</p><p className="mt-1 text-xs text-slate-500">{adminText("Joined")} {formatDate(subscriber.createdAt)}</p></td><td className="px-5 py-4"><p className="font-medium">{ownerName}</p><p className="mt-1 text-xs text-slate-500">{subscriber.owner.email || adminText('No email')}</p></td><td className="px-5 py-4"><Badge variant="outline" className={statusTone(subscriber.subscription?.status)}>{subscriber.subscription?.planName || adminText('No plan')}</Badge><p className="mt-1 text-xs capitalize text-slate-500">{adminStatus(subscriber.subscription?.status)}</p></td><td className="px-5 py-4 text-slate-600">{subscriber.siteCount} / {subscriber.staffCount}</td><td className="px-5 py-4 text-slate-600">{formatDate(subscriber.subscription?.endDate)}</td><td className="px-5 py-4 text-right"><Button variant="ghost" size="sm" onClick={() => select(subscriber)}>{adminText('View')} <ArrowRight className="ml-1 h-4 w-4"/></Button></td></tr>; })}</tbody></table></div>{!compact && !loading && !error && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600"><span>{total === 0 ? `0 ${adminText("organisations")}` : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} ${adminText("of")} ${total} ${adminText("organisations")}`}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange?.(page - 1)}>{adminText('Previous')}</Button><Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => onPageChange?.(page + 1)}>{adminText('Next')}</Button></div></div>}</CardContent></Card>;
}

function OrganisationPanel({ subscriber, close }: { subscriber: Subscriber; close: () => void }) {
  const ownerName = [subscriber.owner.firstName, subscriber.owner.lastName].filter(Boolean).join(" ") || adminText('Account owner');
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const plans = useQuery<AdminPlan[]>({
    queryKey: ["/api/platform-admin/plans"],
    queryFn: () => apiJson("/api/platform-admin/plans"),
  });
  const detail = useQuery<OrganisationDetail>({
    queryKey: ["/api/platform-admin/organisations", subscriber.id],
    queryFn: () => apiJson(`/api/platform-admin/organisations/${subscriber.id}`),
  });
  const assignPlan = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/platform-admin/organisations/${subscriber.id}/plan`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: Number(planId), endDate, reason: reason.trim(), expectedSubscriptionId: detail.data?.subscription?.id ?? null }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || adminText('Plan assignment failed'));
      return result;
    },
    onSuccess: async () => {
      setPlanId(""); setEndDate(""); setReason("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/overview"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/subscribers"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/organisations", subscriber.id] }),
      ]);
    },
  });
  const submitPlan = (event: FormEvent) => {
    event.preventDefault();
    const selected = plans.data?.find((plan) => plan.id === Number(planId));
    if (!selected || !detail.data || reason.trim().length < 10 || !endDate) return;
    if (window.confirm(`${adminText('Confirm plan assignment')}\n${subscriber.name} → ${selected.name}\n${adminText('Ends')}: ${endDate}\n${adminText('No payment will be recorded.')}`)) assignPlan.mutate();
  };

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onClick={close}>
    <aside className="h-full w-full max-w-4xl overflow-y-auto bg-white shadow-2xl sm:my-5 sm:h-auto sm:max-h-[calc(100vh-2.5rem)] sm:self-start sm:rounded-l-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">{adminText('Organisation workspace')}</p><h2 className="mt-1 text-xl font-bold">{subscriber.name}</h2></div>
        <Button variant="ghost" onClick={close}>{adminText('Close')}</Button>
      </div>

      {detail.isLoading && <div className="grid min-h-[220px] place-items-center text-slate-500"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin"/><p className="mt-3 text-sm">{adminText('Loading organisation workspace')}</p></div></div>}
      {detail.error && <div className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{detail.error.message}</div>}
      {detail.data && <div className="space-y-6 p-5 sm:p-7">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PanelMetric icon={Store} label={adminText('Active sites')} value={detail.data.footprint.sites.filter((site) => site.active).length} />
          <PanelMetric icon={Users} label={adminText('User accounts')} value={detail.data.footprint.roles.reduce((total, role) => total + role.count, 0)} />
          <PanelMetric icon={Activity} label={adminText('Orders · 30 days')} value={detail.data.usage.ordersLast30Days} />
          <PanelMetric icon={CircleDollarSign} label={adminText('Operational receipts · 30 days')} value={formatMoney(detail.data.usage.revenueLast30Days)} />
        </section>

        <Tabs defaultValue="summary">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1">
            <TabsTrigger value="summary">{adminText('Summary')}</TabsTrigger><TabsTrigger value="subscription">{adminText('Subscription')}</TabsTrigger><TabsTrigger value="sites">{adminText('Sites')}</TabsTrigger><TabsTrigger value="users">{adminText('Users')}</TabsTrigger><TabsTrigger value="payments">{adminText('Payments')}</TabsTrigger><TabsTrigger value="audit">{adminText('Audit')}</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-5 space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <PanelSection title={adminText('Owner and account')}>
                <p className="font-semibold">{ownerName}</p><p className="mt-1 text-sm text-slate-500">{detail.data.owner.email || adminText('No email')}</p><p className="mt-1 text-sm text-slate-500">{detail.data.owner.phone || adminText('No phone')}</p><p className="mt-4 text-xs text-slate-400">{adminText("Organisation created")} {formatDate(detail.data.createdAt)}</p>
              </PanelSection>
              <PanelSection title={adminText('Activity snapshot')}>
                <dl className="grid grid-cols-2 gap-4 text-sm"><PanelDatum label={adminText('All orders')} value={detail.data.usage.orderCount}/><PanelDatum label={adminText('Last order')} value={formatDate(detail.data.usage.lastOrderAt)}/><PanelDatum label={adminText('Customers')} value={detail.data.usage.customerCount}/><PanelDatum label={adminText('New customers · 30 days')} value={detail.data.usage.customersLast30Days}/></dl>
              </PanelSection>
            </div>
            <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><p className="text-sm font-semibold text-cyan-900">{adminText('Controlled administration')}</p><p className="mt-1 text-sm text-cyan-800">{adminText('Only plan assignment is editable here. It is audited and does not record a payment. Other operational data remains read-only.')}</p></section>
          </TabsContent>

          <TabsContent value="subscription" className="mt-5">
            <PanelSection title={adminText('Current subscription')}>
              <div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className={statusTone(detail.data.subscription?.status)}>{detail.data.subscription?.planName || adminText('No plan')}</Badge><span className="text-sm capitalize text-slate-500">{adminStatus(detail.data.subscription?.status)}</span></div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><PanelDatum label={adminText('Plan price')} value={detail.data.subscription ? formatMoney(detail.data.subscription.planPrice) : "—"}/><PanelDatum label={adminText("Orders used")} value={detail.data.subscription?.ordersUsed ?? "—"}/><PanelDatum label={adminText('Started')} value={formatDate(detail.data.subscription?.startDate)}/><PanelDatum label={adminText("Renews / ends")} value={formatDate(detail.data.subscription?.endDate)}/></dl>
            </PanelSection>
            <PanelSection title={adminText('Assign a plan manually')}>
              <form onSubmit={submitPlan} className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">{adminText('Plan')}<select className="h-10 rounded-md border border-slate-300 px-3" value={planId} onChange={(event) => setPlanId(event.target.value)} required><option value="">{adminText('Select a plan')}</option>{plans.data?.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {formatMoney(plan.price)}</option>)}</select></label>
                <label className="grid gap-1 text-sm">{adminText('End date')}<Input type="date" value={endDate} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(event) => setEndDate(event.target.value)} required /></label>
                <label className="grid gap-1 text-sm sm:col-span-2">{adminText('Reason')}<Input value={reason} minLength={10} maxLength={500} onChange={(event) => setReason(event.target.value)} required placeholder={adminText('Reason for manual assignment')} /></label>
                <p className="text-xs text-slate-500 sm:col-span-2">{adminText('The previous active plan will end. No payment will be recorded.')}</p>
                {plans.error && <p className="text-sm text-red-700 sm:col-span-2">{plans.error.message}</p>}
                {assignPlan.error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{assignPlan.error.message}</p>}
                {assignPlan.isSuccess && <p role="status" className="text-sm text-emerald-700 sm:col-span-2">{adminText('Plan assigned successfully. No payment recorded.')}</p>}
                <Button type="submit" disabled={assignPlan.isPending || !plans.data?.length || !detail.data}>{assignPlan.isPending ? adminText('Saving…') : adminText('Assign plan')}</Button>
              </form>
            </PanelSection>
            <SandboxCheckoutPanel organisationId={subscriber.id} />
          </TabsContent>

          <TabsContent value="sites" className="mt-5"><PanelSection title={`${adminText("Sites")} (${detail.data.footprint.sites.length})`}><div className="divide-y divide-slate-100">{detail.data.footprint.sites.map((site) => <div key={site.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-medium">{site.name}</p><p className="text-xs text-slate-500">{site.city || adminText('City not set')} · {adminText("Added")} {formatDate(site.createdAt)}</p></div><Badge variant="outline" className={site.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{site.active ? adminText('Active') : adminText('Inactive')}</Badge></div>)}{!detail.data.footprint.sites.length && <EmptyPanel text={adminText('No sites registered.')}/>}</div></PanelSection></TabsContent>

          <TabsContent value="users" className="mt-5"><PanelSection title={adminText('Accounts by role')}><div className="grid gap-3 sm:grid-cols-2">{detail.data.footprint.roles.map((role) => <div key={role.role} className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span className="font-medium capitalize">{role.role.replaceAll("_", " ")}</span><strong>{role.count}</strong></div>)}{!detail.data.footprint.roles.length && <EmptyPanel text={adminText('No user accounts registered.')}/>}</div><p className="mt-5 text-xs text-slate-400">{adminText('Only aggregate role counts are shown to minimise unnecessary exposure of personal data.')}</p></PanelSection></TabsContent>

          <TabsContent value="payments" className="mt-5 space-y-5">
            <section className="grid gap-3 sm:grid-cols-2"><PanelMetric icon={CircleDollarSign} label={adminText('Completed revenue · latest 20 payments')} value={formatMoney(detail.data.billing.completedRevenue)}/><PanelMetric icon={CreditCard} label={adminText('Successful payments shown')} value={detail.data.billing.successfulPaymentCount}/></section>
            <PanelSection title={adminText('Recent subscription payments')}><div className="divide-y divide-slate-100">{detail.data.billing.payments.map((payment) => <div key={payment.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_150px_100px] sm:items-center"><div><p className="font-medium">{payment.planName}</p><p className="text-xs text-slate-500">{payment.method} · {formatDate(payment.createdAt)}</p></div><p className="font-semibold sm:text-right">{formatMoney(payment.amount)}</p><Badge variant="outline" className={`${statusTone(payment.status)} justify-self-start capitalize sm:justify-self-end`}>{adminStatus(payment.status)}</Badge></div>)}{!detail.data.billing.payments.length && <EmptyPanel text={adminText('No subscription payment recorded.')}/>}</div></PanelSection>
          </TabsContent>

          <TabsContent value="audit" className="mt-5"><PanelSection title={adminText('Organisation audit activity')}><div className="divide-y divide-slate-100">{detail.data.audit.map((event) => <div key={event.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_180px] sm:items-center"><div><p className="font-medium capitalize">{event.action.replaceAll(".", " ")}</p><p className="text-xs text-slate-500">{event.targetType}{event.targetId ? ` · ${event.targetId}` : ""} · {event.actorEmail || adminText("System")}</p></div><p className="text-xs text-slate-500 sm:text-right">{formatDate(event.createdAt)}</p></div>)}{!detail.data.audit.length && <EmptyPanel text={adminText("No audited organisation activity yet.")}/>}</div></PanelSection></TabsContent>
        </Tabs>
      </div>}
    </aside>
  </div>;
}

function SandboxCheckoutPanel({ organisationId }: { organisationId: number }) {
  const queryClient = useQueryClient();
  const [lastCheck, setLastCheck] = useState<{ status: string; callbackReceivedAt: string | null; checkedAt: string } | null>(null);
  const [lastLocalRefresh, setLastLocalRefresh] = useState<string | null>(null);
  const queryKey = ["/api/platform-admin/pawapay-sandbox-checkouts", organisationId];
  const checkouts = useQuery<SandboxCheckout[]>({
    queryKey,
    queryFn: () => apiJson(`/api/platform-admin/pawapay-sandbox-checkouts?organisationId=${organisationId}`),
  });
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/platform-admin/organisations/${organisationId}/pawapay-sandbox-checkouts`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || adminText('Sandbox checkout failed'));
      return result as { checkoutId: string; redirectUrl: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const refreshProvider = useMutation({
    mutationFn: async (checkoutId: string) => {
      const response = await fetch(`/api/platform-admin/pawapay-sandbox-checkouts/${checkoutId}/refresh`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || adminText('Sandbox checkout failed'));
      return result;
    },
    onSuccess: (result: { status: string; callbackReceivedAt: string | null }) => {
      setLastCheck({ ...result, checkedAt: new Date().toLocaleTimeString() });
      queryClient.invalidateQueries({ queryKey });
    },
  });
  return <PanelSection title={adminText('PawaPay sandbox test')}>
    <p className="mb-4 text-sm text-slate-600">{adminText('This 1,000 FCFA sandbox checkout does not activate a plan or record a real payment.')}</p>
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? adminText('Creating…') : adminText('Create test checkout')}</Button>
      <Button type="button" variant="ghost" disabled={checkouts.isFetching} onClick={async () => { await checkouts.refetch(); setLastLocalRefresh(new Date().toLocaleTimeString()); }}>{checkouts.isFetching ? adminText('Loading…') : adminText('Refresh status')}</Button>
      <Button type="button" variant="ghost" disabled={!checkouts.data?.length || refreshProvider.isPending} onClick={() => checkouts.data?.[0] && refreshProvider.mutate(checkouts.data[0].checkoutId)}>{refreshProvider.isPending ? adminText('Checking…') : adminText('Check with PawaPay')}</Button>
    </div>
    {create.error && <p role="alert" className="mt-3 text-sm text-red-700">{create.error.message}</p>}
    {checkouts.error && <p role="alert" className="mt-3 text-sm text-red-700">{checkouts.error.message}</p>}
    {lastLocalRefresh && !checkouts.error && <p role="status" className="mt-3 text-sm text-slate-700">{adminText('Status refreshed')} · {lastLocalRefresh}</p>}
    {refreshProvider.error && <p role="alert" className="mt-3 text-sm text-red-700">{refreshProvider.error.message}</p>}
    {lastCheck && <p role="status" className="mt-3 text-sm text-slate-700">{adminText('PawaPay check')}: <strong>{lastCheck.status}</strong> · {lastCheck.checkedAt} · {lastCheck.callbackReceivedAt ? adminText('Signed callback received') : adminText('No signed callback received')}</p>}
    {create.data?.redirectUrl && <a href={create.data.redirectUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-cyan-700 underline">{adminText('Open PawaPay sandbox checkout')}</a>}
    <div className="mt-4 divide-y divide-slate-100">{checkouts.data?.map((checkout) => <div key={checkout.checkoutId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div><strong>{checkout.status}</strong><p className="text-xs text-slate-500">{checkout.checkoutId} · {formatDate(checkout.createdAt)}</p></div>
      {checkout.redirectUrl && <a href={checkout.redirectUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-cyan-700 underline">{adminText('Open test')}</a>}
    </div>)}</div>
  </PanelSection>;
}

function PanelMetric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><Icon className="h-4 w-4 text-cyan-700"/><p className="mt-3 break-words text-xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">{title}</h3><div className="mt-4">{children}</div></section>;
}

function PanelDatum({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-950">{value}</dd></div>;
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="py-4 text-center text-sm text-slate-500"><FileClock className="mx-auto mb-2 h-5 w-5 text-slate-400"/>{text}</div>;
}

export default function PlatformAdminPage() {
  useTranslation();
  const { logout } = useAuth();
  const status = useQuery<AdminStatus>({
    queryKey: ["/api/platform-admin/status"],
    queryFn: () => apiJson("/api/platform-admin/status"),
    retry: false,
    staleTime: 0,
  });

  if (status.isLoading) {
    return <div className="min-h-screen bg-slate-950 text-cyan-300 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!status.data?.isPlatformAdmin) return <AdminLogin />;
  if (!status.data.mfaVerified) {
    return <AdminLogin initialStep={status.data.pendingAuthentication ? (status.data.mfaEnrolled ? "verify" : "enroll") : "credentials"} />;
  }
  return <AdminDashboard />;
}
