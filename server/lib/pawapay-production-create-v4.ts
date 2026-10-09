import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { SAAS_PLANS_V4 } from "./saas-plan-v4";
import type { PaidSaasPlanV4 } from "./saas-plan-transition-v4";
import { effectiveSaasPlanV4 } from "./saas-entitlement-v4";

const API_URL = "https://api.pawapay.io/v2/checkouts";

export async function createProductionPlanCheckoutV4(input: {
  organisationId: number;
  createdByUserId: string;
  targetPlanSlug: PaidSaasPlanV4;
}): Promise<{ checkoutId: string; redirectUrl: string }> {
  if (process.env.SAAS_V4_PAID_BILLING !== "true") throw new Error("SAAS_PAID_BILLING_DISABLED");
  const pilotIds = (process.env.SAAS_V4_PILOT_ORGANISATION_IDS ?? "")
    .split(",").map((id) => Number(id.trim())).filter(Number.isSafeInteger);
  if (!pilotIds.includes(input.organisationId)) throw new Error("SAAS_PAID_PILOT_NOT_ENABLED");
  if (input.targetPlanSlug !== "pro" && input.targetPlanSlug !== "business") {
    throw new Error("SAAS_PLAN_NOT_PURCHASABLE");
  }
  const token = process.env.PAWAPAY_PRODUCTION_API_TOKEN;
  if (!token) throw new Error("PAWAPAY_PRODUCTION_TOKEN_MISSING");
  const appOrigin = process.env.SAAS_V4_PUBLIC_APP_ORIGIN;
  if (!appOrigin) throw new Error("SAAS_PUBLIC_APP_ORIGIN_MISSING");
  const origin = new URL(appOrigin);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("SAAS_PUBLIC_APP_ORIGIN_INVALID");
  }
  const checkoutId = crypto.randomUUID();
  const clientReferenceId = `XP-PROD-${checkoutId}`;
  const amountXaf = SAAS_PLANS_V4[input.targetPlanSlug].monthlyXaf;
  const entitlement = await db.execute(sql`
    SELECT plan_slug, state, trial_started_at, trial_ends_at,
           cycle_started_at, cycle_ends_at
    FROM saas_entitlements_v4 WHERE organisation_id = ${input.organisationId}
  `);
  const current = entitlement.rows[0];
  if (!current) throw new Error("SAAS_ENTITLEMENT_MISSING");
  if (current.state === "active" && effectiveSaasPlanV4({
    planSlug: current.plan_slug as "starter" | "pro" | "business",
    state: "active",
    trialStartedAt: current.trial_started_at as Date | null,
    trialEndsAt: current.trial_ends_at as Date | null,
    cycleStartedAt: current.cycle_started_at as Date | null,
    cycleEndsAt: current.cycle_ends_at as Date | null,
  }, new Date()) === input.targetPlanSlug) {
    throw new Error("EARLY_SAME_PLAN_RENEWAL_NOT_DEFINED");
  }
  await db.execute(sql`INSERT INTO saas_payment_intents_v4
    (checkout_id, client_reference_id, organisation_id, created_by_user_id,
     target_plan_slug, amount_xaf)
    VALUES (${checkoutId}, ${clientReferenceId}, ${input.organisationId},
      ${input.createdByUserId}, ${input.targetPlanSlug}, ${amountXaf})`);
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutId,
        returnUrl: new URL("/subscriptions", origin).toString(),
        returnMethod: "INSTANT", defaultLanguage: "fr", countries: ["CMR"],
        amounts: [{ country: "CMR", currency: "XAF", amount: String(amountXaf) }],
        clientReferenceId,
        reason: { fr: `Abonnement XPress Pro ${input.targetPlanSlug}` },
        metadata: [{ organisationId: String(input.organisationId) },
          { planSlug: input.targetPlanSlug }],
      }),
    });
  } catch {
    // The provider may have accepted the request before a timeout. Preserve
    // the intent for reconciliation; do not retry under a new checkout ID.
    await db.execute(sql`UPDATE saas_payment_intents_v4 SET state = 'review',
      updated_at = now() WHERE checkout_id = ${checkoutId}`);
    throw new Error("PAWAPAY_PRODUCTION_CREATE_UNCERTAIN");
  }
  const result: unknown = await response.json().catch(() => null);
  const data = result as Record<string, unknown> | null;
  if (!response.ok || data?.status !== "ACCEPTED" || data.checkoutId !== checkoutId ||
      typeof data.checkoutCode !== "string" || typeof data.redirectUrl !== "string") {
    await db.execute(sql`UPDATE saas_payment_intents_v4 SET state = 'review',
      provider_status = ${typeof data?.status === "string" ? data.status : `HTTP_${response.status}`},
      updated_at = now() WHERE checkout_id = ${checkoutId}`);
    throw new Error("PAWAPAY_PRODUCTION_CREATE_REJECTED_OR_INVALID");
  }
  const redirect = new URL(data.redirectUrl);
  if (redirect.origin !== "https://checkout.pawapay.io") {
    await db.execute(sql`UPDATE saas_payment_intents_v4 SET state = 'review',
      updated_at = now() WHERE checkout_id = ${checkoutId}`);
    throw new Error("PAWAPAY_PRODUCTION_REDIRECT_INVALID");
  }
  await db.execute(sql`UPDATE saas_payment_intents_v4 SET state = 'accepted',
    checkout_code = ${data.checkoutCode}, provider_status = 'ACCEPTED', updated_at = now()
    WHERE checkout_id = ${checkoutId}`);
  return { checkoutId, redirectUrl: redirect.toString() };
}
