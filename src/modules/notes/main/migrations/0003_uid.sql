-- The id mentions of a note use, kept in its front matter (see src/shared/entities.ts). '' until something links to the note;
-- filled from the files when the index is rebuilt at startup.
ALTER TABLE notes ADD COLUMN uid TEXT NOT NULL DEFAULT '';
CREATE INDEX notes_uid ON notes (uid);
