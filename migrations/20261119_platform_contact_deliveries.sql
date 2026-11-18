BEGIN;
CREATE TABLE IF NOT EXISTS platform_contact_deliveries (
  id uuid PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  approval_id uuid NOT NULL UNIQUE,
  actor_user_id varchar NOT NULL,
  actor_name text NOT NULL,
  recipient text NOT NULL,
  message jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('dispatching','accepted','sent','delivered','read','failed','unknown')),
  provider_id text UNIQUE,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_contact_deliveries_org ON platform_contact_deliveries(organisation_id,created_at DESC);
ALTER TABLE platform_contact_events DROP CONSTRAINT IF EXISTS platform_contact_event_action;
ALTER TABLE platform_contact_events ADD CONSTRAINT platform_contact_event_action CHECK (action IN ('contact','plan','save_message','approve_message','cancel_message','delivery'));
COMMIT;
