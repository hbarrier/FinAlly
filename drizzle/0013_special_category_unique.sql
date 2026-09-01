-- Deduplicate the special categories, then add partial unique indexes so they can
-- never be duplicated again. Root cause: lib/seed.ts ran INSERT OR IGNORE on every
-- startup against a table with no unique constraint on `name`, adding a fresh row
-- each time. See drizzle/0013 plan.
--
-- Part A: merge duplicate "Remboursements" (keyed by name) and "Pension alimentaire"
-- (keyed by is_pension_alimentaire) into the earliest-created row, repointing every
-- category_id foreign key first so no cascade delete fires.

UPDATE transactions SET category_id = (
  SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Remboursements'
    AND id <> (SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE merchants SET category_id = (
  SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Remboursements'
    AND id <> (SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE recurring SET category_id = (
  SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Remboursements'
    AND id <> (SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE simulation_lines SET category_id = (
  SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Remboursements'
    AND id <> (SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE budget_lines SET category_id = (
  SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Remboursements'
    AND id <> (SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
DELETE FROM categories WHERE name = 'Remboursements'
  AND id <> (SELECT id FROM categories WHERE name = 'Remboursements' ORDER BY created_at, id LIMIT 1);--> statement-breakpoint
UPDATE transactions SET category_id = (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1
    AND id <> (SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE merchants SET category_id = (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1
    AND id <> (SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE recurring SET category_id = (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1
    AND id <> (SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE simulation_lines SET category_id = (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1
    AND id <> (SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
UPDATE budget_lines SET category_id = (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1
) WHERE category_id IN (
  SELECT id FROM categories WHERE is_pension_alimentaire = 1
    AND id <> (SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1)
);--> statement-breakpoint
DELETE FROM categories WHERE is_pension_alimentaire = 1
  AND id <> (SELECT id FROM categories WHERE is_pension_alimentaire = 1 ORDER BY created_at, id LIMIT 1);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_reimbursement_name_unique` ON `categories` (`name`) WHERE `name` = 'Remboursements';--> statement-breakpoint
CREATE UNIQUE INDEX `categories_pension_alimentaire_unique` ON `categories` (`is_pension_alimentaire`) WHERE `is_pension_alimentaire` = 1;
