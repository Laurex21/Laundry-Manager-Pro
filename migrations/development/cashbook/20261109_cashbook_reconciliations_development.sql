-- Development only. Reconciliations are immutable observations, not period locks.
CREATE TABLE IF NOT EXISTS cashbook_reconciliations (
 id serial PRIMARY KEY,
 organisation_id integer NOT NULL REFERENCES organisations(id),
 site_ids integer[] NOT NULL CHECK(cardinality(site_ids)>0),
 month varchar(7) NOT NULL,
 currency varchar(3) NOT NULL,
 actor text NOT NULL,
 reason text NOT NULL,
 fingerprint varchar(64) NOT NULL,
 report jsonb NOT NULL,
 reconciliation jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashbook_reconciliations_scope ON cashbook_reconciliations(organisation_id,month,currency);
CREATE OR REPLACE FUNCTION cashbook_reconciliation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CASHBOOK_RECONCILIATION_IMMUTABLE'; END; $$;
DROP TRIGGER IF EXISTS cashbook_reconciliation_immutable ON cashbook_reconciliations;
CREATE TRIGGER cashbook_reconciliation_immutable BEFORE UPDATE OR DELETE ON cashbook_reconciliations
FOR EACH ROW EXECUTE FUNCTION cashbook_reconciliation_immutable();
