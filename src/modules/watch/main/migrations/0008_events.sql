-- Sources have no kind any more: every item is sorted by its own words into Trainings, Conferences or Opportunities. The `kind`
-- column stays (the CHECK in 0001 lists the old kinds, and a shipped migration is never edited) and is set to one valid placeholder;
-- nothing reads it. `item_kind` is not read either. `section` is the item's section, filled at launch for every item that is not
-- an entry by hand.
UPDATE watch_sources SET kind = 'conference';

-- A hidden source holds each workspace's entries by hand (never checked, never listed or counted); its items are `manual`.
ALTER TABLE watch_sources ADD COLUMN manual INTEGER NOT NULL DEFAULT 0;
ALTER TABLE watch_items ADD COLUMN manual INTEGER NOT NULL DEFAULT 0;
ALTER TABLE watch_items ADD COLUMN section TEXT;
