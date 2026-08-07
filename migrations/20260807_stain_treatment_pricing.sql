BEGIN;
SELECT pg_advisory_xact_lock(20260807, 2);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key varchar(120);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_fingerprint varchar(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS posted_at timestamp NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS orders_organisation_id_site_id_idempotency_key_key ON orders(organisation_id,site_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='orders'::regclass AND conname='orders_request_fingerprint_check') THEN ALTER TABLE orders ADD CONSTRAINT orders_request_fingerprint_check CHECK(request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$'); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_items'::regclass AND conname='order_items_id_order_id_key') THEN ALTER TABLE order_items ADD CONSTRAINT order_items_id_order_id_key UNIQUE(id,order_id); END IF;
END $$;
CREATE OR REPLACE FUNCTION preserve_order_posted_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.posted_at IS DISTINCT FROM OLD.posted_at THEN RAISE EXCEPTION 'orders.posted_at is immutable' USING ERRCODE='55000'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS preserve_order_posted_at ON orders;
CREATE TRIGGER preserve_order_posted_at BEFORE UPDATE OF posted_at ON orders FOR EACH ROW EXECUTE FUNCTION preserve_order_posted_at();

CREATE TABLE IF NOT EXISTS stain_treatment_pricing_sets (
 id serial PRIMARY KEY, organisation_id integer NOT NULL REFERENCES organisations(id), site_id integer NOT NULL,
 current_version integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT stain_treatment_pricing_sets_organisation_id_site_id_key UNIQUE(organisation_id,site_id),
 CONSTRAINT stain_treatment_pricing_sets_id_organisation_id_site_id_key UNIQUE(id,organisation_id,site_id),
 CONSTRAINT stain_treatment_pricing_sets_site_tenant_fkey FOREIGN KEY(site_id,organisation_id) REFERENCES sites(id,organisation_id),
 CONSTRAINT stain_treatment_pricing_sets_version_check CHECK(current_version >= 0)
);

CREATE TABLE IF NOT EXISTS stain_treatment_price_versions (
 id serial PRIMARY KEY, pricing_set_id integer NOT NULL, organisation_id integer NOT NULL, site_id integer NOT NULL,
 set_version integer NOT NULL, level varchar(30) NOT NULL, unit varchar(10) NOT NULL, currency varchar(10) NOT NULL,
 price numeric(10,2) NOT NULL, effective_at timestamp NOT NULL DEFAULT now(), active boolean NOT NULL DEFAULT true,
 created_by varchar NOT NULL, created_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT stain_treatment_price_versions_identity UNIQUE(id,organisation_id,site_id),
 CONSTRAINT stain_treatment_price_versions_version_identity UNIQUE(id,organisation_id,site_id,set_version),
 CONSTRAINT stain_treatment_price_versions_set_level_unit_key UNIQUE(pricing_set_id,set_version,level,unit),
 CONSTRAINT stain_treatment_price_versions_set_tenant_fkey FOREIGN KEY(pricing_set_id,organisation_id,site_id) REFERENCES stain_treatment_pricing_sets(id,organisation_id,site_id),
 CONSTRAINT stain_treatment_price_versions_level_check CHECK(level IN ('standard','intensive','very_intensive')),
 CONSTRAINT stain_treatment_price_versions_unit_check CHECK(unit IN ('piece','kg')),
 CONSTRAINT stain_treatment_price_versions_currency_check CHECK(currency ~ '^[A-Z]{3,10}$'),
 CONSTRAINT stain_treatment_price_versions_price_check CHECK(price > 0 AND price <= 99999999.99 AND price=round(price,2)),
 CONSTRAINT stain_treatment_price_versions_version_check CHECK(set_version > 0)
);
ALTER TABLE stain_treatment_price_versions ALTER COLUMN currency TYPE varchar(10);
ALTER TABLE stain_treatment_price_versions DROP CONSTRAINT IF EXISTS stain_treatment_price_versions_currency_check;
ALTER TABLE stain_treatment_price_versions ADD CONSTRAINT stain_treatment_price_versions_currency_check CHECK(currency ~ '^[A-Z]{3,10}$');
CREATE UNIQUE INDEX IF NOT EXISTS stain_treatment_active_rate_key ON stain_treatment_price_versions(organisation_id,site_id,level,unit) WHERE active;
CREATE INDEX IF NOT EXISTS idx_stain_treatment_price_versions_site_effective ON stain_treatment_price_versions(organisation_id,site_id,effective_at);

CREATE TABLE IF NOT EXISTS order_stain_treatments (
 id serial PRIMARY KEY, organisation_id integer NOT NULL, site_id integer NOT NULL, order_id integer NOT NULL, order_item_id integer NOT NULL,
 level varchar(30) NOT NULL, unit varchar(10) NOT NULL, quantity numeric(10,2) NOT NULL, captured_rate numeric(10,2) NOT NULL,
 line_total numeric(10,2) NOT NULL, currency varchar(10) NOT NULL, pricing_version_id integer NOT NULL, pricing_set_version integer NOT NULL,
 idempotency_key varchar(120) NOT NULL, acknowledgement_affirmed boolean, acknowledgement_text_version varchar(120), acknowledged_by varchar,
 acknowledged_at timestamp, corrected_from_treatment_id integer, created_by varchar NOT NULL, created_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT order_stain_treatments_identity UNIQUE(id,organisation_id,site_id),
 CONSTRAINT order_stain_treatments_organisation_id_idempotency_key_key UNIQUE(organisation_id,idempotency_key),
 CONSTRAINT order_stain_treatments_order_tenant_fkey FOREIGN KEY(order_id,organisation_id,site_id) REFERENCES orders(id,organisation_id,site_id),
 CONSTRAINT order_stain_treatments_item_order_fkey FOREIGN KEY(order_item_id,order_id) REFERENCES order_items(id,order_id),
 CONSTRAINT order_stain_treatments_pricing_version_tenant_fkey FOREIGN KEY(pricing_version_id,organisation_id,site_id,pricing_set_version) REFERENCES stain_treatment_price_versions(id,organisation_id,site_id,set_version),
 CONSTRAINT order_stain_treatments_corrected_from_tenant_fkey FOREIGN KEY(corrected_from_treatment_id,organisation_id,site_id) REFERENCES order_stain_treatments(id,organisation_id,site_id),
 CONSTRAINT order_stain_treatments_level_check CHECK(level IN ('standard','intensive','very_intensive')),
 CONSTRAINT order_stain_treatments_unit_check CHECK(unit IN ('piece','kg')),
 CONSTRAINT order_stain_treatments_currency_check CHECK(currency ~ '^[A-Z]{3,10}$'),
 CONSTRAINT order_stain_treatments_amount_check CHECK(quantity > 0 AND quantity=round(quantity,2) AND (unit <> 'piece' OR quantity=trunc(quantity)) AND captured_rate > 0 AND captured_rate=round(captured_rate,2) AND line_total > 0 AND line_total=round(quantity*captured_rate,2)),
 CONSTRAINT order_stain_treatments_acknowledgement_check CHECK((level <> 'very_intensive' AND acknowledgement_affirmed IS NULL AND acknowledgement_text_version IS NULL AND acknowledged_by IS NULL AND acknowledged_at IS NULL) OR (level='very_intensive' AND acknowledgement_affirmed IS TRUE AND acknowledgement_text_version IS NOT NULL AND acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL)),
 CONSTRAINT order_stain_treatments_correction_check CHECK(corrected_from_treatment_id IS NULL OR corrected_from_treatment_id <> id)
);
ALTER TABLE order_stain_treatments ALTER COLUMN currency TYPE varchar(10);
ALTER TABLE order_stain_treatments DROP CONSTRAINT IF EXISTS order_stain_treatments_currency_check;
ALTER TABLE order_stain_treatments ADD CONSTRAINT order_stain_treatments_currency_check CHECK(currency ~ '^[A-Z]{3,10}$');
CREATE UNIQUE INDEX IF NOT EXISTS order_stain_treatments_corrected_from_key ON order_stain_treatments(corrected_from_treatment_id) WHERE corrected_from_treatment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_stain_treatments_tenant_date ON order_stain_treatments(organisation_id,site_id,created_at);
CREATE INDEX IF NOT EXISTS idx_order_stain_treatments_order_item ON order_stain_treatments(order_id,order_item_id);

CREATE TABLE IF NOT EXISTS order_stain_treatment_adjustments (
 id serial PRIMARY KEY, organisation_id integer NOT NULL, site_id integer NOT NULL, treatment_id integer NOT NULL,
 quantity_effect numeric(10,2) NOT NULL, amount_effect numeric(10,2) NOT NULL, action varchar(20) NOT NULL, reason text NOT NULL,
 idempotency_key varchar(120) NOT NULL, acknowledgement_affirmed boolean, acknowledgement_text_version varchar(120), acknowledged_by varchar,
 acknowledged_at timestamp, created_by varchar NOT NULL, created_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT order_stain_treatment_adjustments_organisation_id_idempotency_key_key UNIQUE(organisation_id,idempotency_key),
 CONSTRAINT order_stain_treatment_adjustments_treatment_tenant_fkey FOREIGN KEY(treatment_id,organisation_id,site_id) REFERENCES order_stain_treatments(id,organisation_id,site_id),
 CONSTRAINT order_stain_treatment_adjustments_action_check CHECK(action IN ('adjustment','void')),
 CONSTRAINT order_stain_treatment_adjustments_effect_check CHECK(quantity_effect <> 0 AND quantity_effect=round(quantity_effect,2) AND amount_effect <> 0 AND amount_effect=round(amount_effect,2)),
 CONSTRAINT order_stain_treatment_adjustments_reason_check CHECK(length(btrim(reason)) > 0),
 CONSTRAINT order_stain_treatment_adjustments_acknowledgement_check CHECK((acknowledgement_affirmed IS NULL AND acknowledgement_text_version IS NULL AND acknowledged_by IS NULL AND acknowledged_at IS NULL) OR (acknowledgement_affirmed IS TRUE AND acknowledgement_text_version IS NOT NULL AND acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_order_stain_treatment_adjustments_tenant_date ON order_stain_treatment_adjustments(organisation_id,site_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS order_stain_treatment_adjustments_single_void ON order_stain_treatment_adjustments(treatment_id) WHERE action='void';

ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS treatment_id integer;
ALTER TABLE order_payment_allocations ADD COLUMN IF NOT EXISTS treatment_amount numeric(10,2);
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS treatment_id integer;
ALTER TABLE order_refund_allocations ADD COLUMN IF NOT EXISTS treatment_amount numeric(10,2);
ALTER TABLE order_payment_allocations DROP CONSTRAINT IF EXISTS order_payment_allocation_one_target;
ALTER TABLE order_payment_allocations DROP CONSTRAINT IF EXISTS order_payment_allocation_positive;
ALTER TABLE order_refund_allocations DROP CONSTRAINT IF EXISTS order_refund_allocation_one_target;
ALTER TABLE order_refund_allocations DROP CONSTRAINT IF EXISTS order_refund_allocation_positive;
ALTER TABLE order_payment_allocations ADD CONSTRAINT order_payment_allocation_one_target CHECK(num_nonnulls(service_amount, treatment_amount, pickup_delivery_amount, unallocated_amount) = 1 AND (treatment_amount IS NULL OR treatment_id IS NOT NULL) AND (treatment_amount IS NOT NULL OR treatment_id IS NULL));
ALTER TABLE order_payment_allocations ADD CONSTRAINT order_payment_allocation_positive CHECK(coalesce(service_amount,treatment_amount,pickup_delivery_amount,unallocated_amount)>0);
ALTER TABLE order_refund_allocations ADD CONSTRAINT order_refund_allocation_one_target CHECK(num_nonnulls(service_amount, treatment_amount, pickup_delivery_amount, unallocated_amount) = 1 AND (treatment_amount IS NULL OR treatment_id IS NOT NULL) AND (treatment_amount IS NOT NULL OR treatment_id IS NULL));
ALTER TABLE order_refund_allocations ADD CONSTRAINT order_refund_allocation_positive CHECK(coalesce(service_amount,treatment_amount,pickup_delivery_amount,unallocated_amount)>0);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_payment_allocations'::regclass AND conname='order_payment_allocations_treatment_tenant_fkey') THEN ALTER TABLE order_payment_allocations ADD CONSTRAINT order_payment_allocations_treatment_tenant_fkey FOREIGN KEY(treatment_id,organisation_id,site_id) REFERENCES order_stain_treatments(id,organisation_id,site_id); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_refund_allocations'::regclass AND conname='order_refund_allocations_treatment_tenant_fkey') THEN ALTER TABLE order_refund_allocations ADD CONSTRAINT order_refund_allocations_treatment_tenant_fkey FOREIGN KEY(treatment_id,organisation_id,site_id) REFERENCES order_stain_treatments(id,organisation_id,site_id); END IF;
END $$;

CREATE OR REPLACE FUNCTION reject_stain_financial_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only',TG_TABLE_NAME USING ERRCODE='55000'; END $$;
DROP TRIGGER IF EXISTS order_stain_treatments_append_only ON order_stain_treatments;
CREATE TRIGGER order_stain_treatments_append_only BEFORE UPDATE OR DELETE ON order_stain_treatments FOR EACH ROW EXECUTE FUNCTION reject_stain_financial_mutation();
DROP TRIGGER IF EXISTS order_stain_treatment_adjustments_append_only ON order_stain_treatment_adjustments;
CREATE TRIGGER order_stain_treatment_adjustments_append_only BEFORE UPDATE OR DELETE ON order_stain_treatment_adjustments FOR EACH ROW EXECUTE FUNCTION reject_stain_financial_mutation();

CREATE OR REPLACE FUNCTION validate_payment_allocation_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payment_total numeric(10,2); allocated numeric(12,2);
BEGIN
 SELECT amount INTO payment_total FROM payments WHERE id=NEW.payment_id AND organisation_id=NEW.organisation_id AND site_id=NEW.site_id FOR UPDATE;
 SELECT coalesce(sum(coalesce(service_amount,treatment_amount,pickup_delivery_amount,unallocated_amount)),0) INTO allocated FROM order_payment_allocations WHERE payment_id=NEW.payment_id;
 IF allocated + coalesce(NEW.service_amount,NEW.treatment_amount,NEW.pickup_delivery_amount,NEW.unallocated_amount) > payment_total THEN RAISE EXCEPTION 'allocations cannot exceed payment'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION validate_refund_allocation_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE refund_total numeric(10,2); allocated numeric(12,2);
BEGIN
 SELECT amount INTO refund_total FROM order_refunds WHERE id=NEW.refund_id AND organisation_id=NEW.organisation_id AND site_id=NEW.site_id FOR UPDATE;
 SELECT coalesce(sum(coalesce(service_amount,treatment_amount,pickup_delivery_amount,unallocated_amount)),0) INTO allocated FROM order_refund_allocations WHERE refund_id=NEW.refund_id;
 IF allocated + coalesce(NEW.service_amount,NEW.treatment_amount,NEW.pickup_delivery_amount,NEW.unallocated_amount) > refund_total THEN RAISE EXCEPTION 'allocations cannot exceed refund'; END IF;
 RETURN NEW;
END $$;

COMMIT;
