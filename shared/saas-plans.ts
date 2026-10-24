/** Commercial catalogue v6. SaaS XAF prices are independent of a laundry's currency. */
export const SAAS_CATALOGUE_VERSION = "2026-10-v6";
export const SAAS_PLANS = {
  starter: { slug: "starter", name: "Starter", priceXaf: 0, sites: 1, staff: 0 },
  pro: { slug: "pro", name: "Pro", priceXaf: 10999, sites: 1, staff: 2 },
  business: { slug: "business", name: "Business", priceXaf: 18999, sites: 2, staff: 5 },
} as const;
export type SaasPlan = keyof typeof SAAS_PLANS;
export type SaasPhase = "trialing" | "active" | "starter";
export const SAAS_OPTION_PRICES = { siteXaf: 5000, staffXaf: 2000 } as const;
export const DAY_MS = 86_400_000;
export type SaasSelection = { plan: SaasPlan; extraSites: number; extraStaff: number };
export type SaasState = SaasSelection & {
  phase: SaasPhase; trialStartedAt: string | null; trialEndsAt: string | null;
  cycleStart: string | null; cycleEnd: string | null; anchorDay: number;
  paidBaseXaf: number; paidStaffXaf: number; paidSiteXaf: number;
  activeSiteIds: number[]; activeStaffIds: string[]; version: number;
  pending: SaasSelection | null;
  timeZone?: string;
  launchBusiness?: boolean; launchEstablished?: boolean; protectedUntil?: string | null;
  renewal?: { selection: SaasSelection; start: string; end: string; paidBaseXaf: number; paidStaffXaf: number; paidSiteXaf: number } | null;
};
export type SaasFeature = "receiptCustomization" | "reports" | "analytics" | "machines" | "team" | "memberships" | "multiSite";
export function saasSelection(plan: unknown, extraSites: unknown = 0, extraStaff: unknown = 0): SaasSelection {
  if (typeof plan !== "string" || !Object.hasOwn(SAAS_PLANS, plan)) throw new Error("INVALID_PLAN");
  for (const value of [extraSites, extraStaff]) {
    if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1000) throw new Error("INVALID_OPTIONS");
  }
  if (plan !== "business" && extraSites !== 0) throw new Error("BUSINESS_REQUIRED");
  if (plan === "starter" && extraStaff !== 0) throw new Error("PAID_PLAN_REQUIRED");
  return { plan: plan as SaasPlan, extraSites: Number(extraSites), extraStaff: Number(extraStaff) };
}
export function sameSaasSelection(a: SaasSelection, b: SaasSelection) { return a.plan === b.plan && a.extraSites === b.extraSites && a.extraStaff === b.extraStaff; }
export function saasQuotas(selection: SaasSelection) {
  const checked = saasSelection(selection.plan, selection.extraSites, selection.extraStaff);
  return { sites: SAAS_PLANS[checked.plan].sites + checked.extraSites,
    staff: SAAS_PLANS[checked.plan].staff + checked.extraStaff + checked.extraSites * 2 };
}
export function saasMonthly(selection: SaasSelection) {
  saasSelection(selection.plan, selection.extraSites, selection.extraStaff);
  return SAAS_PLANS[selection.plan].priceXaf + selection.extraSites * SAAS_OPTION_PRICES.siteXaf + selection.extraStaff * SAAS_OPTION_PRICES.staffXaf;
}
export function hasSaasFeature(plan: SaasPlan, feature: SaasFeature) {
  return feature === "multiSite" ? plan === "business" : plan !== "starter";
}
/** Preserve a Jan-31 anniversary across February; retain the original anchor day. */
export function nextSaasMonth(start: Date, anchorDay = start.getUTCDate()): Date {
  const result = new Date(start);
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + 1);
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(anchorDay, last));
  return result;
}
export function saasEffective(state: SaasState, now: Date): SaasState {
  const end = state.phase === "trialing" ? state.trialEndsAt : state.phase === "active" ? state.cycleEnd : null;
  if (end && new Date(end).getTime() <= now.getTime() && state.renewal && new Date(state.renewal.end).getTime() > now.getTime()) {
    return { ...state, ...state.renewal.selection, phase: "active", cycleStart: state.renewal.start, cycleEnd: state.renewal.end,
      paidBaseXaf: state.renewal.paidBaseXaf, paidStaffXaf: state.renewal.paidStaffXaf, paidSiteXaf: state.renewal.paidSiteXaf,
      renewal: null, pending: null, version: state.version + 1 };
  }
  if (end && new Date(end).getTime() <= now.getTime()) return { ...state, plan: "starter", phase: "starter", extraSites: 0, extraStaff: 0,
    activeSiteIds: state.activeSiteIds.slice(0, 1), activeStaffIds: [], renewal: null, version: state.version + 1 };
  return state;
}
export function saasProrata(amount: number, start: string, end: string, now: Date): number {
  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isSafeInteger(amount) || amount < 0 || duration <= 0) throw new Error("INVALID_CYCLE");
  // Integer half-up rounding, bounded to the actual cycle; no assumed 30-day month.
  const remaining = Math.max(0, Math.min(duration, new Date(end).getTime() - now.getTime()));
  return Number((BigInt(amount) * BigInt(remaining) * 2n + BigInt(duration)) / (2n * BigInt(duration)));
}
export type SaasQuote = {
  kind: "cycle" | "upgrade" | "options" | "renewal"; selection: SaasSelection; version: number;
  lines: { label: "plan" | "sites" | "staff" | "creditPro" | "creditStaff"; amountXaf: number; quantity: number }[];
  totalXaf: number; nextMonthlyXaf: number; quotedAt: string; expiresAt: string;
  cycleEnd: string | null;
};
export function quoteSaas(input: SaasState, target: SaasSelection, now: Date): SaasQuote {
  saasSelection(target.plan, target.extraSites, target.extraStaff);
  if (target.plan === "starter") throw new Error("USE_SCHEDULED_CHANGE");
  const current = saasEffective(input, now);
  const active = current.phase === "active";
  const samePlan = active && target.plan === current.plan;
  const upgrade = active && current.plan === "pro" && target.plan === "business";
  const scheduledRenewal = active && current.pending && sameSaasSelection(current.pending, target);
  if (current.renewal) throw new Error("RENEWAL_ALREADY_PAID");
  if (!scheduledRenewal && active && current.plan === "business" && target.plan === "pro") throw new Error("USE_SCHEDULED_CHANGE");
  if (!scheduledRenewal && samePlan && (target.extraSites < current.extraSites || target.extraStaff < current.extraStaff)) throw new Error("USE_SCHEDULED_CHANGE");
  const options = samePlan && (target.extraSites > current.extraSites || target.extraStaff > current.extraStaff);
  const deferredTrial = current.phase === "trialing" && !!current.launchBusiness;
  const renewal = deferredTrial || active && !options && !upgrade;
  if (renewal && !deferredTrial) {
    const included = SAAS_PLANS[target.plan].staff + target.extraSites * 2;
    // Suspended/unused staff places are not charged for the next monthly cycle.
    target = { ...target, extraStaff: Math.min(target.extraStaff, Math.max(0, current.activeStaffIds.length - included)) };
  }
  const lines: SaasQuote["lines"] = [];
  if (options) {
    for (const [label, difference, price] of [["sites", target.extraSites - current.extraSites, SAAS_OPTION_PRICES.siteXaf], ["staff", target.extraStaff - current.extraStaff, SAAS_OPTION_PRICES.staffXaf]] as const) {
      if (difference) lines.push({ label, quantity: difference, amountXaf: saasProrata(difference * price, current.cycleStart!, current.cycleEnd!, now) });
    }
  } else {
    lines.push({ label: "plan", quantity: 1, amountXaf: SAAS_PLANS[target.plan].priceXaf });
    if (target.extraSites) lines.push({ label: "sites", quantity: target.extraSites, amountXaf: target.extraSites * SAAS_OPTION_PRICES.siteXaf });
    if (target.extraStaff) lines.push({ label: "staff", quantity: target.extraStaff, amountXaf: target.extraStaff * SAAS_OPTION_PRICES.staffXaf });
    if (upgrade) {
      lines.push({ label: "creditPro", quantity: 1, amountXaf: -saasProrata(current.paidBaseXaf, current.cycleStart!, current.cycleEnd!, now) });
      if (current.paidStaffXaf) lines.push({ label: "creditStaff", quantity: 1, amountXaf: -saasProrata(current.paidStaffXaf, current.cycleStart!, current.cycleEnd!, now) });
    }
  }
  const totalXaf = lines.reduce((sum, line) => sum + line.amountXaf, 0);
  // Preserve excess paid credit for manual review rather than silently discard it.
  if (totalXaf < 0) throw new Error("EXCESS_CREDIT_REQUIRES_REVIEW");
  const expiry = Math.min(now.getTime() + 15 * 60_000, active ? new Date(current.cycleEnd!).getTime() : Infinity);
  return { kind: options ? "options" : upgrade ? "upgrade" : renewal ? "renewal" : "cycle", selection: target, version: current.version,
    lines, totalXaf, nextMonthlyXaf: saasMonthly(target), quotedAt: now.toISOString(), expiresAt: new Date(expiry).toISOString(), cycleEnd: deferredTrial ? current.trialEndsAt : options || renewal ? current.cycleEnd : null };
}
export function saasTrial(createdAt: Date, now: Date, siteIds: number[], staffIds: string[]): SaasState {
  const initialEnd = createdAt.getTime() + 30 * DAY_MS;
  const migrated = now.getTime() - createdAt.getTime() > 60_000;
  const trialEndsAt = new Date(migrated ? Math.max(initialEnd, now.getTime() + 7 * DAY_MS) : initialEnd).toISOString();
  return { plan: "pro", phase: "trialing", extraSites: 0, extraStaff: 0,
    trialStartedAt: createdAt.toISOString(), trialEndsAt, cycleStart: null, cycleEnd: null,
    anchorDay: now.getUTCDate(), paidBaseXaf: 0, paidStaffXaf: 0, paidSiteXaf: 0,
    activeSiteIds: siteIds.slice(0, 1), activeStaffIds: staffIds.length <= 2 ? staffIds : [], version: 0, pending: null };
}
