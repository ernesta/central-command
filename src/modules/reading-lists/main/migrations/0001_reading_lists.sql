-- Reading lists: a rebuildable index of the list files in notes/reading-lists/<workspace>/.
-- The files are the source of truth; every row here can be recomputed from them, so rows for files
-- that disappear are removed.
CREATE TABLE reading_lists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace     TEXT NOT NULL,
  list_id       TEXT NOT NULL,                 -- the file's base name
  title         TEXT NOT NULL DEFAULT '',
  edited        INTEGER NOT NULL,              -- the file's modified time, in milliseconds
  section_count INTEGER NOT NULL DEFAULT 0,
  entry_count   INTEGER NOT NULL DEFAULT 0,
  excerpt       TEXT NOT NULL DEFAULT '',      -- plain text of the whole list, for search
  content_hash  TEXT NOT NULL,
  UNIQUE (workspace, list_id)
);

CREATE INDEX reading_lists_edited ON reading_lists (workspace, edited);

-- One row per entry that names an existing reading (by citekey), rebuilt alongside its list's row, so a
-- reading's own page can show which lists mention it without reading every list file. A placeholder
-- entry (no citekey yet) has no row here until it is attached to a reading.
CREATE TABLE reading_list_mentions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace  TEXT NOT NULL,
  list_id    TEXT NOT NULL,
  list_title TEXT NOT NULL DEFAULT '',
  section    TEXT NOT NULL DEFAULT '',
  citekey    TEXT NOT NULL,
  annotation TEXT NOT NULL DEFAULT ''
);

CREATE INDEX reading_list_mentions_citekey ON reading_list_mentions (citekey);
CREATE INDEX reading_list_mentions_list ON reading_list_mentions (workspace, list_id);
