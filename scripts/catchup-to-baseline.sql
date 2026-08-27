-- One-time catch-up: brings an existing pre-baseline finance.db up to the state
-- that drizzle migration 0000_brainy_giant_man.sql would produce, then marks that
-- baseline as applied. Only needed for the developer DB that diverged from the
-- (previously stale) drizzle-kit bookkeeping. Fresh installs just run
-- `npm run db:migrate`.
--
-- Usage: sqlite3 finance.db < scripts/catchup-to-baseline.sql

PRAGMA foreign_keys=OFF;
BEGIN;

-- 1. user_settings: module + onboarding columns (baseline defaults)
ALTER TABLE user_settings ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN module_recurring INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN module_divorce INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN module_budgets INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN module_simulations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN module_objectives INTEGER NOT NULL DEFAULT 0;

-- 2. goals table (re-added feature)
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

-- 3. transactions_fts (never applied on this DB; baseline creates it for fresh installs)
CREATE VIRTUAL TABLE `transactions_fts` USING fts5(
  transaction_id UNINDEXED,
  note,
  tokenize = 'unicode61'
);
INSERT OR IGNORE INTO `transactions_fts` (`transaction_id`, `note`)
SELECT `id`, COALESCE(`note`, '') FROM `transactions`;
CREATE TRIGGER IF NOT EXISTS `transactions_fts_ai` AFTER INSERT ON `transactions` BEGIN
  INSERT OR REPLACE INTO `transactions_fts` (`transaction_id`, `note`)
  VALUES (NEW.`id`, COALESCE(NEW.`note`, ''));
END;
CREATE TRIGGER IF NOT EXISTS `transactions_fts_ad` AFTER DELETE ON `transactions` BEGIN
  DELETE FROM `transactions_fts` WHERE `transaction_id` = OLD.`id`;
END;
CREATE TRIGGER IF NOT EXISTS `transactions_fts_au` AFTER UPDATE ON `transactions` BEGIN
  INSERT OR REPLACE INTO `transactions_fts` (`transaction_id`, `note`)
  VALUES (NEW.`id`, COALESCE(NEW.`note`, ''));
END;

-- 4. This install keeps every feature and skips onboarding
UPDATE user_settings
   SET onboarded = 1, module_recurring = 1, module_divorce = 1,
       module_budgets = 1, module_simulations = 1, module_objectives = 1
 WHERE id = 1;

-- 5. Mark baseline 0000_brainy_giant_man as applied
DELETE FROM __drizzle_migrations;
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('24931700dfa2a65ef817163ebfa5d539c670a17095a411ddc13b866e722983b0', 1787825964320);

COMMIT;
PRAGMA foreign_keys=ON;
