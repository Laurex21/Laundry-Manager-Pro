export type ReceiptArchiveContext = { orderId: number; paymentId?: number; kind: "deposit" | "payment" | "subscriber" };
/** Freeze the first issued HTML so later plan/settings changes cannot rewrite it. */
export async function archiveReceiptHtml(html: string, context?: ReceiptArchiveContext): Promise<string> {
  if (!context || typeof window === "undefined") return html;
  const config = await fetch("/api/saas/config", { credentials: "include" });
  if (!config.ok || !(await config.json()).enabled) return html;
  const response = await fetch("/api/receipt-snapshots", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, html }) });
  if (!response.ok) throw new Error("Receipt archive unavailable");
  const saved = await response.json();
  return saved.html;
}
