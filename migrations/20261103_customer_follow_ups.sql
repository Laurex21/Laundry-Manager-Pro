-- Additive, explicit migration. No customer, order, role or subscription is rewritten.
BEGIN;
CREATE TABLE IF NOT EXISTS customer_follow_up_events (
 id uuid PRIMARY KEY,
 customer_id integer NOT NULL REFERENCES customers(id),
 site_id integer NOT NULL REFERENCES sites(id),
 actor_user_id varchar NOT NULL, -- immutable audit reference; removing a staff account does not remove its history
 actor_name text NOT NULL,
 channel text NOT NULL CHECK(channel IN ('whatsapp','sms','call')),
 outcome text NOT NULL CHECK(outcome IN ('no_answer','contacted','return_planned','unavailable','declined')),
 note text NOT NULL CHECK(char_length(note) BETWEEN 3 AND 2000),
 next_reminder_date date,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_follow_up_customer_time ON customer_follow_up_events(site_id,customer_id,created_at DESC,id);
COMMIT;
