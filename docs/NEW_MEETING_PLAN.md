# New meeting and meeting tasks: two bugs, one fix (19 Oct 2026)

**Fixed 19 Oct 2026, together with `docs/MEETING_TASKS_PLAN.md`** (`docs/DECISIONS.md`, "Meetings, trainings and the timer"). The diagnosis below is as written before the fix.

Found by the user on 19 Oct 2026; diagnosed, not yet fixed. Nothing here has been applied to the real library.

## Bug 1: New meeting is prefilled, and leaves a meeting behind each click

- `NewMeetingButton.tsx` calls `meetings.create({ workspace, series: defaultSeries(workspace), date: todayIso(), task: 'auto' })`.
  `defaultSeries` is Supervision in Research and Other in Work, so the page opens as "Supervision · 19 Oct 2026" with a series the
  user never chose. This is what `docs/DECISIONS.md` ("New meeting / New entry create the item at once", "a Supervision meeting
  for today") asked for; **the user's new rule replaces it: a new meeting is prefilled with today's date and nothing else.**
- Every click writes a real file (`YYYY-MM-DD Supervision.md`, ` 2`, ` 3`) and, through `task: 'auto'`, a subtask. Leaving an
  untouched meeting removes nothing: `isUntouchedBody` is used in `MeetingPage.removeNote` only to skip the undo toast when the
  user presses Delete. Three clicks left three meetings (Recent and upcoming, three "19 Oct 2026 Supervision" rows).
- New training entry ("Untitled"), notes and reading lists use the same helper and probably leave the same litter. Report, ask
  before changing.

## Bug 2: the meeting's own task no longer follows the meeting or goes with it

- `isOwnMeetingTask` recognises a subtask the app made by `DATED_TITLE = / · [A-Z][a-z]{2} \d{1,2}, \d{4}$/` (US, "Oct 12, 2026").
  Commit `6ddc65e` (19 Oct 2026, "Dates in headings and labels follow the Mac's region") made `formatDate` write "19 Oct 2026", so
  new subtask titles do not match. `planMeetingTask` then treats them as tasks the user chose and never renames or moves them;
  `MeetingPage.removeNote` and `tasks/main/session-sweep.ts` do not trash them either.
- Seen: a meeting changed from Supervision 19 Oct to Other 20 Oct kept the task "Supervision · 19 Oct 2026". The deleted meetings
  of bug 1 probably left subtasks behind.
- Unit tests missed it because they run in a US locale.

## Plan (one session, small commits, task bug first because the auto-delete in bug 1 relies on it)

1. Stop recognising an own task by title format: an explicit marker (a numbered migration if it needs a column), or every format
   `formatDate` can produce plus the US one and ISO. Decide with the user if it is a real trade-off. Existing own tasks (US and
   regional titles) must still be recognised.
2. Tests under en-GB, en-US and de-DE for `isOwnMeetingTask`, `planMeetingTask` sync and the delete path, with a mutation check.
   Check training's lecture and self-study tasks and `word-sources.ts:77` (`DATE_LINE`) for the same assumption.
3. A meeting can have no series. New meeting creates one with only today's date. Types, `create` (repository, store), front matter,
   `file-name.ts` (`YYYY-MM-DD Untitled.md`, ` 2` for repeats), `meetingHeading` ("Untitled · date" or similar), the series select
   (empty "Choose series" state), the landing's series filter and cards.
4. No own task until there is a series (`task: 'auto'` needs one): make it when the series is first chosen, or use the task
   field's proposal.
5. Leaving an untouched meeting (no series, no times, no attendees, body equal to `NEW_MEETING_BODY`) deletes it silently with its
   own subtask, from the session's dispose path so back, a workspace switch and quit all do it. Never a meeting the user changed.
   Mutation check.
6. A dry-run-by-default repair script (backup first, app closed for `--apply`, refuses to write unless it can verify the result):
   for every meeting in every workspace with a `task:` value, report whether the task exists, is the meeting's own subtask, matches
   "<series task> · <date>", its parent series task and due date, and whether two meetings share one task. List own-looking
   subtasks no meeting points to (orphans) as candidates to trash, never deleting. Say what `--apply` would rename, re-parent or
   set. It must cover the meeting "Other · 20 Oct 2026" whose task still says "Supervision · 19 Oct 2026". Dry-run it on the real
   library, read every line, show the user; **never `--apply` unless the user says so.**
7. DECISIONS.md (replace the "Supervision meeting for today" line) and ROADMAP.md.

Verify with test, lint, typecheck and by driving the app in a scratch library (dev and production build, real clicks, screenshots):
click New meeting several times, change series and date and watch the task follow, delete one and check its task goes.
