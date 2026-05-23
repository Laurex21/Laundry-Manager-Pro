import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, lazy, Suspense } from "react";
import LayoutShell from "@/components/layout-shell";

// ─── Lazy-loaded routes (code-split into separate chunks) ─────────────────────
const NotFound          = lazy(() => import("@/pages/not-found"));
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-72 bg-muted/70 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
          <div className="h-24 bg-muted rounded-2xl" />
          <div className="h-24 bg-muted rounded-2xl" />
          <div className="h-24 bg-muted rounded-2xl" />
        </div>
        <div className="h-64 bg-muted/70 rounded-2xl mt-4" />
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-64">
      <Card className="max-w-sm w-full">
        <CardContent className="p-8 text-center">
          <ShieldOff className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold mb-2">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
        </CardContent>
      </Card>
    </div>
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
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
