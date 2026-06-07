import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, lazy, Suspense } from "react";
import LayoutShell from "@/components/layout-shell";
import { SupportWhatsAppButton } from "@/components/support-whatsapp-button";

// ─── Lazy-loaded routes (code-split into separate chunks) ─────────────────────
const NotFound          = lazy(() => import("@/pages/not-found"));
const LandingPage       = lazy(() => import("@/pages/landing"));
const Dashboard         = lazy(() => import("@/pages/dashboard"));
const AuthPage          = lazy(() => import("@/pages/auth-page"));
const CalculatorPage    = lazy(() => import("@/pages/calculator"));
const DiagnosticPage    = lazy(() => import("@/pages/diagnostic"));
const RentabilitePage   = lazy(() => import("@/pages/rentabilite"));
const PublicReportPage  = lazy(() => import("@/pages/report-public"));
const Customers         = lazy(() => import("@/pages/customers"));
const CustomerDetail    = lazy(() => import("@/pages/customer-detail"));
const Orders            = lazy(() => import("@/pages/orders"));
const OrderDetail       = lazy(() => import("@/pages/order-detail"));
const Services          = lazy(() => import("@/pages/services"));
const Expenses          = lazy(() => import("@/pages/expenses"));
const Payments          = lazy(() => import("@/pages/payments"));
const Reports           = lazy(() => import("@/pages/reports"));
const Machines          = lazy(() => import("@/pages/machines"));
const Employees         = lazy(() => import("@/pages/employees"));
const Analytics         = lazy(() => import("@/pages/analytics"));
const Subscriptions     = lazy(() => import("@/pages/subscriptions"));
const SettingsPage      = lazy(() => import("@/pages/settings"));
const AcceptInvitation  = lazy(() => import("@/pages/accept-invitation"));

// ─── Skeleton fallback while a chunk loads ────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="h-14 border-b border-border/40 bg-muted/20" />
      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-40 bg-muted/60 rounded" />
          </div>
          <div className="h-5 w-28 bg-muted/70 rounded" />
        </div>
        <div className="h-9 bg-muted/50 rounded-lg" />
        <div className="grid grid-cols-4 gap-2">
          <div className="h-14 bg-muted/60 rounded-lg" />
          <div className="h-14 bg-muted/60 rounded-lg" />
          <div className="h-14 bg-muted/60 rounded-lg" />
          <div className="h-14 bg-muted/60 rounded-lg" />
        </div>
        <div className="h-48 bg-muted/40 rounded-lg" />
      </div>
    </div>
  );
}

function AccessDenied() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  return (
    <div className="flex items-center justify-center min-h-48 p-8">
      <div className="text-center max-w-sm space-y-4 p-6 rounded-xl border border-border/60 bg-card">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto">
          <ShieldOff className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-sm">{t('access_denied')}</h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t('access_denied_msg')}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLocation("/")}>
          {t('go_home')}
        </Button>
      </div>
    </div>
  );
}

function RootRoute() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user) setLocation("/dashboard");
  }, [isLoading, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return null;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LandingPage />
    </Suspense>
  );
}

function ProtectedRoute({ component: Component, page }: { component: React.ComponentType; page?: string }) {
  const { user, isLoading, canAccess } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) setLocation("/auth");
  }, [isLoading, user, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasAccess = !page || canAccess(page);
  return (
    <LayoutShell>
      {hasAccess ? <Component /> : <AccessDenied />}
    </LayoutShell>
  );
}

function CalculatorRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/calculateur"); }, []);
  return null;
}

function Router() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        <Route path="/calculateur" component={CalculatorPage} />
        <Route path="/diagnostic" component={DiagnosticPage} />
        <Route path="/rentabilite" component={RentabilitePage} />
        <Route path="/calculator" component={CalculatorRedirect} />
        <Route path="/rapport/:leadId" component={PublicReportPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/join/:token" component={AcceptInvitation} />

        <Route path="/">
          <RootRoute />
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute component={Dashboard} page="dashboard" />
        </Route>
        <Route path="/customers">
          <ProtectedRoute component={Customers} page="customers" />
        </Route>
        <Route path="/customers/:id">
          <ProtectedRoute component={CustomerDetail} page="customers" />
        </Route>
        <Route path="/orders">
          <ProtectedRoute component={Orders} page="orders" />
        </Route>
        <Route path="/orders/:id">
          <ProtectedRoute component={OrderDetail} page="orders" />
        </Route>
        <Route path="/services">
          <ProtectedRoute component={Services} page="services" />
        </Route>
        <Route path="/expenses">
          <ProtectedRoute component={Expenses} page="expenses" />
        </Route>
        <Route path="/payments">
          <ProtectedRoute component={Payments} page="payments" />
        </Route>
        <Route path="/reports">
          <ProtectedRoute component={Reports} page="reports" />
        </Route>
        <Route path="/machines">
          <ProtectedRoute component={Machines} page="machines" />
        </Route>
        <Route path="/employees">
          <ProtectedRoute component={Employees} page="employees" />
        </Route>
        <Route path="/analytics">
          <ProtectedRoute component={Analytics} page="analytics" />
        </Route>
        <Route path="/subscriptions">
          <ProtectedRoute component={Subscriptions} page="subscriptions" />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={SettingsPage} page="settings" />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <SupportWhatsAppButton />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
