-- When an item became Read (open, Mark read, un-save), so the Read list can show the most recently read first. Cleared when it goes
-- back to New. Items read before this have none: they sort after those with one, then by the day found.
ALTER TABLE watch_items ADD COLUMN read_at TEXT;
