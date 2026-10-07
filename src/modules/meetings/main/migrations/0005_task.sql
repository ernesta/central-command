-- The uid of the task a meeting's hours belong to, kept in its front matter (`task:`). '' until one is chosen; filled from the
-- files when the index is rebuilt at startup. Only an index: the file is the truth, and no minutes are stored anywhere.
ALTER TABLE meetings ADD COLUMN task TEXT NOT NULL DEFAULT '';
