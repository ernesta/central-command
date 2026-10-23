# Polish round 2 (23 Oct 2026): the user's first look at the installed round

The user's answers after checking the 14 things of `docs/POLISH_ROUND_PLAN.md` in the installed app. **All of it is one job** (the user's
rule of 23 Oct 2026, overriding the one-stage-per-session rule for this plan): implement every item, drive it in a scratch library (dev and
production, light and dark, look at the screenshots), tests/lint/typecheck, write up (`docs/DECISIONS.md` "Polish round 2", ROADMAP, CLAUDE.md
"What is built"), small commits, push, `npm run build:mac`, quit the app, install in `/Applications`. No questions: the decisions are below.
Everything the user said "yes" to is authorised, including the one change to the real library (item 3, apply step).

## 1. Year select

- **The Year list is still too wide** (the open list is about twice the field's width and far wider than "2026–27"). `Select minWidth={0}` in
  `YearSelect` was not enough: measure the popup in the built app (`Picker.tsx` sets `minWidth`, then `width` from `offsetWidth`; find what else
  gives it width: the option row, the description column, the search row) and make it as wide as its field, at least as wide as its longest
  option. Same check for every other short `Select` (Repeats, Priority, workspace): a list never wider than it needs.
- **In Work the year choice is always the contract**, never an academic year, on every page that has one: `Contract [first day – last day ⌄]`
  (`YearSelect workspace="work"`; `contractLabel`, `hasContracts`). Audit every `YearSelect`, `useYear`, `yearLabel(` and "Hours of …, 2026–27"
  text reached from Work (Meetings landing and page, the Hours of meetings figure, the PDF export name and its toast, "No meetings in …",
  Time off (already passes the workspace), Tasks, Home, search `during:` help if it names years) and make Work use the contract's own dates
  (read `docs/CONTRACTS_PLAN.md`: overlapping contracts, a client belongs to one). Work's meetings are filtered by the chosen contract's first and
  last day (`meetingsInYear` takes a range, not an academic year). Research and Life keep the academic year.

## 2. `new:` carries more

`new:task` takes what else is in the query: **plain words become the title**, `list:` the list (a list or `list/sublist`; in Work it must be a
client, else the notice the field already gives), `due:` the due date (a value `due:` accepts: `today`, `tomorrow`, `week`; not `overdue`),
`priority:` and `tag:` the priority and tags. `workspace:` already carries. For the other kinds plain words become the title where the kind has
one (note, reading list; a training's title; a meeting has none and ignores them). Such modifiers are no longer notices when `new:` is present.
They are not filters then: `parseSearch` puts them in a `create` object (kind, title, list, sublist, due, priority, tags). Update the help
row and Settings → Search lines for `new:`. Tests: the parser, `runNewKind`, the quick action with fields.

## 3. Session tasks, series tasks, and the old ones

- **Marker for the old ones.** The real library has 24 subtasks under "PS5210 Applied Neuroscience Methods" (and likely more under other
  series) with no `own_kind`, so they are neither locked nor linked to their notes. Extend `npm run repair:session-tasks`: for every Research
  training note whose `task:` names a task (and every meeting note, see its existing report), set `own_kind` (`training`, `meeting`) on that
  task and `selfstudy:` ones as `self-study`, and report which tasks it would mark, which notes name no task, and which tasks it cannot match.
  Dry run first, **read every line** (CLAUDE.md "Before applying any importer"), then, with the user's authority from this plan, ask them to quit
  the app, back up (the script does), `--apply`, record it in `docs/DECISIONS.md` "One-off scripts applied to the real library", reopen nothing.
  Then PS5210 and its subtasks are locked and linked ("Made by the training …").
- **Introduction's time.** A PS5210 subtask, "Introduction" (`sxbn2jqc`), shows no time on its own page while Hours shows 2:00 against it on
  Wed 30 Sept. Find why (tracked time linked to a different uid, a series task, or the page's `taskTime` missing time that is on the row) and fix
  the cause; test it with the real shape (a time entry on a subtask with a series parent).
- **A series task's explanatory line goes** ("Meetings and trainings keep the tasks under this one." says nothing). Its lock line is a link
  instead: to the series (the Meetings series page, or the training series page) or, where there is none, to the meeting or training itself
  (`LockLine` in `TaskPage.tsx`: "Made by the series <name>" with the link). A session task's line already links to its note: keep.
- **Tags are not on their own line.** On the task page the tag chips and "+ Tag" sit with something else (beside the title when there is room,
  or in the details row), not in a line of their own; the design is yours, look at screenshots (dark and light) and keep it consistent with
  the notes' and readings' pages if they show tags.
- **Series tasks, the user's new rule** (replaces step 11's "no due date, status is the user's"). A meeting or training series task is the
  app's: **its due date is always the latest due date of its subtasks, and its status is Done once all its subtasks are done** (and open again,
  In progress, when a subtask is added or reopened). Both set by `settleSessionTasks` (the sweep, at launch and every minute) and also straight
  away when a subtask changes, so the table, the page and Home agree. A series with no subtask has no date and stays as it is. `sessionLock` for
  `series` locks due date and status too (`fieldLocked`), and the task page and table show them as plain text. Reword the series lock tests
  (a series can no longer be given a due date or status by hand; the sweep does). The repair script reports the series tasks it would change
  (date, status) in its dry run and applies them in the same `--apply`. The done-with-no-date rule (step 3) does not apply to them.

## 4. Training note, Task row

The series prefix in front of a self-study task's name ("Simulating Social Worlds › Day 2 self-study") is a link to the series (parent) task,
as the task's own name links to its page; plain text only before the parent exists (`TrainingTask.tsx`).

## 5. Toast, more elegant

The dark toast is "a tad chunky": make it lighter. Smaller padding and type (13px), a slimmer Open/Undo chip (less padding, no heavy weight),
a thinner time bar, a softer shadow and a hairline border rather than the outline now there, a smaller radius to match the app's buttons. Look at
it next to the app's other floating things (the picker list, tooltips) in both themes and in a screenshot with a long title.

## 6. Cmd-Z's toast

"Undid the status change of “X” from To do to Done." is clunky. Say what happened to the thing, in the active voice: **"Changed status of
“X” back to To do."**; for the other task edits "Changed due date of “X” back to 30 Oct.", "Changed list of “X” back to Training.", "Changed
priority of “X” back to P2."; a deletion's undo "Brought back “X”." Keep the Open chip. `UndoEntry` gets an optional full `message`; entries
without one keep "Undid the {label}." Tests: the messages, with a very long title (ellipsised), and a value that was empty ("no date").

## Not part of this plan

Nothing else. Do not start the ClickUp import, the Watch page or the Swift widget.
