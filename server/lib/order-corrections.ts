import type { PoolClient } from "pg";
import { pool } from "../db";

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
  garments: Array<{ itemName: string; quantity: number }>;
};

async function dependencies(client: PoolClient, orderId: number) {
  const result = await client.query(
    `SELECT
       EXISTS(SELECT 1 FROM payments WHERE order_id = $1) AS has_payments,
       EXISTS(SELECT 1 FROM credit_transactions WHERE order_id = $1) AS has_credit,
       EXISTS(SELECT 1 FROM subscription_transactions WHERE order_id = $1) AS has_subscription,
       EXISTS(SELECT 1 FROM production_cycle_orders WHERE order_id = $1) AS has_cycles,
       EXISTS(
         SELECT 1 FROM production_cycle_orders pco
         JOIN production_cycles pc ON pc.id = pco.cycle_id
         WHERE pco.order_id = $1 AND pc.status IN ('preparing', 'running')
       ) AS has_active_cycles,
       EXISTS(SELECT 1 FROM machine_usage WHERE order_id = $1) AS has_machine_usage,
       EXISTS(SELECT 1 FROM loyalty_points WHERE order_id = $1) AS has_loyalty,
       EXISTS(SELECT 1 FROM order_status_history WHERE order_id = $1 AND status <> 'received') AS has_status_progress,
       EXISTS(SELECT 1 FROM order_corrections WHERE order_id = $1) AS has_corrections`,
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
    const existingPrices = new Map<number, number>();
    for (const item of existingPricesResult.rows) {
      if (!existingPrices.has(Number(item.service_id))) {
        existingPrices.set(Number(item.service_id), Number(item.price_at_order));
      }
    }
    const prices = new Map(servicesResult.rows.map((service) => [
      Number(service.id),
      existingPrices.get(Number(service.id)) ?? Number(service.price),
    ]));
    const subtotal = input.items.reduce((sum, item) => sum + (prices.get(item.serviceId) ?? 0) * item.quantity, 0);
    const discountPct = Number(order.discount_pct || 0);
    const discountAmount = Math.min(
      subtotal,
      discountPct > 0 ? subtotal * (discountPct / 100) : Number(order.discount_amount || order.discount || 0),
    );
    const pickupCost = Number(order.pickup_cost || 0);
    const totalAmount = Math.max(0, subtotal - discountAmount + pickupCost);
    const before = await snapshot(client, orderId);

    await client.query(
      `UPDATE orders SET customer_id = $2, entry_date = $3, pickup_date = $4,
         original_price = $5, discount_amount = $6, discount = $6,
         total_amount = $7, correction_reason = $8, updated_at = NOW()
       WHERE id = $1`,
      [orderId, input.customerId, input.entryDate, input.pickupDate, subtotal, discountAmount, totalAmount, input.reason],
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
        `INSERT INTO garment_items (order_id, item_name, quantity) VALUES ($1, $2, $3)`,
        [orderId, garment.itemName, garment.quantity],
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
    return { orderId, totalAmount: totalAmount.toFixed(2) };
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
      `INSERT INTO garment_items (order_id, item_name, quantity)
       SELECT $2, item_name, quantity FROM garment_items WHERE order_id = $1`,
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
