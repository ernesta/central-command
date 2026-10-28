-- An item's dates, apart: the event itself (a day or a range) and a deadline for it, with the words that go in front of it
-- ("Apply by"). `date` and `date_kind` (the single date of 0001) stay in the table, no longer written; what they held is copied.
ALTER TABLE watch_items ADD COLUMN event_date TEXT;
ALTER TABLE watch_items ADD COLUMN event_end TEXT;
ALTER TABLE watch_items ADD COLUMN deadline TEXT;
ALTER TABLE watch_items ADD COLUMN deadline_label TEXT;
UPDATE watch_items SET deadline = date WHERE date_kind = 'deadline';
UPDATE watch_items SET event_date = date WHERE date_kind = 'date';
