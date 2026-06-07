ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "area" text;

ALTER TABLE "garment_items"
  ADD COLUMN IF NOT EXISTS "details" text;
