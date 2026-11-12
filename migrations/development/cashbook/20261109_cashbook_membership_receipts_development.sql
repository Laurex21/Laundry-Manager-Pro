-- Isolated development only. No backfill: historical payments lack a verified collection site.
CREATE TABLE IF NOT EXISTS cashbook_membership_receipts (
 payment_id integer PRIMARY KEY REFERENCES membership_subscription_payments(id),
 organisation_id integer NOT NULL REFERENCES organisations(id),
 site_id integer NOT NULL REFERENCES sites(id),
 occurred_at timestamptz NOT NULL,
 amount numeric(12,2) NOT NULL CHECK (amount > 0),
 method text NOT NULL
);
CREATE INDEX IF NOT EXISTS cashbook_membership_receipts_scope
 ON cashbook_membership_receipts(organisation_id, site_id, occurred_at);

CREATE OR REPLACE FUNCTION cashbook_capture_membership_receipt(p_payment integer,p_org integer,p_site integer)
RETURNS void LANGUAGE plpgsql VOLATILE AS $$
DECLARE p membership_subscription_payments%ROWTYPE;
BEGIN
 SELECT * INTO STRICT p FROM membership_subscription_payments WHERE id=p_payment AND organisation_id=p_org;
 IF p.amount<=0 OR p.status IS NULL OR p.status NOT IN ('partial','completed','renewal_partial','renewal_completed','advance_available','advance_applied') THEN RETURN; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM customer_subscriptions sub
  JOIN customers cu ON cu.id=sub.customer_id
  JOIN sites s ON s.id=cu.site_id
  WHERE sub.id=p.subscription_id AND sub.organisation_id=p_org AND s.organisation_id=p_org AND s.id=p_site
 ) THEN RAISE EXCEPTION 'CASHBOOK_MEMBERSHIP_SITE_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM cashbook_membership_receipts WHERE payment_id=p_payment) THEN RETURN; END IF;
 IF p.payment_date IS NULL THEN RAISE EXCEPTION 'CASHBOOK_MEMBERSHIP_DATE_REQUIRED'; END IF;
 PERFORM cashbook_guard_site(p_site,p.payment_date AT TIME ZONE 'UTC');
 INSERT INTO cashbook_membership_receipts(payment_id,organisation_id,site_id,occurred_at,amount,method)
 VALUES(p.id,p_org,p_site,p.payment_date AT TIME ZONE 'UTC',p.amount,
   CASE lower(trim(p.payment_method))
    WHEN 'cash' THEN 'Cash'
    WHEN 'card' THEN 'Visa/Mastercard'
    WHEN 'bank_transfer' THEN 'Bank Transfer'
    WHEN 'bank transfer' THEN 'Bank Transfer'
    WHEN 'mobile_money' THEN 'Mobile Money'
    WHEN 'mobile money' THEN 'Mobile Money'
    ELSE coalesce(nullif(trim(p.payment_method),''),'Mode non renseigné')
   END)
 ON CONFLICT(payment_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION cashbook_membership_receipt_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'CASHBOOK_MEMBERSHIP_RECEIPT_IMMUTABLE';
END $$;
DROP TRIGGER IF EXISTS cashbook_membership_receipt_immutable ON cashbook_membership_receipts;
CREATE TRIGGER cashbook_membership_receipt_immutable BEFORE UPDATE OR DELETE ON cashbook_membership_receipts
 FOR EACH ROW EXECUTE FUNCTION cashbook_membership_receipt_immutable();
