import type { PoolClient } from "pg";
import { pool } from "../db";
import { calculateOrderTotals, paidCorrectionOutcome } from "./order-money";
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
) {
  const client = await pool.connect();
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
    const deps = await dependencies(client, orderId);
    const isUnusedCorrectedCopy = !!order.corrected_from_order_id && !order.has_corrections;
    if (
      (order.status !== "received" && !isUnusedCorrectedCopy)
      || order.payment_status !== "unpaid"
      || deps.has_payments
      || deps.has_credit
      || deps.has_subscription
      || deps.has_cycles
      || deps.has_machine_usage
      || deps.has_loyalty
      || deps.has_active_cycles
      || (deps.has_status_progress && !isUnusedCorrectedCopy)
    ) {
      throw new OrderCorrectionError("This order already has a financial or operational impact and can no longer be edited", 409);
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

    await client.query(
      `UPDATE orders SET customer_id = $2, entry_date = $3, pickup_date = $4,
         original_price = $5, discount_amount = $6, discount = $6,
         total_amount = $7, correction_reason = $8, updated_at = NOW()
       WHERE id = $1`,
      [orderId, input.customerId, input.entryDate, input.pickupDate, money.subtotal, money.discount, money.total, input.reason],
    );
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);
    for (const item of input.items) {
      await client.query(
        `INSERT INTO order_items (order_id, service_id, quantity, price_at_order) VALUES ($1, $2, $3, $4)`,
        [orderId, item.serviceId, item.quantity, prices.get(item.serviceId)],
      );
    }
    await client.query(`DELETE FROM garment_items WHERE order_id = $1`, [orderId]);
    for (const garment of input.garments) {
      await client.query(
        `INSERT INTO garment_items (order_id, item_name, quantity, color) VALUES ($1, $2, $3, $4)`,
        [orderId, garment.itemName, garment.quantity, garment.color || null],
      );
    }
    const after = await snapshot(client, orderId);
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
    return { orderId, totalAmount: money.total };
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
