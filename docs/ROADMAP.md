# Roadmap

**Tasks (5 Oct 2026): built in an unattended run, awaiting the user's review; not pushed. The ClickUp import was applied to the real library on 6 Oct 2026 at the user's request (1,211 tasks; every subtask keeps its date).** Stages 1 to 7 and the buildable part of 9 are done (store and rules, ClickUp importer, landing / All tasks / table, task page with the description in the live editor, recurrence, time, mentions and search everywhere, Settings → Tasks). Stage 8 (Work hours become tasks) waits for the user's answer. Plan: `docs/TASKS_PLAN.md`; write-ups per stage in `docs/DECISIONS.md` ("Tasks: stage N write-up"); mockup `docs/design/tasks-mockup.html`.

**Live markup in the notes editor, the Typora way (requested 30 Sep 2026): finished.** All nine stages are done (`docs/EDITOR_LIVE_MARKUP_PLAN.md`; decision in `docs/DECISIONS.md`, "Notes editor: CodeMirror 6, with the Markdown text as the document"). `LiveEditor` (CodeMirror 6, the Markdown text is the document) is the only editor in every module; Milkdown and its packages are gone. Everything is pushed. What is left is your review of stages 7 and 8 and the open questions, all in "For the user" below.

**Notes feedback round (2 Oct 2026): stages 1 to 5 built (1 to 3 applied to the real library; stage 4's `npm run tidy:reading-lists` applied 2 Oct 2026); stage 5 built (readable copy of entities; `docs/DECISIONS.md`, "Stage 5 write-up"), the round is finished.** See `docs/DECISIONS.md`, "Notes feedback round, stages 1 and 2" (stage 3 is written up in its list of what was left). Stage 3 (`npm run link:citations`): 40 links in 14 files; 29 citations still have no reading, so the user adds them to Zotero and asks for another pass (a re-run). Stage 4 (done): Reading lists use entities, "Attach a reading…" and the sidebar are gone. Left: (5) readable copy of entities (names; APA in-text citations plus a reference list). Afterwards remind the user about the entity sidebar/hover question.

**Work's Hours (5 Oct 2026): built, pushed and installed.** Weeks run Friday to Thursday, every day counts, the week's 8:00 counts from its first day, Work has contracts (own first and last day, whole weeks) and a Month card for invoicing (`docs/DECISIONS.md`, "Work's Hours: weeks, contracts and months"). Importing the user's past Work data from their Google Sheet is in progress (4 stages: 1. a contract may start on any weekday, done 5 Oct 2026; 2. a client on Work entries and the timer, done 5 Oct 2026 (committed, not pushed); 3. the importer, dry run, done 5 Oct 2026 (`npm run import:work-hours`; both contracts pass, the 2:15 of the May log is added at guessed dates; `docs/DECISIONS.md`, "Stage 3"); 4. applied to the real library 5 Oct 2026, `docs/DECISIONS.md`, "Stage 4"; done). Work's Tasks is next.

**Meeting TODOs as checkboxes (5 Oct 2026): built, converted and installed.** Tick open TODOs on the Meetings landing; `/todo` writes a checkbox (a new line when typed mid-line); `npm run convert:todos` was applied to all Research and Work meetings (`docs/DECISIONS.md`, "TODOs as checkboxes"). Nothing left to do; try ticking a TODO from the landing and typing `/todo` in a meeting.

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

_Historical: the files named below (`notes-find.ts`, `NotesEditor`, the `findSetup` hand-over) were replaced when the editor moved to CodeMirror (30 Sep 2026); Find is now `editor/live-find.ts` and the bar reaches the card through `FindContext`._

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

### 6. Work meetings: import from Obsidian, same treatment as Research — done, since built on further

**Originally stopped at a dry run on purpose; since finished at the user's go-ahead (they chose full parity for
Work's own Meetings view, and gave the two per-file decisions the dry run needed).** The importer
(`scripts/import-work-meetings.mts`, `planWorkMeetingImport`) was already built and tested; Work's own workspace
wiring (Meetings' renderer threading a real workspace everywhere instead of hard-coding `workspace: 'research'`, a
landing page, a factory module registered once per workspace) is now built too, and `--apply` has run for real.
Full write-up in `docs/DECISIONS.md`, "Work meetings import".

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

## Tasks: decisions to review (unattended run, 5 Oct 2026)

Choices the plan left open, made conservatively; change any of them by telling Claude.

- The trash is the `deleted_at` column (a deleted task and its subtasks keep their rows and can be restored); only a task never written in is removed for real.
- A series is tracked by `series_uid` (an addition to the plan's data model); completing a task never starts a second open instance of its series.
- A subtask stores no list (`''`) and shows its parent's; a dated subtask copied into the next occurrence keeps its distance from the parent's due date, an undated parent gives it none.
- Completing a parent does not complete its subtasks.
- Stage 9: Settings → Tasks holds only what the app needs (restoring deleted tasks, a copy on demand); there are no other settings yet. The importer's "Series that look recurring" list is advice only, and a series with a date in its title ("…: September") is not found.
- Stage 7: `task` is an entity kind (`cc://task/<uid>`); descriptions of tasks count as places a mention is written (the backlinks look at the database as well as the note files); the picker offers tasks, done ones last. The palette and Dock get "New task" (the Dock item is untested: macOS only). A person's page lists open tasks whose description mentions them (and the usual Mentioned in).
- Stage 6: a typed time in Hours (`Adjust`) gained an optional `task` field (additive; old files read as before) so Add time on a task is linked; Hours' own retyping of a row keeps the link. Choosing a name in Hours' Start field links the time to the open task whose title matches exactly (none or several: just a name). Naming a running unnamed timer from the top-bar popover does not link it. A task's time counts every year file of the workspace; a running timer counts whole minutes.
- Stage 4: a deleted task goes to the trash column with an "Undo" message (there is no trash page); a task nobody wrote in is removed for real. A subtask's page has no priority, list or subtasks. Tags are lower-cased when added. Mentioned in and Start/Add time arrive in stages 6 and 7.
- Stage 3: moving all overdue tasks to Today or Backlog asks first (a dialog with the count), since it changes many dates at once. Columns sort by clicking the header (not in the mockup; the plan called priority sortable). Status icons are drawn as small SVGs, not Lucide (no half-filled circle there). Due offers Today, Tomorrow, Next week, No date and a date picker.
- Importer: the export's `Subtasks IDs` is empty for most parents, so it is only checked where filled (6 disagree: a subtask added later). ClickUp's literal `\n` in task text becomes a line break. The 2 attachments become links at the end of the description. Done tasks get no completed date (the export has none). A subtask's list is dropped (it shows its parent's).
- Importer: every subtask keeps its ClickUp date, also when it repeats its parent's (the user said so on 6 Oct 2026; the plan had dropped such copies, 270 of them). 2 parents with no date take a subtask's date (the plan said 4); the rest of the plan's numbers match exactly.

## TODOs

### For the user (review and decisions)

- [x] **Non-billable work in Hours: dropped (6 Oct 2026, the user).** Work is billable work only; the billable / non-billable distinction was removed from the app (`docs/DECISIONS.md`, "Work is billable work only"). The 74 non-billable Work tasks (5:30) are in `~/CentralCommand/exports/work-non-billable-tasks.csv`. Left: whether to remove the `billable` tag from tasks and move the 74 tasks out of Work (data change, asked).
- [ ] **Stage 8 is applied (6 Oct 2026): look over the result.** Open Work → Tasks and Work → Hours (Month card): every hours entry has a task, task names follow the hours' wording where the entries agree, dates follow the hours, new and split tasks are in `docs/DECISIONS.md` ("Stage 8, finished and applied"). Old task names are in `~/CentralCommand/backups/work-final-*/` and `backups/tasks/`. Say if a name or a merge is wrong. (The questions below this one are answered and kept for the record.)
- [x] **Stage 8, second round (6 Oct 2026): tell me which of these 27 Luminos tasks are billable.** Not tagged `billable` but in the Luminos list: 24 invoicing tasks (Admin & Logistics: "Add monthly billable time to Luminos in FreeAgent" and "Create and send a monthly Luminos invoice…", 12 months each; 3 carry 15 minutes), 2 open Document Automation tasks ("Coordinate and communicate: October", "Prepare for and complete meeting with Neha"), and "Draft Oromia SPELL Training Manual for School Leaders" (Transition Support, 6:00, matches an entry exactly). Also: 12:45 of the hours have no ClickUp time (mostly 5 Oct work and the log-style lines), so reaching 100% means making tasks for them or merging some; say whether to make new billable tasks from those entries' labels. The Month card and the Billable choice in Work's tracker are built (see `docs/DECISIONS.md`, "Stage 8, second round").
- [ ] **Stage 8: link Work's history to tasks (built 6 Oct 2026, not applied).** Dry run: `npm run link:work-hours` (reads only). It links entries to billable tasks only when their minutes add up to the task's ClickUp time exactly: 66 tasks, 91 of 212 entries (159:00 of 324:00); 56 of those are high or medium confidence and are what `--apply` writes (low is only with `--include-low`; the 10 low ones are mixed, I would not apply them). Read the list, then say go: app closed, a backup is made first. Left alone: 42 billable tasks with time whose entries do not add up (the monthly summaries, the large data-preparation subtasks), 4 ties and 121 entries. Questions: (1) is the one non-billable match (Oromia SPELL for School Leaders, 6:00) meant to be billable? ClickUp has no tag on it. (2) Should Work's Month card get Billable and Non-billable rows for new time only? (3) Should the 42 unmatched tasks get a way to link entries by hand? (4) A linked task's page shows "In Hours 0:00" for history linked this way (ClickUp's time already holds it); fine, or should it say "Linked from Hours"?

- [ ] **Tasks: review the build (written 5 Oct 2026, unattended run).** _Done:_ stages 1 to 7 of `docs/TASKS_PLAN.md` and the buildable part of 9 (Settings → Tasks: deleted tasks with Restore, "Save a copy now"; write-ups; this list). _Not done, and why:_ **stage 8** (Work's hour entries become tasks, billable tag, Work's Month card) waits for your answer on how they should become tasks; the **real import** was never applied (you asked for that to be yours). Everything was committed in small steps and **not pushed**.
  - **How to try it** (scratch library, never your real one): `mkdir -p /tmp/cc-try/CentralCommand/data && cp ~/CentralCommand/data/zotero-export.bib /tmp/cc-try/CentralCommand/data/`, then `CENTRAL_COMMAND_HOME=/tmp/cc-try npm run import:clickup -- --file ~/CentralCommand/imports/clickup/90151633664hbIZSRKE.csv --apply` and `CENTRAL_COMMAND_HOME=/tmp/cc-try npm run dev`. Dry run on the real CSV (reads only): `npm run import:clickup -- --file ~/CentralCommand/imports/clickup/90151633664hbIZSRKE.csv` (2,193 -> 1,211 rows; 1,082 complete, 98 to do, 31 in progress; 663 top-level, 548 subtasks; 1,612.8 h across 628 tasks).
  - **Applied 6 Oct 2026** (you asked; the app was closed): 1,211 tasks in `~/CentralCommand/data/central-command.sqlite`, read back and matched, with a copy in `~/CentralCommand/backups/tasks/`. You said every subtask should keep its date, so the importer was changed first (518 subtasks have one). Next: rebuild or run the app, and set the repeat rules. The steps below were for applying it yourself and are kept for a redo.
  - **Apply the import to your real library, yourself:** 1. quit Central Command everywhere (the installed app and any `npm run dev`). 2. Run the dry run above and read it (the lists of series, sub-subtasks and counts). 3. Run the same command with `--apply` added. It writes into `~/CentralCommand/data/central-command.sqlite`, reads the rows back, and saves a readable copy in `~/CentralCommand/backups/tasks/`. It refuses if Tasks already holds anything (to redo, ask Claude; nothing else is touched). 4. Rebuild the app (`npm run build:mac`, quit the old one first, replace it in `/Applications`) or use `npm run dev`. 5. Open Research → Tasks and Work → Tasks; set the repeat rule of each routine task from the importer's list ("Series that look recurring") on its page.
  - **Decisions to review** are listed one line each under "Tasks: decisions to review" near the top of this file.
  - **Bugs found by driving the app** (all fixed): the row context menu closed the moment it opened (a document `contextmenu` listener caught the same event); the Due column clipped "Feb 24, 2027"; one existing editor test used `cc://task/1` as an "unknown kind" (now `gadget`). Playwright's Electron ignores the system colour scheme (dark checked with `emulateMedia`). A real-app mutation of the quit-flush did not fail the check (the 400 ms timer overlaps), so the unit tests carry that guarantee (`debounced-saver.test.ts`).
  - **Not tested:** the Dock menu's "New Task" (macOS only, no way to drive it), the packaged app (not rebuilt), and Tasks on a phone-width window.

- [ ] **Look at Work -> Hours in the app (5 Oct 2026).** The Work history is imported (both contracts, `docs/DECISIONS.md`, "Stage 4"). Old contract (Oct 2025 to Mar 2026): pick it in the select at the top right; 208:00, balance 0:00. Current one (from 1 May): 116:00, Month card with client rows, Charts and weeks. Two entries were added from the May log at guessed dates (21 May Impact 0:45, 28 May Teaching & Learning 1:30); say if you want other dates (edit the entries by hand in `time/work/2026-05-01.json` with the app closed).
- **Hours (2 Oct 2026):** allowance days not listed as time off now come off the plan on the year's last day (`docs/DECISIONS.md`, "Unlisted allowance days"). Two data fixes were made in `~/CentralCommand/time/research/2025-26.json` on 2 Oct 2026 (back-up in `backups/hours-fix-2026-10-02`): the 450-minute day total on 20 Sep 2026 was deleted, and the old sheet's typed `weekDays` of 3 for the week of 20 Apr 2026 was dropped, so that week is planned as 4 days (30 hours).
- [ ] **Review heading spacing (2 Oct 2026).** Notes now keep no blank lines around headings (new notes are made without them, and `npm run tidy:headings` was applied to the real library: 199 notes, 676 lines, backups in `backups/tidy-headings-*`); the editor draws the gap (1.1em above, 0.5em below a heading). Open a few notes and meetings and say whether the space above and below headings is right (`docs/DECISIONS.md`, "No blank lines around headings").
- [ ] **Hours: edit and delete past entries** (asked 2 Oct 2026). Imported day totals and older days cannot be changed or removed in the app today, so a wrong entry means editing the year file by hand. Let the user change or delete any day's entry in any year, and the old sheet's typed planned days for a week (the 20 Apr 2026 week showed why: a typed number overrides the rule "work days less days off").
- [ ] **Review the Hours work of 2 Oct 2026** (built and committed, not pushed): **Time off** (Research → Time off: summary and bar, the list, Add with From/To/Type, remove; the landing card), **Charts and weeks** (new: running balance, year heat map, typical week, Years table; click a heat-map day or press Enter to open its week), and **Training and Meetings now use the shared year** (52 weeks from a Monday, set in Settings → General) instead of 1 Sep to 31 Aug: the year select, the Training plan and the PDF exports all follow it. Nothing in your library changed year (2025–26 still has 129 training entries). Things to say: should removing a day off ask first? Should the Time off bar have a legend? Should the Years table sit nearer the top of the charts page?
- [ ] **How does Work differ for Hours and Time off?** Hours a day, allowance, whether it has time off at all, its own tasks (`docs/TIME_PLAN.md`, "Still open"). Nothing for Work is built until you answer.

- [ ] **Top-bar Start (stage 5b), two things to think about.** (1) **How far back should Recent reach?** It lists names from the last seven days (`RECENT_DAYS` in `src/modules/hours/shared/tasks.ts`); after a week away it is empty, though typing still suggests earlier names. Options: a longer window, or "the last five names whatever their date". (2) **Do you want a shortcut to start a timer** (for example Mod-Shift-T)? None was added; it would go in the Hours manifest `shortcuts`, Settings and `matchesShortcut`.
- [ ] **Review stage 8 of the live editor** (Milkdown is gone; every editor is the new one, no switch). Open each kind of page once: a note, a Work note, a meeting (Research and Work), a training entry, the Training plan, a reading list, a reading's notes. The old editor is not available any more, so anything that feels worse than before is for me to fix, not to switch back. `docs/DECISIONS.md`, "Live markup … stage 8", lists every old test and whether it was ported or retired.
- [ ] **Stage 8 finding: the TODO owner menu is taller than the window.** Typing `/todo` in a meeting lists everyone in the people list (and "No owner"), so the menu runs off the top of the window and the first names cannot be seen or clicked. It was the same with the old editor. Should it show only the meeting's attendees first, or scroll inside a shorter box? (I have not changed it.)
- [ ] **Stage 8 finding: a duplicate-key warning on a reading's page** (development mode only; nothing visible). `ReadingDetailPage.tsx` gives two sibling components the same `key`. Harmless, not from the editor; say if you want it fixed.
- [ ] **Review stage 7 of the live editor** (interactions). Things to look at: nested quotes now indent (they never did); headings have space above and below; the `\*` backslash is hidden until the cursor touches it; a table turns into text with a 14 px shift (it used to jump by the table's size); code blocks keep their height when their fence lines hide; undo takes one key press per step.
- [ ] **Live editor question 12:** the `#`, `**` and other markers are a pale slate. On white that is a contrast of 3.7 to 1 (light theme), and 3.0 to 1 on a code block's grey; in the dark theme it is 4.9 to 1. Darkening the light one to about `#667382` would give roughly 5 to 1. Keep the quiet colour, or darken it?
- [ ] **Live editor question 13:** a heading followed by a blank line has that blank line plus a little padding (about 22 px) under it, where the old editor always had 8 px. Headings with no blank line under them get the 8 px. The editor shows the spacing the note actually has; should a blank line right after a heading be drawn smaller?
- [ ] **Live editor question 14:** a link's address appearing when you click into a long line can make that paragraph wrap onto another line and push the text below down (28 px here); the same happens in any editor of this kind. Fine?

- [ ] **Try tables and code blocks in the new editor** (stage 6 of live markup). A table away from the cursor is a grid (open the research note "Agent-Based Modelling Research Questions" or the Work meeting of 3 Jul 2026); click in it and it becomes text with grey pipes. Tab and Shift-Tab move between cells. Type `| a | b |`, Enter, `|---|---|`, Enter, `| 1 | 2 |`, then Tab for a new row. A code block (Cmd-Option-C, or type three backticks) shows its fence lines while you are in it and hides them otherwise.
- [ ] **Live editor question 7:** Tab in the last cell of a table adds a new empty row (as in Word). Would you rather it did nothing, so a stray Tab cannot add a row?
- [ ] **Live editor question 8:** Enter inside a table row is an ordinary new line (it breaks the row in two, like any text). Should Enter at the end of a row start the next row instead?
- [ ] **Live editor question 9:** a table inside a quote or a bullet list stays as plain text with its pipes showing (only tables in the page itself become a grid). Fine?
- [ ] **Live editor question 10:** a code block whose closing fence is missing keeps its opening line showing (everything below it is code, and the note would look wrong otherwise). Fine, or hide it like the others?
- [ ] **Live editor question 11:** table column widths follow the longest text in each column, not an exact fit, and a Find match on a whole cell shades the whole cell. Fine?

- [ ] **Try Find, the outline and the TODO helper in the new editor** (stage 5 of live markup). Cmd-F highlights every match and Enter steps through; Cmd-Option-F adds replace (Cmd-Enter replaces one, Cmd-Shift-Enter all, also with the cursor in the note); the outline and Meetings' topics jump to a heading; in a meeting `/todo` or Cmd-Shift-T opens the owner menu. The file format does not change.
- [ ] **Live editor question 5:** Find reads the Markdown text, as you asked, so it also finds words inside a link's address and inside a mention's hidden address (searching `person` or `example.org` finds something you cannot see, and nothing lights up). Should Find skip hidden addresses, so it only finds what is drawn? (Markers themselves stay findable either way.)
- [ ] **Live editor question 6:** two small differences from the old editor: the outline and topic jumps scroll instantly instead of gliding, and Cmd-F does nothing if the bar is already open and you click back into the note (the old editor did the same). Fine, or should either change?

- [ ] **Try mentions in the new editor** (stage 4 of live markup): a mention is a chip the cursor jumps over; Backspace right after it (or Delete right before) removes it whole, Cmd-Z brings it back;
      `@` opens the picker as before; Cmd-click opens it; resting the pointer shows the card. A note with a mention is in no way different in the file.
- [ ] **Live editor question 4:** a chip cannot be edited in place (its label or address): you delete it and pick again. In the old editor you could type inside a mention's label. Is that fine, or should
      Enter/Cmd-E on a chip show its source text?

- [ ] **Try the new editor's keys and lists** (stage 3 of live markup; switch it on with `localStorage.setItem('central-command.liveEditor', '1')`
      in the developer tools, then reload). Use it for real: bullets, numbered lists, checkboxes (click one), Enter, Tab and Backspace in lists,
      pasting from a web page or Word (plain text only), pasting a web address over selected text. Then answer the four questions below.
- [ ] **Live editor question 1:** Cmd-Option-1 to 6 on a line that is already a heading changes its level (Cmd-Option-0 makes it a paragraph). Should the same key
      instead switch the heading off?
- [ ] **Live editor question 2:** Cmd-B with the cursor inside a long bold sentence un-bolds the whole sentence, not only the word. Is that fine?
- [ ] **Live editor question 3:** Tab in an ordinary paragraph moves the cursor out of the editor (it only indents inside lists). Should it insert spaces instead?
- [x] **Live editor glitch to tune in stage 7:** with the cursor at the very start of a heading line, the `#` is drawn over the text cursor. Fixed in stage 7: a marker at a line start stands 3 px off the caret.

- [ ] **Review the Training data after the 30 Sep 2026 tidy** (series, titles, file names; originals in
      `~/CentralCommand/backups/tidy-training-series-*`). Fix what you don't like: institutions that are really people or providers
      ("Dr Robert De Vries", "Prof. Gaelle Vallee-Tourangeau", "DataCamp", "SEDarc DTP"), whether the Statistical Genetics Group Seminar
      and other one-offs need a series, and PS5302 / PS2021 entries that have no session titles. Then try the Series and Institution
      drop-downs on an entry page and the Type before Series column order in the Training and Meetings lists.
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
- [ ] **Later, Hours: a Mac widget** for starting a task and tracking time (start, stop, the running task and its clock, without opening the app). Not started; needs a plan first (a WidgetKit extension is a separate Swift target, so how it reads the timer from `~/CentralCommand/time` and starts one needs deciding).
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
- **Imported notes with bold pseudo-headings** (`**Topic**`): converted (`npm run convert:topics`, applied 25 Sep 2026; a dry run now finds nothing).
- **Imported previous items with a status word** (`(Cancelled) **TODO(EO)**: …`) are ownerless Previous TODOs and carry
  over while unticked; the user may want to tick or delete them in the newest notes.
- **Deleted Previous TODOs come back (raised 2 Oct 2026).** Opening a meeting re-adds any TODO from the previous meeting in the
  series that is still unticked and not listed under this meeting's Previous TODOs (`carry-over.ts`), so deleting a line from
  the current meeting does not stick; the user has to tick it, or delete it in the previous meeting too. To consider: remember
  what was dropped (for example a per-meeting list in front matter) so a deleted TODO is not carried again. Not started.
- **Backspace at the start of a first-line bullet**: checked by hand in the built app on 26 Sep 2026 (typed `- first item`, Cmd+Left,
  Backspace): the bullet lifts to a paragraph at once. Resolved.

## Training (built; awaiting the user's review)

All ten stages of `docs/TRAINING_PLAN.md` are done, plus the Meetings additions (academic year selector, skills, hours counter).
`docs/DECISIONS.md` (Training) records what was decided and found. The importers have been dry-run on the user's real files;
both have been applied to the real library.

### Training follow-ups (not started; the user decides when)

- **Series naming (agreed and applied 30 Sep 2026, 46 entries; originals in `backups/tidy-training-series-*`):** a series is the full programme or module name, code included
  ("PS5210 Applied Neuroscience Methods", "SENSS Experimental Methods in the Social Sciences", "DataCamp"); the title is only the
  session ("Introduction"). A series now exists only while an entry uses it (the fixed SEDarc/DataCamp start list is gone). The user will review the data.
- **Institution as a drop-down** (asked and built 30 Sep 2026): Series and Institution use the shared `ComboField` (a text field with a list of
  the values in use; a new one can be typed). Some institutions in the data are really people or providers ("Dr Robert De Vries", "DataCamp",
  "SEDarc DTP"); the user will tidy them.
- **Training file names** are `YYYY-MM-DD Series - Title` (just the title with no series, or when the title is the series); they follow the
  series and title when either is edited. Applied to the library on 30 Sep 2026.
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
(`notes-find.ts`, since replaced by `src/renderer/src/editor/live-find.ts`) built into the shared editor itself, so Notes, Meetings, Training entries, the plan and
Readings notes all have it, with no page-wide search and no Electron IPC involved at all. See `docs/DECISIONS.md`, "Find in
the note".

## Ideas to think about (parked 29 Sep 2026; none started, the user decides)

**Editor**

- **Entities are built** (29 Sep 2026, `docs/DECISIONS.md`, "Entities: mentions with `@`"): the earlier "links between notes / unlinked mentions" idea is now
  partly done (mentions and "Mentioned in"); "unlinked mentions" (plain names that could be mentions) and tasks as a kind are not.
- **Link editing (Cmd-K on selected text):** set, change or remove a link's address without touching the Markdown.
- **"Paste without formatting" in the right-click menu:** reuses the Cmd-Shift-V code, and works even if the key chord misbehaves.
- **Plan text width:** cap the Training plan's text at 780px like Notes and Meetings (it is full width now).
- **Plan outline levels:** the plan's outline now also lists `#` headings, since it shares the Notes outline. Keep, or go back to `##`/`###` only?
- **Created dates everywhere:** add a `created:` front-matter key to new meetings, training entries and plans (and optionally backfill from
  file dates with a one-off importer). Only Notes record it today.

**Bigger, for a long unattended stretch** (each would get a short plan first, then be built and checked in the app)

1. **Prepare for a meeting** (People idea 2): from a person or an upcoming meeting, one page with what you owe them, what they owe you,
   the last meeting's topics and its open TODOs.
2. **Home page** first version, from the decided list in "Home" below: today's meetings, open TODOs due, pinned notes, training hours.
3. **TODO overview:** every open `TODO(XX)` across meetings in one filterable list (by owner, series, year), each linking to its meeting.
4. ~~Work workspace wiring~~ **already built** (Work's Meetings, landing and import; found 29 Sep 2026). Work Notes: **built** (29 Sep 2026). Work still lacks Training and Reading lists (Research-only today).
5. **Backup and export:** one command that zips the data folder (notes, plans, people) to a chosen place, plus a "last backed up" line in Settings.
6. **Unlinked mentions:** on a person's or note's page, meetings and notes that mention the name but do not link it.
7. **Tags across modules:** one tag vocabulary for notes, readings and reading lists, with a filter row on each list.
8. **Weekly review page:** what changed this week (meetings held, notes edited, training hours), generated from files' dates.

## Later, roughly in order (not for Phase 1)

- Real Claude wiring for the Ask panel; embedded terminal for Build
- **Ask "recipes"** (use case noted 30 Sep 2026, not planned): on a page, type a short command such as "Summarise" in Ask and Claude
  acts on that page. First recipe: on a training entry, write the one-sentence Summary from the Notes text, or from the slides in
  the entry's linked folder when Notes is empty; fill only an empty Summary, never overwrite one. Sample summaries are in
  `notes/training/research/` (e.g. the SENSS entries). Open points for the plan: what the Ask panel sends to Claude (CLAUDE.md says
  never send user data over the network, so this needs the user's explicit decision, e.g. a confirmation per action), and reading PDF
  slides (no PDF text tool in the app yet).
- Shared task engine (tasks, dates, time tracking, lists, subtasks, table/board/calendar views) and a one-time ClickUp import
- **Hours and Time off** (replace the user's two Google Sheets; sessions later feed Tasks): built for Research (stages 1 to 9 of
  `docs/TIME_PLAN.md`, 2 Oct 2026). Left: Work's own Hours and Time off, which waits for the user's answer to "How does Work differ?", and Tasks.
- **Training** (the formal training log, a notes page per entry, linked files, PDF export): the plan and mockup are drafted in
  `docs/TRAINING_PLAN.md` and `docs/design/training-mockup.html`; built; see the Training section above.
- **Notes** (one module for free notes with a group per note, pinned notes, quick capture; replaces Thesis, Data Sources and Inbox): plan
  `docs/NOTES_PLAN.md` and mockup `docs/design/notes-mockup.html` are approved; built (nine stages), see the Notes section above and `docs/DECISIONS.md`. Studies stays "Coming soon".
- Global dashboard (priorities, calendar, weather, unread email count)
- World news tab, Research Digest, Focus/Writing space
- Life and Work workspaces
- Books module (following the Readings pattern)
- Dark mode: **built** (Settings → Theme). Packaging and public release
