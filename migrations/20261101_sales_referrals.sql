-- Additive, explicit migration; never run automatically on application startup.
BEGIN;
CREATE TABLE IF NOT EXISTS sales_representatives (
 id serial PRIMARY KEY, name varchar(120) NOT NULL, country varchar(2) NOT NULL,
 code varchar(23) NOT NULL UNIQUE, active boolean NOT NULL DEFAULT true,
 environment text NOT NULL CHECK(environment IN ('test','production')),
 created_by varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(country ~ '^[A-Z]{2}$'), CHECK(code ~ '^[A-Z]{2}-[A-F0-9]{20}$')
);
CREATE TABLE IF NOT EXISTS sales_registrations (
 user_id varchar PRIMARY KEY REFERENCES users(id), representative_id integer NOT NULL REFERENCES sales_representatives(id),
 organisation_id integer UNIQUE REFERENCES organisations(id), country varchar(2) NOT NULL,
 environment text NOT NULL CHECK(environment IN ('test','production')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_registrations_representative ON sales_registrations(representative_id,created_at);
CREATE TABLE IF NOT EXISTS sales_admin_events (
 id bigserial PRIMARY KEY, actor_id varchar NOT NULL REFERENCES users(id),
 representative_id integer NOT NULL REFERENCES sales_representatives(id),
 action text NOT NULL CHECK(action IN ('created','activated','disabled')), created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
