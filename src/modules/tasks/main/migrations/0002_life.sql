-- Life is a third workspace with its own tasks. SQLite cannot change a CHECK, so the table is made again with the wider one.
-- Every row is copied as it was. The tags are set aside while the table is swapped (dropping a table that rows still point at
-- leaves a foreign-key violation that making the new one does not clear), and the new table points at itself by its own name,
-- which the rename then changes to `tasks`.
CREATE TABLE task_tags_stash AS SELECT task_uid, tag FROM task_tags;
DROP TABLE task_tags;

CREATE TABLE tasks_new (
  uid             TEXT PRIMARY KEY,
  workspace       TEXT NOT NULL CHECK (workspace IN ('life', 'research', 'work')),
  title           TEXT NOT NULL DEFAULT '',
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority        TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  due             TEXT,
  completed_at    TEXT,
  list            TEXT NOT NULL DEFAULT '',
  sublist         TEXT NOT NULL DEFAULT '',
  parent_uid      TEXT REFERENCES tasks_new (uid),
  position        REAL NOT NULL DEFAULT 0,
  recurrence      TEXT,
  series_uid      TEXT,
  earlier_minutes INTEGER NOT NULL DEFAULT 0,
  source_id       TEXT UNIQUE,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT
);

INSERT INTO tasks_new (
  uid, workspace, title, description, status, priority, due, completed_at, list, sublist, parent_uid,
  position, recurrence, series_uid, earlier_minutes, source_id, created_at, updated_at, deleted_at
)
SELECT
  uid, workspace, title, description, status, priority, due, completed_at, list, sublist, parent_uid,
  position, recurrence, series_uid, earlier_minutes, source_id, created_at, updated_at, deleted_at
FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

CREATE INDEX tasks_workspace ON tasks (workspace, deleted_at);
CREATE INDEX tasks_parent ON tasks (parent_uid);
CREATE INDEX tasks_series ON tasks (series_uid);

CREATE TABLE task_tags (
  task_uid TEXT NOT NULL REFERENCES tasks (uid),
  tag      TEXT NOT NULL,
  PRIMARY KEY (task_uid, tag)
);
INSERT INTO task_tags (task_uid, tag) SELECT task_uid, tag FROM task_tags_stash;
DROP TABLE task_tags_stash;
