import { createHash } from "node:crypto";
import { canonicalMoney } from "../../shared/order-money";
export * from "../../shared/order-money";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) {
    try { return canonicalMoney(value); } catch { return value; }
  }
  return value;
}

export function fingerprintRequest(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

export type PaidCorrectionOutcome =
  | { kind: "balance"; amount: string }
  | { kind: "customer_credit"; amount: string }
  | { kind: "approved_internal_refund"; amount: string; externalTransfer: false }
  | { kind: "balanced"; amount: "0.00" };
