# Hours and Time off: plan

Status: **designed, not built** (29 Sep 2026). Read it with `CLAUDE.md` and `docs/DECISIONS.md`. Meetings and Training are the patterns to copy
(`docs/MEETINGS_PLAN.md`, `docs/TRAINING_PLAN.md`). "Proposed" means the user has not confirmed it; the open questions are at the end, each with the
default to use if the user does not answer.

## What the user does today (read from the two Google Sheets, 29 Sep 2026)

Two workbooks, one per tracking year, with the same two tabs. The user has 2025–26 (`Study Hour Tracker` and `Time Off Tracker`, 363 day rows,
1,527.5 h) and 2026–27 (started Mon 21 Sep 2026). Copies of the exported .xlsx files are in the session scratchpad
(`old.xlsx`, `new.xlsx`); the importer takes paths, so the user can also download them again.

**Study Hour Tracker**

- **Columns A–B: one row per day, newest first** (`Date`, `Hours`). Hours are typed at the end of the day as a total, in quarter hours
  (`7.75`); a few are typed as sums (`=9.25+0.5+1.25`). Days off are `0` or empty.
- **Columns D–H: one row per week, Monday to Sunday**, numbered downwards (Week 52 … Week 1):
  - `Hours` = sum of that week's seven days.
  - `Days` = the number of **planned working days**, typed by hand (5 normally, 3 or 0 in a week with leave or holidays).
  - `Plan` = `Hours − 7.5 × Days`: the balance for the week (plus is ahead, minus is behind).
  - Top row `Total`: total hours, total days, total balance, and `Average` = `Hours ÷ Days × 5`, an average week.
- **Columns J–M: a scratch area for today.** Start and end times typed as `HHMM` numbers (`1030`, `1215`), a duration (`1.75`), and a task
  label ("Prepare a presentation for lab meeting…"). A row with a start and no end (`1449`) is a running session. The column total (`L1`) is
  the day's tracked time. The user then **copies the total into the day's `Hours`** and **copies the specific timings into their task
  tracker**. The area is cleared or overwritten daily. Column M also holds a few loose notes next to dated rows ("send rabia ai stuff",
  "look at inkpath").
- **The year is 52 weeks starting on a Monday** (22 Sep 2025 to 20 Sep 2026; then 21 Sep 2026 to 19 Sep 2027). That is **not** the app's academic year
  (1 Sep to 31 Aug); it looks like a contract or funding year.
- **Numbers for the year so far, 2025–26:** 1,527.5 h over 220 planned days, balance −122.5 h, average week 34.7 h.
  The weekly plan is 37.5 h (7.5 h × 5).

**Time Off Tracker** (`Year`, `Away Date`, `Done`, `Type`, and a small summary block)

- One row per day away: 2025–26 has 15 dated holidays; 2026–27 has 16 rows so far. `Type` is Public Holiday or University Holiday; `Done` is Yes or No.
- The summary counts are **typed by hand**, not calculated from the rows: allowance `40`, used `14` (8 public + 6 university), left `26`.
  The 2026–27 list has 10 public-holiday rows but the typed count says 8: two rows are 27 and 28 Dec 2027, outside the year, so the typed count
  is right and the list is wrong. The app should count from the rows and refuse dates outside the year.
- **Annual leave in 2025–26 is not dated**: four monthly blocks (1 Apr: 9 days, 1 May: 2, 1 Jul: 2, 1 Sep: 11) beside the holidays;
  15 + 24 = 39 of 40 days used.
- **A leftover is credited as hours**: "Remainder added to hour tracker (Sep 20, 2026)". The last day of 2025–26 has 7.5 h typed:
  the 1 unused day, at 7.5 h.
- Holiday dates come from the university's term-dates page (typed in by hand; the app does not fetch anything).

**Where the pain is:** double entry (times → task tracker, total → hours), planned days typed by hand although the time-off list already
implies them, counts typed by hand and wrong once, a weekly and yearly balance that punishes a week that is still in progress, tasks that are
only free text next to the hours, and a new workbook every year.

## What the user asked for

1. Personal use, not for reporting; the user **loves tracking and wants to see the data**. No exports.
2. Sessions (specific timings) will later **connect to Tasks**: one entry feeds both the task's time and the day's hours.
3. Tasks come later; then a session's task is chosen from **existing tasks only**. Not built now.
4. **Time off** is a **separate feature**, built after Hours.

## Design (proposed)

### Two modules in Research, one data core

- **Hours** (`id: hours`, Research) and **Time off** (`id: time-off`, Research) are two module manifests. Each has its own landing card and page.
  Hours reads Time off (planned days) and Time off reads Hours' year (dates), so the year data lives in shared machinery, not in either module:
  `src/main/tracking/` (store) and `src/shared/tracking/` (pure rules), like the shared notes machinery.
- Not per workspace for now. If Work ever wants its own, it becomes `createHoursModule(workspace)` like Meetings; do not build that now.

### The tracking year

- A **tracking year** starts on a Monday and is **52 weeks** long. It is named by its start year, `2026–27`. The user sets the start when
  the year is created; the next year defaults to start + 52 weeks (21 Sep 2026 + 364 days = 20 Sep 2027, as the sheets did).
- **Do not reuse `academic-year.ts`** (1 Sep to 31 Aug). It is a different concept; give the new one its own small module, and do not call it
  "academic year" in the UI. Weeks run Monday to Sunday and are numbered from 1 in the year (the sheet numbers downwards; the app counts up).
- Opening the app in a new year with no file for it creates one with the defaults (never asks first) and says so once.

### Data: one plain file per tracking year

- `~/CentralCommand/time/2026-27.json`, human-readable, never a database table: it is the user's data, the future backup zips it, and it
  matches the Meetings and Training rule that files are the truth. Written atomically and guarded by a content hash like the notes files
  (check `src/main/atomic-write.ts` and `src/main/notes/` for what fits JSON). A corrupt file is set aside, never overwritten (as `settings.ts` does).
- Contents (all dates `YYYY-MM-DD`, times `HH:MM`, durations in whole **minutes** so there is no rounding drift):

```
{
  "version": 1,
  "start": "2026-09-21",                       // a Monday; the year is 52 weeks
  "plan": { "hoursPerDay": 7.5, "allowanceDays": 40 },
  "sessions": [ { "id": "k3f9a2x1", "date": "2026-10-01", "start": "10:30", "end": "12:15" | null,
                  "label": "Prepare a presentation for lab meeting", "task": "<uid>" | absent } ],
  "days": { "2026-09-28": { "extraMinutes": 465, "note": "look at inkpath" } },
  "timeOff": [ { "date": "2026-12-24", "type": "university" } ],
  "weekDays": { "2025-09-22": 5 }              // only for imported history: planned days typed in the old sheet
}
```

- **A day's total is its sessions plus `extraMinutes`.** Sessions are what the user records from now on; `extraMinutes` holds imported
  history (only a total was ever typed), and adjustments such as the leftover-leave credit. There is no way to disagree with itself, as with Meetings' hours (no typed
  hours field next to the times). The UI's word for extra minutes is "Added time".
- **Session rules:** at most one running session (`end: null`); a session does not cross midnight. A session still running from an earlier day
  is shown as "Started yesterday 14:49, set an end time" and does not count until it has an end. Overlapping sessions are allowed but flagged
  (the user may forget to stop). Starting a session writes the file immediately and synchronously (the lost-keystrokes lesson: quitting right
  after Start must not lose it); a running session survives quitting the app.
- **Unknown keys survive every save**, as in front matter.

### Rules (pure functions in `src/shared/tracking/`, all unit-tested)

- `plannedDays(week)`: Mon–Fri days of the week that are not in `timeOff` (weekend dates in `timeOff` are ignored), or `weekDays[weekStart]` when
  present. Replaces the typed `Days` column.
- `weekPlanMinutes = plannedDays × hoursPerDay × 60`; `weekBalance = hours − plan`; the **year balance** and **average week**
  (`hours ÷ plannedDays × 5`) keep the sheet's formulas, so the imported 2025–26 numbers match the sheet exactly (a test against
  1,527.5 h, 220 days, −122.5 h, 34.716).
- **Change from the sheet: the current week's plan counts only the days up to and including today** (the sheet subtracts a whole week's plan
  on Monday, so the balance reads −29.75 h before the week has happened). Future weeks are not in the balance at all; the year
  plan total (52 weeks) is shown separately. Decide at build time how a partly finished _today_ is treated (default: today's plan counts
  from the moment there is any time on it, or at the day's end).
- `timeOffCounts(year)`: booked and taken per type, counted **from the rows that fall inside the year**; a row outside the year is refused
  when added and reported by the importer. `left = allowanceDays − booked`. "Taken" is derived (date before today), so there is no
  `Done` column to keep up.

### Hours page (Research → Hours)

The shape of the existing pages: a landing with a card and a full page, the shared landing component, the shared `HoursStrip` where it fits,
plain CSS with tokens (both themes: every colour a `light-dark()` pair), Lucide icons, no gradients.

```
Hours                                   2026–27 ▾   (year select)
┌ Today · Tue 29 Sep ──────────────────────────────┐   ┌ This week (Week 2) ──────────────┐
│  [ What are you working on?          ] [ Start ] │   │ bars Mon…Sun vs 7.5 h line       │
│  10:30–12:15   1.75 h  Prepare a presentation…   │   │ 7.75 h of 37.5 h · 5 days planned │
│  14:49–        running 0:21  Deck        [ Stop ]│   └──────────────────────────────────┘
│  Total 2.10 h                    Add time…       │   ┌ Year ────────────────────────────┐
└──────────────────────────────────────────────────┘   │ Balance −24.75 h · Average 25.1 h │
Sessions, earlier days (a day's list, edit times inline)  │ 50.25 h of 1,950 h planned         │
Charts (below, one column): …                          └──────────────────────────────────┘
```

- **Start** is the only choice: a label field (optional) and one button. The label suggests earlier labels as you type (the user repeats them);
  once Tasks exist it becomes a task picker (`@`-style, reusing `EntityPicker`), limited to existing tasks as the user described.
  One-word buttons: Start, Stop, Add, Delete. Session times edit inline with the same time fields as Meetings. Deleting a session uses the
  shared confirmation; nothing pops up before creating one.
- **Data views** (the user wants to see the data), hand-drawn SVG from tokens, no chart library, one dataviz pass over all of them
  (use the `dataviz` skill when building):
  1. **Weeks of the year:** a bar per week against the 37.5 h line, over and under in two token colours, the current week outlined.
  2. **Balance over time:** a line of the running year balance.
  3. **Days calendar:** a heat map of the year, weeks as columns, days as cells, time-off days marked differently from zero-hour days.
  4. **Typical week:** average hours per weekday.
  5. **Time of day** (only once sessions exist): when the work happens. Later, with tasks: hours per task.
     Every chart has the numbers as text beside it or in a hover, so it is readable without colour.
- A day's row can carry a short **note** (the sheet's loose column M).

### Time off page (Research → Time off, built after Hours)

- A list for the year: Date, weekday, Type, Status (Upcoming or Taken), the same table and landing pattern as Training. One summary line:
  `40 days · 14 booked · 26 left`, then per type.
- **Add** takes a date or a range (weekends skipped, dates outside the year refused). Types start as **Public holiday**, **University holiday** and
  **Annual leave**; more are added in Settings, as Training's series are. "Done" is not a field (see above).
- **Effect on Hours:** each weekday listed lowers that week's planned days and plan, and shows on the Days calendar.
- **Year end:** when unused days remain, one button, "Credit N days as hours", adds N × hoursPerDay to the year's last day as _Added time_
  with a note, the same as the user's manual "Remainder added to hour tracker". Nothing happens automatically.
- The landing card shows days left and the next day off.

### Tasks, later (no schema change)

- A session's optional `task` is an entity key (`cc://task/<uid>`), so Tasks add one kind to `ENTITY_KINDS` in `src/shared/entities.ts` and one
  provider in a module manifest, exactly as `docs/DECISIONS.md` ("Entities") describes. A task's time is the sum of the sessions that point at it,
  so the timings are entered **once** and Hours and Tasks both read them. The `label` stays for history and for sessions with no task.
- The picker's "existing tasks only" rule is a change to the Start row when Tasks land, not a data change.

### Around the pages

- **Landing card** for Hours: today's total, the running session if any, this week against plan. Time off: days left, next day off.
- **Running timer everywhere:** a small chip in the top bar (elapsed time, click to stop) mounted through the manifest's `globals`, a Dock
  menu item "Start/Stop timer", and palette commands "Start timer" and "Stop timer". If the user wants a shortcut, add it to `shortcuts` in
  the manifest and Settings (check for a free chord first).
- **Settings** gets an "Hours" tab: hours per day, allowance days, the start of the year, time-off types.
- Search (Mod-K): sessions' labels are not searched at first; Time off has nothing to search.

### Import (`npm run import:hours -- --old <xlsx> --new <xlsx> [--apply]`)

Dry run by default, reads .xlsx with Node built-ins (reuse the Training importer's reader), and follows the CLAUDE.md importer rules.

- **2025–26:** every day's hours become `extraMinutes`; the typed weekly `Days` become `weekDays` (the dates the leave blocks cover are unknown);
  the 15 dated holidays become `timeOff`; the four leave blocks become `timeOff` rows of type Annual leave dated the first of the month with a
  day count (a small `days` field, used only by import); the 7.5 h remainder on 20 Sep 2026 stays as Added time with the sheet's note.
- **2026–27:** daily hours as above; the 14 holidays in the year; the two rows dated Dec 2027 are **left out and reported**.
  The scratch area's sessions have no date in the sheet, so they are **reported and not imported**; the user says which day they belong to.
  Loose notes beside dated rows (M14, M15) become day notes.
- **Safety check** (like the other importers): read the result back and compare with the sheet's own numbers: total hours, planned days, the
  balance and the average, each week's hours, and the time-off counts. A year that fails is left out as ATTENTION. Dry-run against the real files
  and read every line before anything is applied; never `--apply` on the real library unless the user asks.

## Stages (one small commit per stage, or per standalone part of one)

1. **Rules:** `src/shared/tracking/` (year and weeks, planned days, day and week totals, balance and average, time-off counts) with tests,
   including the sheet's real numbers. Mutation-check the rules that protect data (outside-year refusal, one running session, no midnight crossing).
2. **Store:** the year file in `src/main/tracking/` (atomic, guarded, corrupt file set aside, unknown keys kept, new year created on demand),
   IPC and `Api` methods, tests. A running session persists across a simulated quit.
3. **Importer:** built and tested, then **dry run on the real files; stop and show the user the output**. Do not apply without their go-ahead.
4. **Hours page:** Today (Start, Stop, add, edit, delete), the week, the year strip, year select, Settings tab. Drive it in the real app (below).
5. **Data views:** the charts above, one at a time, each looked at in light and dark.
6. **Time off:** store methods, page, Settings types, the link to planned days, the year-end credit.
7. **Around the pages:** landing cards, top-bar timer chip, Dock item, palette commands, shortcuts entry if any.
8. **Polish and QA, then docs:** `docs/DECISIONS.md` ("Hours and Time off"), `docs/ROADMAP.md`, `CLAUDE.md` (status, the new import command).

**Testing for real** (CLAUDE.md): a scratch library with `CENTRAL_COMMAND_HOME`, Playwright, the built app and dev mode. Type real keystrokes into the
label; Start then quit immediately and reopen (the session must still be running); Stop after a relaunch; a session left running overnight
(change the clock in a test, not the machine); focus rings while tabbing every screen; screenshots of every screen in light and dark, with the
charts checked for clipping and contrast, not only that they render.

## Open questions (default in bold; the user answers before or during the build)

1. **Is the year a contract or funding year that starts on a Monday and lasts 52 weeks?** Default: **yes**, next start = this start + 52 weeks, editable in Settings.
2. **The unused-leave credit:** is it a rule (unused days count as worked hours, at 7.5 h a day) or a one-off? Default: **an optional button at year end**, as above.
3. **Old-year leave** was only counted by month. Default: **import as four rows with a day count** (above); the alternative is to skip old-year leave.
4. **Partly finished weeks:** default: **plan counts up to today** (a change from the sheet's whole-week subtraction). The user may prefer the sheet's way.
5. **Are there other kinds of time off** (sick, conference, unpaid)? Default: **Public holiday, University holiday, Annual leave**, more in Settings.
6. **Should hours be shown as decimals (7.75 h) or as 7:45?** Default: **decimals, like the sheets**, with h:mm on hover.
7. **Work workspace:** is this Research only? Default: **yes**.
