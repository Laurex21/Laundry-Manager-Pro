-- Existing orders remain exempt from the new handover gate; new orders opt in explicitly.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requires_garment_verification boolean NOT NULL DEFAULT false;
ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS quality_checked_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS handed_over_quantity integer NOT NULL DEFAULT 0;
ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS quality_checked_at timestamp;
ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS quality_checked_by varchar;
ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS handed_over_at timestamp;
ALTER TABLE garment_items ADD COLUMN IF NOT EXISTS handed_over_by varchar;
