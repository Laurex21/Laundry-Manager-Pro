CREATE TABLE IF NOT EXISTS order_drafts (
  id serial PRIMARY KEY,
  site_id integer NOT NULL,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_drafts_user_site_updated
  ON order_drafts(user_id, site_id, updated_at DESC);
