ALTER TABLE recurring ADD COLUMN month_rules text;

CREATE TABLE recurring_instances (
  id text PRIMARY KEY NOT NULL,
  recurring_id text NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,
  month text NOT NULL,
  status text NOT NULL DEFAULT 'expected' CHECK(status IN ('expected','linked','not_applicable')),
  transaction_id text REFERENCES transactions(id) ON DELETE SET NULL,
  UNIQUE(recurring_id, month)
);

CREATE INDEX recurring_instances_recurring_id_idx ON recurring_instances (recurring_id);

-- Backfill linked instances from existing transactions.
-- One instance per (recurring_id, month); pick the most recently created transaction when multiple exist.
INSERT OR IGNORE INTO recurring_instances (id, recurring_id, month, status, transaction_id)
SELECT
  lower(hex(randomblob(4))) || lower(hex(randomblob(2))) || lower(hex(randomblob(2))) || lower(hex(randomblob(2))) || lower(hex(randomblob(6))),
  recurring_id,
  substr(date, 1, 7),
  'linked',
  id
FROM (
  SELECT id, recurring_id, date,
         row_number() OVER (PARTITION BY recurring_id, substr(date,1,7) ORDER BY created_at DESC) as rn
  FROM transactions
  WHERE recurring_id IS NOT NULL
)
WHERE rn = 1;
