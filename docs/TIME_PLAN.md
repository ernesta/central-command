# Hours and Time off: plan

Status: **designed; mockup in review (round 2, 29 Sep 2026); not built.** The mockup is `docs/design/hours-mockup.html` (open it in a browser: four
screens, light and dark). Read it with `CLAUDE.md` and `docs/DECISIONS.md`. Meetings and Training are the patterns to copy
(`docs/MEETINGS_PLAN.md`, `docs/TRAINING_PLAN.md`). Everything below is decided with the user unless it is under "Still open".

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
  **The sheet disagrees with itself:** the 364 daily rows add up to 1,523.5 h (three dates are missing: 27 and 28 Sep and 26 Oct 2025), but the
  weekly total says 1,527.5 h. Week 5's formula range overlaps its neighbour's, so 4 h are counted twice (the sheet says 49 h, the days say 45 h).
  The true balance is −126.5 h, not −122.5 h. The importer must use the daily rows and report the difference; the "matches the sheet" test
  below compares against the daily rows, with this one known 4 h difference written into the test.
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

## What the user decided (29 Sep 2026)

**Answers to the first seven questions**

1. The year is a contract or funding year: 52 weeks from a Monday, the next starting 52 weeks later, editable in Settings.
2. **No year-end credit feature**: the user adds the leftover as hours by hand if needed.
3. **Annual leave for 2025–26 has exact dates**, which the user will give; they are added in the app (Time off → Add), not by the importer.
4. **The balance counts the plan up to today** (today included), not the whole week or year.
5. **Time off has three types only**: Public holiday, University holiday, Annual leave. No types setting.
6. **Times are shown as hours and minutes, `7:45`**, never as decimals, everywhere (lists, charts, the chip).
7. **Work gets Hours and Time off too, but its setup differs a little; do it later.** Build Research first and keep everything per workspace
   (see Modules).

**Feedback on the first mockup**

- **Task-level time is never finer than 15 minutes**, always rounded to the nearest quarter hour, with the rounding remainder carried
  forward so the total is never over- or under-reported (see "The timer and the rounding").
- **The hours list has no "what": only the day and the time worked.** The daily aim is 7:30 on a work day.
- **Start/stop is loved.** The user switches back and forth between tasks all day, so the day shows **how much per task, not when**.
  Start and end times may stay in the file but are not shown.
- **"Running / Stopped" was confusing**: it was only a mockup switch. The real page has no such control; the running task is simply marked.
- **The long list of every day does not scale**: replaced by one week at a time with arrows, a heat map that opens a week, and a compact
  table of all weeks on the charts page.
- **Time off must show booked vs taken vs left to book.**
- **The top-bar timer chip is loved, but real task names are long** (for example "Prepare a presentation for lab meeting with Michael
  Crawford"): the chip cuts with an ellipsis and a click opens the full name, a Switch list and Stop.

## Design

### Modules

- **Hours** (`id: hours`) and **Time off** (`id: time-off`) are two module manifests, each with a landing card and its own pages, created by
  factories per workspace like Meetings and Notes (`createHoursModule(workspace)`, `createTimeOffModule(workspace)`). **Only Research is
  registered now.** Work is one more line in `src/modules/index.ts` plus its own settings once the user has explained how it differs (open
  question 1); do not build it yet, but do not hard-code "research" anywhere either.
- Hours reads Time off (planned days) and Time off reads the year's dates, so the data lives in shared machinery, not in either module:
  `src/main/tracking/` (store) and `src/shared/tracking/` (pure rules), like the shared notes machinery.
- **One timer for the whole app** (a person works on one thing at a time), even with two workspaces: starting a task in Work while one runs in
  Research switches the timer, and the chip names the workspace when it is not the current one.

### The tracking year

- Starts on a Monday, **52 weeks**, named by its start year (`2026–27`). The next defaults to start + 52 weeks (21 Sep 2026 + 364 days = 20 Sep
  2027). **Do not reuse `academic-year.ts`** (1 Sep to 31 Aug) and do not call it "academic year" in the UI. Weeks run Monday to Sunday and
  are numbered from 1.
- Opening the app in a new year with no file creates one with the defaults, without asking, and says so once.

### Data: one plain file per workspace and year

- `~/CentralCommand/time/<workspace>/2026-27.json`: human-readable, never a database table (the user's data; the future backup zips it; it
  matches the rule that files are the truth). Atomic writes guarded by a content hash like the notes files (check `src/main/atomic-write.ts` and
  `src/main/notes/` for what fits JSON); a corrupt file is set aside, never overwritten (as `settings.ts` does). Unknown keys survive every save.
- All dates `YYYY-MM-DD`; a session's times are kept **to the second** (`HH:MM:SS`) so nothing drifts:

```
{
  "version": 1,
  "start": "2026-09-21",                         // a Monday; the year is 52 weeks
  "plan": { "hoursPerDay": 450, "allowanceDays": 40 },   // minutes: 7:30
  "sessions": [ { "id": "k3f9a2x1", "date": "2026-09-29", "start": "14:49:12", "end": "15:10:40" | null,
                  "label": "Prepare a presentation for lab meeting with Michael Crawford", "task": "<uid>" | absent } ],
  "adds": [ { "id": "…", "date": "2026-09-29", "label": "Deck", "minutes": 30 } ],      // typed time, multiples of 15
  "days": { "2026-09-28": { "minutes": 465, "note": "look at inkpath" } },               // imported history: a typed total
  "timeOff": [ { "date": "2026-12-24", "type": "university" | "public" | "leave" } ],
  "weekDays": { "2025-09-22": 5 }                // imported history only: planned days typed in the old sheet
}
```

### The timer and the rounding (the core rule; pure code in `src/shared/tracking/`, the most tested part)

- **Start** begins a session for a task label; **starting another task stops the running one at the same instant** (one write), so switching is
  one click. **Stop** ends it. At most one session runs. A session does not cross midnight: one still running from an earlier day shows
  "Started yesterday 14:49. Set an end time." on Today and counts only once it has an end. Starting a session writes the file immediately and
  synchronously (the lost-keystrokes lesson: quitting right after Start must not lose it); a running session survives quitting the app.
- **What is reported is always a multiple of 15 minutes, computed as a running total, not block by block.** Let `E` be the exact minutes of all
  sessions in the tracking year, in order, and `R = round15(E)` (nearest 15, halves up). A session's reported time is `R(after it) − R(before it)`,
  given to its task. So the year's reported total is always exactly `round15(exact total)`: it is never more than 7½ minutes off, however often
  the user switches. The carry, `E − R`, is the user's "running counter"; it is derived, never stored or shown.
- Consequences to accept: a 2-minute block can show 0:00 or 0:15 depending on where the carry stands (that is what keeps the total true);
  editing or deleting an earlier session can move later days by a quarter hour, because everything after it is re-derived on read (nothing
  stores reported time). If this bothers the user later, freeze each day when it ends.
- **A day shows one row per task** (same label after trimming and ignoring case; the first spelling wins), in the order first used, so rows do
  not jump while switching. Task, day and week totals are all sums of these reported quarter hours.
- **Adds** (typed time for a task, in 15-minute steps) and **imported day totals** are already whole quarters: they count in the day but do not
  touch the carry.
- The running task's row shows the reported time so far (it changes in quarter-hour steps). The **clock** in the chip and on Today's running row is the
  timer itself: hours and minutes since this block started, ticking (the one place exact time is shown; see "Still open" 2).

### Rules (pure functions in `src/shared/tracking/`, unit-tested)

- `plannedDays(week)`: Mon–Fri days not in `timeOff` (weekend dates in `timeOff` are ignored), or `weekDays[weekStart]` when present. The daily aim
  is `hoursPerDay` (7:30) on a planned day; weekends and days off have no aim, and time worked on them still counts as hours.
- `weekPlan = plannedDays × hoursPerDay`; `weekBalance = hours − plan`; **the year balance and the week's balance count the plan up to and
  including today** (future days and weeks are not in it), and the year's whole plan (52 weeks) is shown separately. The **average week** is
  `hours ÷ plannedDays × 5`, as in the sheet.
- Format: one shared `formatHours(minutes)` gives `7:45`, `1,523:30`, `−2:30`, and a signed form for balances.
- The sheet's real numbers as a test: the 2025–26 daily rows give 1,523:30, 220 planned days, balance −126:30, average week 34:38 (the sheet's
  own weekly total says 1,527:30 and −122:30 because of the overlap described above).
- `timeOffCounts(year, today)`: **taken** (date before today), **booked, not yet taken** (today or later), **left to book** = allowance − taken −
  booked, all counted from the rows inside the year; a date outside the year, or on a weekend, is refused when added.

### Hours page (Research → Hours)

Shape of the existing pages: shared landing and page patterns, plain CSS with tokens (both themes), Lucide icons, no gradients. Reuse
`HoursStrip` and the shared components where they fit; ask before inventing a variant.

- **Today:** the total against the aim (`2:15 of 7:30`), one row per task with a round button (▶ switch to this task, ■ stop it) and the
  quarter-hour time, the running task highlighted (no "Running" label anywhere), a field "What are you working on?" with **Start**
  (suggesting earlier task names as chips; once Tasks exist, a task picker limited to existing tasks), one line of help ("Times are rounded to
  15 minutes. What is rounded off carries over, so the total stays true."), and a quiet **Add time**. Long names wrap here.
- **The week:** a list of seven days with arrows (‹ Week 2 · 28 Sep – 4 Oct ›): day, hours, and a small bar against the 7:30 aim (a tick at the
  aim; weekends and days off have none). Future days show a dash. Clicking a day shows its tasks and their times; an "Edit" link there opens that
  task's sessions with their start and end times (the only place times appear) for fixing a forgotten stop. Footer: hours against the plan so
  far and the balance. **No "what" column.**
- **Year:** balance, average week, hours so far, and the whole year's plan (with the days it is made of), and a link to the charts.
- **Charts and weeks** (`/hours/year`; hand-drawn SVG from tokens, no chart library; use the `dataviz` skill; every number also in text or a
  hover): weeks of the year against 37:30 (over and under in two colours: one new token, `--chart-under`), the running balance, a heat map of the
  year with holidays outlined (**clicking a day opens its week**), the typical week, a placeholder for hours per task that fills once tasks
  are recorded, and **All weeks**: a compact table (week, dates, hours, plan, balance, year balance), newest first, in a scroll box with padding
  for focus rings, clicking a row opens the week. This is the answer to "the list of all days will be very many".
- A day may carry a short **note** (the sheet's loose column M), shown in its expanded row.

### Time off page (Research → Time off)

- **Summary:** days a year (40), **Taken**, **Booked, not yet taken**, **Left to book**, a stacked bar of the three, and per-type counts.
- A list for the year, oldest first: date, weekday, type, status (**Taken** or **Booked**). **Add** opens an inline form (from, to, type; weekends
  skipped, dates outside the year refused), not a pop-up. Types are the three fixed ones. There is no Done column and no year-end credit.
- **Effect on Hours:** each weekday listed lowers that week's planned days and plan and is outlined on the heat map.
- The landing card shows days left to book, taken, booked and the next day off.

### Tasks, later (no schema change)

- A session's optional `task` is an entity key (`cc://task/<uid>`): Tasks add one kind to `ENTITY_KINDS` in `src/shared/entities.ts` and one provider in
  a module manifest, as `docs/DECISIONS.md` ("Entities") describes. A task's time is the sum of the reported time of the sessions that point at it, so
  the user enters timings **once** and Hours and Tasks read them. The label stays for history. "Existing tasks only" is a change to the Start field.

### The shell

- **Top-bar chip** on every page while a timer runs: a dot, the task name **cut with an ellipsis at about 26 characters** (full name in a tooltip),
  the block's clock, and Stop. **Clicking it opens a small popover**: the full name, when it started, a "Switch to" list of today's tasks, and Stop.
  Mounted through the manifest's `globals`.
- **Dock menu** "Stop timer (name…)" or "Start timer", and **palette** commands "Start timer" and "Stop timer" (names cut the same way). A shortcut
  only if the user wants one (check for a free chord; list it in Settings).
- **Settings → Hours** (per workspace): hours per day (7:30), days off a year (40), the year's start.
- Search (Mod-K) does not index sessions at first.

### Import (`npm run import:hours -- --old <xlsx> --new <xlsx> [--apply]`)

Dry run by default; reads .xlsx with Node built-ins (reuse the Training importer's reader); follows the CLAUDE.md importer rules.

- **Both years:** every day's typed hours become that day's `minutes` (already quarter hours; a value that is not a multiple of 15 is reported); the
  typed weekly `Days` of 2025–26 become `weekDays`; the dated holidays become `timeOff` (public or university); loose notes beside dated rows
  become day notes. **2026–27's two rows dated Dec 2027 are left out and reported.**
- **Not imported:** the scratch area's rows (no date; reported so the user can say which day they belong to), and 2025–26's annual leave (the user
  adds the exact dates in the app).
- **Safety check:** read the result back and compare with the daily rows: total hours, each week's hours, planned days, balance and average, and the
  holiday counts; the known 4 h overlap in the old sheet's weekly column is reported, not treated as a failure. A year that fails is left out as
  ATTENTION. Dry-run on the real files and read every line; never `--apply` on the real library unless the user asks.

## Stages (one small commit per stage, or per standalone part of one)

1. **Rules:** `src/shared/tracking/`: year and weeks, planned days, the rounding (running total), day/week/year totals, balance and average, time-off
   counts, `formatHours`. Tests include the sheet's numbers. **Mutation-check** the rules that protect the total: remove the carry (the year total
   must then fail a test), let a session cross midnight, allow two running sessions, accept a date outside the year.
2. **Store:** the year file in `src/main/tracking/` (atomic, guarded, corrupt file set aside, unknown keys kept, new year created on demand, per
   workspace), IPC and `Api` methods, tests. A running session persists across a simulated quit; switching is one write.
3. **Importer:** built and tested, then **dry run on the real files; stop and show the user the output.**
4. **Hours page:** Today, the week list, the Year card, Add time, the session editor, the Settings tab.
5. **Charts and weeks:** the views above, one at a time, each looked at in light and dark.
6. **Time off:** store methods, page, the link to planned days.
7. **Around the pages:** landing cards, top-bar chip and popover, Dock item, palette commands, shortcut entry if any.
8. **Polish, QA, docs:** `docs/DECISIONS.md` ("Hours and Time off"), `docs/ROADMAP.md`, `CLAUDE.md` (status, the new import command).
9. **Later, with the user:** Work's Hours and Time off (after question 1), and Tasks.

**Testing for real** (CLAUDE.md): a scratch library via `CENTRAL_COMMAND_HOME`, Playwright, the built app and dev mode. Type real keystrokes into the
field; Start then quit at once and reopen (the session must still be running); switch tasks many times quickly and check the day's total equals the
rounded exact total; a session left running overnight (fake the clock in a test, not the machine); focus rings on every screen (the weeks table's
scroll box especially); screenshots of every screen in light and dark, checking clipping and contrast, not only that things render; a long task name in
the chip, the popover, the Dock and the palette.

## Still open (default in bold; answer before or during the build)

1. **How does Work differ?** (hours per day, allowance, year start, whether it has time off at all, its own tasks.) Asked before stage 9; nothing
   depends on it now.
2. **The clock on the running task** shows the block's real elapsed time, ticking (`0:21`), while every list stays in quarter hours. Default: **yes**;
   the alternative is to show only the quarter-hour value everywhere.
3. **Editing an old session can move later days by a quarter hour** (the price of a total that is always true). Default: **accept**; the alternative
   is to freeze each day when it ends.
4. **Today counts in the balance in full from the start of the day**, so the balance dips in the morning and recovers as you work (the mockup shows
   0:00 with 2:15 done). Default: **yes**, as "up to today" was answered; the alternative is up to yesterday.
