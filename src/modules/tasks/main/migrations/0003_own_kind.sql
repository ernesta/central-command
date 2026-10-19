-- A task the app made for a meeting or training session carries what it was made for, so it is recognised by that and never by the
-- shape of its title (the title follows the Mac's region). NULL: a task the user made or chose. Existing session tasks are marked
-- by the repair script (`npm run repair:session-tasks`), not here: the migration only adds the column.
ALTER TABLE tasks ADD COLUMN own_kind TEXT;
