-- The full-text search feature was removed; the FTS5 virtual table and its sync
-- triggers are dead weight and invisible to drizzle-kit (it modelled the virtual
-- table as an ordinary table). Drop all of it.
DROP TRIGGER IF EXISTS `transactions_fts_ai`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `transactions_fts_ad`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `transactions_fts_au`;--> statement-breakpoint
DROP TABLE IF EXISTS `transactions_fts`;
