ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS payment_method varchar(50),
ADD COLUMN IF NOT EXISTS reference varchar(255);
