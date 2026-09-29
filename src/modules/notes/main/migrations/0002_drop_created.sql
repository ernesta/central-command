-- Notes no longer show or keep a creation date (moving a note between workspaces would make it misleading).
ALTER TABLE notes DROP COLUMN created;
