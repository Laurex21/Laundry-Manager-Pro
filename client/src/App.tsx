import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/order-detail";
import Services from "@/pages/services";
import Expenses from "@/pages/expenses";
import Payments from "@/pages/payments";
import Reports from "@/pages/reports";
import Machines from "@/pages/machines";
import Employees from "@/pages/employees";
import Analytics from "@/pages/analytics";
import Subscriptions from "@/pages/subscriptions";
import SettingsPage from "@/pages/settings";
import AcceptInvitation from "@/pages/accept-invitation";
import LayoutShell from "@/components/layout-shell";

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const hasAccess = !page || canAccess(page);

  return (
    <LayoutShell>
      {hasAccess ? <Component /> : <AccessDenied />}
    </LayoutShell>
  );
}

function Router() {
  return (
    <Switch>
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
