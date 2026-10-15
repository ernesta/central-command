-- Watch: places that announce things worth knowing about (conferences, trainings, journals, mailing-list feeds),
-- checked by the app so the user does not have to open each one by hand. Everything is public pages; nothing
-- about the user is ever sent. Items are never deleted by a check: dismissing one only sets its state.
CREATE TABLE watch_sources (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  title                TEXT NOT NULL,
  url                  TEXT NOT NULL UNIQUE,            -- the page or feed; for a journal, its home page (shown as a link)
  kind                 TEXT NOT NULL CHECK (kind IN ('conference', 'training', 'summer-school', 'journal', 'listing', 'other')),
  method               TEXT NOT NULL CHECK (method IN ('feed', 'page', 'crossref')),
  issn                 TEXT,                            -- crossref only
  group_label          TEXT NOT NULL DEFAULT '',        -- the reminder it came from, e.g. "Check upcoming conferences"
  task_uid             TEXT,                            -- that reminder, when there is one
  interval_hours       INTEGER NOT NULL DEFAULT 24 CHECK (interval_hours >= 1),
  active               INTEGER NOT NULL DEFAULT 1,
  last_checked_at      TEXT,                            -- ISO, set by every attempt
  last_ok_at           TEXT,                            -- ISO, the last attempt that worked (null = no baseline yet)
  last_error           TEXT,                            -- the last attempt's problem, null after a good one
  failures             INTEGER NOT NULL DEFAULT 0,      -- attempts in a row that failed (slows the next ones down)
  page_hash            TEXT,                            -- page method: hash of the readable text
  changed_at           TEXT,                            -- page method: the text changed, with no new link to show for it
  etag                 TEXT,
  last_modified        TEXT,
  created_at           TEXT NOT NULL
);

CREATE TABLE watch_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id     INTEGER NOT NULL REFERENCES watch_sources (id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,                          -- the feed's id, the link, or the DOI: what makes it the same item next time
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  summary       TEXT NOT NULL DEFAULT '',
  published_at  TEXT,                                   -- ISO, when the source says it appeared
  date          TEXT,                                   -- YYYY-MM-DD found in the text: a deadline or the event itself
  date_kind     TEXT CHECK (date_kind IN ('deadline', 'date')),
  score         INTEGER NOT NULL DEFAULT 0,             -- how many of the user's keywords it mentions (title counts more)
  matched       TEXT NOT NULL DEFAULT '',               -- those keywords, comma-separated
  state         TEXT NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'seen', 'saved', 'dismissed')),
  first_seen_at TEXT NOT NULL,
  UNIQUE (source_id, item_key)
);
CREATE INDEX watch_items_state ON watch_items (state, score);
CREATE INDEX watch_items_date ON watch_items (date);

CREATE TABLE watch_keywords (
  term TEXT PRIMARY KEY COLLATE NOCASE
);
