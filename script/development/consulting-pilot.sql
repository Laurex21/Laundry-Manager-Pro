-- Development simulator only. One enrolment per learner for this one-course pilot.
CREATE TABLE IF NOT EXISTS consulting_pilot_purchases (
  learner_id varchar PRIMARY KEY REFERENCES users(id),
  checkout_id uuid NOT NULL UNIQUE,
  amount_xaf integer NOT NULL CHECK (amount_xaf = 100),
  status text NOT NULL CHECK (status IN ('ACCEPTED', 'COMPLETED')),
  confirmed_at timestamptz,
  CHECK ((status = 'COMPLETED') = (confirmed_at IS NOT NULL))
);

-- Video destinations are provisioned in the development database outside the web bundle.
CREATE TABLE IF NOT EXISTS consulting_pilot_videos (
  module_id text PRIMARY KEY,
  youtube_id varchar(11) NOT NULL CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$')
);

-- Official sandbox attempts are independent of client-confirmed simulator purchases.
CREATE TABLE IF NOT EXISTS consulting_course_sandbox_attempts (
  checkout_id uuid PRIMARY KEY,
  learner_id varchar NOT NULL REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('PENDING','COMPLETED','FAILED','EXPIRED','CANCELLED')),
  checkout_code text,
  redirect_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  CHECK ((status = 'COMPLETED') = (confirmed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS consulting_course_one_purchase
  ON consulting_course_sandbox_attempts(learner_id) WHERE status IN ('PENDING','COMPLETED');
CREATE INDEX IF NOT EXISTS consulting_course_attempt_history
  ON consulting_course_sandbox_attempts(learner_id, created_at DESC);
