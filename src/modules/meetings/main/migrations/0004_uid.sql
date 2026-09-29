-- The id mentions of a meeting use, kept in its front matter (see src/shared/entities.ts). '' until something links to the
-- meeting; filled from the files when the index is rebuilt at startup.
ALTER TABLE meetings ADD COLUMN uid TEXT NOT NULL DEFAULT '';
CREATE INDEX meetings_uid ON meetings (uid);
