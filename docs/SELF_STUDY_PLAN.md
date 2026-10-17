# Self-study tasks for trainings (plan, 17 Oct 2026)

The user's idea, agreed in conversation on 17 Oct 2026. **Built and driven 17 Oct 2026** (`docs/DECISIONS.md`, "Self-study tasks for trainings").

**Standing exception to CLAUDE.md (the user's explicit instruction, 17 Oct 2026):** the user is away, so do every stage in one go, without stopping between
them, and finish with the push and the install. Still one small commit per standalone part; test, lint and typecheck must pass before each commit.

## What the user decided

- A lecture's session and its self-study are different tasks. The lecture's own task stays what it is: the session, derived from the note's start and end,
  due on the note's date, marked done by the sweep once the session is over (`session-sweep.ts`). **There is no way to start or add time on a lecture's own
  task: its time is typed in the note (start and end).**
- **Self-study has one task per series**, and **each lecture has its own self-study subtask under it**, made when time is first put on it from that lecture:

  ```
  PS5210                                   series task (as now)
    <lecture title>                        lecture subtask: the session (as now)
  PS5210 · self-study                      one per series, made the first time any lecture of the series needs it
    <lecture title> · self-study           made when Start or Add time is pressed on that lecture's note
  ```

- Start and Add time on a training note always go to the lecture's self-study subtask, before and after the session is over.
- Nothing is made in advance. A lecture never studied for has no self-study task.

## Decisions taken for the user (they are away; each is easy to change)

1. **Titles.** The series' task is `<series> · self-study` (the series text as the note has it). The lecture's subtask is `<note title> · self-study`, and it
   follows the note's title the way the lecture task does (`planLectureTask`'s rules, same 0.8 s settling).
2. **List.** The series self-study task is a top-level task in the list "Training" (`TRAINING_LIST`), found by title first (an open top-level task with that
   exact title, folded and `bareTitle`d like `parentFor`), else made. It is not a subtask of the series task.
3. **A lecture with no series** has no series to hang a self-study task on: its self-study task is a top-level task of its own, `<note title> · self-study`, in
   Training. Adding a series later moves it under the series' self-study task (as the lecture task moves under the series task); clearing the series takes it
   back out.
4. **Time already tracked on lecture subtasks stays there** and is still counted. Nothing is moved, no script, no change to any Hours file.
5. **A deleted self-study task** is made again silently by the next Start or Add time (no "Make it again" line: it only exists to receive time). Time already
   tracked under its name stays in Hours.
6. **Deleting a lecture** also puts its self-study subtask in the trash (restorable), like its lecture subtask. The series self-study task is never touched.
   The delete dialog's wording about self-study time stays true ("that time stays in Hours").
7. **Due date and status.** The self-study subtask has no due date and status `doing`; the sweep never touches it (it only reads the note's `task:`).

## Data

- A new front-matter key on a training note, `selfstudy: <task uid>` (plain style, written after `task`, `ORDER` in `shared/front-matter.ts`; an empty value
  removes the key; same uid check as `task` in `training-store.ts`). `TrainingMeta.selfStudy: string` ('' when none); `TrainingPatch` follows.
- Training migration `0006_self_study_task.sql`: `ALTER TABLE training ADD COLUMN self_study_task TEXT NOT NULL DEFAULT ''`, like `0004_task.sql`; filled
  from the files when the index is rebuilt; `TrainingIndexRow.selfStudy`; `index-row.ts` fills it. Never edit a shipped migration.
- `entryMinutes` (`shared/rules.ts`) becomes: the note's session + minutes tracked on the lecture task (older notes keep theirs) + minutes tracked on the
  self-study task. Every caller already passes the row, so the training counter, per-skill totals, table, landing, series cards and the PDF all follow; check
  each caller and the PDF page (`report.ts`, `trackedByTask`) rather than assuming.

## Stage 1: the rules and the data (pure, tested)

- `src/modules/training/shared/self-study-task.ts`: `planSelfStudyTask(note, tasks)` -> `none | create | sync`, in the style of `planLectureTask`, with the
  series' task found by `selfStudyParentFor(series, tasks)` (an open top-level `<series> · self-study`, "Training" first). A task that is not the note's own is
  never renamed or moved; a subtask under a self-study parent is always the note's. Unlike the lecture task, nothing is planned while `selfstudy` is empty:
  the first Start or Add time asks for it (`create`).
- Front matter, types, migration, index row, `entryMinutes` as above.
- Tests: every plan case (no series, series typed, series changed, series cleared, title renamed, task deleted, another note's task not touched), front matter
  round trip (an older note byte-identical after unrelated edits), `entryMinutes` with both tasks, an older note unchanged.
- Mutation checks: a self-study task moved or renamed that is not the note's; `entryMinutes` counting the self-study twice or not at all; the migration column
  missing after a rebuild.

## Stage 2: the note page

- `useSelfStudyTask` (renderer, in the style of `useLectureTask`: one thing at a time, `busy` ref, settle timer, `made` set for a series self-study task a
  moment's typing left behind, put in the trash only if the page made it and it is empty) keeps an existing self-study subtask in step with the note's
  title and series. It makes nothing by itself.
- `LectureHours` (inside the lecture's Task panel): the total (`entryMinutes`), **Start** and **Add time** that act on the self-study subtask, the overlap
  line as now. **The Start and Add time on the lecture task are gone** (no `TaskTimeActions` for the lecture task). When the self-study subtask does not
  exist yet, pressing either one makes it first (series self-study task if needed, then the subtask, then writes `selfstudy:` in the note with
  `session.setMeta`), then starts the timer or opens Add time on it. The panel shows no new sentence; once the subtask exists, a short link "Self-study" to
  its task page may sit next to the lecture's task link (reuse the Task panel's link style). UI text stays minimal (CLAUDE.md, memory `concise-ui-copy`).
- `TaskTimeActions` takes a task that exists, so make the task before rendering the form: either a thin wrapper in the training module that creates on first
  press and then hands over, or a small optional "ensure" callback on `TaskTimeActions` if that is cleaner; do not copy its logic.
- The top-bar Start picker and the task page's own Start/Add time stay as they are for every task. **If** the picker or the task page can hide a training
  lecture's own session task with one small, clean check (a lecture's task uid is any `training.task` value), do it; otherwise leave them and write that in
  `docs/ROADMAP.md` as left. Do not build cross-module machinery for it.
- Deleting a lecture trashes its self-study subtask too (find where the lecture subtask is trashed in the delete flow and add it there).
- Tests (component and pure) and a drive in the app, below.

## Stage 3: totals, search and the rest

- Check every place that shows a lecture's hours or a series' hours: the landing, table, series cards, per-skill totals, Hours' "Meetings and training" rows,
  the Time card on the series task and on the new self-study task (it sums its subtasks), the PDF. All of them must give the same number for a note with and
  without self-study, and an older note must be unchanged (tested; the PDF of the real library's data byte-identical for a library with no `selfstudy:` keys).
- `docs/DECISIONS.md`: a section "Self-study tasks for trainings" with the decisions above, what was found by driving the app, and what was left.
  `docs/ROADMAP.md`: tick the item in "For the user" about work after a session is done (rewrite it as answered), add anything left.

## Driving it for real (CLAUDE.md, "Testing the app for real")

Scratch library only (`CENTRAL_COMMAND_HOME`), never `~/CentralCommand/`. Dev mode and the production build, with screenshots read back:
a new training (no series: Start is there, nothing made until pressed); give it a series and times; press Start on the note (a timer on the new
`<title> · self-study` subtask under `<series> · self-study`, `selfstudy:` in the file, the total grows when stopped); Add time; a second lecture of the same
series (same series task, new subtask); rename the title and the series (the subtask follows, an emptied made series task goes to the trash); delete the
self-study task and press Start again; delete a lecture (its subtasks to the trash); a lecture whose session is over (Start still goes to self-study, the lecture
task stays done); an older note (no panel change beyond Start/Add time, file byte-identical after opening it); leave the page right after pressing Start. No
console errors in either mode. Kill only the processes you started (`pgrep -fl electron` first).

## Finish: commit, push, install

- Commits small: docs (this plan and the ROADMAP correction), then data and rules, then the note page, then totals/delete, then the write-up.
- The working tree may contain another job's changes in files this plan does not touch: stage only your own files by name, never `git add -A`, and do not
  revert or reformat anyone else's changes. Run `git status` before each commit.
- Push to `main` (the user allowed it for this run). Then `npm run build:mac` and install into `/Applications` as before (quit the installed app first, by
  exact name, never any dev or other Electron process; the old copy goes to the Trash; do not launch the installed app against the real library).
- If anything fails and cannot be fixed, stop, leave the tree compile-clean, do not push a broken state, and say so at the top of the final report.
