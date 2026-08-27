ALTER TABLE `transactions` ADD `recurring_amount_id` text;
--> statement-breakpoint
CREATE INDEX `transactions_recurring_amount_id_idx` ON `transactions` (`recurring_amount_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`kind` text NOT NULL,
	`method` text DEFAULT 'card' NOT NULL,
	`category_id` text,
	`merchant_id` text,
	`note` text,
	`recurring_id` text,
	`recurring_amount_id` text,
	`reimbursable` integer DEFAULT 0 NOT NULL,
	`reimbursement_tx_id` text,
	`cleared` integer DEFAULT 0 NOT NULL,
	`claimed_date` text,
	`manual_settlement_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_amount_id`) REFERENCES `recurring_amounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transactions`(
	`id`,
	`date`,
	`amount`,
	`kind`,
	`method`,
	`category_id`,
	`merchant_id`,
	`note`,
	`recurring_id`,
	`recurring_amount_id`,
	`reimbursable`,
	`reimbursement_tx_id`,
	`cleared`,
	`claimed_date`,
	`manual_settlement_at`,
	`created_at`
)
SELECT
	`id`,
	`date`,
	`amount`,
	`kind`,
	`method`,
	`category_id`,
	`merchant_id`,
	`note`,
	`recurring_id`,
	`recurring_amount_id`,
	`reimbursable`,
	`reimbursement_tx_id`,
	`cleared`,
	`claimed_date`,
	`manual_settlement_at`,
	`created_at`
FROM `transactions`;
--> statement-breakpoint
DROP TABLE `transactions`;
--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
