-- When the app itself marked a self-study task done (a week after its training ended). It closes a task once: a task the user reopens
-- by hand stays open. NULL: never closed by the app.
ALTER TABLE tasks ADD COLUMN auto_closed_at TEXT;
