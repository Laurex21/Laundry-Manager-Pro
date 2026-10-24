import { reportingDateString, reportingDateRange, shiftReportingDate } from "./reporting-date";

export function decisionRange(period: string, now: Date, timeZone: string) {
  const today = reportingDateString(now, timeZone);
  const startDay = period === "day" ? today : period === "week" ? shiftReportingDate(today, -6)
    : period === "year" ? today.slice(0, 4) + "-01-01" : today.slice(0, 7) + "-01";
  return { ...reportingDateRange(startDay, today, timeZone), startDay, endDay: today, timeZone };
}

export const employeePerformanceSql = `
 SELECT e.id, e.name,
   COALESCE(a.actions,0)::int AS actions, COALESCE(a.orders,0)::int AS orders,
   COALESCE(a.delivered,0)::int AS delivered, COALESCE(a.weight,0)::float8 AS weight,
   COALESCE(h.hours,0)::float8 AS hours, COALESCE(h.incomplete,0)::int AS incomplete,
   COALESCE(q.rework,0)::int AS rework
 FROM employees e
 LEFT JOIN LATERAL (
   SELECT SUM(x.actions) AS actions, COUNT(*) AS orders,
     COUNT(*) FILTER (WHERE x.delivered) AS delivered, SUM(x.weight) AS weight
   FROM (SELECT ea.order_id, COUNT(*) AS actions,
     BOOL_OR(ea.action_type='order_delivered') AS delivered, MAX(ea.weight_kg) AS weight
     FROM employee_activities ea JOIN orders o ON o.id=ea.order_id AND o.site_id=ea.site_id
     WHERE ea.employee_id=e.id AND ea.site_id=e.site_id AND ea.action_date BETWEEN $2 AND $3
       AND ea.action_type IN ('order_created','order_processed','order_delivered') AND o.status<>'cancelled'
     GROUP BY ea.order_id) x
 ) a ON true
 LEFT JOIN LATERAL (
   SELECT SUM(CASE WHEN check_out_at>=check_in_at THEN EXTRACT(EPOCH FROM(check_out_at-check_in_at))/3600 ELSE 0 END) AS hours,
     COUNT(*) FILTER (WHERE check_in_at IS NOT NULL AND (check_out_at IS NULL OR check_out_at<check_in_at)) AS incomplete
   FROM employee_attendance WHERE employee_id=e.id AND site_id=e.site_id AND work_date::date BETWEEN $4::date AND $5::date
 ) h ON true
 LEFT JOIN LATERAL (
   SELECT COUNT(DISTINCT gr.order_id) AS rework FROM garment_return_cases gr
   WHERE gr.site_id=e.site_id AND gr.status<>'rejected' AND gr.returned_at BETWEEN $2 AND $3
     AND EXISTS (SELECT 1 FROM employee_activities ea WHERE ea.employee_id=e.id AND ea.site_id=e.site_id
       AND ea.order_id=gr.order_id AND ea.action_date BETWEEN $2 AND $3)
 ) q ON true
 WHERE e.site_id=ANY($1::int[]) ORDER BY e.name,e.id`;
