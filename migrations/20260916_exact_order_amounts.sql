ALTER TABLE services
  ALTER COLUMN price TYPE numeric(16,6),
  ALTER COLUMN minimum_charge TYPE numeric(16,6);

ALTER TABLE order_items
  ALTER COLUMN quantity TYPE numeric(16,6),
  ALTER COLUMN price_at_order TYPE numeric(16,6);

ALTER TABLE orders
  ALTER COLUMN total_amount TYPE numeric(18,6),
  ALTER COLUMN discount TYPE numeric(18,6),
  ALTER COLUMN discount_amount TYPE numeric(18,6),
  ALTER COLUMN original_price TYPE numeric(18,6),
  ALTER COLUMN pickup_cost TYPE numeric(18,6);

ALTER TABLE payments ALTER COLUMN amount TYPE numeric(18,6);
ALTER TABLE customers ALTER COLUMN credit_balance TYPE numeric(18,6);
ALTER TABLE customers ALTER COLUMN total_credit_added TYPE numeric(18,6);
ALTER TABLE customers ALTER COLUMN total_credit_used TYPE numeric(18,6);
ALTER TABLE credit_transactions ALTER COLUMN amount TYPE numeric(18,6);
ALTER TABLE credit_transactions ALTER COLUMN balance_before TYPE numeric(18,6);
ALTER TABLE credit_transactions ALTER COLUMN balance_after TYPE numeric(18,6);
