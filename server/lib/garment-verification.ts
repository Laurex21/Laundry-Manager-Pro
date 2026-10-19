export class GarmentVerificationError extends Error {
  constructor(message: string, public statusCode = 409) { super(message); }
}

const stages = ["received", "sorting", "washing", "drying", "ironing", "packaging", "ready", "delivered"];
export function canCheckQuality(status: string): boolean {
  return stages.indexOf(status) >= stages.indexOf("ironing") && status !== "delivered";
}
export function canCheckHandover(status: string): boolean {
  return status === "ready";
}
export function handoverComplete(items: Array<{ quantity: number; qualityCheckedQuantity: number; handedOverQuantity: number; returnedForTreatment?: boolean | null; resolvedAt?: Date | null }>): boolean {
  return items.length > 0 && items.every(item =>
    !item.returnedForTreatment && item.qualityCheckedQuantity === item.quantity && item.handedOverQuantity === item.quantity
  );
}
