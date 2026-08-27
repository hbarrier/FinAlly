ALTER TABLE `transactions` ADD `method` text NOT NULL DEFAULT 'card';
--> statement-breakpoint
ALTER TABLE `recurring` ADD `method` text NOT NULL DEFAULT 'card';
--> statement-breakpoint
UPDATE `transactions`
SET `method` = 'transfer'
WHERE `kind` = 'income';
--> statement-breakpoint
UPDATE `recurring`
SET `method` = 'transfer'
WHERE `kind` = 'income';
