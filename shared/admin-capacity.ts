import { SAAS_PLANS, SAAS_OPTION_PRICES, saasMonthly, saasQuotas, type SaasSelection } from './saas-plans';

export function capacityCost(selection: SaasSelection) {
  const plan = SAAS_PLANS[selection.plan];
  return {
    selection: { plan: selection.plan, extraSites: selection.extraSites, extraStaff: selection.extraStaff },
    includedSites: plan.sites, includedStaff: plan.staff,
    staffFromExtraSites: selection.extraSites * 2,
    totalSites: saasQuotas(selection).sites, totalStaff: saasQuotas(selection).staff,
    baseXaf: plan.priceXaf, sitesXaf: selection.extraSites * SAAS_OPTION_PRICES.siteXaf,
    staffXaf: selection.extraStaff * SAAS_OPTION_PRICES.staffXaf,
    monthlyXaf: saasMonthly(selection),
  };
}
export type CapacityCost = ReturnType<typeof capacityCost>;
export type CapacityChange = {
  expectedFingerprint: string; extraSites: number; extraStaff: number;
  addSiteIds: number[]; addStaffIds: string[]; reason: string;
};
export type CapacitySummary = {
  organisationId: number; fingerprint: string | null;
  phase: 'trialing' | 'active' | 'starter' | null; endsAt: string | null;
  current: CapacityCost | null;
  usedSites: number; usedStaff: number;
  sites: { id: number; name: string; available: boolean; enabled: boolean }[];
  staff: { id: string; name: string; siteIds: number[]; enabled: boolean }[];
  next: { kind: 'renewal' | 'scheduled'; cost: CapacityCost; startsAt: string | null; endsAt: string | null } | null;
  latestInvoice: {
    id: string; status: string; createdAt: string; paidAt: string | null;
    cost: CapacityCost | null; lines: { label: string; quantity: number; amountXaf: number }[];
    originalXaf: number; discountXaf: number; totalXaf: number; promoCode: string | null;
    durationMonths: number;
  } | null;
  activationBlockedReason: string | null;
};
export type CapacityPreview = {
  before: CapacityCost; after: CapacityCost;
  usedSitesBefore: number; usedStaffBefore: number; usedSitesAfter: number; usedStaffAfter: number;
  addedSites: { id: number; name: string }[]; addedStaff: { id: string; name: string }[];
  endsAt: string | null; paymentRecorded: false;
};
