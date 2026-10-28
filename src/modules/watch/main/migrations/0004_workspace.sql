-- Watch belongs to a workspace: a source is Research's or Life's, and its items are its source's (a join, no copy). Every source made
-- before this is Research's, which is where Watch was.
ALTER TABLE watch_sources ADD COLUMN workspace TEXT NOT NULL DEFAULT 'research' CHECK (workspace IN ('research', 'life'));
CREATE INDEX watch_sources_workspace ON watch_sources (workspace);
