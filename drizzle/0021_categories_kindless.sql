-- Categories no longer carry a kind: every category applies to both expenses and
-- income (the transaction / line / recurring row keeps its own kind).
-- Same-named expense + income categories are merged into the expense row: every
-- reference is re-pointed to it before the income duplicate is deleted.
UPDATE `categories` SET `name` = 'Impôts'
  WHERE `name` = 'IMPOTS' AND `kind` = 'income'
    AND EXISTS (SELECT 1 FROM `categories` WHERE `name` = 'Impôts' AND `kind` = 'expense');
--> statement-breakpoint
CREATE TEMP TABLE `category_merge` AS
  SELECT d.`id` AS `old_id`, k.`id` AS `new_id`
  FROM `categories` d
  JOIN `categories` k ON lower(k.`name`) = lower(d.`name`) AND k.`kind` = 'expense'
  WHERE d.`kind` = 'income';
--> statement-breakpoint
UPDATE `transactions` SET `category_id` = (SELECT `new_id` FROM `category_merge` WHERE `old_id` = `category_id`)
  WHERE `category_id` IN (SELECT `old_id` FROM `category_merge`);
--> statement-breakpoint
UPDATE `merchants` SET `category_id` = (SELECT `new_id` FROM `category_merge` WHERE `old_id` = `category_id`)
  WHERE `category_id` IN (SELECT `old_id` FROM `category_merge`);
--> statement-breakpoint
UPDATE `recurring` SET `category_id` = (SELECT `new_id` FROM `category_merge` WHERE `old_id` = `category_id`)
  WHERE `category_id` IN (SELECT `old_id` FROM `category_merge`);
--> statement-breakpoint
UPDATE `simulation_lines` SET `category_id` = (SELECT `new_id` FROM `category_merge` WHERE `old_id` = `category_id`)
  WHERE `category_id` IN (SELECT `old_id` FROM `category_merge`);
--> statement-breakpoint
UPDATE `budget_lines` SET `category_id` = (SELECT `new_id` FROM `category_merge` WHERE `old_id` = `category_id`)
  WHERE `category_id` IN (SELECT `old_id` FROM `category_merge`);
--> statement-breakpoint
DELETE FROM `categories` WHERE `id` IN (SELECT `old_id` FROM `category_merge`);
--> statement-breakpoint
DROP TABLE `category_merge`;
--> statement-breakpoint
ALTER TABLE `categories` DROP COLUMN `kind`;
