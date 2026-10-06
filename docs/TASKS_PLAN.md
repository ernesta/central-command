# Tasks: plan

Status: **stage 8 (Work hours become tasks) was done and applied on 6 Oct 2026 (`docs/DECISIONS.md`, "Stage 8 …").** Approved by the user on 5 Oct 2026 (mockup round 5). Built in an unattended run on 5 Oct 2026: stages 0 to 7 and the buildable part of 9 are done and committed (not pushed); stage 8 waits for the user's answer; the real-library import is not applied.** Mockup: `docs/design/tasks-mockup.html` (open it in a
browser: five screens, light and dark, clickable). Read this with `CLAUDE.md`, `docs/DECISIONS.md` and `docs/TIME_PLAN.md` ("Tasks, later"). The user is
leaving ClickUp (the annual subscription renews within days; they exported everything to `~/CentralCommand/imports/clickup/`, one CSV), so Tasks is a
**replacement task manager**, not an integration. No two-way sync, no ClickUp API.

## What the user does in ClickUp today (read from the export, 5 Oct 2026)

**The CSV lists most tasks twice**: 2,193 rows, 1,211 unique `Task ID`s (982 ids appear exactly twice, the two rows identical in every field). The first
reading of the file (2,193 tasks, 2,535 h, "97 duplicate pairs") was wrong for that reason. Every number below is after de-duplicating by id.

- **1,211 tasks**, created 22 Sep 2025 to 4 Oct 2026, all assigned to the user: 1,082 complete, 98 to do, 31 in progress. 663 are top-level and 548 are
  subtasks (up to three levels; 295 of the subtasks just repeat their parent's due date).
- **Two spaces**: PhD Studies (1,009 tasks, becomes Research; 63 top-level tasks open) and Consulting (202, becomes Work; 24 open).
- **Lists, not projects, do the organising**: Research: Coursework & Training, Reading, Admin & Logistics, Writing, Supervisor Meetings, Placement,
  Presenting, and study folders (Study 2: USAID Analysis › Data Cleaning & Analysis, Language Mapping › Scoping; the Study 1 and Research Scoping lists
  hold only finished work). Work: Luminos (Document Automation, Historical Data Analysis, Transition Support, Admin & Logistics) and a plain Admin & Logistics.
- **Priority**: ClickUp 1 to 4 (7, 107, 691, 387; 19 none). **Tags** on a minority: `billable` (107), `r`, `study 1`, `statistics`, `ghana`, `psychology`, `luminos`.
- **Due dates on most; start dates are noise** (the user will not set them), and there are no comments, checklists, estimates or types in the export; 2 attachments.
- **Recurring work is most of the volume** (inferred from repeated names, about 36 instances each over 54 weeks): weekly "Log supervisor meetings and
  trainings for the week" (four subtasks), weekly back-ups, the per-meeting cycle (prepare, clean up and share notes, notes document, deliverable), a
  fortnightly meeting with Matthew, and monthly bookkeeping and invoicing. The CSV has **no recurrence column**.
- **Time**: 628 tasks carry time, **1,612.8 h** in all (Writing 312, Coursework 278, Study 2 analysis 225, Supervisor Meetings 135; Luminos about 250 h; 203.5 h are
  `billable`). The CSV has a total per task, not dated entries. The time of a parent often sits on its subtasks.

## What the user decided (5 Oct 2026)

1. **Build it ourselves**, local-first, **in SQLite** (the database Readings uses). Confirmed.
2. **Recurring**: the next occurrence is created **after the user handles the current one**, due the interval after the **completion date** (it drifts with
   the user); only one instance of a series is ever open. A recurring task is otherwise an ordinary task, **with its subtasks copied to the next one**.
3. **The user deletes the redundant routine tasks themselves** once the app covers them; the importer does not filter any (it only removes the export's repeated rows).
4. **Research and Work have separate task lists** (`createTasksModule(workspace)`, like Notes and Meetings). Lists stay; there is no project field. A list is a
   group with an optional subgroup, shown as in Notes: `Study 2: USAID Analysis › Data Cleaning & Analysis`.
5. **Time**: ClickUp's per-task totals are carried over (no dated entries). Time can be added on a task as well as from the Hours timer.
6. **Import all 1,211.** Work's hour entries become real tasks later; the user will say how.
7. **Three priorities, High / Normal / Low, always shown at a glance** (round 2). ClickUp 1 and 2 become High, 3 and none Normal, 4 Low.
8. **No start date at all** (round 2: "maybe start time is irrelevant"). The import ignores ClickUp's.
9. **Undated tasks are Backlog / Someday**, kept out of Today.
10. **Round-2 feedback**: tags follow the title; one aligned table everywhere (a missing value is an empty cell); add a task from every screen; no "twice" marker.
11. **Round-3 feedback**: **status and priority are icons only** (status: empty circle, half-filled, filled with a tick; priority: double chevron up, equals,
    chevron down); the subtask progress (a ring that fills, with 2/6) and the repeat icon sit at the end of the task, with no columns; **Time is always a column**;
    no Repeats column ever; **a task always has a list**; **the default due date is the same everywhere (Today)** and the default list is the one you are on or last
    used; the task page's controls are compact (the list name is cut off with an ellipsis, never wrapped); explanatory text is mock-only, not UI. Answers: the Today
    default is right; **keep every imported subtask date as it is** (the user will clean up).
12. **Round-4 feedback**: **clicking the status icon rotates it** (to do, in progress, done, back to to do; Shift-click goes straight to done or back); right-click a row for
    status, priority and Add subtask. **Subtasks expand in place** with a chevron in the Status cell (a reserved slot, so rows never shift); an expanded task ends with an
    "Add a subtask" line; a row's hover plus and the right-click menu add a subtask to a task that has none; subtasks carry no priority of their own. Right-click menu: fine.
13. **Round-5 feedback**: **priority is a P1 / P2 / P3 badge column** (sortable and filterable; solid accent, a tint of the same colour, a quiet grey), subtasks carry none.
    **The row stripe idea** is used for a running timer (an accent stripe on that task's row, matching the top-bar timer) and as the thread down a task's subtasks.
    **Subtasks have a single control**: a pill after the title with the count and a fill showing progress, which opens them; a faint "+ Subtask" in the same place on hover when
    there are none; open subtasks hang off a thread with a "+ Add a subtask" line; no chevron, ring or far-right plus. **A subtask cannot have subtasks.**

## Where tasks live: SQLite (decided)

Queries for Today, Upcoming, filters and search are plain SQL; a later mobile sync has a stable `uid`, `updated_at` and a record of deletions on every task.
Descriptions are short (a minority of tasks have one) and live in the database too. Costs, written down:

- A task is not a file Obsidian can open. Mitigation: a readable snapshot of the tasks in `~/CentralCommand/backups/`, on a schedule and before an import.
- The editor (`EditorCard`/`LiveEditor`) works on notes sessions that are files. A description needs a small adapter that hands the editor a text and reports changes
  **synchronously** (CLAUDE.md: a debounced reporter lost keystrokes on quick exit). Stage 4 starts by proving it with quit-right-after-typing.
- "Never lose a note, never overwrite" has a DB form: writes are transactions; delete goes to a trash table; an untouched new task deletes without asking, as elsewhere.
- Mobile is **not** designed here; the data model keeps the door open.

## Data model (one migration, `tasks/0001_init`)

`tasks`: `uid` (the key mentions use: `cc://task/<uid>`), `workspace` (`research` or `work`), `title`, `description` (Markdown), `status` (`todo`, `doing`,
`done`), `priority` (`high`, `normal`, `low`), `due` (a date, no time, nullable), `completed_at`, `list` and `sublist` (text; `list` is required), `parent_uid` (subtasks, **one level only**),
`position`, `recurrence` (null or a rule: every N days, weeks or months), `earlier_minutes` (the task's own ClickUp time, shown, never written by the app),
`source_id` (the ClickUp id, so a re-run cannot duplicate), `created_at`, `updated_at`, `deleted_at`. `task_tags`: `task_uid`, `tag`.

Rules in `src/modules/tasks/shared/`, plain and tested: `nextOccurrence(task, completedOn)`; the views (Today = due today, in progress, overdue, a task once, under
its first matching heading; Upcoming = the next 14 days; Backlog = open, undated, not in progress; Open = dated or in progress; Done); the date a task shows (its own; a task with no date and dated open subtasks takes the earliest); rolled-up time; the order of subtasks. **Only top-level tasks are rows in any table.**

## Screens (all follow existing patterns; see the mockup)

- **Landing** (`LandingPage`/`LandingHeader`/`LandingSection`): back link, title "Tasks", **All tasks** and **New task** buttons; the add bar; sections Due today, In
  progress, Overdue (five shown, "Show all", Move to Today / Move to Backlog), Upcoming (14 days); then **list cards** (the Series cards pattern: open count, overdue,
  sublists as a line) and a Backlog link.
- **All tasks** (the Meetings page pattern): the usual filter row (search, list, priority, tag) and a Segmented Open / Backlog / Done, the add bar, and the table. A
  list page is All tasks with the list filter set, titled with the list.
- **The table, everywhere**: Status (icon), Task (title, tags, the repeat icon, then the subtask pill), List, Priority (P1 P2 P3),
  Time (h:mm; a parent adds its subtasks'), Due (overdue red, today accent). One tab stop, arrow keys, Enter opens (`useRowNavigation`). Click a Status icon to rotate it
  (Shift-click: straight to Done); click a Priority icon for a menu; right-click a row for both and Add subtask. Space on the selected row advances the status and the arrow
  keys open and close the subtasks (listed in Settings).
- **Subtask dates**: a subtask has a date only if the user gave it one (copies of the parent's date are dropped on import). A subtask with its own date shows in Due today,
  Overdue and Upcoming **nested directly under its parent**, which gives it context; otherwise subtasks are only seen on their task's page. The parent's own Due is
  never replaced by a subtask's. (Earlier drafts only handled a parent with no date.)
- **Task page**: back link, title with its tags under it, details above the note (Status and Priority as segmented buttons, Due, List, Repeats), Subtasks, the
  description in `EditorCard`, and a side panel with Time (Start, Add time) and Mentioned in.
- **Add from everywhere**: the add bar on every screen with a table (title, then a Due select and a List select); the **New task** button on every task screen opens a small dialog (title, due, list, priority); **Mod-Shift-A** (proposed) from anywhere, listed in Settings and in the manifest's `shortcuts`, next to Mod-Shift-N. Defaults, the same everywhere unless obviously different: due Today, priority Normal, list = the list you are on, else the list you used last (kept per workspace).

## Time

Hours stays the only place sessions are stored; a session's optional `task` becomes `cc://task/<uid>` (`docs/TIME_PLAN.md`). The timer's Start field offers existing
tasks; **Add time** creates a session on the day chosen. A task's total = `earlier_minutes` + its sessions, subtasks rolled up. The ClickUp history is **not** put into
Hours' days and balance (that would double-count the Hours the user imported). Work's Hours entries carry a client today; how they become tasks is stage 8.

## Import (`npm run import:clickup -- --file <csv> [--apply]`, dry run by default, never overwrites a store that holds tasks)

- **De-duplicate by `Task ID` first.** If two rows with one id differ in any field, stop and report (today they never do). Report the counts before and after.
- Space to workspace (PhD Studies to Research, Consulting to Work). A folder (`["Study 2: USAID Analysis"]`) becomes the list and the CSV's list name the sublist;
  lists without a folder have no sublist.
- Status: `to do` todo, `in progress` doing, `complete` done. Priority: 1 and 2 high, 3 and `null` normal, 4 low. Start dates are dropped.
- Due: the date part of `Due Date Text` (the calendar date the user saw). **A subtask whose due equals its parent's gets none** (it inherits); a different one is kept.
  A parent with no due and at least one dated open subtask takes the earliest (4 in the data).
- `Parent ID` (the string `null` means none) to `parent_uid`; a subtask's own subtasks (17, all finished, all under one course task) are moved up to the top-level task, with the former parent's title in front ("Complete work for the Welcome Week lecture › Read the RStudio Cheat Sheet"); `Subtasks IDs` only as a check. Tags to `task_tags`. `Task Content` (`null` is empty) to the description.
  `Time Spent` (a quoted millisecond string) to `earlier_minutes` on the task that has it; totals roll up.
- **Recurrence is not in the export.** The importer lists each series with exactly one open instance (about 25 by name) and a proposed rule; nothing is set until the
  user confirms in the app. No "duplicate" flag in the app: a series never has two open instances, and the export's repeated rows are removed by id.
- Safety checks, as the other importers: tasks per status, every parent resolves, the sum of `earlier_minutes` equals the de-duplicated CSV's (1,612.8 h), nothing dropped
  silently; a task that fails a check is left out and listed. Dry-run on the real CSV and read every line before `--apply`; apply to a scratch library first.

## Stages (stop at the end of each and ask for next steps)

0. **Mockup** (`docs/design/tasks-mockup.html`) and the user's review. **Done: approved after five rounds (5 Oct 2026).** No code.
1. **Store and rules**: migration, repository, `nextOccurrence`, the view filters, backup snapshot, unit tests (mutation-check recurrence and the trash rules). No UI.
2. **Importer**: `import:clickup`, dry run on the real CSV, applied to a scratch library; the real library only when the user says so.
3. **Landing, All tasks and the table**: module shell, sections, list cards, filters, add bar, New task dialog, row navigation, status and priority menus.
4. **Task page**: details, subtasks, the description in the live editor (prove the synchronous-save adapter first).
5. **Recurrence**: set a rule, complete, the next appears with its subtasks, drifting from the completion date.
6. **Time**: task picker in the Hours timer, Add time, totals with `earlier_minutes`.
7. **Everywhere**: `cc://task/<uid>` mentions and a provider, "Mentioned in", Mod-K search, palette and Dock items, Settings shortcuts, the People page's open tasks.
8. **Work**: the user's Work-hours-to-tasks decision, billable tag, Work's Month card. **Built 6 Oct 2026** (`npm run link:work-hours`, billable-only Start list); the Month card has no billable rows; applying is the user's call.
9. **Tidy**: Settings -> Tasks, DECISIONS.md write-up, ROADMAP, the real-library import (when asked).

Every stage that touches UI or data flow is driven in the built app on a scratch library (`CLAUDE.md`, "Testing the app for real").

## Still open

- ~~How Work's hour entries should turn into tasks~~ Decided 6 Oct 2026: match by exact minutes, billable only (`docs/DECISIONS.md`, "Tasks: stage 8 write-up"). The real link is not applied yet. Natural-language quick-add and the mobile app are not in scope.
- The stripe has two jobs (a running timer, the subtask thread) and the user wants no third. The depth-2 flattening on import is approved.
- Shortcut for Add a task: Mod-Shift-A is proposed; the user said they do not care for now.
