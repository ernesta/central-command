# Watch review plan (28 Oct 2026)

**Status: all four stages BUILT (28 Oct 2026), in one run at the user's request; write-up in `docs/DECISIONS.md`, "Watch review". [x] Stage 1 states and the full list. [x] Stage 2 dates. [x] Stage 3 parsing. [x] Stage 4 `watch:reparse` (built and dry-run on the real library; `--apply` is the user's call).**

The user's review of Watch after the first real checks of five sources (Research: EPS, National Literacy Trust, researchED, SSSR,
What Works Hub for Global Education). Four stages; all decisions below are the user's unless marked "my call".

## What the real data showed

- **New vs Earlier**: "New" is an item not yet opened. Opening it in the browser sets state `seen`, and `seen` rows sit under "Earlier".
  Everything was found at the same time; the two "Earlier" National Literacy Trust items are just the two the user clicked.
- **Dismiss** is a second way to get rid of an item beside Save. It goes.
- **researchED** (page method): the real events are researchED Doha (14 Nov 2026), Scandinavia 2027 (20 Feb 2027), Glasgow (6 Mar 2027).
  Stored: Doha and Scandinavia with no date, no Glasgow, and the web designer's footer credit ("Website Design by Kall Kwik Romford").
  Its past-events URL (`/events/list/?eventDisplay=past`) is The Events Calendar (Tribe) plugin's, so `/wp-json/tribe/events/v1/events`
  and `?ical=1` probably exist. Plain `curl` gets a 403: verify through the app's own fetcher (`net-fetcher.ts`), not curl.
- **SSSR**: the page is one event (34th annual conference, 14–17 July 2027, Santiago, Chile). Every stored item is a navigation link
  (FAQs, LinkedIn, Listserv, Past Conferences…). Its deadlines are on the "SSSR 2027 Registration Details & Key Dates" page and the
  "Submissions & Programme" page, not on the page watched.
- **What Works Hub**: the page says "There are currently no upcoming events"; the stored items are its "Past events" list, nav links and a
  cookie plugin's credit. The 2026 conference (15 Sept 2026) is past. The right result is no items. They hold one conference a year.
  The app's check of this site timed out; `curl` gets 403 (bot protection).
- **National Literacy Trust**: its cards carry dates and work; the page has JSON-LD, but not `Event`.
- **EPS**: has a WordPress REST API (`wp-json`) and a feed (`/feed/`); its four items were not complained about.

## Stage 1: states and the full list

- The full list (`WatchAllPage`) no longer remembers search, source or state (drop `useModuleState` there; plain `useState` from
  `DEFAULT_WATCH_QUERY`): it opens on All sources, All.
- States become **New**, **Read**, **Saved**. Dismiss and Restore are removed everywhere (landing rows, table, API, tests).
  - Read: opening an item (already the case) or a **Mark read** icon button; a read item's button puts it back to New.
  - Saving also marks it read; un-saving makes it Read.
  - No schema edit (the CHECK lists `new, seen, saved, dismissed`): stored `seen` is Read; a data migration turns `dismissed` rows into `seen`
    (numbered, `watch/0005_…`; never edit a shipped migration). `WatchState` and the labels use "read" in the UI only, or the type is
    renamed with a mapping at the repository; pick the smaller change and keep it consistent.
  - Search for every use of `dismissed` (repository, register.ts line ~94, Home/notification counts, `HomeSummary`, snapshot) and remove it.
- State filter: **Saved / New / Read / All** (labels as written). **All** shows every item grouped **Saved, New, Read** with `GroupRow` headers
  (the Upcoming/Earlier look of Training and Meetings; `shared/upcoming-groups.ts` and `GroupRow` are the pattern); a single-state filter shows
  no header. Each group shows the first ~10 rows with an in-place "Show N more" row (a constant, tested), also inside a single-state filter,
  so large lists stay short. Search and source filters apply before the cut.
- Landing sections list **New** items only (my call; the user can ask to keep read ones there); Saved section as now. "Nothing new in …" stays.
- Counts for Home and notifications stay New only.

## Stage 2: dates

- The **Note** column is removed. **When** is filled for every item (the event's date or range, "14 Nov 2026", "14–17 Jul 2027"); a new
  **Deadline** column ("Apply by 5 Nov", "Register by …") shows only when the item has one.
- Storage: migration adds `event_date`, `event_end` and `deadline` (ISO dates, nullable) to `watch_items` and copies the current `date` /
  `date_kind` (deadline → `deadline`, date → `event_date`). Keep `findDate` for the text-reading fallback but let it return an event range and a
  deadline separately. Sorting inside a group stays "found day, then newest"; the user did not ask for date sorting.
- A saved item's Home / notification date is its deadline, else its event date (the rule today is the single `date`).
- `titleParts` / `splitTrailingDate` stay for titles that end in a date but When now comes from the stored fields first.

## Stage 3: parsing (structured first, text only as the fallback)

Never send page text anywhere (no model, no third party): the "Never send user data" rule. Everything is the app's own parsing of public pages.

1. **Structured sources**, tried in this order when a source is checked (cache what works per source, e.g. a `method` of `events-api` / `ical` /
   `jsonld`, or autodiscover at add time in `SourceDialog` and re-discover on failure):
   - The Events Calendar REST (`/wp-json/tribe/events/v1/events?start_date=<today>`) and its iCal (`?ical=1` or `/events/list/?ical=1`).
   - Any `.ics` or feed link the page advertises (`<link rel="alternate">`, `<a href$=.ics>`).
   - schema.org `Event` JSON-LD (single object, `@graph`, or `ItemList`).
   - Each gives title, start, end, URL, so no text guessing. Add a small ICS parser and a JSON-LD reader as plain modules with tests.
2. **A page that is one event** (SSSR): new method `event` (WATCH_METHODS gets it, with the SourceDialog choice and `guessMethod` left as is; the
   user or autodiscovery sets it). The item is the page itself, title from `og:title` / `<h1>`, dates from the text. It also follows at most one
   or two links on the same site whose text or path says "key dates", "deadline", "registration", "submission" and reads deadlines there
   ("abstract submission deadline", "registration closes"). Navigation, footer and header links are never items.
3. **Smart fallback for listing pages** (National Literacy Trust, any source with no structured data), in `parse-page.ts`:
   - links only from the main content; drop a link to another site unless it has its own future date; drop credits ("Website Design by",
     "Powered by", cookie plugins, "sign up for our newsletter", "Get involved") with a shared exclusion list;
   - skip everything under a heading that says past/previous/archive/earlier events; "no upcoming events" (and similar) means no items;
   - an item must have a future date: beside the link, in its card, or (one fetch per new link, cached in the row, capped per check) on its own
     page via JSON-LD / the text; no future date, not stored (for page sources). Items from feeds keep today's rules;
   - existing furniture and `isOver` rules stay.
4. Network failures (`ERR_NETWORK_CHANGED`, a timeout) get one retry after a short wait before the failure count rises; the error text the
   Sources table shows says what happened (403 = the site blocks automated requests).
5. Unit-test each parser with fixtures cut from the real pages (save trimmed HTML/ICS/JSON samples under the scratchpad, then as test fixtures
   in the module; no user data in them). A mutation check on the "past events" rule and the future-date rule.

## Stage 4: the real library

- A script, dry run by default, backs the database up first, `--apply` only when the user says so and the app is closed: `npm run watch:reparse
[-- --apply]` removes the stored **unsaved** items of page sources that fail the new rules (never a saved item) and clears the sources' `etag`
  / `last_modified` / `page_hash` so the next check reads them again. Record it in `docs/DECISIONS.md`, "One-off scripts applied to the real library".
- Then re-check the five sources from a scratch library first (what the new parsers give for each live page, through the app's fetcher), read every
  line, and report per source what was found. The user's sources stay as they are (no source is added or removed by the script).
- Expected: researchED 3 events (Doha, Scandinavia, Glasgow), with dates; SSSR 1 conference (14–17 Jul 2027) with deadlines when its key-dates
  page gives them; What Works Hub none (and a readable "no upcoming events", not an error); National Literacy Trust as now.

## How to finish (the user's standing request for this round)

All four stages in one run, no stopping between them (the user's call 28 Oct 2026, overriding "stop at every stage" for this plan only). Tests,
lint and typecheck pass; mutation checks for the state rules and the parsing rules; drive the app in a scratch library (production build and
dev mode, light and dark, screenshots looked at): the full list's filters reset on every visit, Mark read / Save / New grouping and "Show N more", the
When and Deadline columns, a source set to each method. Then write up (`docs/DECISIONS.md` section "Watch review", `docs/ROADMAP.md`, the CLAUDE.md
"What is built" line, tick off this plan), commit in small commits (one per stage or standalone part), push, and install (`npm run build:mac`;
quit the app first if it is running, and say so if it could not be installed).
