-- Readings sync stage 4 (docs/READINGS_SYNC_PLAN.md): a vanished citekey and a newly-seen one that
-- match on title + authors + year, but share no DOI/URL, are not merged automatically -- a
-- coincidental match could splice notes onto the wrong work. Recorded here for the user to confirm
-- (Link) or dismiss instead. Dismissing is permanent for that exact pair (the same old citekey could
-- still legitimately pair with a different new one on a later sync, so the pairing, not either
-- citekey alone, is what's remembered); a dismissed row is kept, never deleted, and its unique
-- (old_citekey, new_citekey) blocks the same pair being recorded again.
CREATE TABLE rename_suggestions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  old_citekey TEXT    NOT NULL,
  new_citekey TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed')),
  created_at  TEXT    NOT NULL,
  UNIQUE (old_citekey, new_citekey)
);

CREATE INDEX rename_suggestions_old ON rename_suggestions (old_citekey);
