-- The training log's index. The Markdown files are the source of truth; this table can be rebuilt from them.
CREATE TABLE training (
  id INTEGER PRIMARY KEY,
  workspace TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  title TEXT NOT NULL,
  series TEXT,
  type TEXT,
  mode TEXT,
  skills TEXT NOT NULL,
  leads TEXT NOT NULL,
  institution TEXT,
  folder TEXT,
  summary TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  has_notes INTEGER NOT NULL,
  problems TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (workspace, entry_id)
);
CREATE INDEX training_date ON training (workspace, date);
