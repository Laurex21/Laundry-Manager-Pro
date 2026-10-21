-- Additive: existing invoices remain explicitly Sandbox, never converted to live.
-- Apply only during the separately approved deployment, after a verified backup.
BEGIN;
ALTER TABLE saas_invoices ADD COLUMN IF NOT EXISTS provider_environment text NOT NULL DEFAULT 'sandbox';
COMMIT;
