-- Manual review only. Never run during build, startup or automatic publication.
-- Hashes and send outcomes only; no token, phone number or message body stored.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA xpresspro_flow_pilot;
CREATE TABLE xpresspro_flow_pilot.inbound_claims (
  message_hash text PRIMARY KEY CHECK (message_hash ~ '^[a-f0-9]{64}$'),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  outcome text NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('unknown', 'accepted', 'failed'))
);
COMMIT;
