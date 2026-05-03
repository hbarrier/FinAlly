CREATE INDEX IF NOT EXISTS `transactions_merchant_date_idx` ON `transactions` (`merchant_id`, `date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_category_date_idx` ON `transactions` (`category_id`, `date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_date_created_at_id_idx` ON `transactions` (`date`, `created_at`, `id`);

