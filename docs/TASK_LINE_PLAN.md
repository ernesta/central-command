# Task line consistency plan (25 Oct 2026)

A consistency check of the second line of a task row (Hours rows, the timer picker and popover, Home, search, the `@` picker) found
five differences. All agreed with the user on 25 Oct 2026; item 6 is deliberately left alone. Decision on the due wording: `due today`,
`due tomorrow`, `due 12 Nov` (not a bare `Today` / `12 Nov`).

## The rules after this plan

1. **One due wording.** `dueText(due, today)` in `tasks/shared/query.ts`: `due today`, `due tomorrow`, `due 12 Nov` (`formatDue` for
   the date part, so a date in another year keeps its year). Hours rows, search and Home's "Coming up" all call it. Home's "due in 2
   days" becomes the date.
2. **One place decides whether the line shows a due date.** `SubtaskLine` takes `due` (replacing `rest`'s use for dates). Rows with no
   trailing chip (Hours rows, timer picker, timer popover, search) show it; rows that already carry a chip or a section that says it
   (Home "Today" and overdue, the Tasks table) do not repeat it. A done task shows none.
3. **An overdue task shows `LateChip`, never a past date in the line.** Add it to Hours rows, the timer picker and the popover (it
   shows already in Home, the Tasks table, the task page and search). In a row with a chip, `dueText` is not shown for an overdue
   task.
4. **The `@` task picker uses the shared line.** `tasks/renderer/entities.ts`: `↳ Parent · <list › sublist>` for a subtask (the same
   `subtaskParent` and `detailOfTask`), the list for any other task. The workspace name is dropped unless the picker lists both
   workspaces at once (check what it does; if it always does, keep it only there).
5. **One "list › sublist" for a task.** `detailOfTask` (`hours/shared/start-picker.ts`) moves to `tasks/shared` (keep a re-export or
   update the imports) and is the one version: `search.ts` and the task page call it (or `listLabel`), instead of re-deriving it.
   Home's SQL in `home/main/collect.ts` stays (it has no task list in memory) but builds its text with `listLabel`, as now.
6. **Not changed:** the `·` in `Subtasks · 2 of 5 done` and tooltips (a different kind of text).

## Stages (one commit each; do all of them in one go, no stop between stages)

1. `dueText` + tests; `SubtaskLine` `due` prop; tests for the line (subtask, plain, self-study, with/without due, done, overdue).
2. Hours rows, timer picker, popover: `due`, `LateChip`.
3. Search and Home "Coming up": `dueText`; Home Today/overdue unchanged.
4. `@` picker line.
5. One `detailOfTask`; search and task page use it.
6. Write up in `docs/DECISIONS.md` ("Task lines") and the ROADMAP/CLAUDE.md "What is built" line.

Drive the built app and dev mode (scratch library, light and dark) on: Hours with a task due today, tomorrow, in the future, overdue
and a subtask; the timer picker and popover; Home; Mod-K; the `@` picker. Look at screenshots.
