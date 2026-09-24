-- Readings: one row per Zotero item, keyed by Better BibTeX citekey.
-- Rows are never deleted by sync; items that leave the export are flagged.
CREATE TABLE readings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  citekey             TEXT    NOT NULL UNIQUE,
  short_citation      TEXT    NOT NULL,
  full_title          TEXT    NOT NULL,
  authors             TEXT    NOT NULL DEFAULT '[]',   -- JSON array of {family, given?} | {literal}
  year                INTEGER,
  status              TEXT    NOT NULL DEFAULT 'unset' CHECK (status IN ('read', 'to_read', 'unset')),
  tags                TEXT    NOT NULL DEFAULT '[]',   -- JSON array of strings
  abstract            TEXT,
  entry_type          TEXT    NOT NULL DEFAULT '',
  missing_from_source INTEGER NOT NULL DEFAULT 0 CHECK (missing_from_source IN (0, 1)),
  has_notes           INTEGER NOT NULL DEFAULT 0 CHECK (has_notes IN (0, 1)),
  notes_excerpt       TEXT    NOT NULL DEFAULT '',
  added_at            TEXT    NOT NULL,                -- ISO timestamp, set on first insert
  updated_at          TEXT    NOT NULL                 -- ISO timestamp, bumped when synced fields change
);

CREATE INDEX readings_status ON readings (status);
CREATE INDEX readings_year ON readings (year);
CREATE INDEX readings_added_at ON readings (added_at);

-- One row per sync attempt, for the status indicator and debugging.
CREATE TABLE sync_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at      TEXT    NOT NULL,
  finished_at     TEXT    NOT NULL,
  status          TEXT    NOT NULL CHECK (status IN ('ok', 'error')),
  entries_seen    INTEGER NOT NULL DEFAULT 0,
  inserted        INTEGER NOT NULL DEFAULT 0,
  updated         INTEGER NOT NULL DEFAULT 0,
  flagged_missing INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT
);
