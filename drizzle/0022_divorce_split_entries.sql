-- Standalone manual ledger for the divorce cost-split page (me / Audrey / Vincent).
-- Purely additive: a new table, nothing existing is touched.
CREATE TABLE `divorce_split_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`person` text NOT NULL,
	`amount` real NOT NULL,
	`my_percent` real,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `divorce_split_entries_date_idx` ON `divorce_split_entries` (`date`);
