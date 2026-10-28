-- Whether a meeting's Notes section has any text, for the "Has notes" mark on the Meetings table.
-- Existing rows get 0 and are refreshed when the index is rebuilt from the files at startup.
ALTER TABLE meetings ADD COLUMN has_notes INTEGER NOT NULL DEFAULT 0;
