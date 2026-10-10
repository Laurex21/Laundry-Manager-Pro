-- Pilot only. Run manually after a reviewed backup and after
-- 20261009_saas_entitlements_v4.sql has been applied. This does not change
-- the legacy Enterprise subscription or enable any feature flag.
BEGIN;

DO $$
DECLARE
  v_owner_id varchar;
  v_latest_plan varchar;
  v_latest_status varchar;
  v_active_sites integer;
  v_staff_accounts integer;
BEGIN
  SELECT owner_id INTO v_owner_id FROM organisations WHERE id = 424 FOR UPDATE;
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Pilot organisation 424 missing'; END IF;

  SELECT p.slug, s.status INTO v_latest_plan, v_latest_status
  FROM subscriptions s JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = v_owner_id ORDER BY s.created_at DESC, s.id DESC LIMIT 1;
  IF v_latest_plan IS DISTINCT FROM 'enterprise' OR v_latest_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Legacy subscription changed; review before seeding pilot';
  END IF;

  SELECT count(*) INTO v_active_sites FROM sites
  WHERE organisation_id = 424 AND is_active = true;
  SELECT count(*) INTO v_staff_accounts FROM users
  WHERE organisation_id = 424 AND user_type = 'staff';
  IF v_active_sites <> 1 OR v_staff_accounts <> 0 THEN
    RAISE EXCEPTION 'Pilot footprint changed; review before seeding';
  END IF;

  IF EXISTS (SELECT 1 FROM saas_entitlements_v4 WHERE organisation_id = 424) THEN
    RAISE EXCEPTION 'Pilot entitlement already exists; no automatic overwrite';
  END IF;
  INSERT INTO saas_entitlements_v4 (organisation_id, plan_slug, state)
  VALUES (424, 'starter', 'starter');
END $$;

COMMIT;
