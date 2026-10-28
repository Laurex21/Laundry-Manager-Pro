import { saasSelection, type SaasSelection } from "@shared/saas-plans";

// A navigation preference only. The server remains authoritative for access and billing.
export function readPlanIntent(search: string): SaasSelection | null {
  const params = new URLSearchParams(search);
  if (!params.has("plan")) return null;
  const option = (key: string) => {
    const value = params.get(key) ?? "0";
    return /^\d{1,4}$/.test(value) ? Number(value) : NaN;
  };
  try { return saasSelection(params.get("plan"), option("extraSites"), option("extraStaff")); }
  catch { return null; }
}

export function planIntentUrl(path: "/auth" | "/subscriptions", selection: SaasSelection | null, tab?: "login" | "register") {
  const params = new URLSearchParams();
  if (path === "/auth" && tab === "register") params.set("tab", "register");
  if (selection) {
    const valid = saasSelection(selection.plan, selection.extraSites, selection.extraStaff);
    params.set("plan", valid.plan);
    if (valid.extraSites) params.set("extraSites", String(valid.extraSites));
    if (valid.extraStaff) params.set("extraStaff", String(valid.extraStaff));
  }
  return path + (params.size ? `?${params}` : "");
}
