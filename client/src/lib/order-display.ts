export type OrderDisplaySource = {
  orderNumber?: number | string | null;
  id?: number | string | null;
} | number | string | null | undefined;

export function orderDisplayId(orderOrId: OrderDisplaySource): number | string {
  if (orderOrId == null) return "";
  if (typeof orderOrId === "number" || typeof orderOrId === "string") return orderOrId;
  return orderOrId.orderNumber ?? orderOrId.id ?? "";
}
