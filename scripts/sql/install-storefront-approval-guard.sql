-- Operational protection, installed explicitly. Never run from app startup/build.
-- No storefront tables or customer records are created or modified here.
BEGIN;

-- A reinstall is atomic: other sessions keep the existing protection until commit.
DO $guard_reinstall$
DECLARE trigger_name text;
BEGIN
  FOREACH trigger_name IN ARRAY ARRAY[
    'xpresspro_storefront_approval_start',
    'xpresspro_storefront_approval_end',
    'xpresspro_storefront_approval_drop'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = trigger_name) THEN
      EXECUTE format('ALTER EVENT TRIGGER %I DISABLE', trigger_name);
    END IF;
  END LOOP;
END;
$guard_reinstall$;

CREATE SCHEMA IF NOT EXISTS xpresspro_release_guard;
REVOKE ALL ON SCHEMA xpresspro_release_guard FROM PUBLIC;

-- Retain identities so a DROP or a rename cannot hide a protected object.
-- This inventory contains catalog identifiers only, never customer records.
CREATE TABLE IF NOT EXISTS xpresspro_release_guard.protected_objects (
  classid oid NOT NULL, objid oid NOT NULL, PRIMARY KEY (classid, objid)
);
REVOKE ALL ON xpresspro_release_guard.protected_objects FROM PUBLIC;
CREATE OR REPLACE FUNCTION xpresspro_release_guard.storefront_objects()
RETURNS TABLE(classid oid, objid oid)
LANGUAGE sql STABLE SET search_path = pg_catalog
AS $objects$
  WITH RECURSIVE protected(classid, objid) AS (
    SELECT 'pg_class'::regclass::oid, oid FROM pg_class
    WHERE relname ~* '^storefront(s|_[a-z0-9_]+)$'
    UNION
    SELECT d.classid, d.objid FROM pg_depend d
    JOIN protected p ON p.classid = d.refclassid AND p.objid = d.refobjid
  ) SELECT * FROM protected;
$objects$;
REVOKE ALL ON FUNCTION xpresspro_release_guard.storefront_objects() FROM PUBLIC;
DELETE FROM xpresspro_release_guard.protected_objects;
INSERT INTO xpresspro_release_guard.protected_objects
SELECT * FROM xpresspro_release_guard.storefront_objects();

CREATE OR REPLACE FUNCTION xpresspro_release_guard.require_storefront_approval()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $guard$
DECLARE
  changed_object record;
  protected_name constant text := '\mstorefront(s|_[a-z0-9_]+)\M';
  blocked boolean := false;
BEGIN
  IF TG_EVENT = 'ddl_command_start' THEN
    -- Also catches ordinary renames away from a protected name.
    blocked := current_query() ~* protected_name;
  ELSIF TG_EVENT = 'ddl_command_end' THEN
    -- Catalog identities cover dynamically generated CREATE/ALTER statements.
    FOR changed_object IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
      IF changed_object.object_identity ~* protected_name OR EXISTS (
        SELECT 1 FROM xpresspro_release_guard.protected_objects p
        WHERE p.classid = changed_object.classid AND p.objid = changed_object.objid
      ) OR EXISTS (
        SELECT 1 FROM xpresspro_release_guard.storefront_objects() p
        WHERE p.classid = changed_object.classid AND p.objid = changed_object.objid
      ) THEN
        blocked := true;
        EXIT;
      END IF;
    END LOOP;
  ELSIF TG_EVENT = 'sql_drop' THEN
    -- Includes objects removed indirectly by DROP SCHEMA ... CASCADE.
    FOR changed_object IN SELECT * FROM pg_event_trigger_dropped_objects() LOOP
      IF changed_object.object_identity ~* protected_name OR EXISTS (
        SELECT 1 FROM xpresspro_release_guard.protected_objects p
        WHERE p.classid = changed_object.classid AND p.objid = changed_object.objid
      ) THEN
        blocked := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF blocked THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'STOREFRONT_APPROVAL_REQUIRED: migration storefront bloquée.',
      HINT = 'Une nouvelle validation explicite du propriétaire est requise pour le SQL exact. Voir docs/releases/storefront-approval.md. Ne pas désactiver cette protection pour publier une autre fonctionnalité.';
  END IF;
END;
$guard$;

REVOKE ALL ON FUNCTION xpresspro_release_guard.require_storefront_approval() FROM PUBLIC;

DO $guard_install$
DECLARE configuration record;
BEGIN
  FOR configuration IN SELECT * FROM (VALUES
    ('xpresspro_storefront_approval_start', 'ddl_command_start'),
    ('xpresspro_storefront_approval_end', 'ddl_command_end'),
    ('xpresspro_storefront_approval_drop', 'sql_drop')
  ) AS events(name, event) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = configuration.name) THEN
      EXECUTE format('CREATE EVENT TRIGGER %I ON %s EXECUTE FUNCTION xpresspro_release_guard.require_storefront_approval()', configuration.name, configuration.event);
    END IF;
    EXECUTE format('ALTER EVENT TRIGGER %I ENABLE ALWAYS', configuration.name);
  END LOOP;
END;
$guard_install$;

COMMIT;
