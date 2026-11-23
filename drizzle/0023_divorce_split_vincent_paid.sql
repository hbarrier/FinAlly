-- Per-entry flag: Vincent has paid Audrey his share of this entry. Additive, defaults to unpaid.
ALTER TABLE `divorce_split_entries` ADD `vincent_paid` integer DEFAULT 0 NOT NULL;
