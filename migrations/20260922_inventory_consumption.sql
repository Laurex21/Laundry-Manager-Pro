CREATE TABLE IF NOT EXISTS inventory_products (
  id serial PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  unit varchar(20) NOT NULL DEFAULT 'ml',
  current_quantity numeric(14, 6) NOT NULL DEFAULT 0,
  reorder_level numeric(14, 6) NOT NULL DEFAULT 0,
  unit_cost numeric(14, 6) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT inventory_product_values_nonnegative CHECK (current_quantity >= 0 AND reorder_level >= 0 AND unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_products_site_active ON inventory_products(site_id, is_active);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id serial PRIMARY KEY,
  product_id integer NOT NULL REFERENCES inventory_products(id) ON DELETE RESTRICT,
  organisation_id integer NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  production_cycle_id integer REFERENCES production_cycles(id) ON DELETE SET NULL,
  movement_type varchar(20) NOT NULL,
  quantity numeric(14, 6) NOT NULL,
  unit_cost numeric(14, 6) NOT NULL DEFAULT 0,
  notes text,
  created_by_user_id varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movement_type_valid CHECK (movement_type IN ('receipt', 'consumption', 'adjustment')),
  CONSTRAINT inventory_movement_quantity_nonzero CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_site_date ON inventory_movements(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_cycle ON inventory_movements(production_cycle_id);
