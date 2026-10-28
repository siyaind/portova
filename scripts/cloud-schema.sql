-- Run once against the Portova Postgres database. No wallet keys are stored.
CREATE TABLE IF NOT EXISTS portova_projects (
  id varchar(80) PRIMARY KEY,
  owner varchar(64) NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  project jsonb NOT NULL,
  description varchar(1200) NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS portova_projects_owner ON portova_projects(owner);
CREATE TABLE IF NOT EXISTS portova_challenges (
  id uuid PRIMARY KEY,
  owner varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS portova_challenges_expiry ON portova_challenges(expires_at);
