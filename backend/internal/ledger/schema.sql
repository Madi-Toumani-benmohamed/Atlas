CREATE TABLE operations (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id),
 account_id text NOT NULL,
 target_account_id text,
 asset_id text,
 sequence bigserial UNIQUE NOT NULL,
 logical_order bigint NOT NULL DEFAULT 0,
 payload jsonb NOT NULL,
 active boolean NOT NULL DEFAULT true,
 corrects text REFERENCES operations(id),
 reason text NOT NULL DEFAULT '',
 idempotency_key text NOT NULL,
 request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(account_id,user_id) REFERENCES accounts(id,user_id),
 FOREIGN KEY(target_account_id,user_id) REFERENCES accounts(id,user_id),
 FOREIGN KEY(asset_id,user_id) REFERENCES assets(id,user_id),
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX operations_owner ON operations(user_id,sequence);
CREATE TABLE price_observations (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id),
 asset_id text,
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 value text NOT NULL,
 observed_at timestamptz NOT NULL,
 source text NOT NULL,
 source_type text NOT NULL DEFAULT 'manual' CHECK(source_type='manual'),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(asset_id,user_id) REFERENCES assets(id,user_id)
);
CREATE INDEX prices_owner ON price_observations(user_id,asset_id,observed_at);
INSERT INTO atlas_schema(version) VALUES(3);
