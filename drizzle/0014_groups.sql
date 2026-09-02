-- Generic "Groups" (shared-expense) module. Adds the group tables and renames the
-- divorce module flag. No data is moved here: the existing divorce data is migrated
-- by scripts/migrate-divorce-to-group.ts after this schema lands. Legacy reimbursement
-- tables + transactions.reimbursement* columns are dropped later in 0015.

CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`settlement_delay_days` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`is_self` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_members_group_id_idx` ON `group_members` (`group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_members_group_self_unique` ON `group_members` (`group_id`) WHERE `is_self` = 1;--> statement-breakpoint
CREATE TABLE `group_member_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`member_id` text NOT NULL,
	`percent` real NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_member_shares_group_id_idx` ON `group_member_shares` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_member_shares_member_id_idx` ON `group_member_shares` (`member_id`);--> statement-breakpoint
CREATE TABLE `group_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`direction` text DEFAULT 'expense' NOT NULL,
	`description` text,
	`payer_id` text NOT NULL,
	`transaction_id` text,
	`involves_all` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payer_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `group_entries_group_id_idx` ON `group_entries` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_entries_group_date_idx` ON `group_entries` (`group_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_entries_transaction_id_unique` ON `group_entries` (`transaction_id`) WHERE `transaction_id` is not null;--> statement-breakpoint
CREATE TABLE `group_entry_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`member_id` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `group_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_entry_participants_entry_id_idx` ON `group_entry_participants` (`entry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_entry_participants_entry_member_unique` ON `group_entry_participants` (`entry_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `group_entry_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount` real NOT NULL,
	`comment` text,
	FOREIGN KEY (`entry_id`) REFERENCES `group_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `group_entry_overrides_entry_id_idx` ON `group_entry_overrides` (`entry_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_entry_overrides_entry_member_unique` ON `group_entry_overrides` (`entry_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `group_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`scope` text NOT NULL,
	`member_id` text,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`due_date` text,
	`settled_at` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `group_statements_group_id_idx` ON `group_statements` (`group_id`);--> statement-breakpoint
CREATE TABLE `group_reimbursements` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`direction` text NOT NULL,
	`member_id` text NOT NULL,
	`transaction_id` text,
	`statement_id` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `group_members`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`statement_id`) REFERENCES `group_statements`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `group_reimbursements_group_id_idx` ON `group_reimbursements` (`group_id`);--> statement-breakpoint
CREATE INDEX `group_reimbursements_member_id_idx` ON `group_reimbursements` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `group_reimbursements_transaction_id_unique` ON `group_reimbursements` (`transaction_id`) WHERE `transaction_id` is not null;--> statement-breakpoint
ALTER TABLE `user_settings` RENAME COLUMN `module_divorce` TO `module_groups`;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `module_taxstatus` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `user_settings` SET `module_taxstatus` = `module_groups`;
