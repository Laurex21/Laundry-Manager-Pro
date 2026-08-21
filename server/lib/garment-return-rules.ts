export const RETURN_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "in_rework",
  "quality_check",
  "resolved",
] as const;

export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const COMPLAINT_REASONS = [
  "poor_washing",
  "poor_ironing",
  "poor_packaging",
  "persistent_stain",
  "damage",
  "wrong_item",
  "other",
] as const;

export const RETURN_DECISIONS = [
  "rewash",
  "reiron",
  "repackage",
  "quality_check",
  "credit",
  "refund",
  "reject",
] as const;

const TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  pending_review: ["approved", "rejected"],
  approved: ["in_rework"],
  rejected: [],
  in_rework: ["quality_check"],
  quality_check: ["resolved"],
  resolved: [],
};

export function canTransitionReturn(from: string, to: string): boolean {
  return RETURN_STATUSES.includes(from as ReturnStatus)
    && RETURN_STATUSES.includes(to as ReturnStatus)
    && TRANSITIONS[from as ReturnStatus].includes(to as ReturnStatus);
}

export function requiresDecisionJustification(decision: string): boolean {
  return decision === "reject" || decision === "credit" || decision === "refund";
}

export function assignedStageForDecision(decision: string): string | null {
  if (decision === "rewash") return "washing";
  if (decision === "reiron") return "ironing";
  if (decision === "repackage") return "packing";
  if (decision === "quality_check") return "quality_check";
  return null;
}

export type EvidenceImage = { mimeType: string; dataUrl: string; sizeBytes: number };

export function validateEvidenceImages(input: unknown): EvidenceImage[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new Error("Evidence images must be a list");
  if (input.length > 3) throw new Error("A maximum of 3 evidence images is allowed");
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  return input.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid evidence image");
    const mimeType = String((value as any).mimeType || "").toLowerCase();
    const dataUrl = String((value as any).dataUrl || "");
    if (!allowed.has(mimeType)) throw new Error("Evidence images must be JPEG, PNG, or WebP");
    const prefix = `data:${mimeType};base64,`;
    if (!dataUrl.startsWith(prefix)) throw new Error("Evidence image data does not match its MIME type");
    const payload = dataUrl.slice(prefix.length);
    if (!/^[a-z0-9+/]*={0,2}$/i.test(payload)) throw new Error("Evidence image is not valid base64");
    const sizeBytes = Buffer.byteLength(payload, "base64");
    if (sizeBytes <= 0 || sizeBytes > 500 * 1024) throw new Error("Each evidence image must be 500 KB or smaller");
    return { mimeType, dataUrl, sizeBytes };
  });
}
