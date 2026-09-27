# Roadmap

## For Claude: six things requested 27 Sep 2026, go-ahead given — work through these without further check-in

**Status (27 Sep 2026, evening): all six done and pushed.** Items 1–5 are fully built, tested (unit tests, plus
the built app and dev mode on a scratch library) and merged. Item 6 was deliberately stopped at a dry run, as
instructed: the importer is built and tested, but `--apply` was not run and Work's own workspace wiring was not
built (it turned out to be bigger than the importer; see its write-up). Full findings, decisions and two real bugs
found by testing (not by reading code) are in `docs/DECISIONS.md`: "Training entry page: a side panel", "Find in
the note, redesigned as an inline bar with replace", "Reading lists", "A page per person, and links", and "Work
meetings import". Immediate TODOs for you are in the "For the user" list directly below, with the two Work-import
ones at the top since they're newest.

Commit as you go (small commits, per feature and per standalone part, as always); do not push. Update this file and
`docs/DECISIONS.md` as each part lands, the same way the rest of this file has been kept current. Order below is
suggested (safe and self-contained first); reorder if a dependency makes more sense once you're in the code.

### 1. Training entry page: a side panel, like Meetings has — done

See `docs/DECISIONS.md`, "Training entry page: a side panel, matching Meetings".


Meetings' `MeetingPage` has a `.split` layout (`grid-template-columns: minmax(0, 1fr) 260px`): the note on the left,
`TopicsPanel` (headings, click to jump, a discussed checkbox) on the right. Training's `TrainingEntryPage` currently
has `FilesPanel` (the linked folder's file listing) as a full-width block above the note
(`src/modules/training/renderer/TrainingEntryPage.tsx`, `<FilesPanel folder={...} onChange={...} />`). The user wants
the same side-panel treatment Meetings has: **both** the file list and a heading outline, on the side.

- Give Training the same `.split` layout as Meetings (copy the CSS shape from `MeetingPage.module.css`).
- Move `FilesPanel` into the side column.
- Add a heading outline below or above it in that same column, using `NoteOutline`
  (`src/modules/notes/renderer/NoteOutline.tsx`, built this session for Notes) rather than a new component —
  it already does exactly this (headings, live, click to jump) and takes `text` and `docRef`. Training entries
  don't have Meetings' "## Notes" structural convention, so use it the way Notes does (whichever heading levels
  the entry's body actually has), not the way Meetings' `TopicsPanel` does.
- Two panels stacked in one column: decide the order (files above outline, or the reverse) by which is more often
  wanted first when opening an entry — files, most likely (that's the existing content), outline below it.

### 2. Meetings: no separate outline (a deliberate no) — confirmed, nothing built

The user asked "might I want headings on the side [for meetings] too?" — they already have this: `TopicsPanel` is
built from the note's own headings (the `###` under `## Notes`, or `##` as a fallback), with a discussed checkbox
added. Do **not** add a second, duplicate outline panel. If the user asks again once they see Training's plain
outline next to Meetings' checkbox-outline, that's a real request to reconsider, not before.

### 3. Find in the note: redesign as an inline, keyboard-first bar, with basic replace — done

See `docs/DECISIONS.md`, "Find in the note, redesigned as an inline bar with replace".


Currently (`src/renderer/src/notes/useNotesFind.tsx`, `notes-find.ts`, `NotesFindBar.module.css`, all built this
session): a floating bar, `position: fixed`, bottom-centre of the window, opened by Cmd-F. The user wants it to feel
inline instead — "not a disjointed popup, closer to where we have the word count", i.e. living near `EditorCard`'s
sticky facts line, Emacs-style (incremental, keyboard-first, part of the document's own chrome, not a floating
dialog) — plus more to do with the keyboard than today, and a basic find-and-replace.

- Move the bar from a `position: fixed` portal into `EditorCard`'s own footer area (`src/renderer/src/notes/EditorCard.tsx`),
  replacing the "Created · Edited · N words" line while find is open (or sitting right above it — try both, the
  sticky-footer space is narrow). `EditorCard` will need to know whether find is open and render the bar instead of
  (or alongside) its own facts line; the cleanest shape is probably for `useNotesFind` to expose the bar's JSX and
  for `NotesEditor` to hand it to `EditorCard` somehow, or for `EditorCard` to grow a `find` slot prop. Whoever
  builds this should feel free to restructure the boundary between `NotesEditor` and `EditorCard` if the current
  one doesn't fit — they were designed before this requirement existed.
- More keyboard: at minimum, typing should never require reaching for the mouse — next/previous/replace/replace all
  all need keyboard equivalents (Enter/Shift-Enter already do next/previous; add something for replace, e.g.
  Cmd-Return for "replace this one", Cmd-Shift-Return or a button for "replace all"). Look at how Emacs
  (`isearch`/`query-replace`) and how VS Code's inline editor find/replace bar (Cmd-Option-F to add the replace row)
  do this, and pick whichever reads more naturally in a Markdown notes editor, documenting the choice.
- Replace: "nothing too complicated, but more than what we have currently" (which is nothing). A replace field, a
  "replace this match" and a "replace all" action, using `findMatches`' positions (`notes-find.ts`) and a single
  transaction per action (so replace-all is one undo step, not N). Keep the existing match-not-crossing-a-mark
  limitation; document it again if it now matters more (a replace that would need to cross a mark boundary should
  presumably just not offer to replace that match, or should be reported — decide and document).
- Recheck the mutation-safety habit: replace edits the document, unlike plain find, so this is the first part of
  Find that can lose text if it's wrong. Add a test that breaks replace (e.g. an off-by-one on the range) and
  confirms a test catches it, the way other safety-critical code in this app is checked.
- Re-verify in the built app and dev mode (StrictMode), on all five kinds of editor (Notes, Meetings, Training
  entries, the Training plan, Readings notes), the way the original Find was checked.

### 4. Reading lists (new feature) — done

See `docs/DECISIONS.md`, "Reading lists" for the full write-up, including the open design points settled while
building and a real bug (`@citekey` vs `[[citekey]]`) only found by driving the built app. Not done: an importer
for the user's own `Language of Instruction Papers.docx` (not asked for in this list; a separate piece of work if
wanted), and reordering sections or entries other than by editing the Markdown.


Grounded in a real example the user shared: `/Users/ernesta/Downloads/Readings/2026 09 26 Language of Instruction
Papers.docx` (read it — a curated bibliography for their supervisor). Its shape: a list has a name, and is divided
into named sections written as questions ("What do the reviews conclude?", "Does home language instruction improve
learning?", "What happens to home language policies in practice?"); each section holds entries, one per paper
(`Author (Year). Title. Journal, volume(issue), pages.`) followed by a one- or two-sentence annotation specific to
_that list_ — not the paper's own (often much longer) notes file.

What the user said, verbatim, matters here: "these notes might have to be accessible from each reading's notes but
not the full thing, some of my notes are very lengthy" — so a reading's own page should show, for each list it is
in, that list's short annotation (not the list's other entries, not the reading's full notes).

Open design points to settle while building (write the decisions into `docs/DECISIONS.md`, "Reading lists", as you
go, the way every other module's decisions are recorded):

- **Not every paper is in Zotero yet** ("it doesn't have all papers in Zotero, but it will"). A list entry should be
  able to point at an existing reading (by citekey) or, for one not yet synced, hold its own citation text as a
  placeholder, with a way to attach it to a real reading later once the Zotero export catches up. Never invent a
  fake citekey or a stub Readings row for a placeholder — keep it as list-only text until it is linked.
- **Where lists live.** A new small module (`src/modules/reading-lists/` or similar, following the module pattern
  in CLAUDE.md: `main/`, `renderer/`, `shared/`, an `index.ts` manifest) is probably right, rather than folding this
  into the Readings module, since a list is its own object with its own page (name, sections, entries), not a
  property of one reading. Follow the Notes/Meetings/Training pattern for the list-of-lists page (a landing card,
  an "all lists" page, one page per list) and reuse `Landing`/`LandingPage`/`SearchInput`/etc. rather than building
  new versions.
- **Storage.** One Markdown file per list is consistent with everything else in this app (plain files, human- and
  Claude-Code-editable, survive independently) — front matter for the list's name, then `##` sections and entries
  as a list (`- ` items), each identifying its reading (citekey) or its placeholder citation text, plus the
  annotation. Follow the guarded-save/content-hash pattern every other note type uses
  (`src/main/notes/guarded-file.ts`); never overwrite a list file that changed since it was read.
- **On a reading's own page**, add a small section (after the abstract, before or after the notes editor — try
  it and see) listing which list(s) mention this reading, each with its own short annotation and a link to the
  full list. Keep this compact; it is explicitly not meant to show the rest of the list.
- **Search:** once this exists, add it to global search (`docs/DECISIONS.md`, "Global search") the same way every
  other source was added — a `renderer/search.ts` and a manifest `search` entry — so a list and its entries are
  findable, ideally added to `SEARCH_GROUP_ORDER` (`src/shared/search.ts`) at a sensible position (after Readings,
  most likely, since a list entry is fundamentally about readings).
- This is the most open-ended of the six items. If, once you're a few hours in, the shape above stops making sense
  against the real data, change it and write down why — do not stall waiting for approval, but do leave a clear
  trail of what changed and why for the user's review.

### 5. A page per person, and links on each person — done

See `docs/DECISIONS.md`, "A page per person, and links", including a real bug (people.json links were silently
dropped by the update IPC handler) only found by driving the built app.


From the ideas list already in this file (`## Ideas`, "People, extended", items 1 and 3), now to be built:

- **A page per person** (`Research → People → a name`), reusing `LandingPage`/`LandingHeader`. Show: their meetings
  and trainings, newest first (reuse `queryMeetings`/`queryTraining` filtered to where they appear); the open TODOs
  they own (existing TODO parsing already tracks owners by initials); when you last met them and, if any, the next
  upcoming meeting. Link to it from `PeopleTable`'s rows (a person's name becomes a link) and from search hits
  (`src/modules/meetings/renderer/people-search.ts` currently routes to `peopleRoute` with `?person=`; once a real
  page exists, route search hits there instead and keep the `peopleRoute?person=` highlight as the fallback for
  the list view).
- **Links per person**, "some named, like Google Scholar, others more generic": extend `Person`
  (`src/shared/people.ts`) with an optional `links?: { label: string; url: string }[]` — a fixed set of common,
  pre-named suggestions (Google Scholar, GitHub, Website, LinkedIn) the person picks from, or their own label, each
  just a URL. Follow this app's existing rule for external links (`isSafeExternalUrl`, `src/main/urls.ts`: only
  `http`/`https`) and open them the same way the editor's links open (Cmd-click convention does not apply here
  since these are plain links on a page, not inside editable text — a normal click is fine). Add the edit UI to the
  per-person page (not the table row, which is already tight), and to `PersonPatch`/`updatePerson`
  (`src/shared/people.ts`) plus the main-process save path and the mutation-check tests that already guard
  `people.json` writes.

### 6. Work meetings: import from Obsidian, same treatment as Research — importer built, dry run reviewed, not applied

**Stopped here on purpose, per the instruction not to apply this one without checking back.** The importer
(`scripts/import-work-meetings.mts`, `planWorkMeetingImport`) is built and tested; the dry run against the real
vault, and everything it found needing your decision (two meetings on the same day, one name spelled two ways),
is written up in `docs/DECISIONS.md`, "Work meetings import". Work's own workspace wiring (a folder, a route, a
landing page) was **not** built: it turned out to be a bigger, separate piece of work than the importer, since
Meetings' renderer hard-codes `workspace: 'research'` throughout rather than reading it from the route — see the
same write-up for why. Needed before `--apply` can write anywhere real; not needed for the dry run, which only
read the vault.

**Vault:** the user gave `/Users/ernesta/Consulting/Luminos/Scribbles` as "all work notes"; the actual Obsidian vault
(where `.obsidian` lives) is one level down, at `/Users/ernesta/Consulting/Luminos/Scribbles/Luminos`. Meeting notes
are under `Meetings/<subfolder>/*.md` (subfolders seen: `Teaching & Learning`, `Impact` — these look like they'd map
to `series`, the way Research uses Supervision/Rastle Lab). 19 files today. Two other top-level folders exist in the
vault — `Admin & Compliance` (personal business admin: Wise, National Insurance, ICO — not meeting notes) and a
nested `Luminos/Luminos/Taxpayer Reference.md` (a single stray file, not more notes) — **the request was specifically
for meeting notes** ("create same setup of meetings for Work … import … meeting notes"), so treat "all work notes"
in the user's answer as pointing at the vault, not as scope to also import Admin & Compliance as Notes-module
content; say so explicitly when reporting back rather than silently deciding either way.

**The format is not the Research format** — do not assume the existing importer (`scripts/import-meetings.mts`,
built for a Word log plus Obsidian notes with YAML-ish conventions) applies unchanged. A sample file from this
vault:

```
**Date**: Jul 3, 2026
**Attendees**: Neha Raheel, Amrita Gopal, Ernesta Orlovaitė
## Action items
- **TODO(NR)**: Share previous conversations with Fab AI.
- TOOD(EO): Start drafting detailed user requirements and acceptance criteria.
## Summary of decisions
| # | Topic | Decision |
...
## Notes
### General updates
#### Fab AI and procurement
...
```

Differences from Research to design around: no YAML front matter (date and attendees are bold-label lines at the
top, `**Date**: Jul 3, 2026` / `**Attendees**: A, B, C`); `## Action items` instead of a `## Previous TODOs`/carry-
over convention; TODOs use the same `**TODO(XX)**:` marker Research uses (good — the existing TODO parser in
`src/modules/meetings/shared/todos.ts` should mostly just work on the body once it's extracted), but there is at
least one **typo to expect and handle or report, not silently drop**: `TOOD(EO)` instead of `TODO(EO)` (seen in the
sample above) — decide whether to fix obvious typos like this during import (report them either way) or leave them
for the user to fix by hand; a Markdown table of decisions under its own heading; more heading depth (`####`) than
Research's meeting notes typically use.

**Before writing an importer**, read a good sample of the 19 files by hand (not just the one above) to find the
range of variation, the way every other importer in this app started. Write the plan into `docs/DECISIONS.md`
("Work meetings import") the way the Research importer's plan and findings are recorded, including a safety check
(compare the converted result against the source: TODO text, counts, any ticked boxes) before any file is written,
matching the standing rule: "Give importers a safety check that compares the converted result with the source
… and leaves out a note that fails it."

**Work needs its own workspace wiring first**, which is already a known, described gap (`docs/ROADMAP.md`,
"Meetings follow-ups": _"Meetings in Work: the code takes a workspace everywhere (`notes/meetings/<workspace>/`);
Work needs a folder, a route and a landing page from the same components. `ACTIVE_WORKSPACES` in
`meetings/main/register.ts` is the switch."_). Do that first, then the importer writes into
`~/CentralCommand/notes/meetings/work/`.

**Safety, as with every other importer in this app: dry run only.** Do not pass `--apply` against the real vault or
the real `~/CentralCommand` without the user's explicit go-ahead once they are back and have read the dry run's
output — this instruction to "go ahead and work" while they are away is not that go-ahead for this one step
specifically, because applying an import is exactly the kind of hard-to-reverse, real-data action CLAUDE.md asks to
confirm first. Get everything else in this list built and working; leave the Work import at "dry run reviewed and
ready for `--apply`" and say so plainly when you report back.

## TODOs

### For the user (review and decisions)

- [ ] **Work meetings import (dry run reviewed; see `docs/DECISIONS.md`, "Work meetings import"):** two meetings
      on 2025-11-04, both "Impact" but with different attendees, need a way to tell their files apart (the
      importer will not guess); "Chris Cumminskey" and "Chris Cummiskey" are almost certainly the same person
      spelled two ways. Say what to do about both, whether "Impact" and "Teaching & Learning" should be added to
      the fixed series list, and whether to go ahead with `--apply` once Work has somewhere to put the files.
- [ ] **Try the Training entry page's new side panel** (Files above Outline, matching Meetings; see `docs/DECISIONS.md`,
      "Training entry page: a side panel"). Say what to change, and whether Meetings should get a second, plain outline
      after all now that you've seen Training's (a deliberate no for now, see item 2 above).
- [ ] **Try the redesigned Find and replace** (Cmd-F, Cmd-Option-F for replace, in any note): the bar now lives in the
      editor's own footer instead of floating. See `docs/DECISIONS.md`, "Find in the note, redesigned as an inline bar
      with replace", including the VS Code-style chords chosen (Cmd-Return / Cmd-Shift-Return) and two bugs found and
      fixed by testing it, not by reading the code.
- [ ] **Try Reading lists** (Research → Reading lists, new): create a list, write a section and a placeholder citation,
      then "Attach a reading…" to link it. See `docs/DECISIONS.md`, "Reading lists" for the design decisions made
      without checking back first (storage shape, the `@citekey` convention and why, no importer built for your own
      example list) — say what to change.
- [ ] **Try a person's own page** (Research → People → a name, or click a name in the table): meetings, trainings,
      open TODOs, last met, next meeting, and links (Google Scholar, GitHub, Website, LinkedIn or your own label). See
      `docs/DECISIONS.md`, "A page per person, and links", including a bug (links silently failed to save) found and
      fixed by testing it.
- [ ] **Review the exports** once there is data to look at: Training's **Export** (a PDF of an academic year, oldest first, no upcoming
      or planned entries) and Meetings' **Export** (the Supervision log as a PDF, same page layout as Training's). Say what to change in the
      layout and content of both.
- [ ] **Choose a type for each imported training** (all 129 start without one; the list says "No type yet"). Seminars, inductions, lab
      meetings and self-guided learning have no Inkpath type: map them by hand and keep a decision log of why, so categorising can
      be automated later.
- [ ] **One imported training broke the rules**: _Making your research transparent and reproducible (Live)_ (28 Jan 2026) has five skills in
      Inkpath and the app allows three. The first three were kept; left out: Digital and bibliographic skills (GS), Intellectual property
      rights (GS). Decide which three to keep. (Review this together with the other training TODOs.)
- [ ] **Review the initials of the 18 people added from your notes** (People page): a few got numbered initials because of clashes
      (Cilla Harries CH2, Kathryn Redway KR2, Robyn Muir RM2). `npm run people:from-notes` was applied on 25 Sep 2026; the previous list
      is `people.json.backup-<time>` in `~/CentralCommand/data/`. Restart the app before using the People page.
- [ ] **Four supervision meetings have times that differ from the Inkpath log** (the files were left as they are): 11 Nov 2025 (file
      15:30–16:00, log 15:30–16:30), 16 Oct 2025 (14:00–14:30 against 14:00–14:15), 26 Jun 2026 (10:00–11:45 against 10:00–11:15), 29 May 2026
      (11:00–12:00 against 11:00–11:45). Say which is right.
- [ ] **Two Rastle Lab meetings in the log have no meeting file** (1 Jun 2026 13:00–14:00 and 22 Jun 2026 15:00–16:00; create the meeting files if wanted).
- [ ] **Twelve trainings have typed hours that differ from the times** (for example Rapid Reading typed 0 h, times give 3 h). The app
      uses the times; check the times are right. `npm run import:training` lists them.
- [ ] **The 61 entries only in the older Word training log** (no twin in the Inkpath log) were not imported. Say if any should be.
- [ ] Review the keyboard shortcuts listed in Settings (still open from Meetings).
- [ ] **Try the Training plan** (Training → Training plan). Your draft was copied in as the 2026–27 plan; edit it there.
- [ ] After the user's review: fix what they raise, then push, write up the state, clear context and move on to the next part.
- [ ] A "decision log" for training types (see above): design it with the user when they start mapping; then suggest types automatically.
- [x] **People page built** (see `docs/DECISIONS.md` "People page"). Waiting for the user's review.
- [ ] **Decide what Studies should be** (it stays "Coming soon"); and later what Ideas becomes.
- [x] **Notes built** (all nine stages of `docs/NOTES_PLAN.md`; see `docs/DECISIONS.md`, "Notes"), pushed. Waiting for the user's review.
- [ ] **Review Notes** against the mockup (`docs/design/notes-mockup.html`): the landing, All notes, a note (Group and Pin beside the
      title; the editor card with Created, Edited and word count under the text) and quick capture (Mod-Shift-n). The editor card is now
      on every editor (Meetings, Training, the plan, Readings notes). Say what to change, and whether Created should also be recorded for
      Meetings, Training and Readings notes (see `docs/DECISIONS.md`, "Editor card").
- [x] **Notes import applied** on 25 Sep 2026: 12 notes from Data Sources, Ideas, Thesis and Placement are in
      `~/CentralCommand/notes/notes/research/`, all ungrouped, wiki links stripped. Group them in the app.
- [ ] **Group the 12 imported notes** (Notes → Ungrouped). The user wants Data Sources to become a single note eventually; the six
      came across separately.
- [ ] **Later, Notes**: a system-wide quick-capture shortcut (works when the app is in the background); Thesis extras (chapter progress,
      word counts per chapter).
- [ ] **Try the People page** (Research → People) and say what to change.
- [ ] Re-check the changed screens in dev mode (StrictMode) and the built app after any further change to lists, landings or entry pages
      (last done for the editor card on 26 Sep 2026).
- [ ] **Say when a filter is applied** (later, the user's call when): opening the Supervision series card shows "All meetings" with only that
      series in it. See the Meetings follow-ups.
- [ ] The Readings follow-ups below are still open.

## Phase 1 (complete; awaiting final review and push)

App shell plus Readings (Zotero one-way sync, notes editor). See
`central-command-mvp-phase1-brief.md`.

- [x] Foundations: scaffold, secure IPC, SQLite migrations, settings, fonts, tokens, base components, docs
- [x] Shell: workspaces, Settings screen, Build button, Ask launcher, module manifests
- [x] Readings data and sync
- [x] Readings UI and Research landing page
- [x] Reading detail and Markdown notes editor
- [x] Polish pass

## Meetings (complete; awaiting the user's review and the push)

All nine stages of `docs/MEETINGS_PLAN.md` are done (shared notes machinery, main-process core, TODO and topic rules,
the meeting page, the list, the landing page, People settings and remembered list state, the import, polish).
`docs/DECISIONS.md` records what was decided and found along the way. The import has been run on the user's real notes.

### Meetings follow-ups (not started; the user decides when)

- **TODO for the user: review the keyboard shortcuts** listed in Settings and say which to change or drop. Nothing has been
  reviewed yet; the list was grouped so the short ones come first and the long editor list last.
- **Say when a filter is applied.** Opening a series card (for example Supervision) shows the page titled "All meetings" with
  only that series in it, which is easy to miss. Make the page say so (a different title or a visible "Showing Supervision
  only" line with a way to clear it). Not started.
- **People page**: built. Later it could hold links per person (GitHub,
  Google Scholar, LinkedIn) and even pull their recent papers, posts or tweets. Training leads and meeting attendees both use it.
- **Export the supervision log as a PDF**: built (`meetings/shared/report.ts`; printing in `src/main/export-pdf.ts` and the page
  shell in `src/shared/report-page.ts` are shared with Training). Awaiting the user's review of the layout.
- **Meetings in Work**: the code takes a workspace everywhere (`notes/meetings/<workspace>/`); Work needs a folder,
  a route and a landing page from the same components. `ACTIVE_WORKSPACES` in `meetings/main/register.ts` is the switch.
- **Imported notes with bold pseudo-headings** (`**Topic**`): converted (`npm run convert:topics`, applied 25 Sep 2026; a dry run now finds nothing).
- **Imported previous items with a status word** (`(Cancelled) **TODO(EO)**: …`) are ownerless Previous TODOs and carry
  over while unticked; the user may want to tick or delete them in the newest notes.
- **Backspace at the start of a first-line bullet**: checked by hand in the built app on 26 Sep 2026 (typed `- first item`, Cmd+Left,
  Backspace): the bullet lifts to a paragraph at once. Resolved.

## Training (built; awaiting the user's review)

All ten stages of `docs/TRAINING_PLAN.md` are done, plus the Meetings additions (academic year selector, skills, hours counter).
`docs/DECISIONS.md` (Training) records what was decided and found. The importers have been dry-run on the user's real files;
both have been applied to the real library.

### Training follow-ups (not started; the user decides when)

- **Imports and conversions are all applied** (checked on 26 Sep 2026: every dry run reports nothing left to write: training 129 already
  there, 35 meeting files agree with the log, 12 notes, 17 reading notes, topics converted, people added). What is left is for you to
  decide: 10 Obsidian training notes found no matching activity (Psychology/Peer Review, Starting Your PhD, Annual Reviews and Upgrade;
  SEDarc Induction and five SEDarc method sessions and Data Management and Security; University/Central Induction), so their text is
  not in the app; the four differing meeting times and the two Rastle Lab meetings without a file (both above).
- **Show meetings in the Training PDF?** Only a line with the hours is included; the meetings are not listed.
- **Inkpath's Organisation, Points and Date Completed** are kept in the front matter (Organisation and Points are read) but
  not shown or used.
- **Long titles** are cut at 80 characters in file names (the front matter title is complete).

## Product vision: Build is a headline feature

If Central Command is ever released, the Build button ("change your software to
work for you") is its most distinctive feature, not a developer-only tool. A
released app would need to make that work for people who install it: a
source checkout the app can edit (or a sandboxed equivalent), a way to hot-reload
or rebuild after changes, and safety nets for bad edits (git history, easy
rollback). Keep this in mind when making structural choices: modules stay
self-contained and data stays outside the code so users' changes can't lose their
data.

## Ideas (suggested 26 Sep 2026; each needs a mockup and a plan, then the user's approval, before building)

Grounded in what the app already stores. Numbers are the ones used in the conversation.

**People, extended** (the list, rewrites and archive are built)

1. **Built**: a page per person: their meetings and trainings (newest first), the open TODOs they own, when you last met, the next meeting.
2. A "prepare for the meeting" view from an upcoming meeting: what you owe them, what they owe you, the last meeting's topics.
3. **Built**: links per person (a fixed set of presets, or their own label), stored only. Pulling in their papers needs the network: later.
4. A "haven't met in a while" line for chosen people, with a threshold in Settings.

**Global search:** built (Mod-K; `docs/DECISIONS.md`, "Global search"), including whole-note text, the Training plans, people, `in:`
modifiers and a command palette in the same window. No recent-items list when the field is empty (the user does not want one).

**Home, writing and the rest of the numbered ideas (5 to 17):** superseded by the fuller, decided-on list in "Home (the overall
landing page)" below, kept up to date there rather than in two places.

## Home (the overall landing page): ideas and open questions (26 Sep 2026; nothing designed yet)

Decided so far: cross-workspace page (not Research-first). **Wanted:** greeting, date and a week strip (5 above); weather (6, network
allowed for it: the `CLAUDE.md` rule must be amended to say exactly what is sent); Today (7: meetings, your open TODOs, trainings).
**Not wanted on Home:** Research progress (8), pinned notes and recent edits (9) and a resume card (10); they belong on Research.

More ideas, to choose from before any design (default pick: 1, 2, 3, 4, 9, 14, 15):

- Things to act on: 1 priorities (up to three lines typed for today, unfinished ones carry over); 2 "Needs attention" (a note whose front
  matter has a problem, a reading missing from Zotero, a TODO past its date, a file changed outside the app; "All clear" when empty);
  3 "Dates ahead" (your own deadlines and milestones with days to go, edited on the card); 4 a capture bar (a line that becomes a note)
  with New meeting, New note and New training links.
- Time and place: 5 a calendar agenda from a local calendar file plus meetings and trainings; 6 other clocks (time zones you choose);
  7 sun times and when rain starts beside the weather; 8 unread email count (needs a mail connection; parked with the network features).
- Reflection and rhythm (automatic): 9 "Today so far" / "Yesterday" from what the app knows (notes edited, words written, meetings and
  trainings), with a planning tone in the morning and a wrap-up in the evening; 10 a one-line day log saved as a note per day (feeds the
  weekly review); 11 habit ticks with streaks that count days, not amounts; 12 "Changed while you were away" (files another tool, such
  as Claude Code, edited).
- Around people: 13 birthdays and anniversaries this week, from an optional date on each person (with the People pages).
- The page itself: 14 workspace tiles (Life, Research, Work, each with one line of status, so Home is also how you get around);
  15 choose, show or hide and reorder the cards in Settings (the brief names visual customisability as the main reason for leaving
  Notion and ClickUp, so build it in from the start); 16 an Ask box for the Claude integration; 17 a focus session (a 25-minute timer
  attached to a note that logs time and feeds the writing tally).

Open questions for the design: single-column "morning briefing" or a grid of small cards; whether Home opens at launch and sits in the
top bar before Life, Research and Work, or replaces the workspace pills. Sources for the ideas: personal-dashboard and habit-tracker
templates (Notion, Asana), Athenify, and the daily-dashboard projects on GitHub.

## Before a public release: what needs the user's decision

Nothing here is started; each is a choice, not just work. Already in place: packaging config (`electron-builder.yml`, icons in
`build/`), a light and dark theme, local-only data, no telemetry, and a right-click menu and link opening in the editor.

- **Licence** for the code (none chosen yet) and whether the source is public. The Build button assumes a source checkout, see the
  product vision above.
- **Signing and notarising** the macOS app (needs an Apple Developer account; `notarize` is off) and, for Windows, a certificate.
- **Updates:** where releases are hosted and whether the app checks for them (an update check is a network request).
- **Name and icon:** the app name is one constant (`src/shared/app-info.ts`); the icon is a placeholder to replace.
- **First-run experience:** what a new user sees with no Zotero export, no repo path and no data (Settings explains each field now).
- **A privacy line** in the README and Settings: what stays on the computer, and what the future network features (weather, Claude)
  would send.
- **Other platforms:** the Build button and the trash move are macOS-first; Windows and Linux need checking.

## Find in the note: built, replacing the abandoned page-wide attempt

An earlier attempt (Cmd-F over the whole page, via Electron's `webContents.findInPage`) was tried and reverted the same day:
typing fast lost keystrokes, and a debounce fix then left it never returning results, cause not found in time. The user then
asked for it scoped to notes instead, which turned out to be the better design anyway: a ProseMirror plugin
(`src/renderer/src/notes/notes-find.ts`) built into `NotesEditor` itself, so Notes, Meetings, Training entries, the plan and
Readings notes all have it, with no page-wide search and no Electron IPC involved at all. See `docs/DECISIONS.md`, "Find in
the note".

## Later, roughly in order (not for Phase 1)

- Real Claude wiring for the Ask panel; embedded terminal for Build
- Shared task engine (tasks, dates, time tracking, lists, subtasks, table/board/calendar views) and a one-time ClickUp import
- **Training** (the formal training log, a notes page per entry, linked files, PDF export): the plan and mockup are drafted in
  `docs/TRAINING_PLAN.md` and `docs/design/training-mockup.html`; built; see the Training section above.
- **Notes** (one module for free notes with a group per note, pinned notes, quick capture; replaces Thesis, Data Sources and Inbox): plan
  `docs/NOTES_PLAN.md` and mockup `docs/design/notes-mockup.html` are approved; built (nine stages), see the Notes section above and `docs/DECISIONS.md`. Studies stays "Coming soon".
- Global dashboard (priorities, calendar, weather, unread email count)
- World news tab, Research Digest, Focus/Writing space
- Life and Work workspaces
- Books module (following the Readings pattern)
- Dark mode: **built** (Settings → Theme). Packaging and public release
