-- How a page source is read beyond its method. `reading` is the user's choice ('event': the page is one event); `found_via` is what the
-- app found that works for it ('tribe', 'ical:<address>'), tried first next time and forgotten when it stops working. (The CHECK on
-- `method` in 0001 does not allow a new value, so 'event' is stored here and shown as the method.)
ALTER TABLE watch_sources ADD COLUMN reading TEXT;
ALTER TABLE watch_sources ADD COLUMN found_via TEXT;

-- Links of a page source that were looked at and had no coming date: not looked at again until `checked_at` is a fortnight old.
CREATE TABLE watch_skipped (
  source_id  INTEGER NOT NULL REFERENCES watch_sources (id) ON DELETE CASCADE,
  item_key   TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  PRIMARY KEY (source_id, item_key)
);
