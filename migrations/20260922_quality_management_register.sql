ALTER TABLE garment_return_cases
  ADD COLUMN IF NOT EXISTS severity varchar(20) NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS root_cause varchar(50),
  ADD COLUMN IF NOT EXISTS responsibility varchar(30),
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(14, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corrective_action text,
  ADD COLUMN IF NOT EXISTS corrective_action_due_at timestamp,
  ADD COLUMN IF NOT EXISTS corrective_action_completed_at timestamp;

CREATE INDEX IF NOT EXISTS idx_garment_return_corrective_due
  ON garment_return_cases(organisation_id, site_id, corrective_action_due_at)
  WHERE corrective_action IS NOT NULL AND corrective_action_completed_at IS NULL;
