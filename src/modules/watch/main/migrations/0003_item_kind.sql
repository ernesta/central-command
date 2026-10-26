-- An item may be of another kind than its source (a course on a conference listing): null means the source's own.
ALTER TABLE watch_items ADD COLUMN item_kind TEXT;
