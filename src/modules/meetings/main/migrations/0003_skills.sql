-- The skills a meeting built (a JSON list of names, at most three), for the skills column and the hours per skill.
-- Existing rows get an empty list and are refreshed when the index is rebuilt from the files at startup.
ALTER TABLE meetings ADD COLUMN skills TEXT NOT NULL DEFAULT '[]';
