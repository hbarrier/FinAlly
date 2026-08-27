CREATE TABLE simulations (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  description text,
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE simulation_lines (
  id text PRIMARY KEY NOT NULL,
  simulation_id text NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  name text,
  kind text NOT NULL CHECK(kind IN ('expense','income')),
  category_id text REFERENCES categories(id) ON DELETE SET NULL,
  merchant_id text REFERENCES merchants(id) ON DELETE SET NULL,
  amount real NOT NULL,
  frequency text NOT NULL CHECK(frequency IN ('monthly','yearly')),
  source_recurring_id text REFERENCES recurring(id) ON DELETE SET NULL
);

CREATE INDEX simulation_lines_simulation_id_idx ON simulation_lines (simulation_id);
CREATE INDEX simulation_lines_category_id_idx ON simulation_lines (category_id);
