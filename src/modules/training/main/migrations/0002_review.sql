-- A note the import leaves for the user to look at (for example skills that did not fit), shown as a to-review list.
-- Existing rows get none and are refreshed when the index is rebuilt from the files at startup.
ALTER TABLE training ADD COLUMN review TEXT;
