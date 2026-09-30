-- Per-kind (expense/income) color-coding config for the budgets page's total
-- cards and per-category bars: a "near" threshold (0-1) plus three category-
-- color tokens (under/near/atOrOver). Stored as a JSON string, same pattern as
-- recurring.month_rules — additive, nullable, no backfill: a null row falls
-- back to DEFAULT_BUDGET_COLORS in code (lib/settings-options.ts), reproducing
-- today's hardcoded 80%/sage/butter/rose behavior exactly.
ALTER TABLE `user_settings` ADD `budget_colors` text;
