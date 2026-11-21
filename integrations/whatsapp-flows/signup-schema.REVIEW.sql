-- Pour revue. Ne jamais exécuter pendant une compilation ou au démarrage.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA xpresspro_flow_signup;
CREATE TABLE xpresspro_flow_signup.connections (
  site_id integer PRIMARY KEY,
  organisation_id integer NOT NULL,
  phone text NOT NULL UNIQUE,
  waba_id text NOT NULL,
  phone_number_id text NOT NULL UNIQUE,
  encrypted_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status = 'pending'),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
