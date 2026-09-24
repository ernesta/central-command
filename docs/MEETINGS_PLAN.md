# Meetings module: plan

Status: **plan final and approved; stages 1 to 5 done** (see DECISIONS.md), waiting for the user's go-ahead for stage 6. The user says "go" per step (see the prompt they keep for it). This file is
the source of truth after a context clear; read it together with `CLAUDE.md`, `docs/DECISIONS.md`
and the mockup (`docs/design/meetings-mockup.html`, also published as a private artifact at
https://claude.ai/artifact/4DWJurKEFDHsEKHTs44Fug). The mockup is the visual reference; this
file wins where they differ.

## What the user needs

A place in Research to keep notes for every meeting, with:

- **A meeting list that is also the formal supervision log.** One list of all meetings, newest first,
  searchable and filterable. Filtering to the Supervision series gives the supervisor log. A PDF export of
  that log (oldest first) comes much later; do not build it now.
- **Automatic carry-over of TODOs** from one meeting to the next, so the user no longer copies
  them by hand.
- **A glanceable list of topics** for each meeting, tickable as discussed.
- **Start and end times** per meeting (duration is calculated).
- Meetings in **Work** later, so nothing should assume Research only.

The formal log currently is a Word table ("Record of PGR Student Supervisory Meetings", an
institutional requirement) with columns Date, Type, Duration, Summary, Attendees (initials), plus
supervisor and student initials. The new log needs: **Date, Time (start to end), Duration, Series,
Type (In person / Online), Summary, Attendees**. It is read-only (fix a row by editing the
meeting). Clicking anywhere on a row opens the meeting; there is no separate "notes" link.

## Decisions made with the user

- **Series** (a fixed list for now): Supervision, Rastle Lab, Luminos (where Matthew Jukes works), Other. Every
  meeting has one; there are **no meeting names or titles**. A meeting is told apart by date,
  time, summary and attendees. The page heading is "Series · date".
- **Attendees** are shown as initials (AC, KR, EO). See People below.
- **Summary** is the text under a `## Summary` heading at the top of the note. It feeds the list and log. An empty summary shows "No summary yet".
  Automated summaries (Claude writing that section) come later; because files are the source of truth, they need no special support.
- **Landing page** (mockup tab 1): a "Before next meeting" list of open TODOs (each row is the TODO text followed by its owner as
  a small initials pill, the same pill used for attendees, with the source "Series · date" at the right end), an Everyone / Mine toggle, series cards with one line `N meetings · last X · next Y`, and
  a "Recent and upcoming" list with a link to all meetings. No "has a log" tag, no default-attendees line. The
  landing list is read-only; ticking happens in the next meeting's Previous TODOs (see below).
- **Agenda section dropped.** The user prepares by writing notes before the meeting (things to ask, report or read up on, some
  never discussed), so a separate agenda is not useful. Instead, the meeting page has a **Topics panel**
  built from the headings in Notes (see Topics). It is the agenda, the outline, and the discussed tracker in one.
- **Delete is real.** A meeting can be deleted from the app, after a confirmation. **Confirmed by the user: the file is moved to
  the macOS Trash** (`shell.trashItem`), like any other file, so it is gone from Central Command but recoverable. Removing
  the file also removes its index rows. `CLAUDE.md`'s "Never delete or overwrite a note file" is for Readings; update the
  wording in the same commit to say meetings can be deleted by explicit user action with confirmation.
- **Follow-ups are plain text in the notes** (option A): no separate task table, so nothing duplicates the future task engine.
- Search covers date, series, attendees, summary and note text (cached plain-text excerpt like Readings).

## Files and format

Location: `~/CentralCommand/notes/meetings/<workspace>/YYYY-MM-DD <Series>.md` (`research` now; `work` later
gets its own folder and landing page from the same module code). A second meeting of a series on one day gets ` 2`. The
database index is a **rebuildable cache**; the files are the source of truth (Claude Code and Obsidian may edit them).
Use `NotesStore`-style guarded writes (content-hash check, atomic write, conflict choice) for every save.

```markdown
---
series: Supervision # Supervision | Rastle Lab | Luminos | Other
date: 2026-09-24
start: '14:00' # optional; 24h local time
end: '15:00' # optional
mode: in-person # in-person | online
attendees: [Kathy Rastle, Arnaud Chevalier, Ernesta Orlovaitė]
discussed: [Study 1 model results] # topic headings ticked as discussed
---

## Summary

One or two sentences.

## Previous TODOs

- [x] **TODO(EO)**: Start writing up the analysis
- [ ] **TODO(KR)**: Send the contact details

## Notes

### Study 1 model results

- Weights were applied twice.
- **TODO(EO)**: Re-run the models with the corrected weights

### Ethics application timeline
```

- The front matter is **not shown in the editor**; it is edited through the fields above the note. Splitting and
  re-joining must leave the body byte-for-byte unchanged (test this hard). Unknown front matter keys are preserved.
- A new meeting is created from the template: Summary, Previous TODOs (auto-filled), Notes. Times and mode are optional.
- **Upcoming** = date after today. The user creates an empty meeting as soon as the next date is known. Upcoming meetings
  are excluded from the log and drive "next Oct 1" on the series card.

## Rules (all pure functions, unit-tested; safety-critical ones get a mutation check)

**TODO syntax.** The user writes `**TODO(EO)**: text` inline wherever it arises. Accept `TODO(EO)`, `TODO (EO)` (space),
`TODO(KR & AC)` (several owners) and `TODO:` (no owner), with or without bold. Do **not** rewrite the user's text on import
beyond the header changes listed below. The note syntax does **not** change (the user's "owner at the end" was about the
landing-page layout: the owner pill after the text).

**Owners and People.** A small people list (name, initials, "me" flag) stored as `data/people.json` (atomic writes).
Initials are **unique**; auto-derived from the name (Kathy Rastle gives KR, titles like "Prof" ignored) and made unique
on collision (edit in Settings). A TODO owner is resolved by initials against the meeting's attendees first, then all
people; unknown initials are kept and flagged, never dropped. Owners are **not restricted to attendees**; the
insert helper suggests attendees first. Attendees in front matter are full names; initials come from the people list.

**TODO helper in the editor.** A shortcut or `/todo` opens a small menu of the attendees and inserts `**TODO(XX)**: `.
Typing it by hand must keep working.

**Previous TODOs (carry-over).** For a meeting M with previous meeting P (same series, earlier date), the list is
P's inline TODOs plus P's unticked Previous TODO items. Ticked items are not carried. Sync only **adds** missing items
(dedupe on owner + normalised text) when M is created and when it is opened; it never removes or edits items and never
touches ticked state. Items are written as `- [ ] **TODO(EO)**: text`.

**Open TODOs (landing).** Per series, with L the latest meeting (including upcoming): unticked items in L's Previous
TODOs plus L's inline TODOs. Each row shows the text, the owner as an initials pill after it, and "Series · date of L" at the right; clicking opens L. Read-only in v1.

**Topics.** Topic headings are the level-3 headings under `## Notes`; if a note has none, its level-2 headings other than
Summary / Previous TODOs / Notes (imported Luminos notes use that shape). The panel lists them with a checkbox (discussed),
click jumps to the heading, "Add topic" appends a `###` heading. Discussed state is stored in front matter (`discussed`),
keyed by heading text; renaming a heading un-ticks it (accepted). Notes with only bold pseudo-headings have no topics.

**Duration** is end minus start, shown read-only; blank if either is missing. **Summary** shown as plain text (markdown
stripped) in the list.

## Stages (one or more small commits each; `npm run lint`, `typecheck`, `test` pass at every commit)

1. **Extract the shared notes machinery from Readings** (guarded store, session, watcher, editor component, task-list
   and list-keymap plugins) so Meetings can reuse it. Pure refactor: Readings tests unchanged and Readings verified in the
   real app (dev and production). Allowed now: it is the second consumer (see CLAUDE.md).
2. **Meetings core (main process).** Module folder `src/modules/meetings/{main,renderer,shared}` following Readings;
   migration `meetings/0001` (index table, TODO table); front matter split/join; file naming; people store; repository; watcher;
   create / read / save / delete (Trash) with tests; register in `main-registry.ts`; API and IPC types in the shared
   `Api` (no generic escape hatch).
3. **TODO and topic parsing, carry-over, open-TODO logic** as pure functions, with heavy tests and mutation checks.
4. **Meeting page.** Metadata fields (series, date, start, end, calculated duration, type, attendees), editor
   (front matter hidden), Previous TODOs auto-fill, Topics panel, TODO insert helper, delete with confirmation.
5. **All meetings list** (search, series / attendee / type filters, newest first, upcoming excluded, click row to open),
   plain-code queries as in Readings.
6. **Landing page** and the Research landing card (replace the planned "Meetings" card with a live one).
7. **Settings: People** (name, initials, me) and remembered list state.
8. **Import** (`npm run import:meetings -- --vault <path> --meeting-notes <path> [--apply]`, dry run by default; see below).
9. **Polish and docs:** visual QA against brief section 9, keyboard and focus (check ring **clipping** per CLAUDE.md), empty and
   error states, performance with a few hundred meetings, README, DECISIONS, ROADMAP, CLAUDE.md status.

Verification for every UI or data-flow stage (CLAUDE.md): scratch library via `CENTRAL_COMMAND_HOME`, drive the real app
with Playwright in **dev and production**, real keystrokes, screenshots read, quit right after typing, kill stray processes.

## Import: facts found by reading the user's real files

Sources (read-only, never modified): Obsidian vault `~/RHUL/Scribbles/RHUL/Meetings/` (34 notes in `Supervision/`, plus
6 others: Matthew Jukes x3, Caitlin Baron, Rastle Lab 2025-12-17, Annual Review 2026-06-23), the Word log
`~/RHUL/Meeting Notes/2025-26 Supervisor Meeting Log.doc`, and `~/RHUL/Meeting Notes/Supervisors/*.docx` (34 supervisor
notes plus the Rastle Lab one). Read Word files with macOS `textutil -convert txt` (the import tool is macOS-only; say so).

- Obsidian note shape: `#tags` line, `**Date**: ...`, `**Attendees**: names` (some `[[wikilinks]]`), optional
  `## Previous Action Items` (checkboxes), `## Notes` with `###` topics, inline `**TODO(EO)**:` (about 300; owners EO, AC,
  KR, MJ; the spelling `TODO (EO)` also occurs about 55 times).
- **Times** exist only in the docx notes, on the first line: `July 9, 2026 | 10:00 - 11:00` (all 35 have them; some hours
  are single-digit, e.g. `9:00`). Match to notes by file-name date.
- **Log rows** (34, Sep 2025 to Jul 2026) give summary, mode (`Visit` = in person, `Teams` = online) and duration. The
  log's Type of contact column is dropped. Every log date has an Obsidian note and a docx note; the docx
  dates equal the Obsidian file-name dates in every case.
- **Series from tags:** `#supervisor-meeting` = Supervision; the Rastle Lab file = Rastle Lab; `#luminos` (Matthew Jukes,
  Caitlin Baron) = Luminos; Annual Review = Other.
- Write each note in the editor's canonical form (as the Readings import does): drop the tags/Date/Attendees header lines (they become
  front matter), rename `## Previous Action Items` to `## Previous TODOs`, insert `## Summary` with the log text for
  supervision meetings, convert `[[wikilinks]]` to plain text and tabs to spaces (reuse the Readings import helpers), leave
  everything else and all inline TODO text untouched. Never overwrite an existing meeting; never touch the vault or the Word files.
- Dry run reports every mapping and every anomaly; nothing is guessed.

### Reminders to give the user after the import runs (they asked for these)

1. **Wrong dates in Obsidian `**Date**` lines**, three supervision notes: files `2025 11 26` and `2025 12 03` both say
   Nov 20, and `2025 11 20` is right; and the Luminos note `2026 05 21` says May 21, **2025**. The import uses the file-name date
   (confirmed by the docx and the log). The user will check these themselves.
2. **Four durations differ** between the Word log and the docx time ranges (log vs docx): 2025-10-16 (15 vs 30 min), 2025-11-11 (60
   vs 30), 2026-05-29 (45 vs 60), 2026-06-26 (75 vs 105). The import uses the docx times; the user should check them.
3. **Five meetings have no times** (no docx exists): Matthew Jukes 2025-11-03, 2025-11-17, 2026-05-21, Caitlin Baron
   2025-10-16, Annual Review 2026-06-23. The user adds times themselves.
4. All imported supervision summaries come from the log; other meetings have none ("No summary yet").

## UI details settled in review (mockup version 4)

- The meeting metadata row (series, date, start, end, calculated duration, type, attendees) is one flex row that wraps between fields,
  never inside one: values, the In person / Online segments and initials chips are `white-space: nowrap`.
- In the all-meetings list the Series column is plain weight (not bold), Type never wraps, and the Attendees column is only as wide as
  three initials pills; more people show as a muted `+N` after the third. Columns: Date, Time, Duration, Series, Type, Summary, Attendees.
  A dash means no time recorded yet.
- Export is a quiet, borderless "Export" control with a download icon, right-aligned in the filter row (disabled until built; it will
  act on the Supervision view, oldest first). It is used about once a year, so it must never look prominent. No header button, no long label.
- Series cards on the landing page are narrow (about 290 to 320px wide, `repeat(auto-fill, minmax(290px, 320px))`), so three or four per line and
  wrapping to a second line is fine. They must show `N meetings · last X · next Y` on one line.
- The meeting page is a two-column layout: the note (Summary, Previous TODOs, Notes) and a sticky Topics panel (about 260px, stacked below
  under 900px).
- Delete opens a small confirmation (Cancel / Delete meeting) saying the file moves to the Trash.
- Remember the focus-ring lessons: every new scrolling or clipping container needs 4px padding plus `scroll-padding`, and the segmented
  control must keep rounded ring corners; run the clipping test from CLAUDE.md on every new screen.

## Decisions accepted without changes

- People rules: unique initials (auto-derived, editable in Settings), unknown owners are flagged and never dropped, owners are not limited to
  attendees (the insert helper suggests attendees first).
- Trash rather than permanent deletion.
