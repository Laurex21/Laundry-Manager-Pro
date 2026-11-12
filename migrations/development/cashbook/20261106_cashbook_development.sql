-- Development migration. Apply ONLY to an explicitly isolated development database.
CREATE TABLE IF NOT EXISTS cashbook_accounts (
 id serial PRIMARY KEY,
 organisation_id integer NOT NULL REFERENCES organisations(id),
 site_id integer NOT NULL REFERENCES sites(id),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 method text NOT NULL CHECK(method <> 'Client Credit'),
 currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 reporting_timezone text NOT NULL,
 opened_at timestamptz NOT NULL,
 opening_balance numeric(18,6) NOT NULL,
 opening_reason text NOT NULL CHECK(length(opening_reason) BETWEEN 10 AND 1000),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organisation_id,site_id,method),
 UNIQUE(organisation_id,site_id,id)
);
CREATE TABLE IF NOT EXISTS cashbook_expense_allocations (
 organisation_id integer NOT NULL,
 site_id integer NOT NULL,
 expense_id integer NOT NULL REFERENCES expenditures(id),
 account_id integer NOT NULL,
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organisation_id,expense_id),
 FOREIGN KEY(organisation_id,site_id,account_id) REFERENCES cashbook_accounts(organisation_id,site_id,id)
);
CREATE TABLE IF NOT EXISTS cashbook_manual_movements (
 id serial PRIMARY KEY,
 organisation_id integer NOT NULL,
 site_id integer NOT NULL,
 account_id integer NOT NULL,
 kind text NOT NULL CHECK(kind IN ('withdrawal','refund','transfer_in','transfer_out')),
 amount numeric(18,6) NOT NULL CHECK(amount > 0),
 occurred_at timestamptz NOT NULL,
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
 transfer_key uuid,
 idempotency_key uuid NOT NULL,
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organisation_id,idempotency_key,account_id),
 FOREIGN KEY(organisation_id,site_id,account_id) REFERENCES cashbook_accounts(organisation_id,site_id,id),
 CHECK((kind IN ('transfer_in','transfer_out')) = (transfer_key IS NOT NULL))
);
-- No UPDATE/DELETE endpoints. Closing remains a preview until existing payment
-- and expense writes can participate in closed-period locking and corrections.
CREATE TABLE IF NOT EXISTS cashbook_requests (
 organisation_id integer NOT NULL,
 idempotency_key uuid NOT NULL,
 actor text NOT NULL,
 payload jsonb NOT NULL,
 response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organisation_id,idempotency_key)
);
