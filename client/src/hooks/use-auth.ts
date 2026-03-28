import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logoutFn(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<(User & { planSlug?: string; currentSite?: any; allSites?: any[] }) | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logoutFn,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/auth";
    },
  });

  const switchSiteMutation = useMutation({
    mutationFn: async (siteId: number | null) => {
      const res = await fetch("/api/auth/switch-site", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });
      if (!res.ok) throw new Error("Failed to switch site");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const planSlug: string = (user as any)?.subscription?.plan?.slug ?? (user as any)?.planSlug ?? "starter";
  const userRole: string = (user as any)?.role ?? "owner";
  const currentSite = (user as any)?.currentSite ?? null;
  const allSites: any[] = (user as any)?.allSites ?? [];
  const isOwner = userRole === "owner";

  const hasFeature = (feature: string): boolean => {
    const featureMap: Record<string, string[]> = {
      analytics:   ["pro", "business", "enterprise"],
      waste:       ["business", "enterprise"],
      performance: ["business", "enterprise"],
      machines:    ["pro", "business", "enterprise"],
      employees:   ["pro", "business", "enterprise"],
      reports:     ["pro", "business", "enterprise"],
      api:         ["enterprise"],
    };
    return featureMap[feature]?.includes(planSlug) ?? false;
  };

  const canAccess = (page: string): boolean => {
    const ownerPages = ["settings", "subscriptions", "reports", "analytics", "team", "dashboard", "orders", "customers", "payments", "services", "expenses", "machines", "employees"];
    const managerPages = ["orders", "customers", "payments", "services", "expenses", "machines", "employees", "analytics", "dashboard"];
    const operatorPages = ["orders", "customers", "payments", "dashboard"];

    if (userRole === "owner") return ownerPages.includes(page) || page === "settings";
    if (userRole === "manager") return managerPages.includes(page);
    if (userRole === "operator") return operatorPages.includes(page);
    return false;
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    planSlug,
    hasFeature,
    userRole,
    currentSite,
    allSites,
    isOwner,
    switchSite: switchSiteMutation.mutate,
    isSwitchingSite: switchSiteMutation.isPending,
    canAccess,
  };
}
