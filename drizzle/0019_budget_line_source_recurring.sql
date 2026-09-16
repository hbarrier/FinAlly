-- Links a budget line to one specific recurring template — tier 1 of the budget
-- actuals waterfall (recurring template > merchant > category, most specific
-- wins). Mirrors simulation_lines.source_recurring_id, but unlike that column
-- this one is editable at any time, not a one-time creation snapshot: it's a
-- live matching key, not provenance.
--
-- Additive, nullable, no backfill: existing lines (e.g. "Assurance Auto",
-- "Navigo") start unlinked and are re-linked by hand via the line sheet's new
-- picker.
ALTER TABLE `budget_lines` ADD `source_recurring_id` text REFERENCES recurring(id) ON DELETE set null;
