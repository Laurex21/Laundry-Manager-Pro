CREATE TABLE IF NOT EXISTS pawapay_sandbox_checkouts (
  checkout_id uuid PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  created_by_user_id varchar NOT NULL REFERENCES users(id),
  amount_xaf numeric(10, 2) NOT NULL CHECK (amount_xaf > 0),
  status varchar(30) NOT NULL DEFAULT 'CREATED',
  checkout_code varchar(100),
  redirect_url text,
  provider_status varchar(30),
  callback_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pawapay_sandbox_checkouts_organisation_created
  ON pawapay_sandbox_checkouts(organisation_id, created_at DESC);

ALTER TABLE pawapay_sandbox_checkouts ADD COLUMN IF NOT EXISTS plan_id integer REFERENCES plans(id);
