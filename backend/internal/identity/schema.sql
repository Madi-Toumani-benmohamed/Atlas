CREATE TABLE IF NOT EXISTS atlas_schema(version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
INSERT INTO atlas_schema(version) VALUES (1) ON CONFLICT DO NOTHING;
