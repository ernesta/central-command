-- Notes: a rebuildable index of the note files in notes/notes/<workspace>/.
-- The files are the source of truth; every row here can be recomputed from them, so rows for files
-- that disappear are removed.
CREATE TABLE notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace    TEXT NOT NULL,
  note_id      TEXT NOT NULL,                 -- the file's base name, e.g. 'Methods participants'
  title        TEXT NOT NULL DEFAULT '',
  group_name   TEXT NOT NULL DEFAULT '',      -- '' when ungrouped
  subgroup     TEXT NOT NULL DEFAULT '',      -- '' when none; only with a group
  pinned       INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created      TEXT NOT NULL DEFAULT '',      -- YYYY-MM-DD, or '' when the file has none
  edited       INTEGER NOT NULL,              -- the file's modified time, in milliseconds
  first_line   TEXT NOT NULL DEFAULT '',      -- shown when the note has no title
  excerpt      TEXT NOT NULL DEFAULT '',      -- plain text of the whole note, for search
  problems     TEXT NOT NULL DEFAULT '[]',    -- JSON array of things wrong with the front matter
  content_hash TEXT NOT NULL,                 -- hash of the file as last indexed
  UNIQUE (workspace, note_id)
);

CREATE INDEX notes_edited ON notes (workspace, edited);
