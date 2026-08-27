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
INSERT OR IGNORE INTO `reimbursement_allocations` (
	`id`,
	`reimbursement_tx_id`,
	`expense_tx_id`,
	`amount`
)
SELECT
	'legacy-' || expense.`id` || '-' || income.`id`,
	income.`id`,
	expense.`id`,
	income.`amount`
FROM `transactions` expense
INNER JOIN `transactions` income ON income.`id` = expense.`reimbursement_tx_id`
WHERE expense.`reimbursement_tx_id` IS NOT NULL
	AND expense.`kind` = 'expense'
	AND income.`kind` = 'income';