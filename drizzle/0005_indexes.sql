CREATE INDEX IF NOT EXISTS `transactions_category_id_idx` ON `transactions` (`category_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_merchant_id_idx` ON `transactions` (`merchant_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_recurring_id_idx` ON `transactions` (`recurring_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_date_idx` ON `transactions` (`date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_kind_date_idx` ON `transactions` (`kind`, `date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recurring_amounts_recurring_id_idx` ON `recurring_amounts` (`recurring_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reimbursement_rates_start_date_idx` ON `reimbursement_rates` (`start_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `merchants_is_active_idx` ON `merchants` (`is_active`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `merchants_category_id_idx` ON `merchants` (`category_id`);
