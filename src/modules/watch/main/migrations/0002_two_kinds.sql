-- The Watch page knows two kinds, trainings and conferences: a summer school is a training. (The column's CHECK still
-- lists the old kinds; a shipped migration is never edited, and nothing is written with them from here on.)
UPDATE watch_sources SET kind = 'training' WHERE kind = 'summer-school';
