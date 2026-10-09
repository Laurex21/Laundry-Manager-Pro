import crypto from "node:crypto";
import { pool } from "../db";
import { inspectProductionCheckoutV4 } from "./pawapay-production-checkout-v4";
import { SAAS_PLANS_V4 } from "./saas-plan-v4";
import { confirmedPaidPlanSwitchV4, type PaidSaasPlanV4 } from "./saas-plan-transition-v4";

const API_URL = "https://api.sandbox.pawapay.io/v2/checkouts";

function sandboxToken(): string {
  const token = process.env.PAWAPAY_SANDBOX_API_TOKEN;
  if (!token) throw new Error("PAWAPAY_SANDBOX_TOKEN_MISSING");
  return token;
}

export function shadowTestEnabledForEmail(email: string): boolean {
  const allowed = process.env.SAAS_V4_SHADOW_TEST_EMAIL?.trim().toLowerCase();
  return process.env.SAAS_V4_SHADOW_TEST_ENABLED === "true" && !!allowed &&
    email.trim().toLowerCase() === allowed;
}

export async function createShadowSandboxCheckout(input: {
  organisationId: number; userId: string; targetPlanSlug: PaidSaasPlanV4;
}): Promise<{ checkoutId: string; redirectUrl: string }> {
  if (input.targetPlanSlug !== "pro" && input.targetPlanSlug !== "business") throw new Error("INVALID_PLAN");
  const token = sandboxToken();
  const checkoutId = crypto.randomUUID();
  const clientReferenceId = `XP-V4-SBX-${checkoutId}`;
  const amountXaf = SAAS_PLANS_V4[input.targetPlanSlug].monthlyXaf;
  const publicOrigin = new URL(process.env.SAAS_V4_PUBLIC_APP_ORIGIN || "https://laundry-manager-pro.replit.app");
  if (publicOrigin.protocol !== "https:") throw new Error("INVALID_RETURN_ORIGIN");
  const current = await pool.query(
    "SELECT plan_slug, cycle_ends_at FROM saas_v4_shadow_entitlements WHERE organisation_id = $1",
    [input.organisationId],
  );
  if (current.rows[0]?.plan_slug === input.targetPlanSlug &&
      new Date(current.rows[0].cycle_ends_at).getTime() > Date.now()) {
    throw new Error("EARLY_SAME_PLAN_RENEWAL_NOT_DEFINED");
  }
  await pool.query(
    `INSERT INTO saas_v4_shadow_sandbox_checkouts
     (checkout_id, client_reference_id, organisation_id, created_by_user_id,
      target_plan_slug, amount_xaf)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [checkoutId, clientReferenceId, input.organisationId, input.userId, input.targetPlanSlug, amountXaf],
  );
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutId, returnUrl: new URL("/subscriptions", publicOrigin).toString(),
        returnMethod: "INSTANT", defaultLanguage: "fr", countries: ["CMR"],
        amounts: [{ country: "CMR", currency: "XAF", amount: String(amountXaf) }],
        clientReferenceId, reason: { fr: `Test abonnement XPress Pro ${input.targetPlanSlug}` },
        metadata: [{ organisationId: String(input.organisationId) }, { planSlug: input.targetPlanSlug }],
      }),
    });
  } catch {
    await pool.query("UPDATE saas_v4_shadow_sandbox_checkouts SET status = 'review' WHERE checkout_id = $1", [checkoutId]);
    throw new Error("SANDBOX_CHECKOUT_CREATE_UNCERTAIN");
  }
  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.status !== "ACCEPTED" || data.checkoutId !== checkoutId ||
      typeof data.checkoutCode !== "string" || typeof data.redirectUrl !== "string") {
    await pool.query("UPDATE saas_v4_shadow_sandbox_checkouts SET status = 'review' WHERE checkout_id = $1", [checkoutId]);
    throw new Error("SANDBOX_CHECKOUT_REJECTED_OR_INVALID");
  }
  const redirect = new URL(data.redirectUrl);
  if (redirect.origin !== "https://checkout.sandbox.pawapay.io") {
    await pool.query("UPDATE saas_v4_shadow_sandbox_checkouts SET status = 'review' WHERE checkout_id = $1", [checkoutId]);
    throw new Error("SANDBOX_REDIRECT_INVALID");
  }
  await pool.query(
    "UPDATE saas_v4_shadow_sandbox_checkouts SET status = 'accepted', checkout_code = $2, redirect_url = $3 WHERE checkout_id = $1",
    [checkoutId, data.checkoutCode, redirect.toString()],
  );
  return { checkoutId, redirectUrl: redirect.toString() };
}

export async function reconcileShadowSandboxCheckout(checkoutId: string, organisationId: number): Promise<string> {
  const token = sandboxToken();
  const response = await fetch(`${API_URL}/${checkoutId}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("SANDBOX_STATUS_UNAVAILABLE");
  const providerResponse: unknown = await response.json();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const intent = await client.query(
      `SELECT * FROM saas_v4_shadow_sandbox_checkouts
       WHERE checkout_id = $1 AND organisation_id = $2 FOR UPDATE`, [checkoutId, organisationId],
    );
    const row = intent.rows[0];
    if (!row || !row.checkout_code) throw new Error("SHADOW_CHECKOUT_NOT_READY");
    if (row.activated_at) { await client.query("COMMIT"); return "already_activated"; }
    const status = inspectProductionCheckoutV4({
      checkoutId, checkoutCode: row.checkout_code,
      clientReferenceId: row.client_reference_id,
      organisationId, targetPlanSlug: row.target_plan_slug,
      amountXaf: Number(row.amount_xaf),
    }, providerResponse);
    if (status !== "completed") {
      await client.query("UPDATE saas_v4_shadow_sandbox_checkouts SET status = $2, verified_at = now() WHERE checkout_id = $1",
        [checkoutId, status]);
      await client.query("COMMIT");
      return status;
    }
    const previous = await client.query(
      "SELECT * FROM saas_v4_shadow_entitlements WHERE organisation_id = $1 FOR UPDATE", [organisationId],
    );
    const old = previous.rows[0];
    const now = new Date();
    const switched = confirmedPaidPlanSwitchV4(old ? {
      planSlug: old.plan_slug, state: "active", trialStartedAt: null,
      trialEndsAt: null, cycleStartedAt: old.cycle_started_at, cycleEndsAt: old.cycle_ends_at,
    } : null, row.target_plan_slug, now);
    await client.query(
      `INSERT INTO saas_v4_shadow_entitlements
       (organisation_id, plan_slug, cycle_started_at, cycle_ends_at, source_checkout_id)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (organisation_id) DO UPDATE SET
       plan_slug = EXCLUDED.plan_slug, cycle_started_at = EXCLUDED.cycle_started_at,
       cycle_ends_at = EXCLUDED.cycle_ends_at, source_checkout_id = EXCLUDED.source_checkout_id,
       updated_at = now()`,
      [organisationId, row.target_plan_slug, switched.entitlement.cycleStartedAt,
        switched.entitlement.cycleEndsAt, checkoutId],
    );
    await client.query("UPDATE saas_v4_shadow_sandbox_checkouts SET status = 'completed', verified_at = $2, activated_at = $2 WHERE checkout_id = $1",
      [checkoutId, now]);
    await client.query("COMMIT");
    return "activated";
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
