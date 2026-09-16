-- UI language management.
--
-- Additive: a `languages` table (user-added UI languages; English is implicit and
-- never a row) and a `translations` table (per-language overrides of message keys,
-- edited from the /languages admin screen), plus a `locale` preference on
-- user_settings.
--
-- Also renames the two seeded categories whose names were French — 'Remboursements'
-- and 'Pension alimentaire' — to English. The reimbursement category is still
-- anchored by name via a partial unique index, so the index predicate moves with it.
CREATE TABLE `languages` (
	`code` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`id` text PRIMARY KEY NOT NULL,
	`language_code` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`language_code`) REFERENCES `languages`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `translations_language_key_unique` ON `translations` (`language_code`,`key`);--> statement-breakpoint
CREATE INDEX `translations_language_code_idx` ON `translations` (`language_code`);--> statement-breakpoint
ALTER TABLE `user_settings` ADD `locale` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
DROP INDEX `categories_reimbursement_name_unique`;--> statement-breakpoint
UPDATE `categories` SET `name` = 'Reimbursements' WHERE `name` = 'Remboursements';--> statement-breakpoint
UPDATE `categories` SET `name` = 'Child support' WHERE `is_pension_alimentaire` = 1 AND `name` = 'Pension alimentaire';--> statement-breakpoint
CREATE UNIQUE INDEX `categories_reimbursement_name_unique` ON `categories` (`name`) WHERE `name` = 'Reimbursements';
