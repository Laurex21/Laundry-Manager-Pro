-- Additive only. Run against a disposable/local development database first.
-- No backfill of existing subscriptions and no startup DDL.
BEGIN;
CREATE TABLE IF NOT EXISTS saas_accounts (
 organisation_id integer PRIMARY KEY REFERENCES organisations(id), state jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas_invoices (
 id uuid PRIMARY KEY, organisation_id integer NOT NULL REFERENCES organisations(id),
 quote jsonb NOT NULL, total_xaf integer NOT NULL CHECK(total_xaf >= 0),
 status varchar(20) NOT NULL DEFAULT 'quoted', checkout_id uuid UNIQUE, checkout_code text,
 redirect_url text, provider_status varchar(20), payment_source text, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saas_invoice_organisation ON saas_invoices(organisation_id,created_at);
CREATE TABLE IF NOT EXISTS saas_events (
 id bigserial PRIMARY KEY, organisation_id integer NOT NULL REFERENCES organisations(id),
 action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saas_notices (
 id bigserial PRIMARY KEY, organisation_id integer NOT NULL REFERENCES organisations(id),
 notice_key text NOT NULL, kind text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS saas_notice_unique ON saas_notices(organisation_id,notice_key);
CREATE TABLE IF NOT EXISTS saas_receipt_snapshots (
 id bigserial PRIMARY KEY, organisation_id integer NOT NULL REFERENCES organisations(id),
 order_id integer NOT NULL REFERENCES orders(id), receipt_key text NOT NULL, html text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS saas_receipt_unique ON saas_receipt_snapshots(organisation_id,receipt_key);
COMMIT;
