-- Cost split: rent is now a per-month section driven by settings (rent, APL, my %),
-- and expenses get a "my share paid" flag. Additive only: no existing data is touched.
CREATE TABLE `divorce_split_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`rent` real NOT NULL,
	`apl` real NOT NULL,
	`my_percent` real NOT NULL,
	`start_month` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `divorce_split_settings` (`id`, `rent`, `apl`, `my_percent`, `start_month`) VALUES (1, 320, 90, 35, '2026-10');
--> statement-breakpoint
CREATE TABLE `divorce_split_rent_months` (
	`month` text PRIMARY KEY NOT NULL,
	`rent` real,
	`apl` real,
	`vincent_paid` integer DEFAULT 0 NOT NULL,
	`audrey_paid` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `divorce_split_entries` ADD `me_paid` integer DEFAULT 0 NOT NULL;
