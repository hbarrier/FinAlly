ALTER TABLE `budget_amounts` ADD `recurring_monthly` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_amounts` ADD `recurring_yearly` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_amounts` ADD `adhoc_monthly` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_amounts` ADD `adhoc_yearly` real DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `budget_amounts` SET `adhoc_monthly` = `limit_amount`;--> statement-breakpoint
ALTER TABLE `budget_amounts` DROP COLUMN `limit_amount`;
