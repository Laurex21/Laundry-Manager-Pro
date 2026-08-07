import type { PoolClient } from "pg";
import { pool } from "../db";
import { calculateOrderTotals, canonicalMoney, compareMoney, fingerprintRequest, persistRefundInTransaction, subtractMoney, sumMoney } from "./order-money";
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

async function dependencies(client: PoolClient, orderId: number) {
  const availabilityResult = await client.query(
    `SELECT
       to_regclass('public.payments') IS NOT NULL AS payments,
       to_regclass('public.credit_transactions') IS NOT NULL AS credit_transactions,
       to_regclass('public.subscription_transactions') IS NOT NULL AS subscription_transactions,
       to_regclass('public.production_cycle_orders') IS NOT NULL AS production_cycle_orders,
       to_regclass('public.production_cycles') IS NOT NULL AS production_cycles,
       to_regclass('public.machine_usage') IS NOT NULL AS machine_usage,
       to_regclass('public.loyalty_points') IS NOT NULL AS loyalty_points,
       to_regclass('public.order_status_history') IS NOT NULL AS order_status_history,
       to_regclass('public.order_corrections') IS NOT NULL AS order_corrections`,
  );
  const available = availabilityResult.rows[0];
  const check = (enabled: boolean, sql: string) => enabled ? `EXISTS(${sql})` : "false";
  const result = await client.query(
    `SELECT
       ${check(available.payments, "SELECT 1 FROM payments WHERE order_id = $1")} AS has_payments,
       ${check(available.credit_transactions, "SELECT 1 FROM credit_transactions WHERE order_id = $1")} AS has_credit,
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
       ${check(available.order_corrections, "SELECT 1 FROM order_corrections WHERE order_id = $1")} AS has_corrections`,
    [orderId],
  );
  return result.rows[0];
}

async function snapshot(client: PoolClient, orderId: number) {
  const result = await client.query(
    `SELECT to_jsonb(o) AS "order",
       COALESCE((SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.id) FROM order_items oi WHERE oi.order_id = o.id), '[]'::jsonb) AS items,
       COALESCE((SELECT jsonb_agg(to_jsonb(gi) ORDER BY gi.id) FROM garment_items gi WHERE gi.order_id = o.id), '[]'::jsonb) AS garments
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
    const money = calculateOrderTotals(input.items.map((item) => ({ price: prices.get(item.serviceId) ?? "0", quantity: item.quantity })), String(order.discount_pct || 0), String(order.discount_amount || order.discount || 0), String(order.pickup_cost || 0));
    const before = await snapshot(client, orderId);

    const postedResult = hasFinancialImpact ? await client.query(
      `SELECT
         coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id=$1 AND p.organisation_id=$2 AND p.site_id=$3),0)::text AS cash_paid,
         coalesce((SELECT sum(r.amount) FROM order_refunds r WHERE r.order_id=$1 AND r.organisation_id=$2 AND r.site_id=$3),0)::text AS refunded,
         coalesce((SELECT sum(ct.amount) FROM credit_transactions ct WHERE ct.order_id=$1 AND ct.organisation_id=$2 AND ct.site_id=$3 AND ct.type='debit'),0)::text AS credit_applied`,
      [orderId, order.organisation_id, siteId],
    ) : { rows: [{ cash_paid: "0", refunded: "0", credit_applied: "0" }] };
    const posted = postedResult.rows[0];
    const netPosted = subtractMoney(sumMoney([posted.cash_paid, posted.credit_applied]), posted.refunded);
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
