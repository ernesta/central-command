# Subtasks, trainings and Home (plan, 24 Oct 2026)

The user's decisions of 24 Oct 2026, after looking at the mockups `docs/design/subtask-parent-mockup.html` and
`docs/design/training-display-mockup.html` (made-up titles; the real library is never committed). **One job** (the user's rule, overriding the
one-stage-per-session rule for this plan): implement every part below, drive it in a scratch library (production build and dev mode, light and
dark, look at the screenshots), tests/lint/typecheck, write up (`docs/DECISIONS.md` "Subtasks, trainings and Home", ROADMAP, CLAUDE.md "What is
built"), small commits (one per part), push, `npm run build:mac`, quit the app if it runs, install in `/Applications`. No questions: the decisions
are below. Nothing in this plan changes the real library's data (no `--apply`).

Already done and committed before this plan: the Tasks section on a person's page is removed (`84e9685`).

## 1. A subtask shows its parent (marker 7B)

A subtask shown away from its parent says which task it belongs to, on its **second line**, with the same marker everywhere:

```
Review the funder guidance and confirm approach with supervisors
↳ Publish Study A: analysis code · Writing
```

- **The line is `↳ <parent title> · <list>`**, then the due date only where that place shows one today (search, Home's Coming up; not Home's
  Today). The list is always shown and never cut; **the parent is cut with an ellipsis** (`flex: 0 1 auto; min-width: 0; overflow: hidden;
text-overflow: ellipsis; white-space: nowrap`; the list `flex: none`). Put the parent first when there is no list. The parent is never a link or a
  chip. The `↳` is Lucide's `CornerDownRight` at 12px, `align-self: center`, muted, a 4px gap (the Tasks table draws a connector to a subtask row;
  this is its text counterpart). Build **one component** (say `SubtaskLine`, in `tasks/renderer/`) and use it in every place below; the second-line
  text for a task without a parent is unchanged.
- **Where:** Home (Today and Coming up: a task row, an event row's task), search (`tasks/renderer/search.ts`: replace "Subtask of X" with the
  marker, **and keep the list**, which a subtask lost; due date stays), the timer's picker (`hours/renderer/TaskPicker.tsx`) and popover
  (`TimerChip.tsx`), and Hours' rows (`TaskList.tsx`).
- **Not** the Tasks table (it shows a subtask under its parent already) and not a person's page (removed).
- **The timer picker becomes two lines for every task**: title, then the second line above (the list moves from the right-hand column under the
  title, so it is never cut to "Admin & Logis…"; the right-hand `.detail` column goes). No due date in the picker. **Wider: the popover is 420px**
  (was 380px, `TimerChip.module.css`), so the picker inside is as wide as the popover; the picker in `TaskPicker` and the popover are one width.
- **Hours' rows get a second line**: every task row shows its list (a subtask: the marker first). Ordinary rows were one line.
- `detailOfTask`/`listOfTask` (`hours/shared/start-picker.ts`) already give a subtask its parent's list; reuse them.

## 2. Meeting and training session tasks leave every task view (option B)

A meeting's own task (`own_kind = 'meeting'`) and a training's own session task (`own_kind = 'training'`) are kept as records, because every hour
has a task, the notes derive their hours from them, Work's billable totals depend on them and deleting a meeting takes its hours with it
(`docs/MEETING_TASKS_PLAN.md`, `docs/TIMER_TASKS_PLAN.md`). **Nothing about storage, hours, sync or deletion changes.** They stop being shown as
tasks:

- Hidden from: the Tasks table and its landing counts and chips (`2/2`, "N overdue"), Home's task rows (Today and Coming up: the meeting or
  training still appears as the **event** it already is), Mod-K's task hits (the meeting and training hits stay), `useTasksList`-based pickers,
  the Home summary's task counts, the widget snapshot and notifications (a hidden task never notifies; the event does). Do it once, in a shared
  predicate (`tasks/shared/session-lock.ts` already knows the kinds: add e.g. `isHiddenTask(task, all)`) and use it where a list of tasks is built,
  not in each view's own loop; `grep` every consumer of `tasks.list` / `allTasks` / `useTasksList` / `collect.ts` and decide each one in the write-up.
- **The series container is hidden with them**: the plain series task (the parent of a training's session tasks, e.g. `<series>`) shows nothing once
  every one of its children is a hidden session task. Read `tasks/main/session-sweep.ts` for how it is made and find the most precise rule
  (an explicit marker if one exists; otherwise "every child is a hidden session task"); never hide a task the user made and chose as a parent.
  The `<series> self-study` parent and its subtasks stay visible (part 3).
- **Still reachable**: the icon link from a meeting's or training's note to its task page stays; the task page of a hidden task still opens, locked
  as now ("Made by …"). Hours rows, the training log and Work's totals read the same data as before: **assert it with a test** (hours totals with
  and without the filter are equal).
- Search modifiers (`status:`, `list:` …) apply to the visible tasks only.

## 3. Self-study: a reminder in Tasks that looks like a training

The self-study task stays a real task (due a week after the training, done a week after its end, reminds on Home and in Tasks, Start/Add time on
the note) and is **displayed as a training** (the user: "I want a self-study reminder in Tasks, and I also want it to show up as a training"):

- **Name**: `<Series>: <Title>` (`trainingLabel`, `training/shared/training-entries.ts`: "Series: Title", just "Title" for a series-less
  training or when the title already starts with the series), exactly as the Training module names the entry. **Display only**: the stored title
  stays `Day 2` (and the series parent `<series> self-study`). Replace the "Series ›" prefix (`TaskName`, `studyLabel`/`studySeries`, the timer
  popover's `head.series`) with this name everywhere it is used: Tasks table, search, the timer's picker and popover, Hours' rows, Home's rows.
- **Icon**: Lucide `GraduationCap` (already Home's training icon, `HomePage.tsx` `KIND_ICON`), muted, 14px, shown in front of the name in
  place of nothing (Hours, picker, search) and beside the status button in rows that have one (Tasks table, Home). It stays tickable where it was
  (the status button is not removed; the icon is an extra mark, and `locked` rules of `session-lock.ts` are unchanged).
- **Second line**: `Training · self-study` then the due date where that place shows one (`Training · self-study · due in 3 days`). The
  parent marker (part 1) is **not** used for self-study (the series is in the name).
- **Not** added to the Training module's list (the entry is already there; a second row would duplicate it).
- Mockup: `docs/design/training-display-mockup.html`, "Option 2".

## 4. Home: "See all", Coming up, Today

- **Bug: "See all" opens Tasks filtered to Done** (it opens the page with the last remembered view). `tasksAllRoute(workspace)` with no `view`
  falls back to the remembered query (`TasksPage` / `useTasksView`). Pass `{ view: 'open' }` from Home's "See all" **and from the Tasks landing's
  "All tasks"** (same bug). Test: remembered view `done`, follow the link, the page shows Open. A list card's own link keeps its list filter.
- **Coming up is the next 3 days**, not 7 (`COMING_UP_DAYS` in `home/renderer/home-model.ts`, the card's "Next 7 days" label, the Home summary,
  the widget snapshot and any help text that says 7). Today's window is unchanged: today's events, then overdue and due-today tasks.
- **Overdue looks the same everywhere.** Today it is Home's red outlined chip ("103 days late") and, in the Tasks table, red text on the date
  (`.due_overdue`), with other wording in the landing card and the search. Build **one** `LateChip` (the Home chip: `N days late`, `1 day late`;
  the tokens that chip uses, `light-dark()` pair if a colour is new) and show it wherever an overdue task is shown: Home's Today, the Tasks
  table's Due column (the date stays; the chip beside it replaces the red text), the task page's due field, a task in search
  (`due 5 days ago` becomes the chip in a hit's second line), the landing's overdue group, Hours' task rows, the timer's picker where it shows
  tasks. Audit with `grep -rniE "overdue|days late|daysLate|due_overdue|--danger"` and list each place in the write-up. Overdue is calendar days
  from the due date to today, as `daysLate` already is (one function, `tasks/shared/`, shared by the chip and Home's summary).

## Order of work (one commit per part, tests and lint green before each)

1. Part 4 (See all; Coming up 3 days), the smallest and independent.
2. `LateChip` and its places.
3. `SubtaskLine` and its places; the picker's two lines and the 420px width; Hours' second line.
4. Part 2, the hidden predicate and its consumers (with the hours-unchanged test).
5. Part 3, the training display of self-study.
6. Drive everything in the built app and dev mode on a scratch library (see CLAUDE.md "Testing the app for real"; copy the real library
   _into the session scratchpad_ only, switch the weather off in the copy's `settings.json`, clear `trainingsFolder` and `repoPath`, never launch
   against `~/CentralCommand`), screenshots in both themes: Home (Today with an overdue task, Coming up), Tasks, a training with its self-study,
   Mod-K search for a training and for a subtask, the timer picker and popover (a subtask, a self-study task), Hours.
7. Docs, push, `npm run build:mac`, quit the app if it is running (`pgrep -fl "Central Command"`, then `osascript -e 'quit app "Central
Command"'`), move the old `/Applications/Central Command.app` to the Trash, copy the new one from `dist/mac-arm64`; do not launch it.

## What the user will check afterwards

Home "See all" opens Open; Coming up shows 3 days; overdue is the same chip in Home, Tasks, search and the task page; a subtask in Home,
search, the timer picker and Hours says `↳ parent · list`; the timer popover is wider and its list is never cut; meetings and trainings no longer
show as tasks (Tasks, Home, search) but still as events, notes and hours (Hours totals unchanged); a self-study task shows in Tasks and Home with
the cap icon and its training's name.
