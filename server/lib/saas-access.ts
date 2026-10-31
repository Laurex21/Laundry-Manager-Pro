import {starterReceiptSettings} from "../../shared/starter-receipt";
import { hasSaasFeature, type SaasFeature, type SaasState } from "../../shared/saas-plans";
import { saasEnabled, saasStore, saasForOrganisation } from "./saas-runtime";
import { SaasError } from "./saas-store";

export const SAAS_CUSTOM_FIELDS = ["logoBase64", "receiptHeaderColor", "receiptFooterNote", "receiptQrCodeBase64", "receiptQrCodeTarget", "receiptQrCodeLabel", "showLogo", "showPickupDate", "showGarmentList", "showPaymentHistory", "showTerms", "termsOfService"];
export function standardSaasSettings<T extends Record<string, any>>(settings: T, plan: string): T {
  if (plan !== "starter") return settings;
  return starterReceiptSettings(settings);
}
export async function applySaasAccess(req: any, res: any): Promise<boolean> {
  if (!saasEnabled() || !req.organisationId) return true;
  const state = await saasForOrganisation(req.organisationId,req.userId);
  if (!state) return true; // Unreviewed legacy accounts keep their existing access.
  req.saas = state;
  const owner = (await saasStore.db.query("SELECT owner_id FROM organisations WHERE id=$1", [req.organisationId])).rows[0];
  const isOwner = owner?.owner_id === req.userId;
  const activeSites = state.activeSiteIds.filter((id: number) => req.authorizedSiteIds.includes(id));
  const allowedAuth = ["/api/auth/user", "/api/auth/logout", "/api/legal/current", "/api/legal/status", "/api/legal/accept"];
  if (!isOwner && !state.activeStaffIds.includes(req.userId)) {
    if (allowedAuth.includes(req.path)) { req.saasSuspended = true; return true; }
    res.status(403).json({ code: "SAAS_STAFF_SUSPENDED", message: "Your access is suspended by the organisation subscription. Contact the owner." }); return false;
  }
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  const exempt = req.path === "/api/receipt-snapshots" || req.path.startsWith("/api/saas/") || req.path === "/api/auth/switch-site" || allowedAuth.includes(req.path);
  if (!isOwner || (mutation && !exempt)) {
    req.authorizedSiteIds = activeSites; req.organisationSiteIds = activeSites;
    req.siteScope = req.siteScope.filter((id: number) => activeSites.includes(id)); req.organisationSiteScope = activeSites;
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.siteId && !activeSites.includes(req.siteId)) {
    if (!exempt) {
      res.status(403).json({ code: "SAAS_SITE_READ_ONLY", message: "This site is available for historical consultation only. Business is required to operate multiple sites." }); return false;
    }
  }
  // Premium routes remain guarded by the server, even when a caller skips the UI.
  const feature = routeFeature(req.path, req.method);
  if (feature && req.siteId && !activeSites.includes(req.siteId)) {
    res.status(403).json({ code: "SAAS_SITE_READ_ONLY", message: "Only previously stored history is available for this site." }); return false;
  }
  if (state.plan !== "business" && (feature || req.path === "/api/analytics/dashboard")) {
    // Historical order/customer reads remain available; consolidated analytics do not.
    req.siteScope = req.siteScope.filter((id: number) => activeSites.includes(id));
    req.organisationSiteScope = activeSites;
  }
  if (feature && !hasSaasFeature(state.plan, feature)) {
    res.status(403).json({ code: "SAAS_FEATURE_REQUIRED", feature, message: "This action requires a paid XpressPro plan." }); return false;
  }
  return true;
}
export function routeFeature(path: string, method: string): SaasFeature | null {
  if (method === "GET" && path.startsWith("/api/daily-site-reports")) return null; // Stored historical snapshots, not new calculations.
  if (/^\/api\/(analytics\/(?!dashboard|credit-summary)|reports|performance|daily-site-reports|machines|production-cycles|pilotage\/(?:today|overview)|attendance|employees)/.test(path)) return path.startsWith("/api/employees") || path.startsWith("/api/attendance") ? "team" : path.startsWith("/api/machines") || path.startsWith("/api/production-cycles") || path.includes("pilotage") ? "machines" : "reports";
  // Existing customer contracts, their balances, receipts and history remain readable.
  if (method !== "GET" && (/^\/api\/(subscription-plans|loyalty-program)/.test(path) || /^\/api\/customers\/\d+\/subscription(?:s)?(?:\/|$)/.test(path) || /^\/api\/subscriptions\/\d+\/(renew|suspend|cancel|card\/regenerate)/.test(path))) return "memberships";
  if (method !== "GET" && /^\/api\/(invitations$|sites\/\d+\/members)/.test(path)) return "team";
  return null;
}
export function saasFailure(res: any, error: any) {
  if (error?.name === "ZodError") return res.status(400).json({ code: "INVALID_REQUEST", message: "Invalid billing request" });
  if (error instanceof SaasError) return res.status(error.status).json({ code: error.code, message: error.code });
  const code = /^[A-Z_]+$/.test(error?.message || "") ? error.message : "SAAS_UNAVAILABLE";
  return res.status(code === "SAAS_UNAVAILABLE" ? 503 : 409).json({ code, message: code });
}
