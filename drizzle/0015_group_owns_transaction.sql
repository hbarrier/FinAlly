-- Track whether a group entry / reimbursement created its own linked movement
-- (delete them together) or merely points at a movement allocated from the ledger
-- (deleting the mapping must leave the movement alone).

ALTER TABLE `group_entries` ADD `owns_transaction` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `group_reimbursements` ADD `owns_transaction` integer DEFAULT 1 NOT NULL;
