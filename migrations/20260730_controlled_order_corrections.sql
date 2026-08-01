ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS corrected_from_order_id integer,
  ADD COLUMN IF NOT EXISTS correction_reason text;

CREATE INDEX IF NOT EXISTS idx_orders_corrected_from
  ON orders(corrected_from_order_id);

CREATE TABLE IF NOT EXISTS order_corrections (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id),
  site_id integer NOT NULL,
  reason text NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL,
  changed_by varchar,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_corrections_order_created
  ON order_corrections(order_id, created_at);

CREATE INDEX IF NOT EXISTS idx_order_corrections_site
  ON order_corrections(site_id);
