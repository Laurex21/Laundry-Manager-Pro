import { requestReceipt } from "./receipt-request";
export type ReceiptArchiveContext = { orderId: number; paymentId?: number; kind: "deposit" | "payment" | "subscriber" };
/** Freeze the first issued HTML so later plan/settings changes cannot rewrite it. */
export async function archiveReceiptHtml(html: string, context?: ReceiptArchiveContext): Promise<string> {
  if (!context || typeof window === "undefined") return html;
  const enabled = await requestReceipt("/api/saas/config", async response => {
    if (!response.ok) throw new Error("Receipt archive unavailable");
    return (await response.json()).enabled;
  });
  if (!enabled) return html;
  return requestReceipt("/api/receipt-snapshots", async response => {
    if (!response.ok) throw new Error("Receipt archive unavailable");
    const saved = await response.json();
    if (typeof saved.html !== "string" || !saved.html.trim()) throw new Error("Receipt archive unavailable");
    return saved.html;
  }, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, html }) });
}
