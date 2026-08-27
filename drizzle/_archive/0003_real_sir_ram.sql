CREATE TABLE `recurring_amounts` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_id` text NOT NULL,
	`amount` real NOT NULL,
	`start_date` text NOT NULL,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `recurring_amounts` (`id`, `recurring_id`, `amount`, `start_date`)
SELECT `id` || '_v0', `id`, `amount`, `start_date` FROM `recurring`;
