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
