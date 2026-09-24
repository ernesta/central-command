-- Bibliographic details beyond the basics (journal, volume, pages, DOI, publisher, ...),
-- kept as JSON so a reference can be formatted. NULL until the next sync fills it in.
ALTER TABLE readings ADD COLUMN reference TEXT;
