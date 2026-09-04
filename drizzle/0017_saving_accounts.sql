-- Saving accounts + the "saving" movement/recurring kind.
--
-- Additive only: a new saving_accounts table, two nullable transfer-endpoint
-- columns each on transactions and recurring (NULL endpoint = the credit
-- account), and a categories.is_savings flag backing the auto-created protected
-- "Savings" category. Extending the kind text enum to include 'saving' is a
-- drizzle type-only change (no CHECK constraint), so no SQL for that here.
CREATE TABLE `saving_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_balance` real DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `source_saving_account_id` text REFERENCES saving_accounts(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `transactions` ADD `dest_saving_account_id` text REFERENCES saving_accounts(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `recurring` ADD `source_saving_account_id` text REFERENCES saving_accounts(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `recurring` ADD `dest_saving_account_id` text REFERENCES saving_accounts(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `categories` ADD `is_savings` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_savings_unique` ON `categories` (`is_savings`) WHERE `is_savings` = 1;--> statement-breakpoint
CREATE INDEX `transactions_source_saving_account_id_idx` ON `transactions` (`source_saving_account_id`);--> statement-breakpoint
CREATE INDEX `transactions_dest_saving_account_id_idx` ON `transactions` (`dest_saving_account_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `categories` (`id`, `name`, `icon`, `color`, `kind`, `is_pension_alimentaire`, `is_savings`, `is_active`)
VALUES ('cat_savings', 'Savings', 'cat-seed', 'sage', 'expense', 0, 1, 1);
