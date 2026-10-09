import type { PaidSaasPlanV4 } from "./saas-plan-transition-v4";

export type ProductionCheckoutIntentV4 = {
  checkoutId: string;
  checkoutCode: string;
  clientReferenceId: string;
  organisationId: number;
  targetPlanSlug: PaidSaasPlanV4;
  amountXaf: number;
};

function metadataValue(metadata: unknown, key: string): string | null {
  if (Array.isArray(metadata)) {
    const found = metadata.find((item) => item && typeof item === "object" && key in item);
    const value = found?.[key];
    return typeof value === "string" ? value : null;
  }
  if (metadata && typeof metadata === "object") {
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
}

// Product decision (Stevve, 9 Oct 2026): a server-fetched COMPLETED checkout
// confirms payment. This inspector does not activate a plan; the caller must
// persist the verified intent and apply an idempotent transaction.
export function inspectProductionCheckoutV4(intent: ProductionCheckoutIntentV4,
  providerResponse: unknown): "pending" | "failed" | "completed" {
  const response = providerResponse as { status?: unknown; data?: Record<string, unknown> } | null;
  if (response?.status !== "FOUND" || !response.data || typeof response.data !== "object") {
    throw new Error("PAWAPAY_CHECKOUT_NOT_FOUND");
  }
  const data = response.data;
  const amounts = data.amounts;
  const amountMatches = Array.isArray(amounts) && amounts.some((entry) =>
    entry?.country === "CMR" && entry?.currency === "XAF" &&
    typeof entry?.amount === "string" && /^\d+(?:\.0+)?$/.test(entry.amount) &&
    Number(entry.amount) === intent.amountXaf);
  if (data.checkoutId !== intent.checkoutId || data.checkoutCode !== intent.checkoutCode ||
      data.clientReferenceId !== intent.clientReferenceId ||
      !amountMatches || metadataValue(data.metadata, "organisationId") !== String(intent.organisationId) ||
      metadataValue(data.metadata, "planSlug") !== intent.targetPlanSlug) {
    throw new Error("PAWAPAY_CHECKOUT_MISMATCH");
  }
  if (data.status === "COMPLETED") return "completed";
  if (["FAILED", "EXPIRED", "CANCELLED"].includes(String(data.status))) return "failed";
  if (["CREATED", "ACCEPTED", "PENDING"].includes(String(data.status))) return "pending";
  throw new Error("PAWAPAY_CHECKOUT_STATUS_UNKNOWN");
}
