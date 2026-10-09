-- Additive test-only tables for a single allowlisted owner on the public app.
-- Do not run against production until the owner explicitly approves the
-- database change. These tables never grant real SaaS permissions.
CREATE TABLE IF NOT EXISTS saas_v4_shadow_sandbox_checkouts (
  checkout_id uuid PRIMARY KEY,
  checkout_code varchar(100),
  client_reference_id varchar(100) NOT NULL UNIQUE,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  created_by_user_id varchar NOT NULL REFERENCES users(id),
  target_plan_slug varchar(20) NOT NULL CHECK (target_plan_slug IN ('pro', 'business')),
  amount_xaf integer NOT NULL CHECK (amount_xaf > 0),
  status varchar(25) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'accepted', 'completed', 'failed', 'expired', 'cancelled', 'review')),
  redirect_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  activated_at timestamptz
);

CREATE INDEX IF NOT EXISTS saas_v4_shadow_checkouts_org_created
  ON saas_v4_shadow_sandbox_checkouts (organisation_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS saas_v4_shadow_one_open_per_org
  ON saas_v4_shadow_sandbox_checkouts (organisation_id)
  WHERE status IN ('created', 'accepted', 'review');

CREATE TABLE IF NOT EXISTS saas_v4_shadow_entitlements (
  organisation_id integer PRIMARY KEY REFERENCES organisations(id),
  plan_slug varchar(20) NOT NULL CHECK (plan_slug IN ('pro', 'business')),
  cycle_started_at timestamptz NOT NULL,
  cycle_ends_at timestamptz NOT NULL,
  source_checkout_id uuid NOT NULL UNIQUE REFERENCES saas_v4_shadow_sandbox_checkouts(checkout_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saas_v4_shadow_cycle_valid CHECK (cycle_ends_at > cycle_started_at)
);
