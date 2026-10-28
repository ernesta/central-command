-- Dismissing is gone: an item is New, Read (stored as 'seen') or Saved. What was dismissed is Read. (The CHECK in 0001 still lists
-- 'dismissed'; a shipped migration is not edited, and nothing writes it any more.)
UPDATE watch_items SET state = 'seen' WHERE state = 'dismissed';
