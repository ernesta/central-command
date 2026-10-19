# Meetings, trainings and the timer: one combined fix (plan, 19 Oct 2026)

**Built and driven 19 Oct 2026** (eight steps, eleven commits; `docs/DECISIONS.md`, "Meetings, trainings and the timer"). Not pushed, not installed, nothing applied to the real library; the repair script was dry-run only.

Extends `docs/NEW_MEETING_PLAN.md` (bugs 1 and 2, steps 1 to 7: follow them). Adds what the user raised after reading that plan's
prompt. **Run as one unattended session: the user's explicit exception to the CLAUDE.md "stop at every stage" rule (19 Oct 2026).**
Still one small commit per standalone part; test, lint and typecheck pass before each commit; nothing pushed; never `--apply` on the
real library; commit only your own files (another session has uncommitted search work in `src/shared/search-*`).

## What the user reported (19 Oct 2026, screenshot of the timer popover)

1. After clicking New meeting three times and deleting the meetings, the timer's "Suggested" list shows "Supervision · 19 Oct 2026"
   three times (list "Meetings"). **Answer to "were the tasks deleted too?": no.** The deletes ran `MeetingPage.removeNote`, which
   trashes a task only if `isOwnMeetingTask` says it is the meeting's own; that test wants " · Oct 19, 2026" (US), the titles are
   "19 Oct 2026" since `6ddc65e`, so every task was skipped. `NEW_MEETING_PLAN.md` step 1 fixes this for new deletes, but see A
   below: the plan alone leaves gaps.
2. Meetings must not show in the timer, nor trainings: only their self-study tasks do.
3. A self-study task should exist for every training entry always, due on the training's date, and be marked done exactly one week
   after the training's end.

## Gaps in the NEW_MEETING_PLAN prompt, and how this plan closes them

- **A. Deleting is done in the renderer.** `removeNote` trashes the task; a meeting removed any other way (Finder, the Trash,
  `pruneMissing` / `dropRowsWithoutFiles` in `meetings-store.ts`, an untouched-meeting delete from the dispose path in step 5) leaves
  the task. Put the task's removal in the main process, in `MeetingsStore.delete` (a small injected "trash this task" callback, like
  `trash`), so every delete path through the app does it once; keep `removeNote`'s Undo restoring it. Files removed outside the app
  are not auto-trashed (never delete on a guess); the repair script lists them as orphans.
- **B. The marker.** Prefer an explicit marker over title formats: a numbered Tasks migration adding a nullable `own_kind`
  (`'meeting'`, later `'self-study'`) column, set when the app makes the task, read by `isOwnMeetingTask` and the sweep. Existing
  tasks (US or regional or ISO titles, with a `parent_uid`, pointed at by a meeting's `task:`) are backfilled by the repair script
  and, until then, recognised by the old US pattern **plus** the regional pattern for every `formatDate` locale (union, tested).
  A task named by a meeting's `task:` and not marked is a task the user chose and is never touched.
- **C. Orphans already in the library.** The repair script (step 6) trashes nothing but lists them; its report must include the
  three "Supervision · 19 Oct 2026" tasks in "Meetings" and say which meeting, if any, points at each.
- **D. The timer must not offer session tasks** (this plan, part 2). See below.

## Part 2: meetings and trainings out of the timer

Interpretation (the user's words, "the hours tracker", with the screenshot being the timer's Suggested list): the **timer pickers**
(top-bar suggestions, `suggestedTasks`, and typed search, `pickerOptions` in `hours/shared/start-picker.ts`, used by `TimerChip.tsx`
and `TaskPicker.tsx`) and the Hours page's task lists stop offering a meeting's own task or a training lecture's own session task.
Time on them is typed in the note (start and end), as the self-study plan already says. **Not changed:** the hours the notes derive
into the Hours totals (`useMeetingHours`, `derivedEntries`) and the read-only `MeetingRows` list of a day's sessions, because
Work's billable totals depend on them. If the user meant those too, that is a one-line follow-up in `MeetingRows`, not a redesign:
write that in `docs/ROADMAP.md` and do not remove them.

- A task is a "session task" when it carries the marker from B (own meeting task, own lecture session task).
  Build one `sessionTaskUids(workspace)` in the Tasks main module (it already reads both tables in `session-sweep.ts`
  `sessionRows`), expose it through a typed `window.api` method (add to `Api` and `IPC` in `src/shared/api.ts`; nothing generic),
  and have the picker filter with it. Keep it a small filter, no cross-module machinery; tests: a meeting's task is absent from
  suggestions and search, a self-study task and an ordinary task are present, and a series task a user chose for a meeting stays
  offered (only a task the app made for the session, by the marker, is hidden).
- Task page Start / Add time on a session task: leave as is unless one clean check hides it; if not, record in ROADMAP as left.
- Time already tracked on those tasks stays in Hours (nothing moved).

## Part 3: a self-study task for every training entry, always

This **replaces** `SELF_STUDY_PLAN.md` decisions "Nothing is made in advance", "no due date, status `doing`" and "a lecture never
studied for has no self-study task" (the user's instruction of 19 Oct 2026 wins; record it in DECISIONS.md and update that plan's
header). Everything else in that plan stands (titles, `<series> · self-study` parent in Training, lecture subtask under it,
`selfstudy:` front matter key, `entryMinutes`, trash on delete).

- Made by the app, not the page: when a training entry is created, and for a no-series entry the top-level fallback, so it exists
  even if the note is never opened. Do it in the main process beside `settleSessionTasks` (the sweep already runs at launch and
  every minute and reads both tables): a sweep step "ensure a self-study task for each training row with a title" that creates the
  parent and subtask and writes `selfstudy:` into the note through the training store's own guarded write (never a raw file write;
  respect the content-hash rule). Keep it idempotent: two runs make one task.
- **Due date** = the training's date; follows the note when the date changes. **Done** exactly one week after the training's end:
  `date + 7 days` at the entry's `end` (no end: end of the date's day, 23:59), done when now is at or past that moment; it is never
  re-opened by the sweep if the user reopens it by hand within the same session (same rule as `sessionTaskChanges`; add the weekly
  offset there or in a sibling function, pure and tested). Put the cutoff in one named constant.
- A deleted training entry trashes its self-study subtask (already planned). An untouched or dateless entry (no date): no task yet,
  made when a date is set.
- Backfill for existing entries: part of the repair script (below), dry run, never applied by Claude. Entries with tracked time on a
  self-study task keep it.
- Tests under en-GB, en-US, de-DE: due date, the one-week completion boundary (the minute before, the minute at), idempotence,
  two entries of a series share one parent, a renamed entry, a changed date. Mutation checks: off-by-one-day completion, creating
  a second task on a second sweep.

## Repair script (extends NEW_MEETING_PLAN step 6)

Same script, one report, dry run by default, backup first, app closed for `--apply`, refuses to write unless the result verifies:
meetings (task exists, own, title, parent, due, shared by two meetings, **marker missing**), orphan own-looking subtasks and the three
"Supervision · 19 Oct 2026" tasks listed as trash candidates, `Other · 20 Oct 2026` still titled "Supervision · 19 Oct 2026", and
for trainings: the entries that lack a self-study task, with the due date and done-date it would set. Dry-run it on the real library,
read every line, show the user. Never `--apply`.

## Order of work (task bug first)

1. Marker migration and recognition (NEW_MEETING_PLAN steps 1 and 2, with the locale tests and mutation check; report whether
   training tasks and `word-sources.ts:77` `DATE_LINE` share the assumption).
2. Main-process task removal in `MeetingsStore.delete` (gap A), `removeNote` simplified to rely on it, Undo kept.
3. No series; New meeting prefills only today's date (steps 3 and 4).
4. Untouched meeting deleted silently on dispose with its task (step 5), mutation check.
5. Timer and Hours pickers hide session tasks (part 2).
6. Self-study task for every training entry, due date, one-week completion (part 3).
7. Repair script with the dry run on the real library (never `--apply`).
8. DECISIONS.md (replace the "Supervision meeting for today" line; record the self-study change and the timer interpretation) and
   ROADMAP.md. Also report, without changing, whether New training entry ("Untitled"), notes and reading lists leave untouched items.

## Verify

`npm test`, `npm run lint`, `npm run typecheck` (the editor gate is not needed). Drive the app in a scratch library
(`CENTRAL_COMMAND_HOME`, never the real `~/CentralCommand`), dev mode and production build, real clicks, screenshots: click New
meeting several times (one untouched meeting remains per click until leaving; leaving removes it and its task), choose a series,
change series and date and watch the task title follow, delete one and check the task is in the trash, open the timer popover and
check no meeting or lecture task is suggested or found by typing, create a training entry with a date and check its self-study task
appears with the due date and is offered by the timer (the lecture's own session task is not), and move the entry's date so the
one-week completion can be seen.
