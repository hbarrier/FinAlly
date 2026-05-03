-- Fix transactions whose method drifted to 'card' due to missing prefill in virtual entry sheet.
-- Re-aligns each recurring transaction's method with its template.
UPDATE `transactions`
SET `method` = (
  SELECT `method` FROM `recurring` WHERE `recurring`.`id` = `transactions`.`recurring_id`
)
WHERE `recurring_id` IS NOT NULL
  AND `method` != (
    SELECT `method` FROM `recurring` WHERE `recurring`.`id` = `transactions`.`recurring_id`
  );
