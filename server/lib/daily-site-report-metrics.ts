import { pool } from "../db";
import { parseLocalDateParam } from "./reporting-date";

export type DailySiteMetrics = {
  ordersCreated: number;
  ordersDelivered: number;
  pendingOrders: number;
  paymentsCollected: number;
  expensesRecorded: number;
  outstandingBalance: number;
  returnsCreated: number;
  returnsOpen: number;
  returnsDecided: number;
};

export async function snapshotDailySiteMetrics(siteId: number, reportDate: string): Promise<DailySiteMetrics> {
  const start = parseLocalDateParam(reportDate, new Date());
  const end = parseLocalDateParam(reportDate, new Date(), true);
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM orders WHERE site_id = $1 AND entry_date BETWEEN $2 AND $3) AS orders_created,
      (SELECT count(*)::int FROM orders WHERE site_id = $1 AND delivered_at BETWEEN $2 AND $3) AS orders_delivered,
      (SELECT count(*)::int FROM orders WHERE site_id = $1 AND status NOT IN ('delivered', 'cancelled')) AS pending_orders,
      (SELECT COALESCE(sum(p.amount), 0)::numeric FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.site_id = $1 AND p.date BETWEEN $2 AND $3) AS payments_collected,
      (SELECT COALESCE(sum(amount), 0)::numeric FROM expenditures WHERE site_id = $1 AND date BETWEEN $2 AND $3) AS expenses_recorded,
      (SELECT COALESCE(sum(GREATEST(o.total_amount - COALESCE(p.paid, 0), 0)), 0)::numeric
        FROM orders o LEFT JOIN (SELECT order_id, sum(amount) paid FROM payments GROUP BY order_id) p ON p.order_id = o.id
        WHERE o.site_id = $1 AND o.entry_date BETWEEN $2 AND $3 AND o.status <> 'cancelled') AS outstanding_balance,
      (SELECT count(*)::int FROM garment_return_cases WHERE site_id = $1 AND returned_at BETWEEN $2 AND $3) AS returns_created,
      (SELECT count(*)::int FROM garment_return_cases WHERE site_id = $1 AND status NOT IN ('rejected', 'resolved')) AS returns_open,
      (SELECT count(*)::int FROM garment_return_cases WHERE site_id = $1 AND decided_at BETWEEN $2 AND $3) AS returns_decided
  `, [siteId, start, end]);
  const row = rows[0];
  return {
    ordersCreated: Number(row.orders_created), ordersDelivered: Number(row.orders_delivered), pendingOrders: Number(row.pending_orders),
    paymentsCollected: Number(row.payments_collected), expensesRecorded: Number(row.expenses_recorded), outstandingBalance: Number(row.outstanding_balance),
    returnsCreated: Number(row.returns_created), returnsOpen: Number(row.returns_open), returnsDecided: Number(row.returns_decided),
  };
}
