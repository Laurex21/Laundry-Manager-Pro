-- Schema only. Do not add to the automatic migration runner or backfill until
-- the production organisation inventory and migration plan are approved.
CREATE TABLE IF NOT EXISTS saas_entitlements_v4 (
  organisation_id integer PRIMARY KEY REFERENCES organisations(id),
  plan_slug varchar(20) NOT NULL CHECK (plan_slug IN ('starter', 'pro', 'business')),
  state varchar(20) NOT NULL CHECK (state IN ('trialing', 'active', 'starter', 'past_due')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  cycle_started_at timestamptz,
  cycle_ends_at timestamptz,
  paid_extra_sites integer NOT NULL DEFAULT 0 CHECK (paid_extra_sites >= 0),
  paid_extra_staff integer NOT NULL DEFAULT 0 CHECK (paid_extra_staff >= 0),
  scheduled_plan_slug varchar(20) CHECK (scheduled_plan_slug IN ('starter', 'pro', 'business')),
  time_zone varchar(80) NOT NULL DEFAULT 'Africa/Douala',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_entitlements_v4_trial_window_check
    CHECK ((trial_started_at IS NULL AND trial_ends_at IS NULL) OR
           (trial_started_at IS NOT NULL AND trial_ends_at > trial_started_at)),
  CONSTRAINT saas_entitlements_v4_cycle_window_check
    CHECK ((cycle_started_at IS NULL AND cycle_ends_at IS NULL) OR
           (cycle_started_at IS NOT NULL AND cycle_ends_at > cycle_started_at)),
  CONSTRAINT saas_entitlements_v4_state_dates_check
    CHECK ((state <> 'trialing' OR trial_ends_at IS NOT NULL) AND
           (state <> 'active' OR cycle_ends_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_saas_entitlements_v4_trial_ends
  ON saas_entitlements_v4 (trial_ends_at)
  WHERE state = 'trialing';

CREATE INDEX IF NOT EXISTS idx_saas_entitlements_v4_cycle_ends
  ON saas_entitlements_v4 (cycle_ends_at)
  WHERE state = 'active';

-- Authenticated staff seats, distinct from the pressing's employee records.
-- No backfill or suspension is performed by this schema-only migration.
CREATE TABLE IF NOT EXISTS saas_staff_seats_v4 (
  organisation_id integer NOT NULL REFERENCES organisations(id),
  user_id varchar NOT NULL REFERENCES users(id),
  state varchar(30) NOT NULL CHECK (state IN ('active', 'subscription_suspended')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_staff_seats_v4_org_user_unique UNIQUE (organisation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_saas_staff_seats_v4_active_by_org
  ON saas_staff_seats_v4 (organisation_id)
  WHERE state = 'active';

-- In-app owner notices only; no outbound messaging integration.
CREATE TABLE IF NOT EXISTS saas_trial_notices_v4 (
  id bigserial PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  kind varchar(30) NOT NULL CHECK (kind IN ('trial_reminder', 'trial_expired')),
  local_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_trial_notices_v4_once_per_local_day
    UNIQUE (organisation_id, kind, local_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS saas_trial_notices_v4_expired_once
  ON saas_trial_notices_v4 (organisation_id)
  WHERE kind = 'trial_expired';

-- Production payments are isolated from fictive PawaPay Sandbox checkouts.
-- Creating these tables does not enable production checkout or charging.
CREATE TABLE IF NOT EXISTS saas_payment_intents_v4 (
  checkout_id uuid PRIMARY KEY,
  client_reference_id varchar(100) NOT NULL UNIQUE,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  created_by_user_id varchar NOT NULL REFERENCES users(id),
  target_plan_slug varchar(20) NOT NULL CHECK (target_plan_slug IN ('pro', 'business')),
  amount_xaf integer NOT NULL CHECK (amount_xaf > 0),
  provider_environment varchar(20) NOT NULL DEFAULT 'production'
    CHECK (provider_environment = 'production'),
  checkout_code varchar(100),
  state varchar(25) NOT NULL DEFAULT 'created'
    CHECK (state IN ('created', 'accepted', 'completed', 'failed', 'expired', 'cancelled', 'review')),
  provider_status varchar(30),
  provider_verified_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_payment_intents_v4_checkout_org_unique UNIQUE (checkout_id, organisation_id)
);

CREATE INDEX IF NOT EXISTS idx_saas_payment_intents_v4_org_created
  ON saas_payment_intents_v4 (organisation_id, created_at DESC);

-- Prevent two simultaneous unpaid checkouts for one organisation. A review
-- state is deliberately blocking until an operator resolves uncertain cases.
CREATE UNIQUE INDEX IF NOT EXISTS saas_payment_intents_v4_one_open_per_org
  ON saas_payment_intents_v4 (organisation_id)
  WHERE state IN ('created', 'accepted', 'review');

CREATE TABLE IF NOT EXISTS saas_payment_receipts_v4 (
  checkout_id uuid PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  amount_xaf integer NOT NULL CHECK (amount_xaf > 0),
  provider_verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_payment_receipts_v4_intent_org_fk
    FOREIGN KEY (checkout_id, organisation_id)
    REFERENCES saas_payment_intents_v4(checkout_id, organisation_id)
);
