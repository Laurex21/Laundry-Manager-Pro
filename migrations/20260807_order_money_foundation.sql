BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':order-money-foundation', 0));

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS currency varchar(10);
UPDATE organisations SET currency = 'FCFA' WHERE currency IS NULL OR btrim(currency) = '';
ALTER TABLE organisations ALTER COLUMN currency SET DEFAULT 'FCFA';
ALTER TABLE organisations ALTER COLUMN currency SET NOT NULL;

ALTER TABLE site_members ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE site_members DROP CONSTRAINT IF EXISTS site_members_capabilities_valid;
ALTER TABLE site_members ADD CONSTRAINT site_members_capabilities_valid CHECK (
  jsonb_typeof(capabilities) = 'array'
  AND capabilities <@ '["manage_stain_treatment_pricing", "view_stain_treatment_reports"]'::jsonb
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS organisation_id integer;
UPDATE orders o SET organisation_id = s.organisation_id FROM sites s WHERE s.id = o.site_id AND o.organisation_id IS NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE organisation_id IS NULL OR site_id IS NULL) THEN
    RAISE EXCEPTION 'cannot safely establish tenant identity for every legacy order';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS sites_tenant_identity ON sites(id, organisation_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_identity ON orders(id, organisation_id, site_id);
ALTER TABLE orders ALTER COLUMN organisation_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN site_id SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_site_tenant_fkey') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_site_tenant_fkey FOREIGN KEY (site_id, organisation_id) REFERENCES sites(id, organisation_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_order_tenant_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE site_organisation integer;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.organisation_id, NEW.site_id) IS DISTINCT FROM (OLD.organisation_id, OLD.site_id) THEN
    RAISE EXCEPTION 'order tenant identity is immutable' USING ERRCODE='23514';
  END IF;
  SELECT organisation_id INTO site_organisation FROM sites WHERE id=NEW.site_id;
  IF NEW.organisation_id IS NULL THEN NEW.organisation_id := site_organisation; END IF;
  IF site_organisation IS NULL OR NEW.organisation_id IS DISTINCT FROM site_organisation THEN
    RAISE EXCEPTION 'order tenant does not match site tenant' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enforce_order_tenant_identity ON orders;
CREATE TRIGGER enforce_order_tenant_identity BEFORE INSERT OR UPDATE OF organisation_id,site_id ON orders FOR EACH ROW EXECUTE FUNCTION enforce_order_tenant_identity();

ALTER TABLE payments ADD COLUMN IF NOT EXISTS organisation_id integer;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS site_id integer;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64);
UPDATE payments p SET organisation_id = o.organisation_id, site_id = o.site_id FROM orders o
 WHERE o.id = p.order_id AND (p.organisation_id IS NULL OR p.site_id IS NULL);
UPDATE payments SET idempotency_key = 'legacy-payment-' || id WHERE idempotency_key IS NULL;
UPDATE payments SET request_fingerprint = md5('legacy-payment-' || id::text) || md5('legacy-payment-' || id::text || ':fingerprint')
 WHERE request_fingerprint IS NULL OR request_fingerprint !~ '^[0-9a-f]{64}$';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM payments WHERE organisation_id IS NULL OR site_id IS NULL) THEN
    RAISE EXCEPTION 'cannot safely establish tenant identity for every legacy payment';
  END IF;
END $$;
DROP INDEX IF EXISTS idx_payments_idempotency_key;
CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_identity ON payments(id, organisation_id, site_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_tenant_idempotency_key
  ON payments(organisation_id, site_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE payments ALTER COLUMN organisation_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN idempotency_key SET NOT NULL;
ALTER TABLE payments ALTER COLUMN request_fingerprint SET NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_request_fingerprint_valid;
ALTER TABLE payments ADD CONSTRAINT payments_request_fingerprint_valid CHECK (request_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_orders_id_fk;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_fkey;
DO $$ DECLARE legacy_fk record; BEGIN
  FOR legacy_fk IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid='payments'::regclass AND c.contype='f' AND array_length(c.conkey,1)=1
      AND c.conkey[1]=(SELECT attnum FROM pg_attribute WHERE attrelid='payments'::regclass AND attname='order_id')
  LOOP EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', legacy_fk.conname); END LOOP;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payments'::regclass AND conname='payments_order_tenant_fkey') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_order_tenant_fkey FOREIGN KEY (order_id,organisation_id,site_id) REFERENCES orders(id,organisation_id,site_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION derive_payment_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tenant record;
BEGIN
  SELECT organisation_id, site_id INTO tenant FROM orders WHERE id = NEW.order_id;
  IF tenant.organisation_id IS NULL OR tenant.site_id IS NULL THEN RAISE EXCEPTION 'payment order has no tenant'; END IF;
  IF NEW.organisation_id IS NOT NULL AND (NEW.organisation_id, NEW.site_id) IS DISTINCT FROM (tenant.organisation_id, tenant.site_id) THEN
    RAISE EXCEPTION 'payment tenant does not match order tenant' USING ERRCODE = '23503';
  END IF;
  NEW.organisation_id := tenant.organisation_id; NEW.site_id := tenant.site_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS derive_payment_tenant ON payments;
CREATE TRIGGER derive_payment_tenant BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION derive_payment_tenant();

CREATE TABLE IF NOT EXISTS order_refunds (
  id serial PRIMARY KEY,
  organisation_id integer NOT NULL REFERENCES organisations(id),
  site_id integer NOT NULL,
  order_id integer NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0 AND amount <= 99999999.99),
  reason text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'approved_internal' CHECK (status IN ('approved_internal','customer_credit')),
  idempotency_key varchar(120) NOT NULL,
  request_fingerprint varchar(64) NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  approved_by varchar,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (id, organisation_id, site_id),
  UNIQUE (organisation_id, site_id, idempotency_key),
  FOREIGN KEY (order_id, organisation_id, site_id) REFERENCES orders(id, organisation_id, site_id)
);

CREATE TABLE IF NOT EXISTS order_payment_allocations (
  id serial PRIMARY KEY,
  payment_id integer NOT NULL,
  organisation_id integer NOT NULL,
  site_id integer NOT NULL,
  service_amount numeric(10,2),
  pickup_delivery_amount numeric(10,2),
  unallocated_amount numeric(10,2),
  created_at timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY (payment_id, organisation_id, site_id) REFERENCES payments(id, organisation_id, site_id),
  CONSTRAINT order_payment_allocation_one_target CHECK (num_nonnulls(service_amount, pickup_delivery_amount, unallocated_amount) = 1),
  CONSTRAINT order_payment_allocation_positive CHECK (coalesce(service_amount, pickup_delivery_amount, unallocated_amount) > 0)
);

CREATE TABLE IF NOT EXISTS order_refund_allocations (
  id serial PRIMARY KEY,
  refund_id integer NOT NULL,
  organisation_id integer NOT NULL,
  site_id integer NOT NULL,
  service_amount numeric(10,2),
  pickup_delivery_amount numeric(10,2),
  unallocated_amount numeric(10,2),
  created_at timestamp NOT NULL DEFAULT now(),
  FOREIGN KEY (refund_id, organisation_id, site_id) REFERENCES order_refunds(id, organisation_id, site_id),
  CONSTRAINT order_refund_allocation_one_target CHECK (num_nonnulls(service_amount, pickup_delivery_amount, unallocated_amount) = 1),
  CONSTRAINT order_refund_allocation_positive CHECK (coalesce(service_amount, pickup_delivery_amount, unallocated_amount) > 0)
);

ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS organisation_id integer;
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS site_id integer;
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS order_id integer;
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS amount numeric(10,2);
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS status varchar(30) DEFAULT 'approved_internal';
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS idempotency_key varchar(120);
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64);
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS approved_by varchar;
ALTER TABLE order_refunds ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS payment_id integer;
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS organisation_id integer;
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS site_id integer;
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS service_amount numeric(10,2);
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS pickup_delivery_amount numeric(10,2);
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS unallocated_amount numeric(10,2);
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS refund_id integer;
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS organisation_id integer;
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS site_id integer;
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS service_amount numeric(10,2);
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS pickup_delivery_amount numeric(10,2);
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS unallocated_amount numeric(10,2);
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

-- Repair populated legacy partial tables only from authoritative parent joins. Tenant
-- identity is never guessed: rows without a resolvable parent deliberately abort.
UPDATE order_refunds r SET organisation_id=o.organisation_id,site_id=o.site_id
FROM orders o WHERE r.order_id=o.id AND (r.organisation_id IS NULL OR r.site_id IS NULL);
UPDATE order_refunds SET reason='Legacy refund import' WHERE reason IS NULL OR btrim(reason)='';
UPDATE order_refunds SET status='approved_internal' WHERE status IS NULL;
UPDATE order_refunds SET idempotency_key='legacy-refund-' || id WHERE idempotency_key IS NULL;
UPDATE order_refunds SET request_fingerprint=md5('legacy-refund-' || id::text) || md5('legacy-refund-' || id::text || ':fingerprint')
WHERE request_fingerprint IS NULL OR request_fingerprint !~ '^[0-9a-f]{64}$';
UPDATE order_refunds SET created_at=now() WHERE created_at IS NULL;
UPDATE order_payment_allocations a SET organisation_id=p.organisation_id,site_id=p.site_id
FROM payments p WHERE a.payment_id=p.id AND (a.organisation_id IS NULL OR a.site_id IS NULL);
UPDATE order_payment_allocations SET created_at=now() WHERE created_at IS NULL;
UPDATE order_refund_allocations a SET organisation_id=r.organisation_id,site_id=r.site_id
FROM order_refunds r WHERE a.refund_id=r.id AND (a.organisation_id IS NULL OR a.site_id IS NULL);
UPDATE order_refund_allocations SET created_at=now() WHERE created_at IS NULL;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM order_refunds WHERE order_id IS NULL OR organisation_id IS NULL OR site_id IS NULL OR amount IS NULL) THEN
   RAISE EXCEPTION 'cannot safely repair legacy order_refunds: order tenant or amount is unresolved';
 END IF;
 IF EXISTS (SELECT 1 FROM order_payment_allocations WHERE payment_id IS NULL OR organisation_id IS NULL OR site_id IS NULL) THEN
   RAISE EXCEPTION 'cannot safely repair legacy order_payment_allocations: payment parent is unresolved';
 END IF;
 IF EXISTS (SELECT 1 FROM order_refund_allocations WHERE refund_id IS NULL OR organisation_id IS NULL OR site_id IS NULL) THEN
   RAISE EXCEPTION 'cannot safely repair legacy order_refund_allocations: refund parent is unresolved';
 END IF;
END $$;
ALTER TABLE order_refunds ALTER COLUMN organisation_id SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN amount SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN reason SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN status SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN idempotency_key SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN request_fingerprint SET NOT NULL;
ALTER TABLE order_refunds ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE order_payment_allocations ALTER COLUMN payment_id SET NOT NULL;
ALTER TABLE order_payment_allocations ALTER COLUMN organisation_id SET NOT NULL;
ALTER TABLE order_payment_allocations ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE order_payment_allocations ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE order_refund_allocations ALTER COLUMN refund_id SET NOT NULL;
ALTER TABLE order_refund_allocations ALTER COLUMN organisation_id SET NOT NULL;
ALTER TABLE order_refund_allocations ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE order_refund_allocations ALTER COLUMN created_at SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refunds'::regclass AND conname='order_refunds_id_organisation_id_site_id_key') THEN ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_id_organisation_id_site_id_key UNIQUE(id,organisation_id,site_id); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refunds'::regclass AND conname='order_refunds_organisation_id_site_id_idempotency_key_key') THEN ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_organisation_id_site_id_idempotency_key_key UNIQUE(organisation_id,site_id,idempotency_key); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refunds'::regclass AND conname='order_refunds_organisation_id_fkey') THEN ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_organisation_id_fkey FOREIGN KEY(organisation_id) REFERENCES organisations(id); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refunds'::regclass AND conname='order_refunds_amount_check') THEN ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_amount_check CHECK (amount > 0 AND amount <= 99999999.99); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refunds'::regclass AND conname='order_refunds_status_check') THEN ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_status_check CHECK (status IN ('approved_internal','customer_credit')); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refunds'::regclass AND conname='order_refunds_request_fingerprint_check') THEN ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_request_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_payment_allocations'::regclass AND conname='order_payment_allocation_one_target') THEN ALTER TABLE order_payment_allocations ADD CONSTRAINT order_payment_allocation_one_target CHECK (num_nonnulls(service_amount,pickup_delivery_amount,unallocated_amount)=1); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_payment_allocations'::regclass AND conname='order_payment_allocation_positive') THEN ALTER TABLE order_payment_allocations ADD CONSTRAINT order_payment_allocation_positive CHECK (coalesce(service_amount,pickup_delivery_amount,unallocated_amount)>0); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refund_allocations'::regclass AND conname='order_refund_allocation_one_target') THEN ALTER TABLE order_refund_allocations ADD CONSTRAINT order_refund_allocation_one_target CHECK (num_nonnulls(service_amount,pickup_delivery_amount,unallocated_amount)=1); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refund_allocations'::regclass AND conname='order_refund_allocation_positive') THEN ALTER TABLE order_refund_allocations ADD CONSTRAINT order_refund_allocation_positive CHECK (coalesce(service_amount,pickup_delivery_amount,unallocated_amount)>0); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refunds'::regclass AND conname='order_refunds_order_id_organisation_id_site_id_fkey') THEN ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_order_id_organisation_id_site_id_fkey FOREIGN KEY(order_id,organisation_id,site_id) REFERENCES orders(id,organisation_id,site_id); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_payment_allocations'::regclass AND conname='order_payment_allocations_payment_id_organisation_id_site_id_fkey') THEN ALTER TABLE order_payment_allocations ADD CONSTRAINT order_payment_allocations_payment_id_organisation_id_site_id_fkey FOREIGN KEY(payment_id,organisation_id,site_id) REFERENCES payments(id,organisation_id,site_id); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refund_allocations'::regclass AND conname='order_refund_allocations_refund_id_organisation_id_site_id_fkey') THEN ALTER TABLE order_refund_allocations ADD CONSTRAINT order_refund_allocations_refund_id_organisation_id_site_id_fkey FOREIGN KEY(refund_id,organisation_id,site_id) REFERENCES order_refunds(id,organisation_id,site_id); END IF;
END $$;

INSERT INTO order_payment_allocations(payment_id,organisation_id,site_id,unallocated_amount)
SELECT p.id,p.organisation_id,p.site_id,p.amount
FROM payments p
WHERE NOT EXISTS (SELECT 1 FROM order_payment_allocations a WHERE a.payment_id=p.id);

CREATE OR REPLACE FUNCTION reject_order_money_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000'; END $$;
DROP TRIGGER IF EXISTS order_refunds_append_only ON order_refunds;
CREATE TRIGGER order_refunds_append_only BEFORE UPDATE OR DELETE ON order_refunds FOR EACH ROW EXECUTE FUNCTION reject_order_money_mutation();
DROP TRIGGER IF EXISTS order_payment_allocations_append_only ON order_payment_allocations;
CREATE TRIGGER order_payment_allocations_append_only BEFORE UPDATE OR DELETE ON order_payment_allocations FOR EACH ROW EXECUTE FUNCTION reject_order_money_mutation();
DROP TRIGGER IF EXISTS order_refund_allocations_append_only ON order_refund_allocations;
CREATE TRIGGER order_refund_allocations_append_only BEFORE UPDATE OR DELETE ON order_refund_allocations FOR EACH ROW EXECUTE FUNCTION reject_order_money_mutation();

CREATE OR REPLACE FUNCTION validate_payment_allocation_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment_total numeric(10,2); allocated numeric(12,2);
BEGIN
  SELECT amount INTO payment_total FROM payments WHERE id = NEW.payment_id AND organisation_id = NEW.organisation_id AND site_id = NEW.site_id FOR UPDATE;
  SELECT coalesce(sum(coalesce(service_amount, pickup_delivery_amount, unallocated_amount)),0) INTO allocated FROM order_payment_allocations WHERE payment_id = NEW.payment_id;
  IF allocated + coalesce(NEW.service_amount, NEW.pickup_delivery_amount, NEW.unallocated_amount) > payment_total THEN RAISE EXCEPTION 'allocations cannot exceed payment'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payments_append_only ON payments;
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION reject_order_money_mutation();
DROP TRIGGER IF EXISTS validate_payment_allocation_total ON order_payment_allocations;
CREATE TRIGGER validate_payment_allocation_total BEFORE INSERT ON order_payment_allocations FOR EACH ROW EXECUTE FUNCTION validate_payment_allocation_total();

CREATE OR REPLACE FUNCTION validate_refund_allocation_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE refund_total numeric(10,2); allocated numeric(12,2);
BEGIN
  SELECT amount INTO refund_total FROM order_refunds WHERE id = NEW.refund_id AND organisation_id = NEW.organisation_id AND site_id = NEW.site_id FOR UPDATE;
  SELECT coalesce(sum(coalesce(service_amount, pickup_delivery_amount, unallocated_amount)),0) INTO allocated FROM order_refund_allocations WHERE refund_id = NEW.refund_id;
  IF allocated + coalesce(NEW.service_amount, NEW.pickup_delivery_amount, NEW.unallocated_amount) > refund_total THEN RAISE EXCEPTION 'allocations cannot exceed refund'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_refund_allocation_total ON order_refund_allocations;
CREATE TRIGGER validate_refund_allocation_total BEFORE INSERT ON order_refund_allocations FOR EACH ROW EXECUTE FUNCTION validate_refund_allocation_total();

CREATE OR REPLACE FUNCTION freeze_organisation_currency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.currency IS DISTINCT FROM OLD.currency AND (
    EXISTS (SELECT 1 FROM orders WHERE organisation_id = OLD.id)
    OR EXISTS (SELECT 1 FROM payments WHERE organisation_id = OLD.id)
    OR EXISTS (SELECT 1 FROM order_refunds WHERE organisation_id = OLD.id)
    OR EXISTS (SELECT 1 FROM membership_subscription_payments WHERE organisation_id = OLD.id)
    OR EXISTS (SELECT 1 FROM credit_transactions WHERE organisation_id = OLD.id)
  ) THEN RAISE EXCEPTION 'currency cannot change after a financial record is posted' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS organisations_currency_freeze ON organisations;
CREATE TRIGGER organisations_currency_freeze BEFORE UPDATE OF currency ON organisations FOR EACH ROW EXECUTE FUNCTION freeze_organisation_currency();

COMMIT;
