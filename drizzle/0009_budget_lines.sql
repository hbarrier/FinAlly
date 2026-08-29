DROP TABLE `budget_amounts`;--> statement-breakpoint
CREATE TABLE `budget_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_id` text NOT NULL,
	`name` text,
	`kind` text NOT NULL,
	`category_id` text NOT NULL,
	`merchant_id` text,
	`amount` real NOT NULL,
	`frequency` text NOT NULL,
	`recurring` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `budget_lines_budget_id_idx` ON `budget_lines` (`budget_id`);--> statement-breakpoint
CREATE INDEX `budget_lines_category_id_idx` ON `budget_lines` (`category_id`);
