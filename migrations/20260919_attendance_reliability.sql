ALTER TABLE employee_attendance
  ADD COLUMN IF NOT EXISTS corrected_by varchar,
  ADD COLUMN IF NOT EXISTS correction_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

CREATE INDEX IF NOT EXISTS employee_attendance_site_work_date_idx
  ON employee_attendance(site_id, work_date);

WITH grouped AS (
  SELECT employee_id, work_date,
         min(check_in_at) AS earliest_check_in,
         max(check_out_at) AS latest_check_out,
         max(id) AS keeper_id,
         count(*) AS row_count
  FROM employee_attendance
  GROUP BY employee_id, work_date
  HAVING count(*) > 1
), merged AS (
  UPDATE employee_attendance target
  SET check_in_at = grouped.earliest_check_in,
      check_out_at = grouped.latest_check_out,
      correction_reason = concat_ws(' | ', target.correction_reason, 'Migration: consolidated duplicate attendance rows'),
      updated_at = now()
  FROM grouped
  WHERE target.id = grouped.keeper_id
  RETURNING target.id
)
DELETE FROM employee_attendance
WHERE EXISTS (
  SELECT 1 FROM grouped
  WHERE grouped.employee_id = employee_attendance.employee_id
    AND grouped.work_date = employee_attendance.work_date
    AND grouped.keeper_id <> employee_attendance.id
);
