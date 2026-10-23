# Polish round (23 Oct 2026): 13 items

The user's list of 23 Oct 2026, agreed in conversation. Each item is one feature: implement in full, test (`npm test`, `lint`, `typecheck`), drive it in a
scratch library (see CLAUDE.md, "Testing the app for real"), add a "Polish round" entry to `docs/DECISIONS.md`, commit (one commit per standalone part),
then go on. The user is away: no questions between items. **Stop and give the user a prompt for the next item only where marked "STOP"** (the
big ones, so they can clear context). At the end: a very brief list of the 13 things done, run `npm run build:mac`, install in `/Applications`
(quit the app first), nothing pushed unless the user says so.

## Decisions already made (do not re-ask)

- **Item 1, `new:` modifier only.** No plain-words "New task" row. `new:` joins the search modifiers (`src/shared/search-query.ts`,
  `search-chips.ts`, `search-help.ts`: completion list, chip, ghost-text Tab, help row, Settings → Search). Values: `note`, `task`, `meeting`,
  `training`, `reading-list`. Enter on a `new:<kind>` chip creates the empty thing and navigates to it; it never searches. The workspace is the page's
  (`quickActionWorkspace`), overridden by `workspace:`. The existing `QUICK_ACTIONS` (`shell/quick-actions.ts`) are the one implementation: add
  `new-task` (an empty task page: the old New task dialog code is kept, see `21008c4`; open the task page, title focused, removed when left untouched
  like a new meeting) and `new-reading-list` there, and call them from the palette. Add `new:` to the tests of the modifier table.
- **Item 4, toast.** Dark pill (`--tooltip-bg`), always one line, the quoted title ellipsised in the middle of the sentence (`min-width: 0`,
  `text-overflow: ellipsis`), the action as a small accent-tinted chip at the right edge (no underline, no margin-hack: a flex row with a gap), a thin
  shrinking bar along the foot showing the time left (paused while the pointer is over it). One component: `Toast.tsx`, `Toast.module.css`.
- **Item 6, self-study subtasks.** The series shows as a muted prefix: "Simulating Social Worlds › Day 2 self-study". A display rule, no data change:
  a shared helper builds the label from the subtask and its parent (the task page header, the timer's pickers (parent line under the title), Hours
  rows, search results, the tasks table's subtask rows). Only for tasks with `own_kind = 'self-study'`.
- **Item 10, Home.** "Today" holds today's timed meetings and trainings first (time order), then tasks due today; "Coming up" starts tomorrow. Overdue
  stays separate. A meeting row: title = series, or "Untitled meeting" when it has none (never "Other"); second line `Meeting · with <attendees>`
  (first names or initials as elsewhere). A training row: title; second line `Training · <format>`. The workspace is never shown inside its own
  workspace. A time range (`13:45–15:00`) replaces "Today 13:45". A meeting that is over today drops out as now. Then review the whole Home
  page for consistency (spacing, one row component for task and event rows, the same empty texts).
- **Item 13.** Remove the "Next meeting / None booked" card entirely (the user called it unnecessary; meetings are in Today / Coming up now).
  Drop `NextMeetingCard`, `NextMeeting` and the Home view fields only it used. Its "Open TODOs" count goes with it; say so in DECISIONS.

## Defaults I propose (the user did not object; they can correct at the check)

- **Item 2, locked session tasks (the user's answer, 23 Oct 2026).** A task with `own_kind` (meeting, training, self-study) and the series
  parent tasks the app makes for them: title, **due date**, repeat, list and delete are shown as plain text with a quiet line "Made by the meeting
  <title>" (a link to the note). The due date is set only by `session-sweep.ts` from the note's date, so it is locked on the task and on its subtask
  rows (the series task's subtask list shows dates as text). Status, priority, tags, notes and time (Start, Add time) stay editable. Deleting
  happens through the meeting or training. Enforce in the main process too (the IPC update ignores locked fields for such tasks; the sweep's own
  writes go through the store, not that handler), not only in the renderer. Test: an update of a locked field is refused; a sweep still sets due.
- **Item 3, buttons and year layout.** "New training entry" becomes "New training" (also `quick-actions.ts`, the comments, tests, Settings and
  docs). Audit every "New …" / "Add …" button for one pattern: `New <thing>` in the page header (training, meeting, note, task, reading list,
  person), `Add <thing>` only inside lists; list the changes in DECISIONS. The "YEAR" label and its dropdown sit together at the left, label
  directly before the dropdown (one row: `Year [2026–27 ⌄]`), through `YearSelect` and the places that lay it out (`TrainingPage`, `TrainingPlanPage`,
  `TimeOffPage`, `HoursPage`, `MeetingsPage`, the landings, Home) so every page and every "Contract" choice reads the same way.
- **Item 5, back to today.** Wherever the week or month can be clicked away from the current one (Hours' week header, the shared year if it can
  move), a quiet "This week" button appears next to the arrows, only while away from today's week; Enter/click returns to it. "This month" where
  the stepper is a month. Add a shortcut only if the page already has arrow shortcuts (and list it in Settings).
- **Item 8, clipped blue borders.** The focus ring / highlight of the Mod-K field and the highlighted result row are cut at the popup's edge
  (the popup clips with `overflow`). Give the scroll container the 4px padding and `scroll-padding` the pitfalls list asks for, and check the ring
  rectangle against each clipping ancestor, in dark and light, in the palette and the results window.
- **Item 9, the stray middle dot.** A task row's second line is `<list> · due in 3 days`; with no list the leading "·" is dropped. Then answer
  "why no list name": find why the task has none (an unlisted task, or the row not being given it) and show the list name wherever there is one,
  with nothing at all (not a dot) where there is none. One shared line-builder, used by Home, the tasks table and the landing.
- **Item 11.** Marking a recurring task done shows the toast "Done. Next one is due <date>" with an **Open** chip that navigates to the new
  task (`toast-store` action; the main process must return the new task's uid from the status update).
- **Item 12.** The default toast time goes from 6 s to 9 s (`showToast`'s `ms`), 12 s for toasts with an action; check every caller that passes
  its own `ms`.

## Item 7 (the user's answer: wrapping)

The toast `Deleted "Attend and present at …" (3:45). Undo` wrapped onto two lines. Covered by item 4 (always one line, title ellipsised); add a
test or a driven check with a very long title, and with the "(3:45)" and an action present. Done together with item 4.

## Order and stops

1. Item 12 + item 4 (toast, with item 7's wrapping check), item 11 (Open link on recurring done). Commit each.
2. Item 3 (button names, year layout), item 5 (back to today), item 8 (clipped borders), item 9 (stray dot). Commit each.
3. Item 13 (remove card), then item 10 (Home). **STOP** after item 10, with a prompt for the next.
4. Item 6 (self-study label), item 2 (locked session tasks). **STOP** after item 2.
5. Item 1 (`new:` modifier). **STOP**.
6. Last: `npm run build:mac`, install, the 13-line list.

Every stage: update `docs/ROADMAP.md`, and CLAUDE.md's "What is built" with one line at the end.
