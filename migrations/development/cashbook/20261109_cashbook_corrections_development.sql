-- Isolated development database only. Corrections never rewrite closed history.
CREATE TABLE IF NOT EXISTS cashbook_corrections (
 id serial PRIMARY KEY,
 organisation_id integer NOT NULL,
 site_id integer NOT NULL,
 account_id integer NOT NULL,
 closure_id integer NOT NULL REFERENCES cashbook_closures(id),
 direction text NOT NULL CHECK(direction IN ('increase','decrease')),
 amount numeric(18,6) NOT NULL CHECK(amount>0),
 occurred_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
 reference text NOT NULL CHECK(length(reference) BETWEEN 3 AND 200),
 created_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 idempotency_key uuid NOT NULL,
 UNIQUE(organisation_id,idempotency_key),
 FOREIGN KEY(organisation_id,site_id,account_id) REFERENCES cashbook_accounts(organisation_id,site_id,id)
);
CREATE OR REPLACE FUNCTION cashbook_guard_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'CASHBOOK_CORRECTION_IMMUTABLE'; END IF;
 PERFORM cashbook_guard_site(NEW.site_id,NEW.occurred_at);
 IF NOT EXISTS(SELECT 1 FROM cashbook_closures c WHERE c.id=NEW.closure_id AND c.organisation_id=NEW.organisation_id AND c.site_id=NEW.site_id AND c.period_end<=NEW.occurred_at) THEN
  RAISE EXCEPTION 'CASHBOOK_INVALID_CORRECTION_CLOSURE';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cashbook_guard_correction ON cashbook_corrections;
CREATE TRIGGER cashbook_guard_correction BEFORE INSERT OR UPDATE OR DELETE ON cashbook_corrections FOR EACH ROW EXECUTE FUNCTION cashbook_guard_correction();
