import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CalendarClock,
  CreditCard,
  Loader2,
  LockKeyhole,
  LogOut,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import QRCode from "qrcode";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Overview = {
  organisationCount: number;
  activeSiteCount: number;
  userCount: number;
  staffCount: number;
  activeSubscriptionCount: number;
  subscriptionRevenueMonth: number;
  expiringSoonCount: number;
};

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

type AuditEvent = {
  id: number;
  organisationName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
};

type AdminStatus = {
  isPlatformAdmin: boolean;
  mfaEnrolled: boolean;
  mfaVerified: boolean;
  pendingAuthentication: boolean;
};

type AdminAuthStep = "credentials" | "enroll" | "verify";

async function apiJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || "Request failed");
  }
  return response.json();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
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
        if (!response.ok) throw new Error(payload?.message || "MFA setup failed");
        return payload as { secret: string; otpauthUri: string };
      })
      .then(async (payload) => setSetup({ ...payload, qrCode: await QRCode.toDataURL(payload.otpauthUri, { width: 220, margin: 1 }) }))
      .catch((error) => setSetupError(error instanceof Error ? error.message : "MFA setup failed"));
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
      if (!response.ok) throw new Error(payload?.message || "Sign in failed");
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
      if (!response.ok) throw new Error(payload?.message || "Verification failed");
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
            <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">Platform administration</p>
          </div>
        </div>
        <div className="max-w-xl">
          <p className="text-cyan-300 text-sm font-semibold uppercase tracking-[0.18em] mb-5">Restricted operations portal</p>
          <h1 className="font-display text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
            Manage the platform without crossing subscriber boundaries.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300 max-w-lg">
            Monitor organisations, subscriptions, sites, and security activity from one controlled workspace.
          </p>
        </div>
        <p className="text-xs text-slate-500">Access is recorded and limited to authorised platform administrators.</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-cyan-400 text-slate-950 grid place-items-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display font-bold">XpressPro</p>
              <p className="text-xs text-slate-400">Platform administration</p>
            </div>
          </div>
          <div className="mb-8">
            <Badge className="bg-cyan-400/10 text-cyan-300 border-cyan-400/20 hover:bg-cyan-400/10">
              superadmin.xpressclean.cm
            </Badge>
            <h2 className="font-display text-3xl font-bold mt-5">
              {step === "credentials" ? "Administrator sign in" : step === "enroll" ? "Secure your account" : "Verification code"}
            </h2>
            <p className="text-slate-400 mt-2">
              {step === "credentials"
                ? "Use an account authorised for platform administration."
                : step === "enroll"
                  ? "Scan this code with an authenticator app, then enter the current six-digit code."
                  : "Enter the six-digit code from your authenticator app."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            {step === "credentials" ? <>
            <div>
              <label htmlFor="admin-email" className="text-sm font-medium text-slate-300">Email address</label>
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
              <label htmlFor="admin-password" className="text-sm font-medium text-slate-300">Password</label>
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
                  <img src={setup.qrCode} alt="Authenticator setup QR code" className="mx-auto h-[220px] w-[220px]" />
                  <p className="mt-3 break-all font-mono text-xs text-slate-700">{setup.secret}</p>
                </div>
              )}
              {step === "enroll" && !setup && !setupError && <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cyan-300" /></div>}
              <div>
                <label htmlFor="admin-code" className="text-sm font-medium text-slate-300">Six-digit code</label>
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
              {step === "credentials" ? "Continue securely" : step === "enroll" ? "Enable MFA" : "Verify and open portal"}
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

function AdminDashboard() {
  const { logout } = useAuth();
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const overview = useQuery<Overview>({
    queryKey: ["/api/platform-admin/overview"],
    queryFn: () => apiJson("/api/platform-admin/overview"),
  });
  const subscribers = useQuery<Subscriber[]>({
    queryKey: ["/api/platform-admin/subscribers", searchTerm],
    queryFn: () => apiJson(`/api/platform-admin/subscribers?search=${encodeURIComponent(searchTerm)}`),
  });
  const auditEvents = useQuery<AuditEvent[]>({
    queryKey: ["/api/platform-admin/audit-events"],
    queryFn: () => apiJson("/api/platform-admin/audit-events?limit=8"),
  });

  const metrics = overview.data;
  const loading = overview.isLoading || subscribers.isLoading;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-950 text-cyan-300 grid place-items-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display font-bold leading-tight">XpressPro Control</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Platform administration</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-slate-200">
              <AvatarFallback className="bg-slate-100 text-xs font-bold">SA</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={() => logout()} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Platform overview</p>
            <h1 className="font-display text-3xl font-bold tracking-tight mt-1">Subscriber operations</h1>
            <p className="text-slate-500 mt-2">Monitor organisations, subscriptions, and security activity.</p>
          </div>
          <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Read-only administration
          </Badge>
        </div>

        {overview.error && (
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            {overview.error.message}
          </p>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Subscriber organisations" value={metrics?.organisationCount ?? "—"} icon={Building2} />
          <MetricCard label="Active sites" value={metrics?.activeSiteCount ?? "—"} icon={Store} />
          <MetricCard label="Active subscriptions" value={metrics?.activeSubscriptionCount ?? "—"} icon={CreditCard} />
          <MetricCard label="Subscription revenue this month" value={metrics ? formatMoney(metrics.subscriptionRevenueMonth) : "—"} icon={Activity} />
          <MetricCard label="Platform users" value={metrics?.userCount ?? "—"} icon={Users} />
          <MetricCard label="Staff accounts" value={metrics?.staffCount ?? "—"} icon={Users} />
          <MetricCard label="Expiring in 14 days" value={metrics?.expiringSoonCount ?? "—"} icon={CalendarClock} />
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="border-slate-200/80 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Subscribers</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Organisation owners and current subscription status</p>
                </div>
                <form
                  className="relative w-full md:w-80"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearchTerm(search.trim());
                  }}
                >
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Search business or owner"
                    aria-label="Search subscribers"
                  />
                </form>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Organisation</th>
                      <th className="px-5 py-3 font-semibold">Owner</th>
                      <th className="px-5 py-3 font-semibold">Plan</th>
                      <th className="px-5 py-3 font-semibold">Sites / staff</th>
                      <th className="px-5 py-3 font-semibold">Renewal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && (
                      <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading subscribers</td></tr>
                    )}
                    {!loading && subscribers.error && (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-red-600">{subscribers.error.message}</td></tr>
                    )}
                    {!loading && !subscribers.error && subscribers.data?.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No subscribers found.</td></tr>
                    )}
                    {!loading && subscribers.data?.map((subscriber) => {
                      const ownerName = [subscriber.owner.firstName, subscriber.owner.lastName].filter(Boolean).join(" ") || "Account owner";
                      return (
                        <tr key={subscriber.id} className="hover:bg-slate-50/80">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">{subscriber.name}</p>
                            <p className="mt-1 text-xs text-slate-500">Joined {formatDate(subscriber.createdAt)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium">{ownerName}</p>
                            <p className="mt-1 text-xs text-slate-500">{subscriber.owner.email || "No email"}</p>
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant="outline" className="capitalize">
                              {subscriber.subscription?.planName || "No plan"}
                            </Badge>
                            <p className="mt-1 text-xs capitalize text-slate-500">{subscriber.subscription?.status || "inactive"}</p>
                          </td>
                          <td className="px-5 py-4 text-slate-600">{subscriber.siteCount} / {subscriber.staffCount}</td>
                          <td className="px-5 py-4 text-slate-600">{formatDate(subscriber.subscription?.endDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Recent security activity</CardTitle>
              <p className="text-sm text-slate-500">Latest audited actions across organisations</p>
            </CardHeader>
            <CardContent>
              {auditEvents.isLoading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
              {auditEvents.error && <p className="text-sm text-red-600">{auditEvents.error.message}</p>}
              <div className="space-y-5">
                {auditEvents.data?.map((event) => (
                  <div key={event.id} className="relative pl-6">
                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-500 ring-4 ring-cyan-50" />
                    <p className="text-sm font-semibold text-slate-800">{event.action.replaceAll(".", " ")}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {event.organisationName || event.targetType} · {event.actorEmail || "System"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDate(event.createdAt)}</p>
                  </div>
                ))}
                {!auditEvents.isLoading && auditEvents.data?.length === 0 && (
                  <p className="text-sm text-slate-500">No audited activity yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function PlatformAdminPage() {
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
