CREATE TABLE `monthly_opening_balances` (
	`month` text PRIMARY KEY NOT NULL,
	`opening_balance` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `monthly_opening_balances_month_idx` ON `monthly_opening_balances` (`month`);