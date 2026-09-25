# Training module: plan

Status: **draft 2, revised after the user's review. Nothing is built.** Read it with `CLAUDE.md`, `docs/DECISIONS.md` and the mockup
(`docs/design/training-mockup.html`; open it in a browser). The Meetings module is the pattern to copy (`docs/MEETINGS_PLAN.md`).
"Proposed" means the user has not decided yet; the open questions are at the end.

## What the user needs

A place in Research to keep the **training log** the user reports each academic year, with notes and files per entry:

- **The log is the Inkpath-style log** (`~/RHUL/Trainings/2025-26 Inkpath Training Log.xlsx`), not the older Word table. It has a start and
  end time per entry, a description, the skills gained and the hours. Hours are **calculated from the times**, like meeting duration.
  No days anywhere.
- **The yearly aim is 200 hours of training.** Progress towards it and **hours per skill** are what the totals show. Totals by type
  (online training, lab meeting…) are not wanted.
- **Every entry can have notes** (the same editor as Readings and Meetings) and a **linked folder** of files (slides, readings).
  Files are linked, never copied.
- **Academic year**: tracking starts anew every year, for Training and for Meetings alike.

## What changed since the first draft (the user's ten points)

1. No days; hours only, calculated from start and end times (the Meetings fields and rule).
2. Type: the full Inkpath list, renamed slightly and harmonised so it is easy to choose. **Blocked on the list**, see the questions.
3. The list shows title and summary (the summary is the notes' `## Summary`, as in Meetings).
4. No days or per-type totals; hours, skills and the 200-hour aim instead.
5. The list matches the Meetings list: Date, Time, Duration, Series, Type, Title and summary, then Skills and Leads.
6. **Series** replaces "Programme" and behaves like a Meetings series (a chip, a filter, and it can open the list filtered).
7. **Leads** are people, several allowed, chosen exactly like meeting attendees from the shared people list.
8. Files are linked to existing folders, never copied.
9. **Skills**: up to three per entry, chosen from the skills in the log; hours per skill are the summary.
10. **Academic year** filter for both Training and Meetings.

## Facts found by reading the user's real files (read-only)

**The Inkpath log** (`2025-26 Inkpath Training Log.xlsx`, one sheet, read by unzipping the workbook; no spreadsheet program needed):

- **166 entries, 371.0 hours**, Sep 23, 2025 to Jul 29, 2026 (not in date order). Every entry is a single day and has a start and end
  time, hours and skills. Columns: Name, Type, Attendance Type, Description, Organisation, Provider, Start Date, Start Time, End Date,
  End Time, Date Completed, Hours, Points, Skills, Notes. Dates are `dd/mm/yyyy`; descriptions can contain line breaks (21 do).
- **It includes 34 supervisor meetings (32.5 h) and 3 Rastle Lab meetings (4 h)**, which the Meetings module already holds. The user says
  these have the correct times (the Meetings import found four durations that disagreed with the Word log), so they are a source for
  correcting Meetings times. Without them the log is 334.5 hours, so even so the aim of 200 is passed this year.
- **The Type column says "Activity" in all 166 rows**, so the real type list is not in the file. It is in the user's two screenshots
  (`types1.png`, `types2.png`). Only the second could be read: it ends with _Research-related courses, Shadowing, Supervisor/PI/manager
  meeting, Volunteering, Work placements or work-related projects_. The first (the earlier part of the list) is still needed.
- **Attendance Type** is Other (136), Live (online) (29) or Live (in person) (1), so it is a format like the Meetings Type
  (In person / Online). **Organisation** has two values (Healthy, Thriving Communities: 136; SEDarc DTP: 30). **Provider** has 31 values,
  a mix of institutions (Royal Holloway 79, DataCamp 38, Middlesex 9, LSE 2…) and people (Dr Anastasiya Lopukhina, Maria Korochkina…).
  **Points** appear on 28 entries. **Notes** is empty.
- **Skills**: 19 distinct names, each tagged `(GS)`, `(RP)` or `(SS)` (for example _Quantitative Skills (GS)_ and _Quantitative Skills
  (SS)_ are different skills). Entries carry 1 skill (33), 2 (99), 3 (33) and one carries 5, which breaks the "up to three" rule (_Making your
  research transparent and reproducible (Live)_). Because an entry counts for each of its skills, the hours per skill add up to more than
  the total (Quantitative Skills (GS) 220.0 h, Data Management and analysis (GS) 183.5 h, Networking (RP) 48.5 h…).
- **Hours in the log are not always the length of the session**: in 17 entries they differ from end minus start (a 3-hour SENSS session
  credited 0 or 1 h, a supervisor meeting from 09:00 to 09:45 credited 1 h). The app calculates from the times; the import reports each
  difference.
- **Series** is not a column. What the data shows: DataCamp 38 entries (119.5 h), SEDarc DTP 30 (77.0 h), SENSS 11 (17.0 h), LSE 2, plus
  many Royal Holloway ones (Research Training Seminars 13, Psychology Seminar Series 6, Researcher Development Programme 4, modules such
  as PS5302) and a few external (FRiLL at Aston and at Reading, Experimental Psychology Society).

**The older Word log** (`2025-26 Training Log.docx`, 131 entries, no times) overlaps the Inkpath log only in part: 70 entries have the
same name and date; 61 Word entries and 62 Inkpath entries (not counting supervisor meetings) have no twin by name, because the two logs
name the same session differently (_SEDarc: Mixed Methods Research Designs_ against _Refine understanding of mixed methods research
designs (Live)_). It has no times or skills, so it is at most a cross-check.

**Files and notes:** the Trainings folder is `~/RHUL/Trainings/<year>/<programme>/<YYYY MM DD Title>/`. A multi-day course has one folder
for several entries, and module weeks have no dates, so an entry links to one folder and several entries can share one. Ten Obsidian
notes exist in `Scribbles/RHUL/Training/` (`**Lead**: [[Name]]`, `## Overview`, `## Notes`).

## Design (proposed)

### Files and format

`~/CentralCommand/notes/training/<workspace>/YYYY-MM-DD Title.md` (`research` now). File names replace unsafe characters (the colon in
`SEDarc: …`); a second entry with the same date and title gets ` 2`; editing the date or title renames the file without replacing
another (as Meetings does). The database is a rebuildable index; the files are the source of truth.

```markdown
---
date: 2025-12-10
start: '10:00'
end: '11:30'
title: 'Data Management and Security'
series: SEDarc
type: Research-related courses # from the harmonised list
mode: online # in-person | online, optional
skills: [Data Management and analysis (GS), Ethical and legal issues (GS)] # up to three
leads: [Robert Darby] # people, several allowed
folder: 2025-26/SEDarc/2025 12 10 Data Management and Security # optional, relative to the Trainings folder
organisation: SEDarc DTP # kept from the Inkpath log, not shown yet
provider: Robert Darby # kept from the Inkpath log, not shown yet
points: 1 # kept from the Inkpath log, not shown yet
---

## Summary

One or two sentences (the Inkpath Description). Shown in the list.

## Notes

Free notes.
```

- The front matter is edited through fields and never shown in the editor; joining leaves the body byte-for-byte unchanged and unknown
  keys survive (the Meetings rules). The Inkpath fields the app does not show yet are kept, so nothing is lost and a later export can
  use them.
- **Duration** = end minus start, read-only (blank if either is missing). No hours field to type, so it can never disagree with the times.
- **Upcoming** = date after today: shown and marked, left out of totals, progress and export (the Meetings rule).
- **Academic year** = 1 September to 31 August, shown as `2025–26`.

### Skills, the 200-hour aim and totals

- **Skills** are chosen from a fixed list (the 19 in the log, names verbatim including the `(GS)`, `(RP)`, `(SS)` tag), at most three per
  entry. The list lives in code like the Meetings series and is easy to change.
- **Totals strip** for the chosen academic year: **hours done of 200** with a thin progress bar (the aim is a setting, default 200),
  then **hours per skill** as a compact list, largest first. Each entry counts fully towards each of its skills, so the skill hours add
  up to more than the total; the strip says so in one line.
- No per-type totals.
- **Which entries count towards the 200?** Proposed: every past entry in the training list. Supervisor and lab meetings stay in the
  Meetings module and are **not** counted, unless the user says Inkpath counts them (see the questions).

### Series (proposed)

Like Meetings series: a chip on every entry, a filter in the list, and an entry cannot exist without one (a series called "Other" is the
fallback). Proposed starting list: **SEDarc, SENSS, LSE, DataCamp, Royal Holloway, Other**, and a new one can be added by typing it. The
import assigns a series only when it is clear (the Organisation _SEDarc DTP_; _SENSS_ or _LSE_ in the title; the provider _DataCamp_ or
_Royal Holloway_) and reports the rest as "Other" for the user to sort.

### Type (blocked, see the questions)

The full Inkpath list, each renamed slightly for clarity and grouped so the choice is quick. The import maps Inkpath's original type to
the new name from a table the user approves; the Inkpath original is kept in the file (`inkpath-type`) so an export can restore it.

### Leads and people

Leads are people, several allowed, picked exactly as meeting attendees are (the same control, the same shared people list, unknown
names shown as outlined chips). The list shows initials chips at the right, like Attendees. **A People page of its own** is a follow-up (the
list is too long for Settings). Later it could hold links per person (GitHub, Google Scholar, LinkedIn) and pull their recent papers,
posts or tweets; that is recorded in the roadmap, not built.

### Screens (see the mockup)

1. **Training list** (`/research/training`), oldest first like the log. Header with the academic-year selector and New entry. Totals strip
   (hours of 200, hours per skill). Search and filters: series, type, skill, leads. Columns in the Meetings order: **Date, Time,
   Duration, Series, Type, Title and summary, Skills, Leads**. Row marks show notes and a linked folder. Filters are remembered
   (`useModuleState`). Export controls are quiet, at the right of the filter row.
2. **Entry page** (`/research/training/t/:id`): title, a row of fields (date, start, end, calculated duration, series, type, format,
   leads), the skills (up to three chips), Summary and Notes in the editor, and a Files panel. Delete asks and moves to the Trash.
3. **Research card**: hours this academic year of 200, and the latest entry.

### Academic year for Meetings too

One shared helper (`academicYearOf(date)`, the list of years present, "current year") used by both modules. Meetings gets an academic-year
selector in its list and on the landing page (series cards count meetings of the chosen year); it opens on the current year. Because it
helps Meetings on its own, it comes first (stage 1).

### Files panel (linked, never copied)

A setting **Trainings folder** is the root; `folder` is stored relative to it. The main process lists the folder, opens a file with the
default app or shows it in Finder, and refuses any path outside the root (`..`, absolute paths, symlinks that escape; tested). The app
never moves, renames, writes or deletes the user's files.

### Export (proposed)

The formal log is reported through Inkpath, so the first export should match its columns. Options, for the user to choose: **PDF**
(as the brief says; Electron `printToPDF`, no dependency); **Copy as table** (HTML plus tab-separated text, pastes into Word or a
spreadsheet); **.xlsx in the Inkpath column layout** (needs a small spreadsheet-writing dependency). All exclude upcoming entries and
cover the chosen academic year. The PDF helper is shared with the future supervision-log export.

## Stages (one or more small commits each; `npm run lint`, `typecheck` and `test` pass at every commit)

1. **Academic year** helper and a selector in the Meetings list and landing (with the remembered state). Useful on its own.
2. **Generalise the front matter code** (a pure move; the generic split, join and key-preserving update leave the Meetings module).
3. **Training core (main process):** module, migration `training/0001`, file naming, front matter, store (create, guarded save, Trash),
   repository, watcher, IPC, registration. Tests.
4. **Pure rules:** duration, academic year, hours per skill, progress, query, upcoming. Mutation checks on the totals and the upcoming
   exclusion.
5. **Entry page:** fields, the leads picker (the attendees control generalised to a people picker), skills, series, type, editor,
   delete.
6. **Training list and Research card.**
7. **Files:** setting, contained listing, open and reveal, panel. Containment tests including symlinks.
8. **Export** (the chosen formats).
9. **Import** (`npm run import:training`, dry run by default).
10. **Polish and docs** (brief section 9, focus rings and clipping, empty and error states, performance, README, DECISIONS, ROADMAP,
    shortcuts list entries, CLAUDE.md status).

Verification for every UI or data-flow stage: scratch library via `CENTRAL_COMMAND_HOME`, real app in dev and production, real keystrokes,
screenshots read, quit right after typing, stray processes killed.

## Import (proposed)

`npm run import:training -- --inkpath <the .xlsx> [--obsidian <folder>] [--trainings <folder>] [--word-log <docx>] [--apply]`. Dry run by
default; never `--apply` on the real library unless the user asks. Sources are never modified.

- **Primary source: the Inkpath workbook**, read by unzipping it and parsing the sheet XML (no new dependency). Each row becomes one entry:
  name to title, description to Summary, start and end times, skills, format from Attendance Type. Organisation, provider, points, date
  completed and the original type are kept in the front matter.
- **Supervisor and Lab meetings are left out** (they belong to Meetings) and listed. Their times are reported against the Meetings
  files so the user can correct them; nothing in Meetings is changed by this tool.
- **The Word log** is only a cross-check: entries with no Inkpath match are listed for the user to decide about; none is imported.
- **Reports, not guesses:** entries with more than three skills (the 5-skill one), hours that differ from the times (17), entries with no
  clear series, Provider values that look like people (candidates for leads; leads are added only with `--add-people` and the user's
  approval), Obsidian notes that could not be matched, folders that could not be linked.
- **Obsidian notes** are matched by date and title (folded), `**Lead**` becomes a lead, tags are dropped, the note's headings and text go
  under `## Notes` one level deeper, wikilinks become plain text. **Folders** are matched by the date at the start of the folder name or
  a date range that contains the entry's date, plus a title check; anything uncertain is reported.
- **Safety net:** the imported entry count and total minutes equal the source's (minus the meetings), every title, description and skill
  list equals its source cell, and every note's text survives; an entry that fails is left out and reported as ATTENTION. Existing
  entries (same date and title) are skipped; files are created exclusively and never replaced, so a second run writes nothing.

## Never (this module)

Never write to the Inkpath or Word files, the Obsidian vault or the Trainings folder. Never overwrite an entry file (saves check its
content hash). A deleted entry goes to the Trash after a confirmation. No user data over the network.

## Open questions for the user

1. **The type list.** `types1.png` could not be read (the read was declined). Please paste the list of types as text, or allow me to read
   the file. I need every option to propose the renamed, harmonised list and the mapping.
2. **Do supervisor and lab meetings count towards the 200 hours?** In Inkpath they are in the log. Proposed: no, they stay in Meetings.
   This year it does not change the outcome (334.5 h without them, 371.0 with).
3. **Series.** Is the starting list right (SEDarc, SENSS, LSE, DataCamp, Royal Holloway, Other)? What about the external ones (FRiLL,
   Experimental Psychology Society)?
4. **Skills.** Keep the `(GS)`, `(RP)`, `(SS)` tags in the names (proposed, they distinguish two "Quantitative Skills"), or show them
   another way? What do the three tags stand for, so the list can be grouped?
5. **Format.** Keep the Inkpath Attendance Type as In person / Online / (blank for self-paced), like Meetings?
6. **Leads from Provider.** Some providers are people. Should the import turn those into leads (adding them to the people list), or leave
   them for you?
7. **Export.** PDF, Copy as table, or an .xlsx in Inkpath's columns (adds a dependency)? Do you upload to Inkpath from a file?
8. **The 5-skill entry** breaks "up to three": keep three, or allow more for old imports?
