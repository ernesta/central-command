# Training entries: consistency and overlaps (plan, 17 Oct 2026)

The user's feedback on Trainings, agreed in conversation. Nothing here is built yet.

**Standing exception to CLAUDE.md (the user's explicit instruction, 17 Oct 2026):** the user is away while this is built, so do all three stages in one go,
without stopping between them. Still one small commit per standalone part, and all of test, lint and typecheck must pass before each commit. Do not push.

## The feedback

1. The "Recent and upcoming" row on the Training landing shows random information: only the start time on an upcoming row, only the duration and mode on a past
   row. Show the same things every time: start and end time, duration and type of attendance (in person, online, self-paced).
2. The user is warned when a training overlaps an hours entry, but two overlapping trainings gave no warning at all.
3. These are examples. Find and address other inconsistencies in Training entries yourself (stage 3).

## What was found

**Row format** (`noteFor` in `src/modules/training/renderer/TrainingLanding.tsx`): an upcoming row returns `row.start ?? 'No time yet'`; a past row returns
`duration · mode`. `RecentRow.note` (`src/renderer/src/components/Landing.tsx`) is a single string. `TrainingTable` has Time and Duration columns but no mode.
`TrainingCard` ("Latest:") shows only title and date. `formatTimeRange` already exists in `@shared/time`.

**Overlaps:** the warning is `MeetingHoursNote` (uses `useMeetingClashes` and the pure `overlapping` in `src/modules/meetings/shared/meeting-entries.ts`), drawn
only inside `LectureHours`, which is drawn only when the entry has a task (`meta.task`, set when a series is chosen; the 129 older notes have none). Its
comparison set, `useMeetingEntries` -> `lectureEntries`, keeps only trainings with a task, a date not after today and both times. So two trainings with no
series, or on upcoming dates, never warn. Meetings are likely to have the same task dependency (check).

## Stage 1: one row format everywhere

- A shared pure helper (training `shared/`, with tests) returns the parts of a row's time line: the range (`09:30–15:00`), the duration (including self-study
  as `entryMinutes` does) and the mode label. The text is `09:30–15:00 · 5 h 30 min · In person`. **Agreed with the user.**
- Missing pieces: no times -> "No time yet" (the rest is left out); no mode -> the part is left out, never an empty separator; an end time without a start
  is treated as no times. Upcoming and past rows use the same helper, so an upcoming row shows its planned duration too.
- Use it in the landing's Recent and upcoming list and in the series page if it has such rows. The Training table keeps its Time and Duration columns and gets a
  Mode column (Research and Life); keep the column order rule "Type before Series" from `docs/ROADMAP.md`.
- `TrainingCard`'s "Latest:" line stays as is unless the audit in stage 3 says otherwise.
- Check the Meetings landing for the same inconsistency and fix it with the same pattern if it is there (Meetings has no type of attendance beyond
  in person/online: use what it has).
- Tests: every row state (upcoming/past, times/no times, mode/no mode, self-study) gives the same parts in the same order.

## Stage 2: overlap detection that does not depend on a task

- A pure function (shared, tested) takes every training and meeting note of a workspace and returns, for one note, the others on the same date whose
  `[start, end)` overlaps. It needs only a date and both times: **no task, no series, upcoming dates included**. Touching times (09:00-10:00 next to
  10:00-11:00) do not overlap. Reuse `overlapping` and `noteKey` (a meeting and a lecture of one name stay two things).
- `useMeetingClashes` keeps its timer and typed-block sources and adds this broader set of notes in place of the task-only `useMeetingEntries` source.
  Check Meetings with the same change: a meeting without a task should warn too (record the behaviour change in `docs/DECISIONS.md`).
- The warning shows on the training entry page whenever the entry has a date and both times, not only inside `LectureHours`. Move or duplicate
  `MeetingHoursNote`'s clash line so it is drawn independently of the task card; the "No hours until it has a start and end" line stays tied to the task.
  Keep the existing wording: "Overlaps <label> <start>-<end>."
- **Entry page only, as decided by the user: no markers on the table, the landing or the card.**
- Tests: two overlapping trainings with no task; upcoming dates; touching times; a training against a meeting; a training against an hours block (still
  works); an entry never against itself. **Mutation check** (CLAUDE.md, safety-style logic): break the comparison (`<` to `<=`, drop the self exclusion, drop
  the date filter) and confirm a test fails.

## Stage 3: audit for other issues

- Read every Training screen for the same kind of inconsistency: landing, table (list), series page, entry page and its meta fields and Task card, the plan
  page, `TrainingCard`, search results, the person page's training list, the Export PDF (`report.ts`), Life's variant. Look for different labels or order of
  the same fact, a different empty state for the same missing thing, date/time/duration formats that differ, a missing mode or type, sort order differences
  (`compareNewestFirst`) and other places where a feature depends on the task or series without saying so.
- Fix what is clearly the same bug class (inconsistent display of the same fact, a silent dependency on a task). **Do not fix, but list in
  `docs/ROADMAP.md` for the user,** anything that needs a decision (new fields, changed rules, removed features), and anything that touches the user's data.
- Write what was found and done in `docs/DECISIONS.md`.

## Verification (every stage)

- `npm test`, `npm run lint`, `npm run typecheck` pass.
- Drive the app for real in a scratch library (CLAUDE.md, "Testing the app for real"): `CENTRAL_COMMAND_HOME=<scratch>`, never the real library, Playwright in
  a scratch folder. Create trainings with real keystrokes: two overlapping ones with no series, one past and one upcoming; check the landing rows and the table
  in the production build and dev mode, dark mode too, and look at the screenshots. Close your own app with `app.close()`; check `pgrep -fl electron` before any
  `pkill`.
- Update `docs/DECISIONS.md` and `docs/ROADMAP.md` (the user's review items: the new row format, the Mode column, the overlap warning).
