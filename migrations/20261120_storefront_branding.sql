-- Development/review only. Production requires new approval for this exact SQL
-- and inspection of the actual Replit diff. Never run at startup or build time.
BEGIN;
ALTER TABLE public.storefronts ADD COLUMN branding jsonb NOT NULL DEFAULT
  '{"template":"classic","accent":"#125d4e","welcome":"Du linge frais. Du temps pour vous.","logo":"","cover":"","serviceImages":{}}'::jsonb;
COMMIT;
