-- The task a lecture's self-study hours go to, kept in the note's front matter (`selfstudy:`): a task uid, or ''. Filled from the
-- files when the index is rebuilt at startup. Only an index: the file is the truth, and no minutes are stored anywhere.
ALTER TABLE training ADD COLUMN self_study_task TEXT NOT NULL DEFAULT '';
