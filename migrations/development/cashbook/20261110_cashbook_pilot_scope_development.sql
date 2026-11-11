-- Isolated development migration, applied after the five cashbook migrations.
-- Enable a new site only while financial writers are stopped and their
-- transactions are drained. A transaction with an older snapshot cannot
-- observe a newly inserted enrollment row.
CREATE TABLE IF NOT EXISTS cashbook_pilot_sites (
 site_id integer PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE
);
-- Preserve the scope of existing cashbooks without copying payment history.
INSERT INTO cashbook_pilot_sites(site_id)
SELECT DISTINCT site_id FROM cashbook_accounts
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION cashbook_guard_site(p_site integer,p_at timestamptz) RETURNS void
LANGUAGE plpgsql VOLATILE AS $$
DECLARE org integer;
BEGIN
 IF p_site IS NULL THEN RETURN; END IF;
 -- Closed periods remain protected if pilot access is later removed.
 IF NOT EXISTS(SELECT 1 FROM cashbook_pilot_sites WHERE site_id=p_site)
    AND NOT EXISTS(SELECT 1 FROM cashbook_closures WHERE site_id=p_site) THEN RETURN; END IF;
 SELECT organisation_id INTO org FROM sites WHERE id=p_site;
 IF org IS NULL THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(61106,org);
 -- A versioned write also forces stale REPEATABLE READ/SERIALIZABLE writers to abort.
 INSERT INTO cashbook_period_locks(site_id,revision) VALUES(p_site,1)
 ON CONFLICT(site_id) DO UPDATE SET revision=cashbook_period_locks.revision+1;
 IF EXISTS(SELECT 1 FROM cashbook_closures WHERE site_id=p_site AND (p_at IS NULL OR p_at<period_end)) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='CASHBOOK_PERIOD_CLOSED';
 END IF;
END; $$;

CREATE OR REPLACE FUNCTION cashbook_capture_membership_receipt(p_payment integer,p_org integer,p_site integer)
RETURNS void LANGUAGE plpgsql VOLATILE AS $$
DECLARE p membership_subscription_payments%ROWTYPE;
DECLARE receiving_site integer;
BEGIN
 SELECT * INTO STRICT p FROM membership_subscription_payments WHERE id=p_payment AND organisation_id=p_org;
 IF p.amount<=0 OR p.status IS NULL OR p.status NOT IN ('partial','completed','renewal_partial','renewal_completed','advance_available','advance_applied') THEN RETURN; END IF;
 SELECT s.id INTO receiving_site
 FROM customer_subscriptions sub
 JOIN customers cu ON cu.id=sub.customer_id
 JOIN sites s ON s.id=cu.site_id
 WHERE sub.id=p.subscription_id AND sub.organisation_id=p_org AND s.organisation_id=p_org;
 IF p_site IS DISTINCT FROM receiving_site AND EXISTS (
  SELECT 1 FROM cashbook_pilot_sites WHERE site_id=p_site
 ) THEN RAISE EXCEPTION 'CASHBOOK_MEMBERSHIP_SITE_REQUIRED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM cashbook_pilot_sites WHERE site_id=receiving_site)
    AND NOT EXISTS (SELECT 1 FROM cashbook_closures WHERE site_id=receiving_site) THEN RETURN; END IF;
 IF p_site IS DISTINCT FROM receiving_site THEN RAISE EXCEPTION 'CASHBOOK_MEMBERSHIP_SITE_REQUIRED'; END IF;
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
