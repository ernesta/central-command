# Training module (and Meetings additions): plan

Status: **draft 3, revised after the user's answers. Nothing is built.** Read it with `CLAUDE.md`, `docs/DECISIONS.md` and the mockup
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
2. Type: the full Inkpath list, renamed slightly and harmonised so it is easy to choose (a proposal is in the Type section).
3. The list shows title and summary (the summary is the notes' `## Summary`, as in Meetings).
4. No days or per-type totals; hours, skills and the 200-hour aim instead.
5. The list matches the Meetings list: Date, Time, Duration, Series, Type, Title and summary, then Skills and Leads.
6. **Series** replaces "Programme" and behaves like a Meetings series (a chip and a filter). It starts with SEDarc and DataCamp.
7. **Leads** are people, several allowed, chosen exactly like meeting attendees from the shared people list.
8. Files are linked to existing folders, never copied.
9. **Skills**: up to three per entry, chosen from the skills in the log; hours per skill are the summary.
10. **Academic year** filter for both Training and Meetings.

## The user's answers to draft 2

- The full Inkpath type list was read (15 types); the user could not tell some of them apart, so this draft proposes plain names and asks
  about the unclear ones (see Type).
- **Meetings do not count towards the 200 hours** of Training. In practice Inkpath counts them, so **Meetings gets its own hours counter
  and skills**, the same as Training, and the Training page can mention them beside its own total.
- **Skills use one capitalisation** throughout (sentence case; see Skills).
- **Series starts with SEDarc and DataCamp only.** The user adds more later.

## Facts found by reading the user's real files (read-only)

**The Inkpath log** (`2025-26 Inkpath Training Log.xlsx`, one sheet, read by unzipping the workbook; no spreadsheet program needed):

- **166 entries, 371.0 hours**, Sep 23, 2025 to Jul 29, 2026 (not in date order). Every entry is a single day and has a start and end
  time, hours and skills. Columns: Name, Type, Attendance Type, Description, Organisation, Provider, Start Date, Start Time, End Date,
  End Time, Date Completed, Hours, Points, Skills, Notes. Dates are `dd/mm/yyyy`; descriptions can contain line breaks (21 do).
- **It includes 34 supervisor meetings (32.5 h) and 3 Rastle Lab meetings (4 h)**, which the Meetings module already holds. The user says
  these have the correct times (the Meetings import found four durations that disagreed with the Word log), so they are a source for
  correcting Meetings times. Without them the log is 334.5 hours, so even so the aim of 200 is passed this year.
- **The workbook's Type column says "Activity" in all 166 rows**, so the activity type of each entry is not in the file. The real list is
  Inkpath's "Activity Type (required)" dropdown, read from the user's two screenshots: 15 options (see Type). The import therefore cannot
  map old types; entries start without one, and the user chooses.
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
series: SEDarc # optional
type: Research methods course # from the harmonised list
mode: online # in-person | online, optional
skills: [Data management and analysis (GS), Ethical and legal issues (GS)] # up to three
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

- **Skills** are chosen from a fixed list (the 19 in the log; more can be added in code later), at most three per entry. The tags
  `(GS)`, `(RP)` and `(SS)` stay because they tell apart skills with the same name (the meaning of the tags is a question below).
- **One capitalisation: sentence case** (first word capitalised, the rest lower case; the tags stay upper case). The import maps each
  original name to its harmonised name by an exact, case-insensitive match, and an export restores Inkpath's original spelling. The
  original names and their harmonised forms:

  | Inkpath name                          | In the app                            |
  | ------------------------------------- | ------------------------------------- |
  | Quantitative Skills (GS)              | Quantitative skills (GS)              |
  | Quantitative Skills (SS)              | Quantitative skills (SS)              |
  | Qualitative Skills (GS)               | Qualitative skills (GS)               |
  | Qualitative Skills (SS)               | Qualitative skills (SS)               |
  | Data Management and analysis (GS)     | Data management and analysis (GS)     |
  | Digital and bibliographic skills (GS) | Digital and bibliographic skills (GS) |
  | Ethical and legal issues (GS)         | Ethical and legal issues (GS)         |
  | Impact of Research (GS)               | Impact of research (GS)               |
  | Intellectual Property Rights (GS)     | Intellectual property rights (GS)     |
  | Language Skills (GS)                  | Language skills (GS)                  |
  | Project management (GS)               | Project management (GS)               |
  | Career Development (RP)               | Career development (RP)               |
  | Personal Development (RP)             | Personal development (RP)             |
  | Stress Management (RP)                | Stress management (RP)                |
  | Cultural Understanding (RP)           | Cultural understanding (RP)           |
  | Impact (RP)                           | Impact (RP)                           |
  | Leadership (RP)                       | Leadership (RP)                       |
  | Negotiations (RP)                     | Negotiations (RP)                     |
  | Networking (RP)                       | Networking (RP)                       |

- **Totals strip** for the chosen academic year: **hours done of 200** with a thin progress bar (the aim is a setting, default 200),
  then **hours per skill**, largest first. Each entry counts fully towards each of its skills, so the skill hours add up to more than the
  total; the strip says so in one line. Below the total, a quiet line says how many hours of meetings there are in the same year
  ("plus 36.5 h of meetings, which Inkpath also counts"), so both numbers are visible without mixing them.
- No per-type totals. **Meetings are not counted in the 200.**

### Meetings: skills and an hours counter (new)

Meetings gets what Training has, without a target:

- **Skills** on the meeting page (the same chips, at most three, the same list) and a Skills column in the list. Stored as `skills:` in the
  meeting's front matter, which the Meetings code already preserves.
- **An hours counter** at the top of the Meetings list and landing page: hours this academic year (duration from start and end times;
  meetings without times count as zero and the strip says how many have none) and hours per skill.
- **The academic-year selector** (below) filters the list, the counter and the series cards.
- The 34 supervisor meetings and 3 lab meetings in the Inkpath log already carry skills and times; a reconciling tool (dry run, never
  guesses, writes only the `skills`, `start` and `end` keys through the guarded save) can copy them into the meeting files, and reports
  every disagreement with the times already there.

### Series (decided: start with two)

Like Meetings series: a chip on an entry, a filter in the list, and a card-style shortcut is possible later. **The list starts with
SEDarc and DataCamp.** The user adds more later (a series is added by typing a new name; nothing else needs code). **A series is
optional**, so entries that belong to neither have none. The import sets SEDarc when the Organisation is _SEDarc DTP_ and DataCamp when
the provider or title prefix is DataCamp, and leaves the rest without one (listed in the report).

### Type (proposed; the user's confirmation needed)

Inkpath has 15 activity types. Three of them read almost the same (Academic skills courses, Generic skills courses, Research-related
courses), which is where the choice gets hard. The proposal is a shorter list with plain names, grouped, each mapped to one Inkpath
type so an export can restore it. **The meanings marked "my reading" are a guess for the user to correct.**

| Group         | Name in the app         | Inkpath type                             | Plain description                                                          |
| ------------- | ----------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| Courses       | Research methods course | Research-related courses                 | Methods, statistics, research design, data and software (my reading)       |
| Courses       | Academic skills course  | Academic skills courses                  | Writing, presenting, publishing, CV (my reading)                           |
| Courses       | General skills course   | Generic skills courses                   | Skills useful beyond research: wellbeing, leadership, careers (my reading) |
| Courses       | Language course         | Language courses                         | Learning a language                                                        |
| Conferences   | Conference: attending   | Conference Guest                         | You went as a visitor                                                      |
| Conferences   | Conference: presenting  | Conference Speaker / Contributor         | A talk, poster or paper                                                    |
| Conferences   | Conference: organising  | Conference Organisation Team             | You helped run it                                                          |
| Work          | Fieldwork               | Fieldwork                                | Collecting data in the field                                               |
| Work          | Placement               | Work placements or work-related projects | A placement or a project done as work                                      |
| Work          | Shadowing               | Shadowing                                | Following someone at work                                                  |
| Work          | Volunteering            | Volunteering                             |                                                                            |
| Contributions | Peer review             | Peer reviews                             | Reviewing someone's paper                                                  |
| Contributions | Publication             | Publications                             | Submitting or publishing a paper or chapter                                |
| Meetings      | Supervisor meeting      | Supervisor/PI/manager meeting            | For Meetings; not offered in the Training list                             |
| Other         | Other                   | Other                                    |                                                                            |

**Not covered by any Inkpath type:** seminars, inductions, lab meetings, and self-guided learning such as DataCamp. The user maps those
by hand, so the app adds no types of its own for them. The user will keep a decision log of these mappings so that the app can learn to
categorise them automatically later (a follow-up, not built now). The app keeps one field with the app name; the Inkpath name is only a mapping, never a second field to
maintain.

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

1. **Academic year and skills, first for Meetings** (useful on its own): the shared academic-year helper and the skills list
   (`src/shared/`), the academic-year selector in the Meetings list and landing, `skills` on the meeting page and in the list, and the
   Meetings hours counter with hours per skill. Existing meeting files are not touched.
2. **Generalise the front matter code** (a pure move; the generic split, join and key-preserving update leave the Meetings module).
3. **Training core (main process):** module, migration `training/0001`, file naming, front matter, store (create, guarded save, Trash),
   repository, watcher, IPC, registration. Tests.
4. **Pure rules:** duration, hours per skill, progress towards the aim, query, upcoming. Mutation checks on the totals and on the upcoming
   exclusion.
5. **Entry page:** fields, the leads picker (the attendees control generalised to a people picker), skills, series, type, editor, delete.
6. **Training list, its totals strip and the Research card.**
7. **Files:** setting, contained listing, open and reveal, panel. Containment tests including symlinks.
8. **Export** (the chosen formats).
9. **Import** (`npm run import:training`, dry run by default) and **the Meetings reconciliation** (`npm run reconcile:meetings`).
10. **Polish and docs** (brief section 9, focus rings and clipping, empty and error states, performance, README, DECISIONS, ROADMAP,
    shortcuts list entries, CLAUDE.md status).

Verification for every UI or data-flow stage: scratch library via `CENTRAL_COMMAND_HOME`, real app in dev and production, real keystrokes,
screenshots read, quit right after typing, stray processes killed.

## Import (proposed)

`npm run import:training -- --inkpath <the .xlsx> [--obsidian <folder>] [--trainings <folder>] [--apply]`. Dry run by default; never
`--apply` on the real library unless the user asks. Sources are never modified.

- **Primary source: the Inkpath workbook**, read by unzipping it and parsing the sheet XML (no new dependency). Each row becomes one entry:
  name to title, description to Summary, start and end times, skills (mapped to the harmonised names by an exact, case-insensitive match;
  an unknown skill is reported and left out of the entry, never invented), format from Attendance Type. Organisation, provider, points
  and date completed are kept in the front matter.
- **Type is left empty** (the workbook does not hold it) and the report counts the entries without one, for the user to fill in the app.
- **Series:** SEDarc when the Organisation is SEDarc DTP, DataCamp when the provider or title prefix is DataCamp; otherwise none.
- **Supervisor and lab meetings are left out** (they belong to Meetings) and listed. `npm run reconcile:meetings` (dry run by default)
  compares them with the meeting files by date and series and, only with `--apply`, adds `skills` and missing times through the guarded
  front matter save; it reports every time that differs and never overwrites one.
- **The older Word log** is not imported. If wanted, a list of its entries with no Inkpath match can be printed for the user to judge.
- **Reports, not guesses:** entries with more than three skills (one has five: keep three, or list the extras in the report), hours that
  differ from the times (17), Provider values that look like people (leads are added only with `--add-people`), Obsidian notes that
  could not be matched, folders that could not be linked.
- **Obsidian notes** are matched by date and title (folded), `**Lead**` becomes a lead, tags are dropped, the note's headings and text go
  under `## Notes` one level deeper, wikilinks become plain text. **Folders** are matched by the date at the start of the folder name or a
  date range that contains the entry's date, plus a title check; anything uncertain is reported.
- **Safety net:** the imported entry count and total minutes equal the source's (minus the meetings), every title, description and skill
  list equals its source cell, and every note's text survives; an entry that fails is left out and reported as ATTENTION. Existing
  entries (same date and title) are skipped; files are created exclusively and never replaced, so a second run writes nothing.

## Never (this module)

Never write to the Inkpath or Word files, the Obsidian vault or the Trainings folder. Never overwrite an entry file (saves check its
content hash). A deleted entry goes to the Trash after a confirmation. No user data over the network.

## Decided and open

**Decided:** meetings are not counted in the 200 hours and have their own counter and skills; skills use sentence case; series starts with
SEDarc and DataCamp and is optional; hours come from the times; files are linked; the aim is 200 hours per academic year.

**Open questions for the user**

1. ~~Which type for a seminar, an induction, a lab meeting and self-guided learning?~~ Decided: the user maps them by hand, the app adds
   no extra types, and a decision log will support automatic categorising later.
2. **Do my readings of the three course types match yours?** Research-related (methods, statistics, data, software), Academic skills
   (writing, presenting, publishing, CV) and Generic skills (wellbeing, leadership, careers). Tell me where I am wrong, or say whether
   you would rather have just one "Course" type in the app and pick the Inkpath type only when you export.
3. **What do the skill tags (GS), (RP) and (SS) stand for?** They let the skills list be grouped, and I do not want to guess.
4. **Format.** Keep Inkpath's Attendance Type as In person / Online / blank for self-paced, like Meetings?
5. **Leads from Provider.** Some providers are people. Should the import turn those into leads (adding them to the people list) or
   leave them for you?
6. **Export.** PDF, Copy as table, or an .xlsx in Inkpath's columns (adds a small dependency)? Do you upload to Inkpath from a file?
7. **The entry with five skills** breaks "up to three": keep three, or allow more for old imports?
8. **Meetings counter target.** Meetings has no aim of its own. Should the Training page show the "plus N hours of meetings" line
   (proposed), or would you rather see the two counters only on their own pages?
