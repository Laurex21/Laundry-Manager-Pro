-- Run only after reviewing duplicate owners and resolving any existing records.
-- This migration does not delete or merge organisations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM organisations GROUP BY owner_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one organisation per owner: duplicate owner_id values exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS organisations_owner_id_unique
  ON organisations (owner_id);
