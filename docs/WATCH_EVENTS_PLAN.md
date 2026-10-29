# Watch: events, opportunities and entries by hand

Agreed with the user, 29 Oct 2026. One run, no stops between the parts (the user's instruction for this plan overrides
the "stop at every stage" rule).

## What changes

1. **No source types.** A source is a name, an address, a workspace and an interval. The "kind" choice leaves the source
   dialog and Settings → Watch. Every item is sorted by its own words into one of three sections.
2. **A third section, Opportunities** (fellowships, grants, funding, stipends, scholarships, awards, calls for
   applications, journal special-issue calls), beside Trainings and Conferences: the same landing rows, "See all" list,
   save/read, deadlines in Home's Coming up for saved items, notifications.
3. **Entries by hand.** The user can add an entry of any section themselves, for the one-offs that need no tracking
   (the Jacobs Foundation BOLD fellowship). It shows in its section next to the automatic ones.
4. **Sources to add** (Research): LINGUIST List and the Jacobs Foundation page.
5. **Existing sources** become generic; nothing is deleted.

## Sorting an item (replaces `shownKind`/`itemKind` by source kind)

One pure function in `watch/shared/types.ts` (or a new `sections.ts`), `sectionOf(title, summary)` returning
`'training' | 'conference' | 'opportunity'`, tested table-style:

- Opportunity: fellowship, grant (funding), funding, stipend, scholarship, bursary, award, "call for applications",
  "apply by" with no event word, and a title tagged `(Jrnl)` or containing "special issue" / "thematic dossier".
- Training: the existing `COURSE_WORDS` (cpd, masterclass, webinar, course, training, workshop, briefing, summer
  school), plus "summer schools" pages.
- Everything else: Conference.
- Order of tests: Opportunity first, then Training, then Conference. Decide the one conflict on the facts: a title that
  names a "workshop" call for papers ("Workshop at SLE 2027 … call for papers") stays a Conference; write that as a test
  and put the rule in the function's comment. A manual entry's section is chosen by the user and never re-derived.
- A source's old `kind` stops being read. Stored `item_kind` is recomputed for every unsaved and saved item at launch
  (migration `watch/0008_events`: add `manual` and `section`; set every source's `kind` to `conference` as the stored
  placeholder, since the old CHECK lists the old kinds and a shipped migration is never edited; the column stays, unread).
  Saved and Read states are untouched.
- `WatchKind`, `SHOWN_KINDS`, `kindsOf`, `guessMethod` stay only as far as the code still needs them; remove what becomes
  dead. `ShownKind` becomes the three sections (rename if it reads better). `rows.ts`, `repository.ts` (the
  `COALESCE(i.item_kind, s.kind)` queries), `WatchPage`, `WatchAllPage`, `watch-paths.ts`, Home's `HomeSummary.watch` and
  the `snapshot.json` writer all follow; check each caller of `shownKind`/`kindsOf`.
- The `from-tasks` script's kinds are dropped the same way (its dry run still works; it is not applied).

## Entries by hand

- **Storage.** Items belong to a source, so each workspace gets one hidden source "Added by hand" (inactive, never
  checked, not shown in Settings → Watch, not counted in `WatchCounts.sources`/`failing`, created on first use). A manual
  item has `manual = 1` and a stored `section`; the checker never touches it, and no "the list is the whole truth" removal
  can reach it (add a test).
- **UI.** A header button on the Watch page, `New entry` (header buttons are `New <thing>`; short, one word per field),
  opens a dialog (shared `Dialog`, `Select` for the section, `DatePicker`/existing date fields, no new patterns):
  - Link (optional). Pasting one and pressing Enter reads the page once through the app's own fetcher with the
    one-event method (`parse-event.ts`) and fills title, dates, deadline and the section guess; the user can overwrite
    every field. A page that cannot be read leaves the fields empty with a one-line notice; the link is still kept.
  - Title (required), Section (Training / Conference / Opportunity; default the guess), Event date and end (optional),
    Deadline and its label (optional, label default "Apply by"), Summary (optional, one line).
  - It is created **Saved** (the user put it there on purpose), so its deadline reaches Home's Coming up and the
    notifications by the existing "saved items only" rule.
- **Edit and delete.** A manual entry has Edit (same dialog) and Delete in its row actions; Delete asks nothing and shows
  an Undo toast (the app's toast with an action). Automatic items keep their actions unchanged (Save, Read). A manual
  entry shows no source name (or "Added by hand" where a row shows its source).
- **Past entries.** The "already over" rules that drop automatic items apply to manual ones for display only: an entry
  whose dates have all passed leaves the landing and the "New/Saved" lists as other items do, but a manual entry is
  never deleted by code.
- The link, when there is one, opens externally with `ExternalIcon`, as other Watch links do. Keyboard: no new shortcut.
- IPC: add `createManualItem`, `updateManualItem`, `deleteManualItem`, `readEntryLink(url)` to `Api` and `IPC` in
  `src/shared/api.ts`, thin handlers in `watch/main/register.ts`, logic in a plain module with unit tests.
  `readEntryLink` makes a single request to the public address the user pasted (allowed under "Never send user data over
  the network": a public page, no identifiers).

## Sources to add (to the real library, last, after the build)

The app must be closed; back `~/CentralCommand/data` up first (use the existing database backup convention). Add through
a short idempotent script `npm run watch:add-events [-- --apply]` (dry run by default; applied once, then recorded in
`docs/DECISIONS.md` under "One-off scripts applied to the real library" and in CLAUDE.md's command list as "applied …,
do not re-run"). It adds, for Research, interval 24 hours:

| Title                         | Address                                                 | Method |
| ----------------------------- | ------------------------------------------------------- | ------ |
| LINGUIST List: Conferences    | https://linguistlist.org/issues/rss/confs               | feed   |
| LINGUIST List: Calls          | https://linguistlist.org/issues/rss/calls               | feed   |
| LINGUIST List: Summer schools | https://linguistlist.org/issues/?topic=Summer%20Schools | page   |

Not added, on purpose: the FYI, Support, Jobs and other LINGUIST feeds (the user's choice, 29 Oct 2026: FYIs are too mixed
to sift). Each feed holds only the newest 20 postings and the conferences feed turns over in about five days, hence the
24 hour interval.

**Jacobs Foundation:** not a source. Add it as a manual entry (Opportunity, Saved): "BOLD Science Communication
Fellowship", link
https://jacobsfoundation.org/bold-celebrates-its-10th-birthday-by-launching-the-science-communication-fellowship/,
applications 1 Sep – 31 Oct 2026, deadline 2026-10-31 "Apply by", summary "Six-month fellowship for early-career
researchers in child learning and development; CHF 5,000 stipend." The same script creates it (skipping it if an entry
with that link exists). Use the app's own `readEntryLink` against the page first and report what it read, to test that
path against a real page.

## Tests and checks

- `sectionOf` table test with the Jacobs title and text, a LINGUIST "Calls … (Jrnl)" title, "Confs: …", a summer school,
  a webinar, a CPD course; mutation check: break each word group and see a test fail.
- Migration test: an existing database with sources of every old kind and items with and without `item_kind` ends with
  the same items, the same states, items recomputed.
- Manual items survive a source check, a `reparse`, and "the list is the whole truth" removal (mutation check on that).
- Counts: the hidden source is not in `WatchCounts` or Settings → Watch.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run format` all pass.
- Drive the app in a scratch library (production build and dev mode, light and dark): add a source with no kind; the three
  sections on the landing and the "See all" lists; New entry from a pasted link (the Jacobs page, a real request) and
  by hand; edit, delete and Undo; the saved entry's deadline in Home's Coming up; Life's Watch too. Look at screenshots.
- The three real LINGUIST addresses: read through the app's own fetcher (not through the user's library) and report the
  items found per section, and anything sorted wrongly.

## Docs

`docs/DECISIONS.md`: "Watch: no source types, three sections, entries by hand" (why: one feed mixes kinds; the user's
words). Update CLAUDE.md's Watch paragraph and command list, `docs/ROADMAP.md`'s Watch entry (what the user should look
at: the three sections, New entry, the sorting of existing items), and mark this plan's status at the top.
