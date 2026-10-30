# Watch: a task from a saved item, and one row in Coming up

Proposed 30 Oct 2026, after the user's screenshot of Research's Home: the task "Apply for the BOLD Science Communication
Fellowship" (Today) and the Watch entry "BOLD Science Communication Fellowship · Opportunity · tomorrow" (Coming up) are one
obligation shown twice. **Status: BUILT and driven 30 Oct 2026 in one unattended run, at the user's go-ahead (their exception to "stop at every stage" for this plan); written up in `docs/DECISIONS.md`, "Watch: a task from a saved item, and one row in Coming up". Not applied to the real library: the two columns arrive with the next launch's migration.**

Agreed with the user in conversation (30 Oct 2026): a task is made by a **button** on a Watch row, never automatically on save, and
the task and the item are linked so Home shows them once. This partly reverses `docs/WATCH_UI_PLAN.md` ("do not tick or create tasks
from Watch"), which was about the monthly reminder tasks; it stays true that Watch never creates a task by itself.

## What the user sees

1. **A "Task" action on every Watch row** (landing rows, "See all", Saved), in `ItemActions`, before Save. An icon button with the
   label "Task" (Lucide `ListPlus`; no emoji). On a row that already has an open task it becomes a link-style button "Open task" that
   goes to the task (`ListChecks`), so a second task cannot be made by accident.
2. **Pressing it opens the existing New task dialog, prefilled** (not a silent create: a top-level task needs a list, and the
   dialog already has the list picker, remembered per workspace by `useTaskDefaults`). Prefilled: the title (the item's own title; the
   user edits "Apply for …" if they want), the workspace (the item's), the **due date** (the item's deadline; else its start date;
   else empty), and the description (the item's address, then its summary). Enter confirms. Cancelling makes nothing.
3. **Confirming also saves the item** (`state = 'saved'`), because only saved items reach Coming up and a task whose item can
   drop off the list would lose its deadline. If the item was already saved nothing changes. Undo (Cmd-Z, the app's silent undo, as
   for Save and Mark read in `item-state-undo.ts`) puts the previous state back; the task is the task's own and is undone from its
   own trash or delete, not from Watch.
4. **One row in Home.** While the task is open (not done, not deleted) and its item is saved, Coming up and every notification
   leave out the item's own `watch:<id>` event. The task's row (Today, Coming up, This week, as it already is) carries what the item
   knew: the deadline in its second line ("Admin & Logistics · Apply by 31 Oct", the item's `dateKind` label) and, when the task row
   has room for one, the item's address as an external link (`ExternalIcon`, `components/Link.module.css`). The task's own `due`
   stays its own: the two dates are never synchronised, so starting before the deadline still works.
5. **When the task is done or deleted** the item's own event comes back in Coming up if its date is still ahead (it is still saved).
   Nothing is lost, and the user can dismiss or unsave it themselves.
6. **On the Watch row**, a small muted note, "Task: <title>", as a link to the task, replaces nothing else. It shows whenever the
   row has a task, open or done.
7. **On the task page** (side column, "about it", per `docs/DECISIONS.md` "A reading's metadata belongs in the side column"): a
   `Panel` "Watch" with the item's title as an external link, its section and its deadline or date. Nothing to edit there except
   "Unlink" (one word; clears the link, leaves both sides alone). No "link an existing task" field in this change: say so and leave
   it for the user's reply, because the button covers the case that prompted it.

## Data

- **Tasks migration `tasks/0005_watch_item`** (never edit a shipped one): `ALTER TABLE tasks ADD COLUMN watch_item_id INTEGER` and
  `ALTER TABLE tasks ADD COLUMN watch_url TEXT`, both NULL for every existing task. No foreign key (Watch's tables live in another
  module and a source's removal cascades its items away): the task must keep working if its item is gone. `watch_url` is the
  item's address copied at link time, so the task still shows the call's link after the item is deleted.
  `watch_item_id` can then dangle; every reader treats a missing item as "no item" (the task keeps `watch_url`, the deadline
  line shows only while the item exists).
- `Task`, `NewTask`, `TaskChanges` (`tasks/shared/types.ts`) get `watchItemId` and `watchUrl` (changes: only `unlink`, which clears
  both). `writeTask`, `rowToTask` and the importer's no-op path follow. `snapshot.json` is unchanged (no version bump).
- A manual item (`manual = 1`, "Added by hand") is linkable like any other.
- The item's id is stable (`UNIQUE (source_id, item_key)`; an item found again keeps its row), so the link survives a re-check.
  `restoreManualItem` must put the id back, or the link would dangle after Undo: check it, test it.

## Where it goes in the code

- `src/modules/watch/renderer/ItemActions.tsx` (+ its CSS module): the button. It asks the Tasks module through a small bridge
  (`openNewTask` in `tasks/renderer/new-task-store.ts` grows `title`, `due`, `description` and `watchItem: { id, url }`), not by
  importing Tasks' dialog; `NewTaskDialog` reads them as its initial values and, on confirm, passes `watchItemId`/`watchUrl` to
  `tasks.create`. Keep Watch's renderer free of Tasks internals.
- The "does this item have an open task" lookup: a main-process query (Tasks owns the table) returning `Map<watchItemId, {uid,
title, status}>` for the visible workspace, exposed as `window.api.tasks.watchLinks(workspace)` (add to `Api` and `IPC` in
  `src/shared/api.ts`; nothing generic) and kept fresh by the broadcast the Tasks module already sends on a change
  (`tasks/main/broadcast.ts`). Watch's rows read it through one hook, `useWatchTasks`.
- Saving as part of confirm: `window.api.watch.items.setState` already exists; call it from the same renderer step after the
  create succeeds, through `item-state-undo.ts` so Cmd-Z restores the state.
- `src/modules/home/main/collect.ts` and `home/shared/summary.ts`: `collectHomeSummary` already reads tasks; give
  `buildHomeSummary` the set of watch item ids that have an **open** task (`HomeInputs.watchLinked`) and have the loop at
  `summary.ts` "Only what the user saved" skip those. The task event gets `watch: { label, url } | null` (`HomeEvent.task`), and
  Home's row (`home/renderer`) draws the label and link. The notifier's deadline notification for a skipped item is skipped
  too; the **task's own** due notification is unchanged. A linked task's deadline label uses the item's current `date` and
  `dateKind`, read at summary time, so it follows the item if a re-check moves the date.
- Settings' shortcut list: the button has **no shortcut**; do not add one.
- Copy: "Task", "Open task", "Unlink". No help sentence.

## Tests (write first, then mutation-check each)

- Migration test (`tasks/main/migrations.test.ts`): the two columns exist, existing rows are NULL, a database at 0004 migrates.
- `tasks-store`: create with `watchItemId`/`watchUrl`; unlink clears both and nothing else; a duplicate link is allowed in the
  store but the lookup returns the open task first (the UI hides the button, the store is not the guard; say so in a comment).
- `buildHomeSummary` (`summary.test.ts`): a saved item with an open linked task has no `watch:` event; the same item with a done or
  deleted task has one; an item with no task has one; a linked task event carries the label (deadline vs date) and url; a dangling
  `watch_item_id` changes nothing. **Mutation check:** drop the skip and the first test must fail.
- Notifier: no deadline notification for a skipped item; the task's own notification still fires.
- Watch row logic (pure, in `watch-tasks.ts` + test): button vs "Open task" vs note, by the lookup.
- Prefill (pure, `watch-task-prefill.ts` + test): title, due (deadline, else date, else none; a past date is still given, the dialog
  and `LateChip` already deal with it), description order, the workspace (`research` or `life`), a long summary cut sensibly.
- `restoreManualItem` keeps the id (the link survives Delete then Undo).

## Drive it (CLAUDE.md: scratch library, `CENTRAL_COMMAND_HOME`, real keystrokes, production build and dev mode, light and dark)

Seed a Research library with a manual Opportunity (deadline tomorrow), an automatic Training, and a Life source item. Check:
Task button on a landing row, "See all" and Saved; the dialog prefilled and Enter confirms; the row's "Open task" and note; Home
shows one row (not two) and the task row has the deadline line and link; tick the task done and the Watch row returns to Coming
up; delete then Undo the manual item and the link holds; cancelling the dialog changes nothing; Cmd-Z after confirm restores the
item's old state; tab through the Watch row and the task side column and look for clipped focus rings (screenshots, both themes).
Not driven: macOS notification banners (unit-tested only).

## Decisions I am making (change on request)

- A button, not automatic creation; the dialog, not a silent create (the list is required).
- Creating also saves the item.
- The two dates are not synchronised.
- Done or deleted tasks release the item's own row in Coming up.
- No "link an existing task" field now.
- The task keeps the item's address, so it outlives the item.

## What the build found (30 Oct 2026)

- **The New task dialog was switched off** (13 Oct 2026, `docs/DECISIONS.md`, "The New task dialog is switched off"), so the plan's "the existing New task dialog" had no host mounted. Brought back only its host (`NewTaskDialogHost`, the Tasks manifest's `globals`), with no shortcut, so Settings still lists every shortcut. The Mod-Shift-A shortcut, the "New task" buttons and the palette entry stay off.
- Watch needed one more call than the plan lists: `window.api.watch.items.get(id)`, for the task page's Watch panel.

## Open (the user's call)

- Whether a task should also be offered from a Watch item's row in Settings or a search result. Not built; ask.
- Whether the Home row should show the Watch label at all for a non-deadline item (an event date). Built as: yes, "Starts 3 Nov".
