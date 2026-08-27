CREATE TABLE `recurring_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_id` text NOT NULL,
	`month` text NOT NULL,
	`status` text DEFAULT 'expected' NOT NULL,
	`transaction_id` text,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recurring_instances_recurring_id_idx` ON `recurring_instances` (`recurring_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_instances_recurring_month_unique` ON `recurring_instances` (`recurring_id`,`month`);--> statement-breakpoint
CREATE TABLE `tax_allocations` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`allocation` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions_fts` (
	`transaction_id` text NOT NULL,
	`note` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `recurring` ADD `method` text DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring` ADD `month_rules` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `method` text DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `recurring_amount_id` text REFERENCES recurring_amounts(id);--> statement-breakpoint
CREATE INDEX `transactions_recurring_amount_id_idx` ON `transactions` (`recurring_amount_id`);