import { activateVerifiedProductionCheckoutV4 } from "./saas-paid-activation-v4";
import { pool } from "../db";

const API_URL = "https://api.pawapay.io/v2/checkouts";

export async function reconcileProductionCheckoutV4(checkoutId: string): Promise<
  "activated" | "already_activated" | "pending" | "failed"
> {
  if (process.env.SAAS_V4_PAID_BILLING !== "true") throw new Error("SAAS_PAID_BILLING_DISABLED");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(checkoutId)) {
    throw new Error("SAAS_CHECKOUT_ID_INVALID");
  }
  const token = process.env.PAWAPAY_PRODUCTION_API_TOKEN;
  if (!token) throw new Error("PAWAPAY_PRODUCTION_TOKEN_MISSING");
  const response = await fetch(`${API_URL}/${checkoutId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("PAWAPAY_PRODUCTION_STATUS_UNAVAILABLE");
  const providerResponse: unknown = await response.json();
  return activateVerifiedProductionCheckoutV4(checkoutId, providerResponse);
}

let reconciliationTimer: ReturnType<typeof setInterval> | null = null;
export function startProductionCheckoutReconciliationV4(): void {
  if (reconciliationTimer) return;
  let running = false;
  reconciliationTimer = setInterval(async () => {
    if (running || process.env.SAAS_V4_PAID_BILLING !== "true" ||
        !process.env.PAWAPAY_PRODUCTION_API_TOKEN) return;
    running = true;
    try {
      const pending = await pool.query(
        `SELECT checkout_id FROM saas_payment_intents_v4
         WHERE state = 'accepted' AND checkout_code IS NOT NULL
           AND created_at > now() - interval '24 hours'
         ORDER BY created_at ASC LIMIT 20`,
      );
      for (const row of pending.rows) {
        try { await reconcileProductionCheckoutV4(String(row.checkout_id)); }
        catch (error) { console.warn("Paid checkout reconciliation failed", {
          checkoutId: row.checkout_id, error: error instanceof Error ? error.message : "unknown",
        }); }
      }
    } catch (error) {
      console.warn("Paid checkout reconciliation unavailable", error instanceof Error ? error.message : "unknown");
    } finally { running = false; }
  }, 60_000);
  reconciliationTimer.unref?.();
}
