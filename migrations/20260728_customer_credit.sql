BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS credit_balance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit_added numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credit_used numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(100);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id serial PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  site_id integer NOT NULL REFERENCES sites(id),
  customer_id integer NOT NULL REFERENCES customers(id),
  order_id integer REFERENCES orders(id),
  payment_id integer REFERENCES payments(id),
  type varchar(10) NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason varchar(50) NOT NULL,
  balance_before numeric(12,2) NOT NULL CHECK (balance_before >= 0),
  balance_after numeric(12,2) NOT NULL CHECK (balance_after >= 0),
  notes text,
  created_by varchar,
  idempotency_key varchar(120) NOT NULL,
  reversal_of_id integer REFERENCES credit_transactions(id),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT credit_transaction_balance_check CHECK (
    (type = 'credit' AND balance_after = balance_before + amount)
    OR
    (type = 'debit' AND balance_after = balance_before - amount)
  )
);

CREATE INDEX IF NOT EXISTS idx_customers_positive_credit
  ON customers(credit_balance) WHERE credit_balance > 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
  ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_tx_customer
  ON credit_transactions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_tx_org_site
  ON credit_transactions(organisation_id, site_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_order
  ON credit_transactions(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_idempotency
  ON credit_transactions(idempotency_key);

COMMIT;
