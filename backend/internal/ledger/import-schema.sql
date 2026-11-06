CREATE TABLE import_batches (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id),
 fingerprint text NOT NULL,
 rows jsonb NOT NULL,
 confirmed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,fingerprint)
);
INSERT INTO atlas_schema(version) VALUES(4);
