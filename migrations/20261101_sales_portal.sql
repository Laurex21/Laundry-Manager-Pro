-- Explicit additive migration; no users/organisations/roles are converted.
BEGIN;
CREATE TABLE IF NOT EXISTS sales_accounts (
 id uuid PRIMARY KEY, representative_id integer NOT NULL UNIQUE REFERENCES sales_representatives(id),
 email text NOT NULL UNIQUE CHECK(email=lower(trim(email))), password_hash text,
 active boolean NOT NULL DEFAULT false, auth_version integer NOT NULL DEFAULT 1,
 environment text NOT NULL CHECK(environment IN ('test','production')),
 created_at timestamptz NOT NULL DEFAULT now(), activated_at timestamptz
);
CREATE TABLE IF NOT EXISTS sales_invitations (
 id uuid PRIMARY KEY, account_id uuid NOT NULL REFERENCES sales_accounts(id), token_hash varchar(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, used_at timestamptz, revoked_at timestamptz,
 delivery_status text NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','preview','sent','failed')),
 created_by varchar NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_invitations_account ON sales_invitations(account_id,created_at);
CREATE TABLE IF NOT EXISTS sales_access_events (
 id bigserial PRIMARY KEY, account_id uuid NOT NULL REFERENCES sales_accounts(id),
 admin_id varchar REFERENCES users(id), action text NOT NULL CHECK(action IN ('invited','invitation_failed','accepted','suspended','reactivated','login','logout')),
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
