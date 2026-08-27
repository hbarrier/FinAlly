CREATE VIRTUAL TABLE IF NOT EXISTS `transactions_fts` USING fts5(
  transaction_id UNINDEXED,
  note,
  tokenize = 'unicode61'
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `transactions_fts_transaction_id_uq` ON `transactions_fts` (`transaction_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `transactions_fts` (`transaction_id`, `note`)
SELECT `id`, COALESCE(`note`, '')
FROM `transactions`;
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

