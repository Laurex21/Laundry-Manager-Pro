-- Run manually ONLY against a disposable XPress Pro test database.
-- Never include in production migrations. The application refuses to process
-- v4 Sandbox subscription payments unless this table exists and the explicit
-- SAAS_V4_TEST_DATABASE=true flag is set.
CREATE TABLE IF NOT EXISTS saas_v4_test_environment_marker (
  id integer PRIMARY KEY CHECK (id = 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO saas_v4_test_environment_marker (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
