export type ProductionDepositExpectationV4 = {
  depositId: string;
  clientReferenceId: string;
  organisationId: number;
  planSlug: "pro" | "business";
  amountXaf: number;
};

function metadataValue(metadata: unknown, key: string): string | null {
  if (Array.isArray(metadata)) {
    const found = metadata.find((item) => item && typeof item === "object" && key in item);
    return typeof found?.[key] === "string" ? found[key] : null;
  }
  if (metadata && typeof metadata === "object") {
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
}

// This validates a deposit fetched by ID from PawaPay, but does not establish
// which checkout produced it. The caller must independently prove that link.
export function inspectProductionDepositV4(expected: ProductionDepositExpectationV4,
  providerResponse: unknown): "completed" | "pending" | "failed" {
  const response = providerResponse as { status?: unknown; data?: Record<string, unknown> } | null;
  if (response?.status !== "FOUND" || !response.data || typeof response.data !== "object") {
    throw new Error("PAWAPAY_DEPOSIT_NOT_FOUND");
  }
  const data = response.data;
  if (data.depositId !== expected.depositId ||
      data.clientReferenceId !== expected.clientReferenceId ||
      data.country !== "CMR" || data.currency !== "XAF" ||
      typeof data.amount !== "string" || !/^\d+(?:\.0+)?$/.test(data.amount) ||
      Number(data.amount) !== expected.amountXaf ||
      metadataValue(data.metadata, "organisationId") !== String(expected.organisationId) ||
      metadataValue(data.metadata, "planSlug") !== expected.planSlug) {
    throw new Error("PAWAPAY_DEPOSIT_MISMATCH");
  }
  if (data.status === "COMPLETED") return "completed";
  if (["FAILED", "CANCELLED", "REJECTED"].includes(String(data.status))) return "failed";
  if (["ACCEPTED", "PENDING", "SUBMITTED", "PROCESSING"].includes(String(data.status))) return "pending";
  throw new Error("PAWAPAY_DEPOSIT_STATUS_UNKNOWN");
}
