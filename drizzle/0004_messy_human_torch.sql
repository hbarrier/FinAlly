ALTER TABLE `merchants` ADD `is_active` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `merchants_is_active_idx` ON `merchants` (`is_active`);--> statement-breakpoint
CREATE INDEX `merchants_category_id_idx` ON `merchants` (`category_id`);--> statement-breakpoint
ALTER TABLE `recurring` ADD `merchant_id` text REFERENCES merchants(id);--> statement-breakpoint
CREATE INDEX `recurring_amounts_recurring_id_idx` ON `recurring_amounts` (`recurring_id`);--> statement-breakpoint
CREATE INDEX `reimbursement_rates_start_date_idx` ON `reimbursement_rates` (`start_date`);--> statement-breakpoint
CREATE INDEX `transactions_category_id_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_merchant_id_idx` ON `transactions` (`merchant_id`);--> statement-breakpoint
CREATE INDEX `transactions_recurring_id_idx` ON `transactions` (`recurring_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_kind_date_idx` ON `transactions` (`kind`,`date`);