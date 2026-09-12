ALTER TABLE platform_admins
  ADD COLUMN IF NOT EXISTS mfa_secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS mfa_secret_iv varchar(32),
  ADD COLUMN IF NOT EXISTS mfa_secret_tag varchar(32),
  ADD COLUMN IF NOT EXISTS mfa_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_totp_step bigint;

CREATE TABLE IF NOT EXISTS platform_admin_audit_events (
  id bigserial PRIMARY KEY,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  outcome varchar(30) NOT NULL,
  request_id varchar(120),
  ip_hash varchar(64) NOT NULL,
  user_agent varchar(500),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_user_created
  ON platform_admin_audit_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_admin_audit_action_created
  ON platform_admin_audit_events(action, created_at DESC);
