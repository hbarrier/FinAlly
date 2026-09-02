-- Restore the standalone `divorce` module and drop the Groups reimbursement/statement
-- sub-feature. The legacy reimbursement_* tables and transactions.reimbursable columns
-- are left untouched (that is what /reimbursements + /tax-status still run on).
--
-- Explicit ordered deletes (not FK cascade) remove the one-shot `grp_divorce` group
-- that the abandoned divorce->group data migration created; all no-ops on a fresh DB.
DELETE FROM `group_entry_overrides` WHERE `entry_id` IN (SELECT `id` FROM `group_entries` WHERE `group_id` = 'grp_divorce');--> statement-breakpoint
DELETE FROM `group_entry_participants` WHERE `entry_id` IN (SELECT `id` FROM `group_entries` WHERE `group_id` = 'grp_divorce');--> statement-breakpoint
DELETE FROM `group_entries` WHERE `group_id` = 'grp_divorce';--> statement-breakpoint
DELETE FROM `group_member_shares` WHERE `group_id` = 'grp_divorce';--> statement-breakpoint
DELETE FROM `group_members` WHERE `group_id` = 'grp_divorce';--> statement-breakpoint
DELETE FROM `groups` WHERE `id` = 'grp_divorce';--> statement-breakpoint
DROP TABLE `group_reimbursements`;--> statement-breakpoint
DROP TABLE `group_statements`;--> statement-breakpoint
ALTER TABLE `user_settings` RENAME COLUMN `module_taxstatus` TO `module_divorce`;
