import { sql } from "drizzle-orm";
import { db } from "../db";
import { inspectProductionCheckoutV4 } from "./pawapay-production-checkout-v4";
import { confirmedPaidPlanSwitchV4, type PaidSaasPlanV4 } from "./saas-plan-transition-v4";
import type { SaasEntitlementV4 } from "./saas-entitlement-v4";
import type { SaasV4ProviderEnvironment } from "./saas-v4-provider-mode";

type ActivationResult = "activated" | "already_activated" | "pending" | "failed";

// Only call after fetching providerResponse from PawaPay's production status
// endpoint on the server. Never pass a browser payload or a callback body.
export async function activateVerifiedProductionCheckoutV4(
  checkoutId: string, providerResponse: unknown, verifiedAt: Date = new Date(),
  providerEnvironment: SaasV4ProviderEnvironment = "production",
): Promise<ActivationResult> {
  if (process.env.SAAS_V4_PAID_BILLING !== "true") throw new Error("SAAS_PAID_BILLING_DISABLED");
  if (!Number.isFinite(verifiedAt.getTime())) throw new RangeError("Invalid verification time");
  return db.transaction(async (tx) => {
    const intentResult = await tx.execute(sql`
      SELECT checkout_id, client_reference_id, checkout_code, organisation_id,
             target_plan_slug, amount_xaf, provider_environment, activated_at
      FROM saas_payment_intents_v4 WHERE checkout_id = ${checkoutId}
        AND provider_environment = ${providerEnvironment} FOR UPDATE
    `);
    const intent = intentResult.rows[0];
    if (!intent || !intent.checkout_code) {
      throw new Error("SAAS_PRODUCTION_INTENT_NOT_READY");
    }
    if (intent.activated_at) return "already_activated";
    const status = inspectProductionCheckoutV4({
      checkoutId: String(intent.checkout_id),
      checkoutCode: String(intent.checkout_code),
      clientReferenceId: String(intent.client_reference_id),
      organisationId: Number(intent.organisation_id),
      targetPlanSlug: intent.target_plan_slug as PaidSaasPlanV4,
      amountXaf: Number(intent.amount_xaf),
    }, providerResponse);
    if (status !== "completed") {
      await tx.execute(sql`UPDATE saas_payment_intents_v4 SET state = ${status},
        provider_status = ${status}, provider_verified_at = ${verifiedAt}, updated_at = now()
        WHERE checkout_id = ${checkoutId}`);
      return status;
    }
    const entitlementResult = await tx.execute(sql`
      SELECT plan_slug, state, trial_started_at, trial_ends_at,
             cycle_started_at, cycle_ends_at
      FROM saas_entitlements_v4 WHERE organisation_id = ${intent.organisation_id} FOR UPDATE
    `);
    const row = entitlementResult.rows[0];
    if (!row) throw new Error("SAAS_ENTITLEMENT_MISSING");
    const previous: SaasEntitlementV4 = {
      planSlug: row.plan_slug as SaasEntitlementV4["planSlug"],
      state: row.state as SaasEntitlementV4["state"],
      trialStartedAt: row.trial_started_at as Date | null,
      trialEndsAt: row.trial_ends_at as Date | null,
      cycleStartedAt: row.cycle_started_at as Date | null,
      cycleEndsAt: row.cycle_ends_at as Date | null,
    };
    const switched = confirmedPaidPlanSwitchV4(previous,
      intent.target_plan_slug as PaidSaasPlanV4, verifiedAt);
    if (switched.fullPlanPriceXaf !== Number(intent.amount_xaf)) {
      throw new Error("SAAS_PRICE_SNAPSHOT_MISMATCH");
    }
    await tx.execute(sql`INSERT INTO saas_payment_receipts_v4
      (checkout_id, organisation_id, provider_environment, amount_xaf, provider_verified_at)
      VALUES (${checkoutId}, ${intent.organisation_id}, ${providerEnvironment}, ${intent.amount_xaf}, ${verifiedAt})`);
    await tx.execute(sql`UPDATE saas_entitlements_v4 SET
      plan_slug = ${switched.entitlement.planSlug}, state = 'active',
      cycle_started_at = ${switched.entitlement.cycleStartedAt},
      cycle_ends_at = ${switched.entitlement.cycleEndsAt},
      scheduled_plan_slug = NULL, version = version + 1, updated_at = now()
      WHERE organisation_id = ${intent.organisation_id}`);
    await tx.execute(sql`UPDATE saas_payment_intents_v4 SET
      state = 'completed', provider_status = 'COMPLETED',
      provider_verified_at = ${verifiedAt}, activated_at = ${verifiedAt}, updated_at = now()
      WHERE checkout_id = ${checkoutId}`);
    return "activated";
  });
}
