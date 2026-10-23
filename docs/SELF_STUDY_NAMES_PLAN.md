# Self-study names, dates and the task screens (23 Oct 2026)

The user's review of the installed app, three screenshots, then three decisions. Nothing here is built yet.

## Decisions (the user's, 23 Oct 2026)

1. **A self-study subtask is named after its training, nothing more**: "Introduction", not "Introduction self-study". The series task (its parent) says what the work is: `<series> self-study`, unchanged. This reverses "titles have no middle dot: `<note title> self-study`" in `docs/DECISIONS.md`, "Self-study tasks for trainings" (18 Oct 2026), for subtasks only.
   - A training with **no series** has no parent to carry the word, so its top-level task keeps `<title> self-study`.
   - The training's own session task is named after the note too, so a bare "Introduction" is ambiguous wherever a subtask is shown without its parent (the timer's picker, search, Hours' rows). There the muted "Series ›" prefix stays (`studyLabel`, Polish round step 10); everywhere the parent is in view (the tasks table's subtask rows, the parent's subtask list, the training note's Task panel) the subtask shows only its own name.
2. **Self-study is due a week after its training ended, and closes itself then.** Today the subtask is due on the training's date and marked done a week after the end. Now the due date is that same moment: the training's date plus `SELF_STUDY_DONE_AFTER_DAYS` (7) days, and the sweep marks it done when that moment arrives (the entry's end time, 23:59 with none; one minute before it is open, at it done: the existing rule, `selfStudyTaskChanges`). The due date follows the training's date and end like before. The series task's due date (its latest subtask's) and its Done (all subtasks done) follow from that by the existing `seriesChanges`/`settleSeries`.
3. **Locked things must not look editable.** A session task's title is a read-only `<textarea>` that still takes the hover border and the focus ring (screenshot 1). A locked title becomes plain heading text (same font, no input, no hover or focus styling, not a tab stop); the other locked values in that card are checked for the same.

## Links use the app's own look (the user: "use existing UX, UI elements and design style, here and elsewhere")

The "Made by the series …" and "Made by the meeting …" line (`LockLine`, `TaskPage.tsx`) and the training note's Task panel (`TrainingTask.tsx`) link with bare underlined `<Link>`s. The app already links to a task with the `ListChecks` icon (`TrainingMetaFields`, "Open task") and has the entity-chip look for things named in prose. Plan:

- Look at the existing chip and icon-link styles first and reuse them; no new style.
- Find every place a task, meeting, training or series is linked with a bare underlined `<Link>` (list them before editing; the user can strike any) and move them to one small shared component: the kind's icon (`ListChecks` for a task) with the quiet chip look, no underline.

## Existing data

- Existing self-study subtasks are renamed by `repair:session-tasks` (a dry run first, `--apply` only when the user says so, app closed, backup first): subtasks marked `self-study` under a `<series> self-study` parent lose the ending (and the first version's " · self-study"); a title that would then equal a sibling's is listed and left alone.
- Their due dates move to the training's date plus 7 days (the repair also lists those that change), and ones now past that moment are marked done by the sweep as before.
- `plain` in `self-study-task.ts` accepts both title forms, so nothing is orphaned or doubled while old and new exist side by side.
- The note's own sync and the sweep name new subtasks the new way; the sweep renames none that the repair has not been asked to (the notes' sync does it for a task it owns when the note opens, as with the first version's dot).

## Tests and driving

- Unit: the new title (with and without a series), the due date at date + 7 days (end time and no end), done at the moment and not the minute before, the series task following, the repair (rename, collision listed, second run changes nothing), `plain` reading both forms. Mutation-check the due offset and the title rule.
- Drive for real (scratch library, production build and dev mode, light and dark, screenshots read): a training made with a series (subtask "Introduction", parent "<series> self-study"), a series-less one, the locked task page (no ring on hover, Tab or click), the icon links, the tasks table with no prefix, the timer's picker, search and Hours rows with it.

## Order

1. Locked title (decision 3). 2. Links (above). 3. Names, due date, the table/panel prefix, the repair (decisions 1 and 2). Each its own commit.
