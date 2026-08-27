CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`limit_amount` real NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_category_unique` ON `budgets` (`category_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'tag' NOT NULL,
	`color` text DEFAULT 'teal' NOT NULL,
	`kind` text NOT NULL,
	`is_pension_alimentaire` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target` real NOT NULL,
	`saved` real DEFAULT 0 NOT NULL,
	`icon` text DEFAULT 'cat-seed' NOT NULL,
	`color` text DEFAULT 'sage' NOT NULL,
	`deadline` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `merchants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`comment` text,
	`category_id` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `merchants_is_active_idx` ON `merchants` (`is_active`);--> statement-breakpoint
CREATE INDEX `merchants_category_id_idx` ON `merchants` (`category_id`);--> statement-breakpoint
CREATE TABLE `monthly_opening_balances` (
	`month` text PRIMARY KEY NOT NULL,
	`opening_balance` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `monthly_opening_balances_month_idx` ON `monthly_opening_balances` (`month`);--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`kind` text NOT NULL,
	`method` text DEFAULT 'card' NOT NULL,
	`category_id` text,
	`merchant_id` text,
	`cadence` text NOT NULL,
	`day_of_month` integer,
	`day_of_week` integer,
	`start_date` text NOT NULL,
	`end_date` text,
	`month_rules` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `recurring_amounts` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_id` text NOT NULL,
	`amount` real NOT NULL,
	`start_date` text NOT NULL,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recurring_amounts_recurring_id_idx` ON `recurring_amounts` (`recurring_id`);--> statement-breakpoint
CREATE TABLE `recurring_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`recurring_id` text NOT NULL,
	`month` text NOT NULL,
	`status` text DEFAULT 'expected' NOT NULL,
	`transaction_id` text,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recurring_instances_recurring_id_idx` ON `recurring_instances` (`recurring_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recurring_instances_recurring_month_unique` ON `recurring_instances` (`recurring_id`,`month`);--> statement-breakpoint
CREATE TABLE `reimbursement_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`reimbursement_tx_id` text NOT NULL,
	`expense_tx_id` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`reimbursement_tx_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_tx_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reimbursement_allocations_reimbursement_tx_id_idx` ON `reimbursement_allocations` (`reimbursement_tx_id`);--> statement-breakpoint
CREATE INDEX `reimbursement_allocations_expense_tx_id_idx` ON `reimbursement_allocations` (`expense_tx_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reimbursement_allocations_income_expense_unique` ON `reimbursement_allocations` (`reimbursement_tx_id`,`expense_tx_id`);--> statement-breakpoint
CREATE TABLE `reimbursement_claim_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`reimbursement_tx_id` text NOT NULL,
	FOREIGN KEY (`claim_id`) REFERENCES `reimbursement_claims`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reimbursement_tx_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rca_claim_id_idx` ON `reimbursement_claim_allocations` (`claim_id`);--> statement-breakpoint
CREATE INDEX `rca_tx_id_idx` ON `reimbursement_claim_allocations` (`reimbursement_tx_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `rca_claim_tx_unique` ON `reimbursement_claim_allocations` (`claim_id`,`reimbursement_tx_id`);--> statement-breakpoint
CREATE TABLE `reimbursement_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`claim_date` text NOT NULL,
	`settled_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reimbursement_claims_month_unique` ON `reimbursement_claims` (`month`);--> statement-breakpoint
CREATE INDEX `reimbursement_claims_month_idx` ON `reimbursement_claims` (`month`);--> statement-breakpoint
CREATE TABLE `reimbursement_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`percent` real NOT NULL,
	`start_date` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reimbursement_rates_start_date_idx` ON `reimbursement_rates` (`start_date`);--> statement-breakpoint
CREATE TABLE `simulation_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`simulation_id` text NOT NULL,
	`name` text,
	`kind` text NOT NULL,
	`category_id` text,
	`merchant_id` text,
	`amount` real NOT NULL,
	`frequency` text NOT NULL,
	`source_recurring_id` text,
	FOREIGN KEY (`simulation_id`) REFERENCES `simulations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `simulation_lines_simulation_id_idx` ON `simulation_lines` (`simulation_id`);--> statement-breakpoint
CREATE INDEX `simulation_lines_category_id_idx` ON `simulation_lines` (`category_id`);--> statement-breakpoint
CREATE TABLE `simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_allocations` (
	`transaction_id` text PRIMARY KEY NOT NULL,
	`allocation` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`kind` text NOT NULL,
	`method` text DEFAULT 'card' NOT NULL,
	`category_id` text,
	`merchant_id` text,
	`note` text,
	`recurring_id` text,
	`recurring_amount_id` text,
	`reimbursable` integer DEFAULT 0 NOT NULL,
	`reimbursement_tx_id` text,
	`reimbursement_amount_override` real,
	`reimbursement_comment` text,
	`cleared` integer DEFAULT 0 NOT NULL,
	`claimed_date` text,
	`manual_settlement_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_amount_id`) REFERENCES `recurring_amounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transactions_category_id_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_merchant_id_idx` ON `transactions` (`merchant_id`);--> statement-breakpoint
CREATE INDEX `transactions_recurring_id_idx` ON `transactions` (`recurring_id`);--> statement-breakpoint
CREATE INDEX `transactions_recurring_amount_id_idx` ON `transactions` (`recurring_amount_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_kind_date_idx` ON `transactions` (`kind`,`date`);--> statement-breakpoint
CREATE VIRTUAL TABLE `transactions_fts` USING fts5(
  transaction_id UNINDEXED,
  note,
  tokenize = 'unicode61'
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `transactions_fts_ai` AFTER INSERT ON `transactions` BEGIN
  INSERT OR REPLACE INTO `transactions_fts` (`transaction_id`, `note`)
  VALUES (NEW.`id`, COALESCE(NEW.`note`, ''));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `transactions_fts_ad` AFTER DELETE ON `transactions` BEGIN
  DELETE FROM `transactions_fts` WHERE `transaction_id` = OLD.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `transactions_fts_au` AFTER UPDATE ON `transactions` BEGIN
  INSERT OR REPLACE INTO `transactions_fts` (`transaction_id`, `note`)
  VALUES (NEW.`id`, COALESCE(NEW.`note`, ''));
END;
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`name` text DEFAULT 'You' NOT NULL,
	`starting_balance` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`onboarded` integer DEFAULT 0 NOT NULL,
	`module_recurring` integer DEFAULT 1 NOT NULL,
	`module_divorce` integer DEFAULT 0 NOT NULL,
	`module_budgets` integer DEFAULT 0 NOT NULL,
	`module_simulations` integer DEFAULT 0 NOT NULL,
	`module_objectives` integer DEFAULT 0 NOT NULL
);
