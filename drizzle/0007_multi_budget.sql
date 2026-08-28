ALTER TABLE `budgets` RENAME TO `budget_amounts_old`;--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `budget_amounts` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`category_id` text NOT NULL,
	`limit_amount` real NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_amounts_budget_category_unique` ON `budget_amounts` (`budget_id`,`category_id`);--> statement-breakpoint
INSERT INTO `budgets` (`id`, `name`, `description`, `is_active`) SELECT 'budget_default', 'My budget', NULL, 1 WHERE EXISTS (SELECT 1 FROM `budget_amounts_old`);--> statement-breakpoint
INSERT INTO `budget_amounts` (`id`, `budget_id`, `category_id`, `limit_amount`) SELECT `id`, 'budget_default', `category_id`, `limit_amount` FROM `budget_amounts_old`;--> statement-breakpoint
DROP TABLE `budget_amounts_old`;
