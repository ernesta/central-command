-- How many topics (headings under Notes) a meeting's note has, for "N topics ready" on the landing page.
-- Existing rows get 0 and are refreshed when the index is rebuilt from the files at startup.
ALTER TABLE meetings ADD COLUMN topic_count INTEGER NOT NULL DEFAULT 0;
