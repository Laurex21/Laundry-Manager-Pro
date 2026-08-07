import type { PoolClient } from "pg";
import { pool } from "../db";
import { calculateOrderTotals, canonicalMoney, compareMoney, fingerprintRequest, multiplyMoney, persistPaidCorrectionOutcome, persistRefundInTransaction, subtractMoney, sumMoney } from "./order-money";
export { paidCorrectionOutcome } from "./order-money";

export class OrderCorrectionError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
  }
}

export type ControlledOrderEditInput = {
  customerId: number;
  entryDate: Date;
  pickupDate: Date | null;
  reason: string;
  idempotencyKey?: string;
  items: Array<{ serviceId: number; quantity: number }>;
  garments: Array<{ itemName: string; quantity: number; color?: string | null }>;
};

export function deriveTreatmentAdjustment(input: {
  originalQuantity: string;
  existingQuantityEffects: string[];
  requestedQuantityEffect?: string;
  capturedRate: string;
  serviceQuantity: string;
  unit: "piece" | "kg";
  level: string;
  action: "adjustment" | "void";
  reason: string;
  acknowledgement?: { affirmed: boolean; textVersion: string };
}) {
  if (!input.reason.trim()) throw new OrderCorrectionError("Treatment correction reason is required");
  const effectiveBefore = sumMoney([input.originalQuantity, ...input.existingQuantityEffects]);
  const quantityEffect = input.action === "void" ? `-${effectiveBefore}` : canonicalMoney(input.requestedQuantityEffect ?? "0");
  if (compareMoney(quantityEffect, "0") === 0) throw new OrderCorrectionError("Treatment correction quantity cannot be zero");
  const effectiveAfter = sumMoney([effectiveBefore, quantityEffect]);
  if (compareMoney(effectiveAfter, "0") < 0 || compareMoney(effectiveAfter, input.serviceQuantity) > 0) throw new OrderCorrectionError("Treatment quantity must remain within the related service quantity");
  if (input.unit === "piece" && !Number.isInteger(Number(effectiveAfter))) throw new OrderCorrectionError("Piece treatment quantity must be a whole number");
  if (input.level === "very_intensive" && compareMoney(quantityEffect, "0") > 0 && (!input.acknowledgement?.affirmed || !input.acknowledgement.textVersion.trim())) {
    throw new OrderCorrectionError("Fresh Very intensive acknowledgement is required");
  }
  const absoluteAmount = multiplyMoney(quantityEffect.replace(/^-/, ""), input.capturedRate);
  const amountEffect = quantityEffect.startsWith("-") ? `-${absoluteAmount}` : absoluteAmount;
  return { quantityEffect, amountEffect, effectiveBefore, effectiveAfter };
}

export type TreatmentAdjustmentInput = {
  action: "adjustment" | "void";
  quantityEffect?: string;
  reason: string;
  idempotencyKey: string;
  acknowledgement?: { affirmed: boolean; textVersion: string };
};

export async function adjustStainTreatment(
  treatmentId: number,
  siteId: number,
  actorUserId: string,
  input: TreatmentAdjustmentInput,
  transactionSource: Pick<typeof pool, "connect"> = pool,
) {
  const client = await transactionSource.connect();
  try {
    await client.query("BEGIN");
    // Global lock order: order item, then its treatment row. This serializes
    // service reductions, simultaneous increases, and increase/void races.
    const located = await client.query(
      `SELECT t.order_item_id FROM order_stain_treatments t WHERE t.id=$1 AND t.site_id=$2`,
      [treatmentId, siteId],
    );
    if (!located.rowCount) throw new OrderCorrectionError("Stain treatment not found", 404);
    await client.query(`SELECT id FROM order_items WHERE id=$1 FOR UPDATE`, [located.rows[0].order_item_id]);
    const treatmentResult = await client.query(
      `SELECT t.*,oi.quantity AS service_quantity,o.total_amount,o.customer_id,o.payment_status,
              (SELECT coalesce(sum(st.line_total + coalesce((SELECT sum(sa.amount_effect) FROM order_stain_treatment_adjustments sa WHERE sa.treatment_id=st.id),0)),0) FROM order_stain_treatments st WHERE st.order_id=o.id)::text AS treatment_subtotal
       FROM order_stain_treatments t JOIN order_items oi ON oi.id=t.order_item_id AND oi.order_id=t.order_id
       JOIN orders o ON o.id=t.order_id AND o.organisation_id=t.organisation_id AND o.site_id=t.site_id
       WHERE t.id=$1 AND t.site_id=$2 FOR UPDATE OF t,o`,
      [treatmentId, siteId],
    );
    if (!treatmentResult.rowCount) throw new OrderCorrectionError("Stain treatment not found", 404);
    const treatment = treatmentResult.rows[0];
    const existing = await client.query(
      `SELECT * FROM order_stain_treatment_adjustments WHERE organisation_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [treatment.organisation_id, input.idempotencyKey],
    );
    const expected = fingerprintRequest({ treatmentId, action: input.action, quantityEffect: input.quantityEffect ?? null, reason: input.reason, acknowledgement: input.acknowledgement ?? null }, { moneyPaths: ["quantityEffect"] });
    if (existing.rowCount) {
      const row = existing.rows[0];
      const actual = fingerprintRequest({ treatmentId: row.treatment_id, action: row.action, quantityEffect: row.action === "void" ? null : row.quantity_effect, reason: row.reason, acknowledgement: row.acknowledgement_affirmed ? { affirmed: true, textVersion: row.acknowledgement_text_version } : null }, { moneyPaths: ["quantityEffect"] });
      if (actual !== expected) throw new OrderCorrectionError("Idempotency key was already used with a different treatment correction", 409);
      await client.query("COMMIT");
      return { adjustment: row, replayed: true };
    }
    const effects = await client.query(`SELECT quantity_effect FROM order_stain_treatment_adjustments WHERE treatment_id=$1 ORDER BY id FOR UPDATE`, [treatmentId]);
    const derived = deriveTreatmentAdjustment({
      originalQuantity: treatment.quantity,
      existingQuantityEffects: effects.rows.map((row) => String(row.quantity_effect)),
      requestedQuantityEffect: input.quantityEffect,
      capturedRate: treatment.captured_rate,
      serviceQuantity: treatment.service_quantity,
      unit: treatment.unit,
      level: treatment.level,
      action: input.action,
      reason: input.reason,
      acknowledgement: input.acknowledgement,
    });
    const inserted = await client.query(
      `INSERT INTO order_stain_treatment_adjustments
       (organisation_id,site_id,treatment_id,quantity_effect,amount_effect,action,reason,idempotency_key,acknowledgement_affirmed,acknowledgement_text_version,acknowledged_by,acknowledged_at,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $9 THEN NOW() ELSE NULL END,$11) RETURNING *`,
      [treatment.organisation_id,siteId,treatmentId,derived.quantityEffect,derived.amountEffect,input.action,input.reason,input.idempotencyKey,input.acknowledgement?.affirmed || null,input.acknowledgement?.textVersion || null,actorUserId],
    );
    const totalAmount = sumMoney([treatment.total_amount, derived.amountEffect]);
    const treatmentSubtotal = sumMoney([treatment.treatment_subtotal, derived.amountEffect]);
    const postedResult = await client.query(
      `SELECT coalesce((SELECT sum(amount) FROM payments WHERE order_id=$1 AND organisation_id=$2 AND site_id=$3),0)::text AS paid,
              coalesce((SELECT sum(amount) FROM order_refunds WHERE order_id=$1 AND organisation_id=$2 AND site_id=$3),0)::text AS refunded,
              coalesce((SELECT sum(amount) FROM credit_transactions WHERE order_id=$1 AND organisation_id=$2 AND site_id=$3 AND type='debit'),0)::text AS credit_applied`,
      [treatment.order_id,treatment.organisation_id,siteId],
    );
    const posted = postedResult.rows[0];
    const netPosted = subtractMoney(posted.paid, posted.refunded);
    const comparison = compareMoney(totalAmount, netPosted);
    const outcome = comparison > 0 ? { kind: "balance" as const, amount: subtractMoney(totalAmount,netPosted) }
      : comparison === 0 ? { kind: "balanced" as const, amount: "0.00" as const }
      : compareMoney(posted.credit_applied,"0") > 0 ? { kind: "customer_credit" as const, amount: subtractMoney(netPosted,totalAmount) }
      : { kind: "approved_internal_refund" as const, amount: subtractMoney(netPosted,totalAmount), externalTransfer: false as const };
    await client.query(`UPDATE orders SET total_amount=$2,payment_status=CASE WHEN $3::numeric=0 THEN 'paid' WHEN $4::numeric>0 THEN 'partial' ELSE payment_status END,updated_at=NOW() WHERE id=$1`, [treatment.order_id,totalAmount,outcome.amount,comparison]);
    if (outcome.kind === "customer_credit" || outcome.kind === "approved_internal_refund") {
      await persistPaidCorrectionOutcome(client, {
        organisationId: treatment.organisation_id, siteId, orderId: treatment.order_id,
        idempotencyKey: `${input.idempotencyKey}:financial`, kind: outcome.kind, amount: outcome.amount,
        reason: input.reason, actorUserId, customerId: treatment.customer_id,
        allocations: outcome.kind === "approved_internal_refund" ? [{ target: "treatment", treatmentId, amount: outcome.amount }] : undefined,
      });
    }
    await client.query("COMMIT");
    return { adjustment: inserted.rows[0], treatmentSubtotal, totalAmount, financialOutcome: outcome, replayed: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function dependencies(client: PoolClient, orderId: number) {
  const availabilityResult = await client.query(
    `SELECT
       to_regclass('public.payments') IS NOT NULL AS payments,
       to_regclass('public.credit_transactions') IS NOT NULL AS credit_transactions,
       to_regclass('public.order_refunds') IS NOT NULL AS order_refunds,
       to_regclass('public.order_payment_allocations') IS NOT NULL AS payment_allocations,
       to_regclass('public.order_refund_allocations') IS NOT NULL AS refund_allocations,
       to_regclass('public.subscription_transactions') IS NOT NULL AS subscription_transactions,
       to_regclass('public.production_cycle_orders') IS NOT NULL AS production_cycle_orders,
       to_regclass('public.production_cycles') IS NOT NULL AS production_cycles,
       to_regclass('public.machine_usage') IS NOT NULL AS machine_usage,
       to_regclass('public.loyalty_points') IS NOT NULL AS loyalty_points,
       to_regclass('public.order_status_history') IS NOT NULL AS order_status_history,
       to_regclass('public.order_stain_treatments') IS NOT NULL AS order_stain_treatments,
       to_regclass('public.order_stain_treatment_adjustments') IS NOT NULL AS order_stain_treatment_adjustments,
       to_regclass('public.order_corrections') IS NOT NULL AS order_corrections`,
  );
  const available = availabilityResult.rows[0];
  const check = (enabled: boolean, sql: string) => enabled ? `EXISTS(${sql})` : "false";
  const result = await client.query(
    `SELECT
       ${check(available.payments, "SELECT 1 FROM payments WHERE order_id = $1")} AS has_payments,
       ${check(available.credit_transactions, "SELECT 1 FROM credit_transactions WHERE order_id = $1")} AS has_credit,
       ${check(available.order_refunds, "SELECT 1 FROM order_refunds WHERE order_id = $1")} AS has_refunds,
       ${check(available.payment_allocations, "SELECT 1 FROM order_payment_allocations opa JOIN payments p ON p.id=opa.payment_id WHERE p.order_id = $1")} AS has_payment_allocations,
       ${check(available.refund_allocations, "SELECT 1 FROM order_refund_allocations ora JOIN order_refunds r ON r.id=ora.refund_id WHERE r.order_id = $1")} AS has_refund_allocations,
       ${check(available.subscription_transactions, "SELECT 1 FROM subscription_transactions WHERE order_id = $1")} AS has_subscription,
       ${check(available.production_cycle_orders, "SELECT 1 FROM production_cycle_orders WHERE order_id = $1")} AS has_cycles,
       ${check(available.production_cycle_orders && available.production_cycles, `
         SELECT 1 FROM production_cycle_orders pco
         JOIN production_cycles pc ON pc.id = pco.cycle_id
         WHERE pco.order_id = $1 AND pc.status IN ('preparing', 'running')
       `)} AS has_active_cycles,
       ${check(available.machine_usage, "SELECT 1 FROM machine_usage WHERE order_id = $1")} AS has_machine_usage,
       ${check(available.loyalty_points, "SELECT 1 FROM loyalty_points WHERE order_id = $1")} AS has_loyalty,
       ${check(available.order_status_history, "SELECT 1 FROM order_status_history WHERE order_id = $1 AND status <> 'received'")} AS has_status_progress,
       ${check(available.order_stain_treatments, "SELECT 1 FROM order_stain_treatments WHERE order_id = $1")} AS has_treatments,
       ${check(available.order_corrections, "SELECT 1 FROM order_corrections WHERE order_id = $1")} AS has_corrections`,
    [orderId],
  );
  return result.rows[0];
}

async function snapshot(client: PoolClient, orderId: number) {
  const result = await client.query(
    `SELECT to_jsonb(o) AS "order",
       COALESCE((SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.id) FROM order_items oi WHERE oi.order_id = o.id), '[]'::jsonb) AS items,
       COALESCE((SELECT jsonb_agg(to_jsonb(gi) ORDER BY gi.id) FROM garment_items gi WHERE gi.order_id = o.id), '[]'::jsonb) AS garments,
       COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM order_stain_treatments t WHERE t.order_id = o.id), '[]'::jsonb) AS treatments,
       COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM order_stain_treatment_adjustments a JOIN order_stain_treatments t ON t.id=a.treatment_id WHERE t.order_id=o.id), '[]'::jsonb) AS treatment_adjustments,
       COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM order_payment_allocations a JOIN payments p ON p.id=a.payment_id WHERE p.order_id=o.id), '[]'::jsonb) AS payment_allocations,
       COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM order_refund_allocations a JOIN order_refunds r ON r.id=a.refund_id WHERE r.order_id=o.id), '[]'::jsonb) AS refund_allocations
     FROM orders o WHERE o.id = $1`,
    [orderId],
  );
  return result.rows[0] ?? null;
}

export async function getOrderCorrectionEligibility(orderId: number, siteId: number) {
  const client = await pool.connect();
  try {
    const orderResult = await client.query(
      `SELECT id, status, payment_status, corrected_from_order_id FROM orders WHERE id = $1 AND site_id = $2`,
      [orderId, siteId],
    );
    const order = orderResult.rows[0];
    if (!order) throw new OrderCorrectionError("Order not found", 404);
    const deps = await dependencies(client, orderId);
    const active = !["cancelled", "cancellation_requested"].includes(order.status);
    const isUnusedCorrectedCopy = !!order.corrected_from_order_id && !deps.has_corrections;
    const canEdit = active
      && (order.status === "received" || isUnusedCorrectedCopy)
      && order.payment_status === "unpaid"
      && !deps.has_payments
      && !deps.has_credit
      && !deps.has_subscription
      && !deps.has_cycles
      && !deps.has_machine_usage
      && !deps.has_loyalty
      && !deps.has_active_cycles
      && (!deps.has_status_progress || isUnusedCorrectedCopy);
    const canCreateCorrectedCopy = active
      && !deps.has_payments
      && !deps.has_credit
      && !deps.has_subscription
      && !deps.has_loyalty
      && !deps.has_active_cycles;
    return {
      canEdit,
      canCreateCorrectedCopy,
      hasPayments: deps.has_payments,
      hasCreditTransactions: deps.has_credit,
      hasSubscriptionCoverage: deps.has_subscription,
      hasProductionCycles: deps.has_cycles,
      reason: canEdit
        ? null
        : deps.has_payments || deps.has_credit || deps.has_subscription
          ? "financial_impact"
          : deps.has_cycles || deps.has_machine_usage || deps.has_status_progress || order.status !== "received"
            ? "operational_impact"
            : "inactive_order",
    };
  } finally {
    client.release();
  }
}

export async function editOrderControlled(
  orderId: number,
  siteId: number,
  actorUserId: string | null,
  input: ControlledOrderEditInput,
  transactionSource: Pick<typeof pool, "connect"> = pool,
) {
  const client = await transactionSource.connect();
  try {
    await client.query("BEGIN");
    const orderResult = await client.query(
      `SELECT o.*, s.organisation_id,
         EXISTS(SELECT 1 FROM order_corrections oc WHERE oc.order_id = o.id) AS has_corrections
       FROM orders o JOIN sites s ON s.id = o.site_id
       WHERE o.id = $1 AND o.site_id = $2
       FOR UPDATE OF o`,
      [orderId, siteId],
    );
    const order = orderResult.rows[0];
    if (!order) throw new OrderCorrectionError("Order not found", 404);
    const requestFingerprint = input.idempotencyKey ? fingerprintRequest({
      orderId,
      customerId: input.customerId,
      entryDate: input.entryDate.toISOString(),
      pickupDate: input.pickupDate?.toISOString() ?? null,
      reason: input.reason,
      items: input.items,
      garments: input.garments.map((garment) => ({ ...garment, color: garment.color ?? null })),
    }) : null;
    if (input.idempotencyKey) {
      const completed = await client.query(
        `SELECT after_snapshot FROM order_corrections
         WHERE order_id=$1 AND site_id=$2 AND after_snapshot->>'idempotencyKey'=$3
         ORDER BY id LIMIT 1 FOR UPDATE`,
        [orderId,siteId,input.idempotencyKey],
      );
      if (completed.rowCount) {
        const recorded = completed.rows[0].after_snapshot;
        if (recorded?.requestFingerprint !== requestFingerprint) throw new OrderCorrectionError("Idempotency key was already used with a different correction request", 409);
        await client.query("COMMIT");
        return recorded.correctionResult;
      }
    }
    const deps = await dependencies(client, orderId);
    const isUnusedCorrectedCopy = !!order.corrected_from_order_id && !order.has_corrections;
    const hasFinancialImpact = deps.has_payments || deps.has_credit;
    const hasMoneyActivity = hasFinancialImpact || deps.has_refunds || deps.has_payment_allocations || deps.has_refund_allocations;
    if (
      (order.status !== "received" && !isUnusedCorrectedCopy)
      || deps.has_subscription
      || deps.has_cycles
      || deps.has_machine_usage
      || deps.has_loyalty
      || deps.has_active_cycles
      || (deps.has_status_progress && !isUnusedCorrectedCopy)
    ) {
      throw new OrderCorrectionError("This order already has a financial or operational impact and can no longer be edited", 409);
    }
    if (hasFinancialImpact && !input.idempotencyKey) {
      throw new OrderCorrectionError("Paid corrections require an idempotency key", 400);
    }
    if (hasMoneyActivity && Number(input.customerId) !== Number(order.customer_id)) {
      throw new OrderCorrectionError("Customer cannot be changed after a payment, credit, refund, or allocation has been recorded", 409);
    }

    const customerResult = await client.query(
      `SELECT c.id FROM customers c JOIN sites s ON s.id = c.site_id
       WHERE c.id = $1 AND s.organisation_id = $2`,
      [input.customerId, order.organisation_id],
    );
    if (!customerResult.rowCount) throw new OrderCorrectionError("Customer does not belong to this organisation", 403);

    const serviceIds = [...new Set(input.items.map((item) => item.serviceId))];
    const servicesResult = await client.query(
      `SELECT sv.id, sv.price
       FROM services sv JOIN sites s ON s.id = sv.site_id
       WHERE sv.id = ANY($1::int[]) AND s.organisation_id = $2 AND sv.active = true`,
      [serviceIds, order.organisation_id],
    );
    if (servicesResult.rowCount !== serviceIds.length) {
      throw new OrderCorrectionError("One or more services are unavailable for this organisation");
    }
    const existingPricesResult = await client.query(
      `SELECT service_id, price_at_order FROM order_items WHERE order_id = $1 ORDER BY id`,
      [orderId],
    );
    const existingPrices = new Map<number, string>();
    for (const item of existingPricesResult.rows) {
      if (!existingPrices.has(Number(item.service_id))) {
        existingPrices.set(Number(item.service_id), String(item.price_at_order));
      }
    }
    const prices = new Map(servicesResult.rows.map((service) => [
      Number(service.id),
      existingPrices.get(Number(service.id)) ?? String(service.price),
    ]));
    const serviceMoney = calculateOrderTotals(input.items.map((item) => ({ price: prices.get(item.serviceId) ?? "0", quantity: item.quantity })), String(order.discount_pct || 0), String(order.discount_amount || order.discount || 0), String(order.pickup_cost || 0));
    const treatmentTotalResult = await client.query(
      `SELECT coalesce(sum(t.line_total + coalesce((SELECT sum(a.amount_effect) FROM order_stain_treatment_adjustments a WHERE a.treatment_id=t.id),0)),0)::text AS total
       FROM order_stain_treatments t WHERE t.order_id=$1 AND t.organisation_id=$2 AND t.site_id=$3`,
      [orderId,order.organisation_id,siteId],
    );
    const treatmentSubtotal = canonicalMoney(String(treatmentTotalResult.rows[0]?.total ?? "0"));
    const money = { ...serviceMoney, subtotal: sumMoney([serviceMoney.subtotal, treatmentSubtotal]), total: sumMoney([serviceMoney.total, treatmentSubtotal]) };
    const before = await snapshot(client, orderId);

    const postedResult = hasFinancialImpact ? await client.query(
      `SELECT
         coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id=$1 AND p.organisation_id=$2 AND p.site_id=$3),0)::text AS posted_paid,
         coalesce((SELECT sum(r.amount) FROM order_refunds r WHERE r.order_id=$1 AND r.organisation_id=$2 AND r.site_id=$3),0)::text AS refunded,
         coalesce((SELECT sum(ct.amount) FROM credit_transactions ct WHERE ct.order_id=$1 AND ct.organisation_id=$2 AND ct.site_id=$3 AND ct.type='debit'),0)::text AS credit_applied`,
      [orderId, order.organisation_id, siteId],
    ) : { rows: [{ posted_paid: "0", refunded: "0", credit_applied: "0" }] };
    const posted = postedResult.rows[0];
    // Credit-funded payments are already represented in payments.amount. The credit
    // ledger remains provenance for disposition, not an additional posted amount.
    const netPosted = subtractMoney(posted.posted_paid, posted.refunded);
    const comparison = compareMoney(money.total, netPosted);
    const financialOutcome = !hasFinancialImpact
      ? { kind: "unpaid" as const, amount: money.total }
      : comparison > 0
        ? { kind: "balance" as const, amount: subtractMoney(money.total, netPosted) }
        : comparison === 0
          ? { kind: "balance" as const, amount: "0.00" }
          : compareMoney(posted.credit_applied, "0") > 0
            ? { kind: "customer_credit" as const, amount: subtractMoney(netPosted, money.total) }
            : { kind: "approved_internal_refund" as const, amount: subtractMoney(netPosted, money.total), externalTransfer: false as const };

    await client.query(
      `UPDATE orders SET customer_id = $2, entry_date = $3, pickup_date = $4,
         original_price = $5, discount_amount = $6, discount = $6,
         total_amount = $7, payment_status = $8, correction_reason = $9, updated_at = NOW()
       WHERE id = $1`,
      [orderId, input.customerId, input.entryDate, input.pickupDate, money.subtotal, money.discount, money.total,
       !hasFinancialImpact ? "unpaid" : comparison > 0 ? "partial" : "paid", input.reason],
    );
    const existingItems = await client.query(`SELECT id, service_id FROM order_items WHERE order_id=$1 ORDER BY id FOR UPDATE`, [orderId]);
    const reusable = new Map<number, number[]>();
    for (const row of existingItems.rows) reusable.set(Number(row.service_id), [...(reusable.get(Number(row.service_id)) ?? []), Number(row.id)]);
    const retainedItemIds: number[] = [];
    for (const item of input.items) {
      const stableId = reusable.get(item.serviceId)?.shift();
      if (stableId) {
        retainedItemIds.push(stableId);
        await client.query(`UPDATE order_items SET quantity=$2,price_at_order=$3 WHERE id=$1 AND order_id=$4`, [stableId,item.quantity,prices.get(item.serviceId),orderId]);
      } else {
        const inserted = await client.query(`INSERT INTO order_items (order_id,service_id,quantity,price_at_order) VALUES ($1,$2,$3,$4) RETURNING id`, [orderId,item.serviceId,item.quantity,prices.get(item.serviceId)]);
        retainedItemIds.push(Number(inserted.rows[0].id));
      }
    }
    await client.query(`SELECT id FROM order_stain_treatments WHERE order_id=$1 ORDER BY id FOR UPDATE`, [orderId]);
    const treatmentBounds = await client.query(
      `SELECT t.order_item_id,
         sum(t.quantity + coalesce((SELECT sum(a.quantity_effect) FROM order_stain_treatment_adjustments a WHERE a.treatment_id=t.id),0)) AS effective_quantity
       FROM order_stain_treatments t
       WHERE t.order_id=$1 GROUP BY t.order_item_id`,
      [orderId],
    );
    const quantityByItem = new Map(retainedItemIds.map((id, index) => [id, input.items[index]?.quantity ?? 0]));
    for (const treatment of treatmentBounds.rows) {
      const serviceQuantity = quantityByItem.get(Number(treatment.order_item_id));
      if (serviceQuantity == null || Number(treatment.effective_quantity) > serviceQuantity) {
        throw new OrderCorrectionError("Treatment correction required before reducing or removing its related service", 409);
      }
    }
    await client.query(`DELETE FROM order_items WHERE order_id=$1 AND NOT (id=ANY($2::int[]))`, [orderId,retainedItemIds]);
    await client.query(`DELETE FROM garment_items WHERE order_id = $1`, [orderId]);
    for (const garment of input.garments) {
      await client.query(
        `INSERT INTO garment_items (order_id, item_name, quantity, color) VALUES ($1, $2, $3, $4)`,
        [orderId, garment.itemName, garment.quantity, garment.color || null],
      );
    }

    if (hasFinancialImpact && financialOutcome.amount !== "0.00") {
      if (financialOutcome.kind === "approved_internal_refund") {
        await persistRefundInTransaction(client, {
          organisationId: order.organisation_id, siteId, orderId,
          idempotencyKey: `${input.idempotencyKey}:refund`, amount: financialOutcome.amount,
          reason: input.reason, status: "approved_internal", approvedBy: actorUserId,
          allocations: [{ target: "unallocated", amount: financialOutcome.amount }],
        });
      } else if (financialOutcome.kind === "customer_credit") {
        const customer = await client.query(`SELECT credit_balance FROM customers WHERE id=$1 AND site_id=$2 FOR UPDATE`, [input.customerId,siteId]);
        if (!customer.rowCount) throw new OrderCorrectionError("Customer not found for tenant site", 404);
        const creditBefore = canonicalMoney(customer.rows[0].credit_balance ?? "0");
        const creditAfter = sumMoney([creditBefore,financialOutcome.amount]);
        const creditKey = `${order.organisation_id}:${siteId}:${input.idempotencyKey}:correction-credit`;
        await client.query(
          `INSERT INTO credit_transactions (organisation_id,site_id,customer_id,order_id,type,amount,reason,balance_before,balance_after,notes,created_by,idempotency_key)
           VALUES ($1,$2,$3,$4,'credit',$5,'order_correction',$6,$7,$8,$9,$10)`,
          [order.organisation_id,siteId,input.customerId,orderId,financialOutcome.amount,creditBefore,creditAfter,input.reason,actorUserId,creditKey],
        );
        await client.query(`UPDATE customers SET credit_balance=$2,total_credit_added=total_credit_added+$3 WHERE id=$1 AND site_id=$4`, [input.customerId,creditAfter,financialOutcome.amount,siteId]);
      }
    }
    const correctionResult = { orderId, totalAmount: money.total, paymentStatus: !hasFinancialImpact ? "unpaid" : comparison > 0 ? "partial" : "paid", financialOutcome };
    const after = await snapshot(client, orderId);
    after.financialOutcome = { ...financialOutcome, netPosted };
    after.idempotencyKey = input.idempotencyKey ?? null;
    after.requestFingerprint = requestFingerprint;
    after.correctionResult = correctionResult;
    await client.query(
      `INSERT INTO order_corrections (order_id, site_id, reason, before_snapshot, after_snapshot, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, siteId, input.reason, before, after, actorUserId],
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [orderId, order.status, actorUserId, `Order corrected: ${input.reason}`],
    );
    await client.query("COMMIT");
    return correctionResult;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createCorrectedOrderCopy(
  orderId: number,
  siteId: number,
  actorUserId: string | null,
  actorEmployeeId: number | null,
  reason: string,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND site_id = $2 FOR UPDATE`,
      [orderId, siteId],
    );
    const order = result.rows[0];
    if (!order) throw new OrderCorrectionError("Order not found", 404);
    if (["cancelled", "cancellation_requested"].includes(order.status)) {
      throw new OrderCorrectionError("An inactive order cannot be corrected", 409);
    }
    const deps = await dependencies(client, orderId);
    if (deps.has_payments || deps.has_credit || deps.has_subscription) {
      throw new OrderCorrectionError("Paid, credited or subscription-covered orders require the cancellation workflow", 409);
    }
    const before = await snapshot(client, orderId);
    const copyResult = await client.query(
      `INSERT INTO orders
        (customer_id, created_by_employee_id, status, total_amount, payment_status,
         entry_date, pickup_date, discount, discount_pct, discount_amount,
         original_price, pickup_cost, site_id, corrected_from_order_id, correction_reason)
       VALUES ($1, $2, $3, $4, 'unpaid', NOW(), $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        order.customer_id, actorEmployeeId, "received", order.total_amount, order.pickup_date,
        order.discount, order.discount_pct, order.discount_amount, order.original_price,
        order.pickup_cost, siteId, orderId, reason,
      ],
    );
    const newOrderId = Number(copyResult.rows[0].id);
    await client.query(
      `INSERT INTO order_items (order_id, service_id, quantity, price_at_order)
       SELECT $2, service_id, quantity, price_at_order FROM order_items WHERE order_id = $1`,
      [orderId, newOrderId],
    );
    await client.query(
      `INSERT INTO garment_items (order_id, item_name, quantity, color)
       SELECT $2, item_name, quantity, color FROM garment_items WHERE order_id = $1`,
      [orderId, newOrderId],
    );
    await client.query(
      `UPDATE orders SET status = 'cancelled', cancelled_at = NOW(),
         cancellation_reason = $2, cancellation_reviewed_by = $3,
         cancellation_reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [orderId, `Replaced by corrected order #${newOrderId}: ${reason}`, actorUserId],
    );
    const after = await snapshot(client, orderId);
    await client.query(
      `INSERT INTO order_corrections (order_id, site_id, reason, before_snapshot, after_snapshot, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, siteId, reason, before, after, actorUserId],
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by, notes)
       VALUES ($1, 'cancelled', $3, $4), ($2, $5, $3, $6)`,
      [orderId, newOrderId, actorUserId, `Replaced by corrected order #${newOrderId}: ${reason}`, "received", `Corrected copy of order #${orderId}: ${reason}`],
    );
    await client.query("COMMIT");
    return { orderId: newOrderId, correctedFromOrderId: orderId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
