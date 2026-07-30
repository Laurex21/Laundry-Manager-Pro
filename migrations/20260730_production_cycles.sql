BEGIN;

CREATE TABLE IF NOT EXISTS production_cycles (
  id serial PRIMARY KEY,
  machine_id integer NOT NULL REFERENCES machines(id),
  site_id integer NOT NULL,
  stage varchar(20) NOT NULL CHECK (stage IN ('washing', 'drying')),
  status varchar(20) NOT NULL DEFAULT 'preparing'
    CHECK (status IN ('preparing', 'running', 'completed', 'cancelled')),
  capacity_kg numeric(10, 2) NOT NULL CHECK (capacity_kg > 0),
  total_weight_kg numeric(10, 2) NOT NULL DEFAULT 0 CHECK (total_weight_kg >= 0),
  planned_duration_minutes integer NOT NULL DEFAULT 0 CHECK (planned_duration_minutes >= 0),
  actual_duration_minutes integer CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes >= 0),
  started_by varchar,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_cycle_orders (
  id serial PRIMARY KEY,
  cycle_id integer NOT NULL REFERENCES production_cycles(id) ON DELETE CASCADE,
  order_id integer NOT NULL REFERENCES orders(id),
  weight_kg numeric(10, 2) NOT NULL CHECK (weight_kg > 0),
  added_at timestamp DEFAULT now(),
  CONSTRAINT idx_production_cycle_order_unique UNIQUE (cycle_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_production_cycles_site_status
  ON production_cycles(site_id, status);
CREATE INDEX IF NOT EXISTS idx_production_cycles_machine_status
  ON production_cycles(machine_id, status);
CREATE INDEX IF NOT EXISTS idx_production_cycle_orders_order
  ON production_cycle_orders(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_cycle_per_machine
  ON production_cycles(machine_id)
  WHERE status IN ('preparing', 'running');

COMMIT;
