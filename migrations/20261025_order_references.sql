-- Additive only. Existing orders keep their printed numeric references.
BEGIN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_reference varchar(32);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_reference_unique ON orders(order_reference);
COMMIT;
