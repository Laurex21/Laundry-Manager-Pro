// Target SaaS catalogue. Do not wire this into the live plan seed or checkout
// until the reviewed organisation migration and payment gates are in place.
export const SAAS_PLANS_V4 = {
  starter: { monthlyXaf: 0, includedSites: 1, includedStaff: 0 },
  pro: { monthlyXaf: 10999, includedSites: 1, includedStaff: 2 },
  business: { monthlyXaf: 18999, includedSites: 2, includedStaff: 5 },
} as const;

export type SaasPlanV4 = keyof typeof SAAS_PLANS_V4;
export const EXTRA_STAFF_MONTHLY_XAF = 2000;
export const EXTRA_BUSINESS_SITE_MONTHLY_XAF = 5000;
export const STAFF_SLOTS_PER_EXTRA_BUSINESS_SITE = 2;

export function saasCapacityV4(plan: SaasPlanV4, paidExtraSites: number, paidExtraStaff: number) {
  if (!Number.isSafeInteger(paidExtraSites) || paidExtraSites < 0 ||
      !Number.isSafeInteger(paidExtraStaff) || paidExtraStaff < 0) {
    throw new RangeError("Invalid paid SaaS option count");
  }
  if (plan !== "business" && paidExtraSites !== 0) {
    throw new RangeError("Only Business can add sites");
  }
  if (plan === "starter" && paidExtraStaff !== 0) {
    throw new RangeError("Starter cannot add staff");
  }
  const base = SAAS_PLANS_V4[plan];
  return {
    maxActiveSites: base.includedSites + paidExtraSites,
    maxActiveStaffExcludingOwner: base.includedStaff +
      paidExtraSites * STAFF_SLOTS_PER_EXTRA_BUSINESS_SITE + paidExtraStaff,
  };
}

export function canActivateSaasSiteV4(plan: SaasPlanV4, paidExtraSites: number, paidExtraStaff: number,
  currentActiveSites: number): boolean {
  if (!Number.isSafeInteger(currentActiveSites) || currentActiveSites < 0) throw new RangeError("Invalid active site count");
  return currentActiveSites < saasCapacityV4(plan, paidExtraSites, paidExtraStaff).maxActiveSites;
}

export function canActivateSaasStaffV4(plan: SaasPlanV4, paidExtraSites: number, paidExtraStaff: number,
  currentActiveStaffExcludingOwner: number): boolean {
  if (!Number.isSafeInteger(currentActiveStaffExcludingOwner) || currentActiveStaffExcludingOwner < 0) {
    throw new RangeError("Invalid active staff count");
  }
  return currentActiveStaffExcludingOwner <
    saasCapacityV4(plan, paidExtraSites, paidExtraStaff).maxActiveStaffExcludingOwner;
}

export function saasMonthlyQuoteV4(plan: SaasPlanV4, activeSites: number, activeStaffExcludingOwner: number) {
  if (!Number.isSafeInteger(activeSites) || activeSites < 1 ||
      !Number.isSafeInteger(activeStaffExcludingOwner) || activeStaffExcludingOwner < 0) {
    throw new RangeError("Invalid SaaS site or staff count");
  }
  const base = SAAS_PLANS_V4[plan];
  if (plan !== "business" && activeSites > base.includedSites) {
    throw new RangeError("Additional sites require Business");
  }
  const extraSites = Math.max(0, activeSites - base.includedSites);
  const includedStaff = base.includedStaff + extraSites * STAFF_SLOTS_PER_EXTRA_BUSINESS_SITE;
  if (plan === "starter" && activeStaffExcludingOwner > 0) {
    throw new RangeError("Starter permits the owner only");
  }
  const extraStaff = Math.max(0, activeStaffExcludingOwner - includedStaff);
  const siteXaf = extraSites * EXTRA_BUSINESS_SITE_MONTHLY_XAF;
  const staffXaf = extraStaff * EXTRA_STAFF_MONTHLY_XAF;
  return { baseXaf: base.monthlyXaf, siteXaf, staffXaf,
    totalXaf: base.monthlyXaf + siteXaf + staffXaf, extraSites, extraStaff, includedStaff };
}

// Round to the nearest whole FCFA, half up. The caller must supply the actual
// UTC cycle boundaries, never a presumed 30-day month.
export function prorateAddedOptionXaf(monthlyXaf: number, addedAt: Date, cycleStart: Date, cycleEnd: Date): number {
  const start = cycleStart.getTime();
  const end = cycleEnd.getTime();
  const added = addedAt.getTime();
  if (!Number.isSafeInteger(monthlyXaf) || monthlyXaf < 0 ||
      !Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(added) ||
      end <= start || added < start || added > end) {
    throw new RangeError("Invalid SaaS proration input");
  }
  const numerator = BigInt(monthlyXaf) * BigInt(end - added);
  const denominator = BigInt(end - start);
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}
