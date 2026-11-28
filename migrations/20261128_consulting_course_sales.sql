BEGIN;
CREATE TABLE IF NOT EXISTS consulting_course_live_videos (
  module_id text PRIMARY KEY,
  youtube_id varchar(11) NOT NULL CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$')
);

-- Each learner can have only one pending or confirmed purchase.
CREATE TABLE IF NOT EXISTS consulting_course_live_attempts (
  checkout_id uuid PRIMARY KEY,
  learner_id varchar NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('PENDING','COMPLETED','FAILED','EXPIRED','CANCELLED')),
  amount_xaf integer NOT NULL CHECK (amount_xaf = 100000),
  checkout_code text,
  redirect_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CHECK ((status = 'COMPLETED') = (confirmed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS consulting_course_live_one_purchase
  ON consulting_course_live_attempts(learner_id) WHERE status IN ('PENDING','COMPLETED');
CREATE INDEX IF NOT EXISTS consulting_course_live_history
  ON consulting_course_live_attempts(learner_id, created_at DESC);
COMMIT;
