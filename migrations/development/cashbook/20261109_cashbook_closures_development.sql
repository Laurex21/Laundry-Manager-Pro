-- Isolated development database only. Legacy timestamps in this workspace are UTC.
CREATE TABLE IF NOT EXISTS cashbook_period_locks (
 site_id integer PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cashbook_closures (
 id serial PRIMARY KEY,
 organisation_id integer NOT NULL REFERENCES organisations(id),
 site_id integer NOT NULL REFERENCES sites(id),
 month varchar(7) NOT NULL,
 currency varchar(3) NOT NULL,
 period_end timestamptz NOT NULL,
 reconciliation_id integer NOT NULL REFERENCES cashbook_reconciliations(id),
 actor text NOT NULL,
 report jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organisation_id,site_id,month)
);
DROP TRIGGER IF EXISTS cashbook_closure_immutable ON cashbook_closures;
CREATE TRIGGER cashbook_closure_immutable BEFORE UPDATE OR DELETE ON cashbook_closures
FOR EACH ROW EXECUTE FUNCTION cashbook_reconciliation_immutable();

-- All financial writers and the closing transaction share this lock.
-- VOLATILE trigger queries see a closure committed while the writer was waiting.
CREATE OR REPLACE FUNCTION cashbook_guard_site(p_site integer,p_at timestamptz) RETURNS void
LANGUAGE plpgsql VOLATILE AS $$
DECLARE org integer;
BEGIN
 IF p_site IS NULL THEN RETURN; END IF;
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

CREATE OR REPLACE FUNCTION cashbook_guard_sources() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
DECLARE r jsonb; s integer; p integer; linked record;
BEGIN
 -- Ordinary order status updates do not alter the cash ledger.
 IF TG_TABLE_NAME='orders' AND TG_OP='UPDATE' AND (to_jsonb(NEW)->'site_id') IS NOT DISTINCT FROM (to_jsonb(OLD)->'site_id') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='sites' AND TG_OP='UPDATE' AND (to_jsonb(NEW)->'organisation_id') IS NOT DISTINCT FROM (to_jsonb(OLD)->'organisation_id') THEN RETURN NEW; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(CASE TG_OP WHEN 'INSERT' THEN jsonb_build_array(to_jsonb(NEW)) WHEN 'DELETE' THEN jsonb_build_array(to_jsonb(OLD)) ELSE jsonb_build_array(to_jsonb(OLD),to_jsonb(NEW)) END)
 LOOP
  IF TG_TABLE_NAME='payments' THEN
   SELECT site_id INTO s FROM orders WHERE id=(r->>'order_id')::integer;
   PERFORM cashbook_guard_site(s,(r->>'date')::timestamp AT TIME ZONE 'UTC');
   -- A payment method also determines the wallet for its linked surplus.
   FOR linked IN SELECT site_id,created_at FROM credit_transactions WHERE payment_id=(r->>'id')::integer AND type='credit' AND reason='overpayment' LOOP
    PERFORM cashbook_guard_site(linked.site_id,linked.created_at AT TIME ZONE 'UTC');
   END LOOP;
  ELSIF TG_TABLE_NAME='expenditures' THEN
   PERFORM cashbook_guard_site((r->>'site_id')::integer,(r->>'date')::timestamp AT TIME ZONE 'UTC');
  ELSIF TG_TABLE_NAME='credit_transactions' THEN
   PERFORM cashbook_guard_site((r->>'site_id')::integer,(r->>'created_at')::timestamp AT TIME ZONE 'UTC');
  ELSIF TG_TABLE_NAME='cashbook_manual_movements' THEN
   PERFORM cashbook_guard_site((r->>'site_id')::integer,(r->>'occurred_at')::timestamptz);
  ELSIF TG_TABLE_NAME='cashbook_expense_allocations' THEN
   PERFORM cashbook_guard_site((r->>'site_id')::integer,(SELECT date AT TIME ZONE 'UTC' FROM expenditures WHERE id=(r->>'expense_id')::integer));
  ELSIF TG_TABLE_NAME='cashbook_accounts' THEN
   -- Opening another wallet after the cutoff remains possible.
   PERFORM cashbook_guard_site((r->>'site_id')::integer,CASE WHEN TG_OP='INSERT' THEN (r->>'opened_at')::timestamptz ELSE NULL END);
  ELSIF TG_TABLE_NAME='orders' THEN
   PERFORM cashbook_guard_site((r->>'site_id')::integer,NULL);
  ELSIF TG_TABLE_NAME='sites' THEN
   PERFORM cashbook_guard_site((r->>'id')::integer,NULL);
  END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['payments','expenditures','credit_transactions','cashbook_manual_movements','cashbook_expense_allocations','cashbook_accounts'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS cashbook_closed_period_guard ON %I',t);
  EXECUTE format('CREATE TRIGGER cashbook_closed_period_guard BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION cashbook_guard_sources()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['orders','sites'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS cashbook_closed_period_guard ON %I',t);
  EXECUTE format('CREATE TRIGGER cashbook_closed_period_guard BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION cashbook_guard_sources()',t);
 END LOOP;
END $$;
