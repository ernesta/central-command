# Training module: plan

Status: **draft for the user's review. Nothing is built.** Read it with `CLAUDE.md`, `docs/DECISIONS.md` and the mockup
(`docs/design/training-mockup.html`; open it in a browser). The Meetings module is the pattern to copy
(`docs/MEETINGS_PLAN.md`). Where this plan says "proposed", the user has not decided yet; the open questions are at the end.

## What the user needs

The brief says Training is "informal notes + formal log with PDF export, attachments". The user's own files show what that
means:

- **A formal Research Training Log** (an institutional and funding requirement). It is a Word table with the columns
  Date, Type, Title/Description, Details, and "No. of day/s contribution" (for example `0.5 (2 h)`). It is kept per
  academic year (`~/RHUL/Trainings/2025-26 Training Log.docx`) and a copy goes into the Annual Review form
  (`Forms & Documents/Annual Reviews/.../2 Research Training Log.docx`), so the user copies it by hand today.
- **Informal notes** on individual sessions (10 Obsidian notes so far, in `Scribbles/RHUL/Training/`), with a lead, an
  overview of the course and the user's notes.
- **Files for each session** (slides, readings, code) in a folder tree the user already keeps:
  `~/RHUL/Trainings/<year>/<programme>/<YYYY MM DD Title>/`.

The module is therefore the same shape as Meetings: one file per entry, one list that is also the formal log, an
export, and a page per entry with a notes editor.

## Facts found by reading the user's real files (read-only)

- The 2025-26 log has **131 entries** from Sep 23, 2025 to Jul 27, 2026, oldest first: **68.5 days, 355.5 hours**. 22 dates
  have more than one entry. Days by type: Training 31.5, Online training 19.5, Seminar 5.0, Lab meeting 2.5, Conference
  attendance 2.5, and 7.5 across the six other types.
- **Eleven types are in use**, typed by hand: Training, Online training, Seminar, Lab meeting, Lecture, Guided learning,
  Self-guided learning, Lecture & guided learning, Conference attendance, Conference presentation, Conference. The last three
  overlap, and so do the first two.
- **Days from hours** in the log follows one rule with no exception: up to 4.5 h is 0.5 day, 5.5 h or more is 1 day (the log's
  own guidance says 1 to 3 h is half a day and 5 to 6 h a full day; 5 h itself never occurs). The guidance also lists other
  activities with their own days (conference poster 0.5, oral presentation 1.5, paper submission 2, organising a conference 2,
  volunteering 1 day), so the days must stay editable.
- **Reading the Word file:** plain-text conversion loses the cells (about five rows have a title or details wrapped across lines and one date is typed
  `Feb 9,2026` with no space, which merged two rows in a first attempt). `textutil -convert html` keeps the table cells, and
  gave exactly 131 rows whose contributions sum to 68.5 days and 355.5 hours.
- One title has a typo in the source: `School of School of Life Sciences and the Environment Postgraduate Researcher Induction`.
  The importer keeps text verbatim; the user can fix it in the app.
- **Folders** are not one-to-one with log rows. Most seminars and workshops have a dated folder (`2025 10 15 Peer Review`).
  A multi-day course has one folder for several log rows (`2026 06 29 - 08 03 Experimental Methods in the Social Sciences`).
  Modules (`PS5302 Statistics for Research/Week 1`) have week folders and no dates. So an entry links to **one folder**, and
  several entries may link to the same one.
- The Obsidian training notes have the shape `#tags`, `**Lead**: [[Name]]`, `## Overview` (the course description) and
  `## Notes`. File names are `YYYY MM DD Title.md`, and titles differ slightly from the log's (`Preparing for Your Annual Reviews
and Upgrade` against the folder `Annual Review and Upgrades`), so matching needs care.

## Design (proposed)

### Files and format

Location: `~/CentralCommand/notes/training/<workspace>/YYYY-MM-DD Title.md` (`research` now; the code takes a workspace, as
Meetings does). File names replace characters that are unsafe (the colon in `SEDarc: Data Management`), and a second entry with
the same date and title gets ` 2`. Editing the date or title renames the file, without ever replacing another (as Meetings does).
The database is a rebuildable index; the files are the source of truth (Claude Code and Obsidian may edit them).

```markdown
---
date: 2025-12-10
type: Training
title: 'SEDarc: Data Management and Security'
programme: SEDarc # optional
hours: 1.5
days: 0.5
lead: Robert Darby # optional
folder: 2025-26/SEDarc/2025 12 10 Data Management and Security # optional, relative to the Trainings folder
---

## Details

The text for the log's Details column. One or two sentences.

## Notes

Free notes in the same editor as Readings and Meetings.
```

- Front matter is edited through fields and is not shown in the editor; splitting and joining leave the body byte-for-byte
  unchanged, and unknown keys survive (the Meetings rules). The Details section feeds the log the way Summary feeds the
  Meetings list.
- **Upcoming** = date after today. An upcoming entry is shown, marked, and left out of the totals and the export (the Meetings
  rule). It is how a planned course is recorded before it happens.
- **Academic year** is 1 September to 31 August, shown as `2025–26`. The list opens on the year that contains today.

### Screens (see the mockup)

1. **Training log** (`/research/training`): the list is the log. Totals strip (days, hours, entries, days by type), search,
   filters (academic year, programme, type), oldest first like the Word log, quiet "Copy as table" and "Export PDF" controls
   at the right of the filter row, and a "New entry" button. Row marks show whether an entry has notes and a linked folder.
   Whole row is clickable; the date is a real link. Filters are remembered (`useModuleState`).
2. **Entry page** (`/research/training/t/:id`): the title, a row of fields (date, type, programme, hours, days, lead), the Details
   and Notes editor, and a Files panel. Delete asks for confirmation and moves the file to the macOS Trash.
3. **Research landing card**: replaces the "Coming soon" tile with days this academic year and the latest entry.

No separate landing page: Meetings needed one for open TODOs and series cards, and Training has nothing like that.

### Rules (pure functions, unit-tested; the safety-critical ones get a mutation check)

- **Days from hours:** 5 h or more is 1, otherwise 0.5. When the user enters hours and days is empty the app fills it with this
  suggestion as an ordinary editable value. Totals use the stored days only.
- **Log line format:** `0.5 (2 h)`; hours and days print without a trailing `.0`.
- **Totals** per academic year and per type; upcoming entries excluded. Types that differ only in case count as one.
- **Search** covers date, type, programme, title, details, lead and note text (an excerpt cached in the index).
- **Type and programme** are free text with suggestions taken from what is already used. Nothing merges or renames types
  behind the user's back.

### Files panel (proposed: link, never copy)

The app links an entry to a folder the user already has instead of copying files into its own store.

- A setting **Trainings folder** (a `PathField`, like the Zotero path) is the root. `folder` is stored relative to it.
- The main process lists the folder (files only, one level plus sub-folders shown as folders) and opens a file with the default
  app or reveals it in Finder. Every path is checked to stay inside the root (`..`, absolute paths and symlinks that escape are
  refused; tested).
- **The app never moves, renames, writes or deletes the user's files.** Adding files to a folder (drag and drop) is a later,
  explicit feature.

### Export (proposed)

- **Export PDF** for the chosen academic year, oldest first, upcoming excluded, in the log's columns, with a totals line.
  Built with Electron's `printToPDF` on a hidden print-styled page, so no new dependency and nothing over the network. The
  same helper serves the Meetings supervision-log export later.
- **Copy as table** puts an HTML table (and a tab-separated text version) on the clipboard, so it pastes into the Annual Review
  Word form as a table, as the APA copy in Readings pastes with italics. Cheap, and it fits how the log is used today.

## Stages (one or more small commits each; `npm run lint`, `typecheck` and `test` pass at every commit)

1. **Generalise the front matter code** (a pure move). `splitNote`, `joinNote` and the key-preserving `updateHead` are generic
   but live in the Meetings module beside meeting-specific parsing. Move the generic part to shared code; Meetings tests stay
   unchanged and Meetings is checked in the real app. Allowed now because Training is the second consumer.
2. **Training core (main process).** Module folders, migration `training/0001` (index table), file naming, front matter parse
   and write, store (create, read, guarded save, Trash delete), repository, watcher, IPC and `Api` types, registration. Tests.
3. **Pure rules:** days suggestion, academic year, totals, query, upcoming, log line. Mutation checks on the totals and on the
   upcoming exclusion.
4. **Entry page:** fields, Details and Notes editor, delete with confirmation.
5. **Log page:** table, totals strip, filters, remembered state, Research card, keyboard navigation, shortcuts list entries.
6. **Files:** the setting, the contained folder listing, open and reveal, the panel. Containment tests including symlinks.
7. **Export:** PDF and Copy as table.
8. **Import** (`npm run import:training`, dry run by default; below).
9. **Polish and docs:** brief section 9 check, focus rings and clipping, empty and error states, performance, README,
   DECISIONS, ROADMAP, CLAUDE.md status.

Verification for every UI or data-flow stage (`CLAUDE.md`): scratch library via `CENTRAL_COMMAND_HOME`, drive the real app with
Playwright in dev and production, real keystrokes, screenshots read, quit right after typing, kill stray processes.

## Import (proposed)

`npm run import:training -- --log <the .docx> [--obsidian <folder>] [--trainings <folder>] [--apply]`. Dry run by default; never
`--apply` on the real library unless the user asks. Sources are never modified.

- **The Word log** is read with `textutil -convert html` and its table cells (macOS only, like the meetings import). A row is
  imported verbatim: date, type, title, details, hours and days. A date without a space (`Feb 9,2026`) is accepted. Programme
  is the part of the title before `: ` when it is short; otherwise it is left empty and reported.
- **Obsidian notes** are matched to rows by file-name date and title (case and accent folded, programme prefix ignored). Anything
  ambiguous or unmatched is reported and never guessed. `**Lead**` becomes `lead`; the header tags are dropped; the note's own
  headings and text go under `## Notes` (their levels shifted one deeper) so nothing is lost; wikilinks become plain text.
- **Folders** are matched to rows by the date at the start of the folder name, or a date range that contains the row's date,
  plus a title check. Module week folders and anything uncertain are reported for the user to link by hand.
- **Safety net:** the imported days and hours must equal the source's totals (68.5 and 355.5) and the count 131; every title,
  detail and type must equal its source cell; every Obsidian note's text must survive the conversion. An entry that fails is left out
  and reported as ATTENTION. Existing entries (same date and title) are skipped, files are created exclusively and never
  replaced, so running it twice writes nothing the second time.
- **Reminders after the dry run:** the `School of School of` typo; near-duplicate types (Conference, Conference attendance,
  Conference presentation; Training, Online training); entries with no programme; rows without a matching folder; notes that
  could not be matched.

## Never (this module)

Never write to the Word logs, the Obsidian vault or the Trainings folder. Never overwrite a training entry file (saves check the
file's content hash). A deleted entry goes to the Trash after a confirmation. No user data over the network.

## Open questions for the user

1. **Scope.** Is this right: the formal log, a page per entry with notes, and linked files? Anything else the module should do,
   such as planning future training (the design supports upcoming entries but nothing more)?
2. **Programme.** Keep it as a filter (SEDarc, SENSS, Research Training Seminars, DataCamp…), or is Type plus search enough?
3. **Types.** Free text with suggestions (proposed, matches how the log is written today), or a fixed list you manage in Settings?
4. **Files.** Link to your existing Trainings folder and never copy (proposed), or copy files into the app's own folder?
5. **Export.** PDF as the brief says, plus Copy as table for the Annual Review form (proposed). Would you rather have a
   `.docx` export? That needs a new dependency.
6. **A target.** Does your funder or department require a number of training days? If so the totals strip can show progress
   towards it. I did not find one in the files I could read (the SEDarc guidance PDFs were not opened).
7. **Details text.** New entries start with an empty Details; should the app ever draft it (for example from your notes), or
   is that a later Ask feature?

## Suggested order relative to other work

Nothing here depends on the Meetings follow-ups. The shared PDF helper built in stage 7 makes the supervision-log export a
small task afterwards. The task engine is not needed.
