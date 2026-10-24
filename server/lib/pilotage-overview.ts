import { reportingDateString, reportingDateRange, shiftReportingDate } from './reporting-date';

// Every query is restricted to the session's authorised site scope. No writes or jobs.
export const overviewSql = {
  operations: `SELECT status, COUNT(*)::int AS count FROM orders WHERE site_id=ANY($1::int[]) AND status<>'cancelled' AND (status<>'delivered' OR delivered_at BETWEEN $2 AND $3) GROUP BY status`,
  priorities: `SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled','delivered') AND pickup_date::date < $2::date)::int AS overdue,
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled','delivered') AND pickup_date::date = $2::date)::int AS due,
    COALESCE(SUM(GREATEST(total_amount-COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id=o.id),0),0)) FILTER (WHERE status<>'cancelled'),0)::float8 AS outstanding
    FROM orders o WHERE site_id=ANY($1::int[])`,
  resources: `SELECT
    (SELECT COUNT(*) FROM employees WHERE site_id=ANY($1::int[]) AND status='active')::int AS employees,
    (SELECT COUNT(DISTINCT a.employee_id) FROM employee_attendance a JOIN employees e ON e.id=a.employee_id AND e.site_id=a.site_id WHERE a.site_id=ANY($1::int[]) AND e.status='active' AND a.work_date::date=$2::date AND a.check_in_at IS NOT NULL AND a.check_out_at IS NULL)::int AS present,
    (SELECT COUNT(*) FROM machines WHERE site_id=ANY($1::int[]) AND status='active')::int AS machines,
    (SELECT COUNT(DISTINCT machine_id) FROM production_cycles WHERE site_id=ANY($1::int[]) AND status='running')::int AS running,
    (SELECT COUNT(*) FROM inventory_products WHERE site_id=ANY($1::int[]) AND is_active AND current_quantity<=reorder_level)::int AS low_stock`,
  trend: `WITH days AS (SELECT generate_series($2::date,$3::date,'1 day')::date AS day)
    SELECT day::text,
    (SELECT COUNT(*) FROM orders o WHERE o.site_id=ANY($1::int[]) AND o.status<>'cancelled' AND (o.entry_date AT TIME ZONE 'UTC' AT TIME ZONE $4)::date=d.day)::int AS orders,
    (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.site_id=ANY($1::int[]) AND o.status<>'cancelled' AND (p.date AT TIME ZONE 'UTC' AT TIME ZONE $4)::date=d.day)::float8 AS collections
    FROM days d ORDER BY day`,
  sites: `SELECT s.id,s.name,
    (SELECT COUNT(*) FROM orders o WHERE o.site_id=s.id AND o.status NOT IN ('cancelled','delivered'))::int AS pending,
    (SELECT COUNT(*) FROM orders o WHERE o.site_id=s.id AND o.status NOT IN ('cancelled','delivered') AND o.pickup_date::date<$4::date)::int AS overdue,
    (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.site_id=s.id AND o.status<>'cancelled' AND p.date BETWEEN $2 AND $3)::float8 AS collections
    FROM sites s WHERE s.id=ANY($1::int[]) ORDER BY s.name,s.id`,
  memberships: `WITH scoped AS (
    SELECT cs.*,sp.included_weight_kg,sp.included_pieces,sp.max_orders,
      (cs.status='active' AND cs.start_date<=$2::date AND cs.expiry_date>=$2::date) AS valid
    FROM customer_subscriptions cs JOIN customers c ON c.id=cs.customer_id JOIN sites site ON site.id=c.site_id AND site.organisation_id=cs.organisation_id
    JOIN subscription_plans sp ON sp.id=cs.subscription_plan_id AND sp.organisation_id=cs.organisation_id
    WHERE c.site_id=ANY($1::int[])
  ) SELECT
    COUNT(*) FILTER (WHERE valid)::int AS active,
    COUNT(*) FILTER (WHERE valid AND expiry_date<=$2::date+7)::int AS expiring,
    COUNT(*) FILTER (WHERE valid AND (
      (included_weight_kg>0 AND remaining_kg IS NOT NULL AND remaining_kg<=included_weight_kg*0.2) OR
      (included_pieces>0 AND remaining_pieces IS NOT NULL AND remaining_pieces<=included_pieces*0.2) OR
      (max_orders>0 AND remaining_orders IS NOT NULL AND remaining_orders<=max_orders*0.2)))::int AS low,
    COUNT(*) FILTER (WHERE status NOT IN ('cancelled','suspended') AND expiry_date<$2::date AND NOT EXISTS (
      SELECT 1 FROM scoped newer WHERE newer.customer_id=scoped.customer_id AND (newer.valid OR newer.start_date>scoped.start_date OR (newer.start_date=scoped.start_date AND newer.id>scoped.id))
    ))::int AS expired,
    (SELECT COALESCE(SUM(mp.amount),0) FROM membership_subscription_payments mp JOIN scoped cs ON cs.id=mp.subscription_id AND cs.organisation_id=mp.organisation_id WHERE mp.status='completed' AND mp.payment_date BETWEEN $3 AND $4)::float8 AS collections
    FROM scoped`,
};

export async function getPilotageOverview(db: { query: (sql: string, args: any[]) => Promise<any> }, siteIds: number[], now: Date, timeZone: string) {
  const today=reportingDateString(now,timeZone), {start}=reportingDateRange(today,today,timeZone);
  const weekStart=shiftReportingDate(today,-6), previousStart=shiftReportingDate(today,-13);
  const results=await Promise.all([
    db.query(overviewSql.operations,[siteIds,start,now]),
    db.query(overviewSql.priorities,[siteIds,today]),
    db.query(overviewSql.resources,[siteIds,today]),
    db.query(overviewSql.trend,[siteIds,previousStart,today,timeZone]),
    db.query(overviewSql.sites,[siteIds,start,now,today]),
    db.query(overviewSql.memberships,[siteIds,today,start,now]),
  ]);
  return {date:today,timeZone,updatedAt:now.toISOString(),weekStart,operations:results[0].rows,priorities:results[1].rows[0],resources:results[2].rows[0],trend:results[3].rows,sites:results[4].rows,memberships:results[5].rows[0]};
}
