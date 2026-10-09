-- Execute manually against a reviewed database connection. This script is
-- read-only and prints IDs/counts only (no names, emails or phone numbers).
BEGIN TRANSACTION READ ONLY;

WITH latest_legacy AS (
  SELECT DISTINCT ON (o.id) o.id AS organisation_id, p.slug AS legacy_plan,
         sub.status AS legacy_status, sub.end_date AS legacy_end_date
  FROM organisations o
  LEFT JOIN subscriptions sub ON sub.user_id = o.owner_id
  LEFT JOIN plans p ON p.id = sub.plan_id
  ORDER BY o.id, sub.created_at DESC NULLS LAST, sub.id DESC NULLS LAST
), site_counts AS (
  SELECT organisation_id, count(*) FILTER (WHERE is_active)::integer AS active_sites,
         count(*)::integer AS total_sites
  FROM sites GROUP BY organisation_id
), user_counts AS (
  SELECT organisation_id,
         count(*) FILTER (WHERE user_type <> 'owner')::integer AS non_owner_user_accounts
  FROM users WHERE organisation_id IS NOT NULL GROUP BY organisation_id
), employee_counts AS (
  SELECT s.organisation_id,
         count(DISTINCT e.id) FILTER (WHERE e.status = 'active')::integer AS active_employee_records,
         count(DISTINCT e.auth_user_id) FILTER (WHERE e.status = 'active' AND e.auth_user_id IS NOT NULL)::integer
           AS active_linked_staff_accounts
  FROM employees e JOIN sites s ON s.id = e.site_id
  GROUP BY s.organisation_id
)
SELECT o.id AS organisation_id,
       (current_timestamp - o.created_at) > interval '30 days' AS older_than_30_days,
       l.legacy_plan, l.legacy_status, l.legacy_end_date,
       coalesce(s.active_sites, 0) AS active_sites,
       coalesce(s.total_sites, 0) AS total_sites,
       coalesce(u.non_owner_user_accounts, 0) AS non_owner_user_accounts,
       coalesce(e.active_employee_records, 0) AS active_employee_records,
       coalesce(e.active_linked_staff_accounts, 0) AS active_linked_staff_accounts,
       (l.legacy_plan = 'enterprise') AS enterprise_review_required,
       (coalesce(s.active_sites, 0) > 2 OR coalesce(u.non_owner_user_accounts, 0) > 5)
         AS above_base_business_quota
FROM organisations o
LEFT JOIN latest_legacy l ON l.organisation_id = o.id
LEFT JOIN site_counts s ON s.organisation_id = o.id
LEFT JOIN user_counts u ON u.organisation_id = o.id
LEFT JOIN employee_counts e ON e.organisation_id = o.id
ORDER BY enterprise_review_required DESC NULLS LAST, above_base_business_quota DESC, o.id;

ROLLBACK;
