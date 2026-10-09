-- A sync run may now delete rows (stage 2 of docs/READINGS_SYNC_PLAN.md: a citekey missing from the
-- export with nothing attached is deleted instead of flagged), so the run record counts them too.
ALTER TABLE sync_runs ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
