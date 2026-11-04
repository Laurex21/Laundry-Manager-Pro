-- Explicit migration: preserve accounts, passwords, contracts, links and attributions.
BEGIN;
ALTER TABLE sales_representatives ADD COLUMN IF NOT EXISTS public_code varchar(16);
CREATE UNIQUE INDEX IF NOT EXISTS sales_representatives_public_code ON sales_representatives(public_code);
CREATE TABLE IF NOT EXISTS sales_user_access (
 representative_id integer PRIMARY KEY REFERENCES sales_representatives(id),
 user_id varchar NOT NULL REFERENCES users(id),
 environment text NOT NULL CHECK(environment IN ('test','production')),
 created_by varchar NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,environment)
);
CREATE TABLE IF NOT EXISTS sales_user_access_events (
 id bigserial PRIMARY KEY,
 representative_id integer NOT NULL REFERENCES sales_representatives(id),
 user_id varchar NOT NULL REFERENCES users(id),
 actor_id varchar NOT NULL REFERENCES users(id),
 action text NOT NULL CHECK(action IN ('linked','activated','disabled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
