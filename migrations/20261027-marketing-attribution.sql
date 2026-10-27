-- Additive migration: no existing customer, order or billing data is modified.
CREATE TABLE IF NOT EXISTS marketing_acquisition_events (
  event_id uuid PRIMARY KEY,
  journey_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('marketing_visit','whatsapp_clicked','signup_started','demo_started','signup_completed')),
  page text NOT NULL CHECK (page IN ('/','/xpresspro','/xpress-consulting','/xpress-clean','/rencontre','/auth')),
  source text NOT NULL CHECK (source IN ('tiktok','facebook','whatsapp','linkedin','youtube','direct_unknown')),
  evidence text NOT NULL CHECK (evidence IN ('utm','referrer','unknown')),
  campaign varchar(40) NOT NULL DEFAULT '',
  content varchar(40) NOT NULL DEFAULT '',
  environment text NOT NULL CHECK (environment IN ('production','test'))
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_one_registration_per_journey ON marketing_acquisition_events (journey_id) WHERE event = 'signup_completed';
CREATE INDEX IF NOT EXISTS marketing_acquisition_period ON marketing_acquisition_events (occurred_at, source) WHERE environment = 'production';
-- Raw anonymous events are queried only for the most recent 90 days.
-- Run the reviewed retention script regularly to remove older measurement rows.
