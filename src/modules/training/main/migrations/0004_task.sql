-- The task a lecture's hours belong to, kept in the note's front matter (`task:`): a task uid, `auto` (a new note that has no
-- subtask yet) or ''. Filled from the files when the index is rebuilt at startup. Only an index: the file is the truth, and no
-- minutes are stored anywhere.
ALTER TABLE training ADD COLUMN task TEXT NOT NULL DEFAULT '';
