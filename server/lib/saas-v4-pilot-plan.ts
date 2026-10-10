import { sql } from "drizzle-orm";
import { db } from "../db";
import { effectiveSaasPlanV4 } from "./saas-entitlement-v4";
import type { SaasPlanV4 } from "./saas-plan-v4";

export function isPaidPilotOrganisationV4(organisationId: number): boolean {
  return process.env.SAAS_V4_PAID_BILLING === "true" &&
    (process.env.SAAS_V4_PILOT_ORGANISATION_IDS ?? "")
      .split(",").some((value) => Number(value.trim()) === organisationId);
}

export async function isEnforcedPilotOrganisationV4(organisationId: number): Promise<boolean> {
  if (process.env.SAAS_V4_ENFORCEMENT !== "true" ||
      !isPaidPilotOrganisationV4(organisationId)) return false;
  const activated = await db.execute(sql`
    SELECT 1 FROM saas_payment_receipts_v4
    WHERE organisation_id = ${organisationId} LIMIT 1
  `);
  return activated.rows.length > 0;
}

// While an organisation is in the paid pilot, legacy subscriptions must never
// be used to decide access: the verified v4 payment ledger is authoritative.
export async function paidPilotPlanV4(organisationId: number | null | undefined): Promise<SaasPlanV4 | null> {
  if (!organisationId || !isPaidPilotOrganisationV4(organisationId)) return null;
  // Preserve the existing legacy entitlement until the first verified v4
  // payment has activated. Merely enabling the pilot must not downgrade an
  // organisation that is about to pay.
  const activated = await db.execute(sql`
    SELECT 1 FROM saas_payment_receipts_v4
    WHERE organisation_id = ${organisationId} LIMIT 1
  `);
  if (!activated.rows.length) return null;
  const result = await db.execute(sql`
    SELECT plan_slug, state, trial_started_at, trial_ends_at,
           cycle_started_at, cycle_ends_at
    FROM saas_entitlements_v4 WHERE organisation_id = ${organisationId}
  `);
  const row = result.rows[0];
  if (!row) throw new Error("SAAS_PILOT_ENTITLEMENT_MISSING");
  return effectiveSaasPlanV4({
    planSlug: row.plan_slug as SaasPlanV4,
    state: row.state as "trialing" | "active" | "starter" | "past_due",
    trialStartedAt: row.trial_started_at as Date | null,
    trialEndsAt: row.trial_ends_at as Date | null,
    cycleStartedAt: row.cycle_started_at as Date | null,
    cycleEndsAt: row.cycle_ends_at as Date | null,
  }, new Date());
}
