CREATE TABLE `reimbursement_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`percent` real NOT NULL,
	`start_date` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `categories` ADD `is_pension_alimentaire` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `reimbursable` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `reimbursement_tx_id` text;