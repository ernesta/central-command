# One rule for starting work: every hour has a task (plan, 7 Oct 2026)

Written with the user after they asked: "If I start a timer now, does it create a corresponding task?" The answer depended on where
the work was started and in which workspace. They want one consistent, sensible experience. Read `CLAUDE.md`, `docs/DECISIONS.md`
("Work's Hours", "Stage 8 …", "Training", "Meetings") and `docs/TASKS_PLAN.md` before starting.

## What the user decided (not to be re-asked)

- **Option A: every hour belongs to a task, in every workspace** (Research and Work; Life has no hours). No unlinked entries for new data.
- **Trainings and meetings also have tasks and their hours are tracked.** Meetings: one generic task per series, not one per
  occurrence. Trainings (changed 7 Oct 2026, see "Trainings: series task and lecture subtasks"): one parent task per series and
  **one subtask per lecture**. Reports show the task's generic title.
- **Starting a timer always starts immediately**, then the task is picked or created.
- **A meeting or training is a note with typed date, start and end. There is no "live meeting" and no timer is needed for them.**
  Never make the user choose between "timer" and "no timer" for the same kind of thing.
- **As much automation as possible, with an easy way to edit.**
- **A running timer's start time must be easy to change** (they forgot to start one and starting it "now" would be wrong).
- Overlapping entries are not expected. Warn, never change silently (the one exception is the back-dated timer, below).
- **Historical data is a later conversation.** Do not design or touch it in the first stages.

## How it works today (the confusion, checked in the code on 7 Oct 2026)

- `store.start` (`src/main/tracking/store.ts`) never creates a task. `Session.task` (an entity key `cc://task/<uid>`) is set only by
  the caller.
- Idle Start chip, popover rename, popover "Switch to": entry only, no task.
- Today form (`TodayCard.keyFor`): links to an open task on an exact title match; **in Work only** creates a task (list: last used);
  in Research never creates one.
- Today row play button: links only on an exact title match; never creates.
- Task page Start: linked. Palette "Start timer": only focuses the Today form. Dock and shortcuts have no start.
- Training hours (`trainingHours`, `report.ts`) come from each entry's own start and end times, separate from the Hours store.
  Meetings count the same way.

## The model

1. **Every hour entry has a task.** Task time stays computed from entries (`trackedByTask`); rows group by task, not by label plus client.
2. **One Start picker everywhere** (idle chip, Today form, row play, "Switch to", palette, task page): the timer starts at once; a single
   field lists open tasks as you type and always ends with **Create task "…"**. In Work the client comes from the task's list and is
   asked only when ambiguous. An unnamed timer is allowed only until the task is chosen; stopping it without one asks for one.
3. **Started at is editable on a running timer** (and on the Today form's Add time): type `10:15` or `-20` (minutes ago), or **Since last
   entry ended**. If it overlaps an earlier entry the app trims that entry's end and says so. It cannot go before midnight; earlier
   is "add time".
4. **Meetings and trainings own their time.** The note's date, start and end are the single source; the Hours store reads them
   (derived, never typed twice). Each note carries a task: the series task, proposed automatically from what the app knows (the
   training's series, the meeting's type) and pre-filled, one click to accept, a dropdown to change. If nothing matches, offer to
   create it with a generic title.
5. **Generic task titles; specifics stay on the note.** The task is "Supervision", not "Supervision with Kathy". Attendees, topics,
   skills, leads and summary stay on the note. The Supervision log and the Inkpath report keep reading the note's fields; only the
   minutes come from the shared store. Client reports list entries under the task's title.
6. **Overlap**: a note whose times overlap another entry shows a warning and changes nothing.

## Trainings: series task and lecture subtasks (decided with the user, 7 Oct 2026; do not re-ask)

Self-study is training too, must be reported, and must not need a new task per lecture or a second note.

- **A series is a parent task** ("Intro to Python"); **each lecture (training note) is a subtask** of it, created automatically with
  the note. Subtask time already rolls up into the parent (`taskTime`, `trackedByTask`), so a series total needs nothing new.
- **A lecture's hours are one total, no split shown**: the derived session time (the note's date, start and end) plus every timer or
  typed entry on its subtask (self-study). The same note holds the self-study notes.
- **Start on a training note's page** starts the timer at once on that lecture's subtask: no picker, no Create. The normal Start
  picker lists the lectures as well.
- **Self-study is lecture-specific only** (the user's choice). No course-wide time on the parent, so no extra Inkpath lines: each
  Inkpath line is a lecture's total. Self-study inherits the series' skills; the training hours counter, per-skill totals and the
  Inkpath export sum the lecture total.
- **Needs, not built**: a way to add time by hand to a subtask (today only the parent's Time card takes typed time; open in
  `docs/DECISIONS.md`, "A subtask has no page of its own"). Subtasks stay hidden under their parent in the task lists, and a subtask's
  route still redirects to its parent (the training note is the lecture's page).
- **Overlap**: a self-study timer that overlaps the lecture's own session time warns and changes nothing (rule 6).

## Open questions (ask the user when the stage needs them)

- Which task a meeting series maps to in Work vs Research, and what the generic titles are (the training's series already exists).
- Exactly how a training or meeting's derived minutes appear in the Hours page (as entries under the task, read-only, with a link to
  the note?).
- What happens to a note with no times yet (no hours until times exist).

## Stages (stop after each and ask; the user clears context between them)

1. **Back-dated start on the running timer.** Needs nothing else; ships on its own. Store, rules (`startSession`, trim of the earlier
   entry), popover, Today form's Add time. Tests with mutation checks on the overlap trim and the midnight limit; drive the built app
   on a scratch library.
2. **One Start picker and the "every hour has a task" rule** for Research and Work: replace the separate start paths, remove the
   Work-only creation in `TodayCard.keyFor`, ask for a task when stopping an unnamed timer. Existing label-only data is left as it
   is (see stage 5). Drive the app in both workspaces, dev and production.
3. **Meetings: task and derived hours.** A task on each meeting note (proposed, editable), minutes derived from its times, overlap
   warning, the Hours page shows them. Supervision log still reads the note.
4. **Trainings: series task, lecture subtasks and derived hours.** A subtask per training note, created with it (series parent found
   or offered); minutes derived from the note's times; the Start button on the training page; typed time on a subtask; overlap
   warning; the training hours counter, per-skill totals and the Inkpath export read the lecture totals from the shared store.
   Check the reports still match for sessions without self-study.
5. **Historical data** (a separate conversation first, read-only look at the real data before any rule): label-only Research and Work
   hours without a task, the 129 training entries with times but no task (series parents and lecture subtasks, only for entries
   with hours), the existing meetings. Importer-style scripts: dry run,
   backup, `--apply` only when the user says so, app closed.

Update `CLAUDE.md`, `docs/DECISIONS.md` and `docs/ROADMAP.md` at the end of each stage.
