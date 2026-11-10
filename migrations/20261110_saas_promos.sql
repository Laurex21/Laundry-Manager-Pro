-- Explicit additive migration. Never applied on startup.
BEGIN;
CREATE TABLE IF NOT EXISTS saas_promos (
 id serial PRIMARY KEY, code varchar(32) NOT NULL,
 environment text NOT NULL CHECK(environment IN ('sandbox','live')),
 kind text NOT NULL CHECK(kind IN ('percent','fixed')), value integer NOT NULL CHECK(value>0),
 plans text[] NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 max_uses integer NOT NULL CHECK(max_uses>0), first_only boolean NOT NULL DEFAULT true,
 representative_id integer REFERENCES sales_representatives(id), active boolean NOT NULL DEFAULT true,
 created_by varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(environment,code), CHECK(ends_at>starts_at), CHECK(kind<>'percent' OR value<100)
);
CREATE TABLE IF NOT EXISTS saas_promo_events (
 id bigserial PRIMARY KEY, promo_id integer NOT NULL REFERENCES saas_promos(id),
 actor_id varchar NOT NULL REFERENCES users(id), action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saas_invoices_promo ON saas_invoices ((quote->'promo'->>'id'),provider_environment,status);
COMMIT;
