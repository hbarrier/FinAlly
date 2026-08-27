ALTER TABLE `simulation_lines` ADD `origin` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `simulations` ADD `inputs` text;--> statement-breakpoint
UPDATE `simulation_lines` SET `origin` = 'recurring' WHERE `source_recurring_id` IS NOT NULL;--> statement-breakpoint
UPDATE `simulation_lines` SET `origin` = 'rollup' WHERE `rollup` = 1;
