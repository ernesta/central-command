-- Tasks: one row per task, subtasks included (one level, through parent_uid).
-- Nothing is ever removed by the app: deleting sets deleted_at (the trash); an untouched new task is the one exception.
CREATE TABLE tasks (
  uid             TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL CHECK (workspace IN ('research', 'work')),
  title           TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  due             TEXT,                          -- YYYY-MM-DD, no time
  completed_at    TEXT,                          -- ISO timestamp of the last completion
  list            TEXT NOT NULL DEFAULT '',      -- required for a top-level task, '' for a subtask
  sublist         TEXT NOT NULL DEFAULT '',
  parent_uid      TEXT REFERENCES tasks (uid),   -- subtasks; one level only (enforced by the store)
  position        REAL NOT NULL DEFAULT 0,       -- order among siblings
  recurrence      TEXT,                          -- JSON {"every": N, "unit": "day" | "week" | "month"} or null
  series_uid      TEXT,                          -- the first task of a recurring series
  earlier_minutes INTEGER NOT NULL DEFAULT 0,    -- ClickUp's time for this task; never written by the app
  source_id       TEXT UNIQUE,                   -- the ClickUp id, so a re-run cannot duplicate
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);

CREATE INDEX tasks_workspace ON tasks (workspace, deleted_at);
CREATE INDEX tasks_parent ON tasks (parent_uid);
CREATE INDEX tasks_series ON tasks (series_uid);

CREATE TABLE task_tags (
  task_uid TEXT NOT NULL REFERENCES tasks (uid),
  tag      TEXT NOT NULL,
  PRIMARY KEY (task_uid, tag)
);
