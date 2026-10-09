import crypto from "crypto";
import { pool } from "../db";
import { pawapaySandboxSchemaReady } from "./pawapay-sandbox-schema";

const API_URL = "https://api.sandbox.pawapay.io/v2/checkouts";
const AMOUNT_XAF = "1000";

export class SandboxCheckoutError extends Error {
  constructor(message: string, readonly httpStatus = 502, readonly checkoutId?: string) { super(message); }
}

export async function createSandboxCheckout(input: {
  organisationId: number; userId: string; planId?: number; returnUrl: string;
}): Promise<{ checkoutId: string; redirectUrl: string }> {
  const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
  if (!token) throw new SandboxCheckoutError("PawaPay sandbox token is not configured", 503);
  await pawapaySandboxSchemaReady();
  const checkoutId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO pawapay_sandbox_checkouts (checkout_id, organisation_id, created_by_user_id, plan_id, amount_xaf)
     VALUES ($1, $2, $3, $4, $5)`,
    [checkoutId, input.organisationId, input.userId, input.planId ?? null, AMOUNT_XAF],
  );
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutId, returnUrl: input.returnUrl, defaultLanguage: "fr", countries: ["CMR"], expiresAfter: 30,
        amounts: [{ country: "CMR", currency: "XAF", amount: AMOUNT_XAF }],
        clientReferenceId: `XP-SBX-${checkoutId.slice(0, 18)}`,
        reason: { fr: "Test XPress Pro", en: "XPress Pro Test" },
        metadata: [{ organisationId: String(input.organisationId) }, ...(input.planId ? [{ planId: String(input.planId) }] : [])],
      }),
    });
  } catch {
    throw new SandboxCheckoutError("Sandbox checkout request timed out; check status before retrying", 503, checkoutId);
  }
  const result: any = await response.json().catch(() => ({}));
  if (!response.ok || result.status !== "ACCEPTED") {
    await pool.query(
      "UPDATE pawapay_sandbox_checkouts SET status = 'REJECTED', provider_status = $2, updated_at = now() WHERE checkout_id = $1",
      [checkoutId, typeof result.status === "string" ? result.status : `HTTP_${response.status}`],
    );
    console.warn("PawaPay sandbox checkout rejected", { checkoutId, httpStatus: response.status, failureCode: result.failureReason?.failureCode });
    throw new SandboxCheckoutError("PawaPay rejected the sandbox checkout", 502, checkoutId);
  }
  let redirect: URL;
  try { redirect = new URL(result.redirectUrl); } catch { throw new SandboxCheckoutError("PawaPay checkout response invalid", 503, checkoutId); }
  if (redirect.origin !== "https://checkout.sandbox.pawapay.io" || result.checkoutId !== checkoutId ||
      typeof result.checkoutCode !== "string") {
    throw new SandboxCheckoutError("PawaPay checkout response invalid", 503, checkoutId);
  }
  await pool.query(
    `UPDATE pawapay_sandbox_checkouts
     SET status = CASE WHEN status = 'CREATED' THEN 'ACCEPTED' ELSE status END,
         provider_status = CASE WHEN status = 'CREATED' THEN 'ACCEPTED' ELSE provider_status END,
         checkout_code = $2, redirect_url = $3, updated_at = now()
     WHERE checkout_id = $1`,
    [checkoutId, result.checkoutCode, redirect.toString()],
  );
  return { checkoutId, redirectUrl: redirect.toString() };
}

export async function reconcileSandboxCheckout(checkoutId: string): Promise<{ status: string; callbackReceivedAt: string | null }> {
  const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
  if (!token) throw new SandboxCheckoutError("PawaPay sandbox token is not configured", 503);
  await pawapaySandboxSchemaReady();
  const local = await pool.query(
    "SELECT checkout_code, amount_xaf, status FROM pawapay_sandbox_checkouts WHERE checkout_id = $1", [checkoutId],
  );
  if (!local.rowCount) throw new SandboxCheckoutError("Sandbox checkout not found", 404);
  const response = await fetch(`${API_URL}/${checkoutId}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new SandboxCheckoutError("PawaPay status request failed");
  const result: any = await response.json();
  if (result.status !== "FOUND" || result.data?.checkoutId !== checkoutId) {
    throw new SandboxCheckoutError("PawaPay checkout status unavailable");
  }
  const data = result.data;
  const amountMatches = Array.isArray(data.amounts) && data.amounts.some((amount: any) =>
    amount?.country === "CMR" && amount?.currency === "XAF" && Number(amount?.amount) === Number(local.rows[0].amount_xaf));
  if (!amountMatches || (local.rows[0].checkout_code && data.checkoutCode !== local.rows[0].checkout_code)) {
    throw new SandboxCheckoutError("PawaPay checkout details do not match", 409);
  }
  const status = String(data.status || "").toUpperCase();
  if (["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].includes(status)) {
    await pool.query(
      `UPDATE pawapay_sandbox_checkouts SET status = $2, provider_status = $2, updated_at = now()
       WHERE checkout_id = $1 AND status NOT IN ('COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED')`,
      [checkoutId, status],
    );
  }
  const current = await pool.query("SELECT status, callback_received_at FROM pawapay_sandbox_checkouts WHERE checkout_id = $1", [checkoutId]);
  if (["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].includes(status) && current.rows[0].status !== status) {
    throw new SandboxCheckoutError("Provider and local final statuses conflict", 409);
  }
  return { status: current.rows[0].status, callbackReceivedAt: current.rows[0].callback_received_at };
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startSandboxCheckoutReconciliation(): void {
  if (timer) return;
  let running = false;
  timer = setInterval(async () => {
    if (running || !process.env.PAWAPAY_SANDBOX_API_TOKEN) return;
    running = true;
    try {
      await pawapaySandboxSchemaReady();
      const pending = await pool.query(
        `SELECT checkout_id FROM pawapay_sandbox_checkouts
         WHERE status IN ('CREATED', 'ACCEPTED') AND created_at > now() - interval '2 hours'
         ORDER BY created_at ASC LIMIT 20`,
      );
      for (const row of pending.rows) {
        try { await reconcileSandboxCheckout(row.checkout_id); }
        catch (error) { console.warn("Sandbox checkout reconciliation failed", { checkoutId: row.checkout_id, error }); }
      }
    } catch (error) { console.warn("Sandbox checkout reconciliation unavailable", error); }
    finally { running = false; }
  }, 60_000);
  timer.unref?.();
}
