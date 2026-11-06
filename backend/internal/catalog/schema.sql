CREATE TABLE portfolios (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id)
);
CREATE INDEX portfolios_owner ON portfolios(user_id,id);
CREATE TABLE accounts (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id),
 portfolio_id text NOT NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 kind text NOT NULL CHECK(kind IN ('brokerage','crypto','savings')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 provider text NOT NULL DEFAULT '' CHECK(length(provider)<=120),
 savings_product text NOT NULL DEFAULT '' CHECK(savings_product IN ('','livret_a','pel','other')),
 archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(portfolio_id,user_id) REFERENCES portfolios(id,user_id),
 CHECK((kind='savings' AND savings_product<>'') OR (kind<>'savings' AND savings_product='')),
 CHECK(savings_product NOT IN ('livret_a','pel') OR currency='EUR'),
 UNIQUE(id,user_id)
);
CREATE INDEX accounts_owner ON accounts(user_id,portfolio_id,id);
CREATE TABLE assets (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 kind text NOT NULL CHECK(kind IN ('stock','etf','crypto','stablecoin')),
 symbol text NOT NULL CHECK(length(symbol) BETWEEN 1 AND 30),
 namespace text NOT NULL CHECK(length(namespace) BETWEEN 1 AND 80),
 reference text NOT NULL CHECK(length(reference) BETWEEN 1 AND 160),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,namespace,reference),
 UNIQUE(id,user_id)
);
CREATE INDEX assets_owner ON assets(user_id,id);
INSERT INTO atlas_schema(version) VALUES(2);
