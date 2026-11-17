-- Explicit, additive migration. No account, payment, order or access changes.
BEGIN;
CREATE TABLE IF NOT EXISTS platform_contact_cases (
 organisation_id integer PRIMARY KEY REFERENCES organisations(id),
 version integer NOT NULL DEFAULT 0 CHECK(version >= 0),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','paused','closed','do_not_contact')),
 next_action text NOT NULL DEFAULT '' CHECK(char_length(next_action) <= 300),
 next_action_date date,
 message jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((next_action = '') = (next_action_date IS NULL)),
 CHECK (status NOT IN ('closed','do_not_contact') OR next_action_date IS NULL)
);
CREATE INDEX IF NOT EXISTS platform_contact_due ON platform_contact_cases(next_action_date) WHERE status IN ('open','in_progress');
CREATE TABLE IF NOT EXISTS platform_contact_events (
 id uuid PRIMARY KEY,
 organisation_id integer NOT NULL REFERENCES organisations(id),
 actor_user_id varchar NOT NULL,
 actor_name text NOT NULL,
 action text NOT NULL CHECK(action IN ('contact','plan','save_message','approve_message','cancel_message')),
 data jsonb NOT NULL,
 resulting_version integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_contact_history ON platform_contact_events(organisation_id,created_at DESC,id);
COMMIT;
