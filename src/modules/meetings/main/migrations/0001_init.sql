-- Meetings: a rebuildable index of the note files in notes/meetings/<workspace>/.
-- The files are the source of truth; every row here can be recomputed from them, so rows for files
-- that disappear are removed (unlike readings, which are never deleted).
CREATE TABLE meetings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace    TEXT NOT NULL,
  meeting_id   TEXT NOT NULL,                 -- the file's base name, e.g. '2026-09-24 Supervision'
  series       TEXT NOT NULL DEFAULT '',
  date         TEXT NOT NULL DEFAULT '',      -- YYYY-MM-DD, or '' when the file has no valid date
  start_time   TEXT,                          -- HH:MM
  end_time     TEXT,
  mode         TEXT CHECK (mode IN ('in-person', 'online')),
  attendees    TEXT NOT NULL DEFAULT '[]',    -- JSON array of full names
  summary      TEXT NOT NULL DEFAULT '',      -- plain text of the ## Summary section
  excerpt      TEXT NOT NULL DEFAULT '',      -- plain text of the whole note, for search
  problems     TEXT NOT NULL DEFAULT '[]',    -- JSON array of things wrong with the front matter
  content_hash TEXT NOT NULL,                 -- hash of the file as last indexed
  UNIQUE (workspace, meeting_id)
);

CREATE INDEX meetings_date ON meetings (workspace, date);
CREATE INDEX meetings_series ON meetings (workspace, series);

-- The TODOs found in each note (filled in by the TODO parser).
CREATE TABLE meeting_todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_pk INTEGER NOT NULL REFERENCES meetings (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,                -- order within the note
  kind       TEXT NOT NULL CHECK (kind IN ('inline', 'previous')),
  owners     TEXT NOT NULL DEFAULT '[]',      -- JSON array of initials as written
  text       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
);

CREATE INDEX meeting_todos_meeting ON meeting_todos (meeting_pk);
