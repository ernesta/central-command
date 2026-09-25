-- The to-review notes moved out of the app into the user's TODO list (docs/ROADMAP.md), so the column goes.
ALTER TABLE training DROP COLUMN review;
