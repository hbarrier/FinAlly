ALTER TABLE transactions ADD COLUMN reimbursement_amount_override REAL;
ALTER TABLE transactions ADD COLUMN reimbursement_comment TEXT;

CREATE TABLE reimbursement_claims (
  id TEXT PRIMARY KEY NOT NULL,
  month TEXT NOT NULL UNIQUE,
  claim_date TEXT NOT NULL,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX reimbursement_claims_month_idx ON reimbursement_claims (month);

CREATE TABLE reimbursement_claim_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  claim_id TEXT NOT NULL REFERENCES reimbursement_claims(id) ON DELETE CASCADE,
  reimbursement_tx_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  UNIQUE(claim_id, reimbursement_tx_id)
);

CREATE INDEX reimbursement_claim_allocations_claim_id_idx ON reimbursement_claim_allocations (claim_id);
CREATE INDEX reimbursement_claim_allocations_tx_id_idx ON reimbursement_claim_allocations (reimbursement_tx_id);
