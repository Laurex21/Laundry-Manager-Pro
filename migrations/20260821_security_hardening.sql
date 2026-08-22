BEGIN;

CREATE TABLE IF NOT EXISTS security_rate_limits (
  bucket_key varchar(64) PRIMARY KEY,
  count integer NOT NULL CHECK (count > 0),
  reset_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_security_rate_limits_reset_at
  ON security_rate_limits(reset_at);

COMMIT;
