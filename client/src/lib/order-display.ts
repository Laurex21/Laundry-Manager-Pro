import { appendClassicOrderNumber, classicOrderNumber } from "@shared/order-identifiers";
export type OrderDisplaySource = {
  legacyOrderNumber?: number | string | null;
  orderReference?: string | null;
  orderNumber?: number | string | null;
  id?: number | string | null;
} | number | string | null | undefined;

export function orderDisplayId(orderOrId: OrderDisplaySource): number | string {
  if (orderOrId == null) return "";
  if (typeof orderOrId === "number" || typeof orderOrId === "string") return orderOrId;
  return orderOrId.orderReference ?? orderOrId.orderNumber ?? orderOrId.id ?? "";
}

/** Human-readable labels only; keep orderDisplayId for filenames and canonical references. */
export function orderDisplayLabel(order: OrderDisplaySource): string {
  return appendClassicOrderNumber(orderDisplayId(order), order);
}
export const orderClassicNumber = classicOrderNumber;
