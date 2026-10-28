# Central Command: conventions for Claude Code

A local-first Electron + React + TypeScript desktop app. The build brief is
`central-command-mvp-phase1-brief.md`; when this file and the brief disagree,
ask the user.

## Commands

- `npm run dev`: run the app with hot reload
- `npm test`: Vitest unit tests (run under plain Node; better-sqlite3 ships
  N-API prebuilds so no Electron rebuild is needed)
- `npm run lint`, `npm run typecheck`, `npm run format`
- `npm run build:locate`: builds `resources/Locate.app` (the Weather location helper, `native/locate.swift`; macOS, Xcode command line tools); `build:mac` runs it first
- `npm run repair:session-tasks [-- --apply]`: the tasks the app makes for meetings and trainings against the notes that name them (marker, title, series task, due date, shared, orphans, trainings without a self-study task; marks the tasks Research training notes name; series tasks' date and status); dry run by default (a throwaway copy of the database, nothing touched), `--apply` only when the user says so, app closed, backs up first; trashes nothing
- `npm run backfill:life-self-study [-- --apply]`: the self-study tasks for Life trainings made before the sweep covered Life (the sweep's "made in the app" rule lifted for Life entries); dry run by default, `--apply` app closed, backs the database and Life notes up; applied 26 Oct 2026 (`docs/DECISIONS.md`), do not re-run
- `npm run check:work-lists`: report only; the live Work tasks whose top-level list is not a client of a contract (expected: none; real library 7 Oct 2026: none)
- `npm run import:reading-list -- --file <docx> [--title "…"] [--list-dir <folder>] [--apply]`: turn a Word reading list into a Reading list
  (dry run by default; macOS only)
- `npm run luminos:meetings [-- --apply]`: the 14 meetings of the oldest Work contract (times, topics, own tasks, minutes moved; contract total checked); applied 25 Oct 2026 (`docs/DECISIONS.md`), do not re-run
- `npm run luminos:meetings-2 [-- --apply]`: the 8 meetings of the second Work contract (1 May – 31 Oct 2026): times, topics, new series tasks per note series, minutes moved, Research series tasks renamed to "<series> meetings"; applied 25 Oct 2026 (`docs/DECISIONS.md`), do not re-run
- `npm run people:from-notes [-- --apply]`: list people named in meeting attendees and training leads who are not in the people list, with
  proposed initials (dry run by default; apply only with the app closed)
- `npm run tidy:reading-lists [-- --apply]`: bring reading list entries to reading entities (shorten linked ones, link typed citations that match exactly one reading); dry run by default, applied 2 Oct 2026; re-run after adding readings to Zotero
- `npm run repair:training-folders [-- --apply]`: training notes' `folder:` links from relative (to the old Trainings folder setting) to absolute paths, and the setting out of `settings.json`; applied 26 Oct 2026 (`docs/DECISIONS.md`, "Training files: any folder"), a dry run now finds nothing, do not re-run
- `npm run watch:from-tasks [-- --apply]`: the addresses in the "Check upcoming …" reminders as Watch sources, plus what must be checked by hand (dry run by default, read-only; `--apply` only when the user says so, app closed, backs the database up first)
- `npm run link:citations [-- --apply]`: turn plain-text citations ("Kim et al. (2020)") into reading entities; only an exact single match is linked, the rest are listed (dry run by
  default; applied 2 Oct 2026, re-run when new readings exist)
- `npm run link:people [-- --apply [--first-names-off]]`: people named in prose to person entities. Rules (the user's, 11 Oct 2026; code in `src/shared/people-mentions.ts`): **never the user themselves** (the person flagged `me` in `people.json`), **never someone the note says was in the meeting** (`attendees`, or a training's `lead`/`leads`), **only the first mention of a person per note**; a first name two people share is listed, never guessed. Authoritative (it also removes chips that break the rules, so a second run changes nothing) and refuses to write unless un-chipping the result gives back the original. Dry run by default, backs each note up first, `--apply` only when the user says so, app closed. Applied 11 Oct 2026 (`docs/DECISIONS.md`); a dry run now finds nothing.
- `npm run tidy:blank-runs [-- --apply]`: cut every run of blank lines to one in all notes (the front matter's trailing blanks included); dry run by default, backs each note up, apply with the app closed; applied 17 Oct 2026 (`docs/EXTRA_BLANK_LINES_PLAN.md`, stage 2), a dry run now finds nothing
- `npm run tidy:paragraph-blanks [-- --apply]`: remove every single blank line between two lines of text where the editor's parse reads the note the same, and list the ones it keeps by kind; dry run by default, backs each note up, apply with the app closed; applied 17 Oct 2026 (`docs/UNIFORM_LINES_PLAN.md`, stage 2), a dry run now removes nothing (77 kept)
- `npm run standardise:bullets [-- --apply]`: write every list bullet as `-` (never `*` or `+`) in all notes except Readings; dry run by default, backs each note up, applied 12 Oct 2026 (`docs/DECISIONS.md`); a dry run now finds nothing
- `npm run fullname:chips [-- --apply]`: write every person chip's label as the person's full name in all notes except Readings (12 Oct 2026, the user's request: a chip says what the thing is called now, and a person rename rewrites the prose label too); dry run by default, backs each note up, apply only with the app closed; applied 12 Oct 2026, a dry run now finds nothing
- **A spelling the rules cannot resolve is the user's call, and lives in their library**, `~/CentralCommand/data/people-aliases.json` (not the repo — it is their data):
  `{ text, person, workspaces?, notes? }` per entry, where leaving out both `workspaces` and `notes` means everywhere. `link:people` reads it, tries a decided spelling before
  the generic ones, refuses to start if an entry names someone not in the people list, and leaves a first name out of its "to map" report once an entry settles it. The four
  entries of 11 Oct 2026: "Caitlin B." is Caitlin Baron everywhere; "Chris" is Chris Cummiskey in Work and in `meetings/research/2026-05-21 Luminos.md` (the same meeting as the
  Work note of that date, written up twice); "Caitlin" is Caitlin Baron in `2025-10-02 Supervision.md` and `2025-10-20 Impact.md`. Add to the file rather than the script

All of test, lint and typecheck must pass before finishing a checkpoint.

## Architecture

- `src/main/`: Electron main process (DB, settings, IPC handlers). Keep IPC
  handlers thin; logic lives in plain modules that can be unit-tested without
  Electron.
- `src/preload/`: exposes the typed `window.api` and nothing else.
- `src/shared/`: types and constants used by both processes (`Api`, `IPC`
  channel names, `Settings`, `APP_NAME`).
- `src/renderer/src/`: React UI. `theme/` (tokens, fonts, base CSS), `components/`
  (shared UI), `shell/` (top bar, routing, Ask launcher).
- `src/modules/<name>/`: one folder per feature module, split into `main/`, `renderer/` and `shared/`, with an
  `index.ts` manifest the shell reads. Readings and Meetings are the patterns to copy. Shared notes machinery
  (guarded file access, watcher, editor, session) lives in `src/main/notes/` and `src/renderer/src/notes/`; the
  remembered-UI-state hook is `useModuleState`. A page with a note has one shape, and it is not re-specified per page:
  `DocSplit` (`renderer/src/notes/`) is the text-and-panels grid, `Panel` (`renderer/src/components/`) is the labelled
  card each panel (and each body block, such as a reading's reference) sits in, and the side column — not the panel —
  is what stays in view and scrolls. What goes in the side column is what the app knows _about_ a thing, not part of
  the thing itself (`docs/DECISIONS.md`, "A reading's metadata belongs in the side column", "Which side of 'about it'
  the APA reference falls on").
- `src/renderer/src/editor/`: the one editor, `LiveEditor` (CodeMirror 6; the Markdown text is the document and everything drawn is a decoration
  over it, so opening never reformats and saving writes exactly what is in the editor; markers show only where the cursor is). Notes, Work notes,
  Meetings, Training entries and plan, Reading lists and Readings notes all render it inside `EditorCard`. Decision: `docs/DECISIONS.md`, "Notes
  editor: CodeMirror 6"; plan and stage write-ups: `docs/EDITOR_LIVE_MARKUP_PLAN.md`, "Live markup … stage 1" to "stage 8". Plain modules, one per concern:
  - `live-state.ts`: the state (Markdown/GFM, history, the file's own line break), synchronous change reporting
  - `live-reveal.ts`: pure rules for when a span's or block's markers show; `live-decorations.ts`: the `ViewPlugin` that draws everything
  - `live-widgets.ts`: bullets, numbers and checkboxes as atomic units; `live-entities.ts`: mention chips, the `@` trigger, whole-chip Backspace
  - `live-tables.ts`: grid away from the cursor, Tab between cells; `live-fences.ts`: fence lines shown only inside the block
  - `live-keymap.ts`: every binding (Settings' Notes editor list is tested against it); `live-format.ts`: inline and block formatting keys
  - `live-lists.ts`: Enter, Shift-Enter, Tab, Backspace, Delete in lists and quotes; `live-lines.ts`: line parsing shared by them; `live-motion.ts`: Home
  - `live-links.ts`: Cmd-click and paste-a-URL-over-a-selection; `live-paste.ts`: plain-text paste; `live-history.ts`: each command its own undo step
  - `live-find.ts`, `live-outline.ts`: Find and replace and the outline jump, through small bridge objects (`notes/find-types.ts`,
    `entities/mention-target.ts`, and Meetings' `todo-live.ts`)
  - tests: one `*.test.ts` per module, helpers `live-test-utils.ts`, `live-key-utils.ts`, `live-history.testing.ts`, and the real-library gate (`live-library.gate.ts`, run as `live-library.<part>.test.ts` files so the parts run in parallel)
- Path aliases: `@shared`, `@modules`, `@renderer`.

## Conventions

- TypeScript strict. Prettier + ESLint.
- Styling: plain CSS with design tokens from `theme/tokens.css` and CSS Modules.
  No raw hex values in components, no Tailwind or UI kits, no gradients, no
  emoji as icons (use Lucide).
- The main process is CommonJS. A new ESM-only main-process dependency must be added to
  `externalizeDeps.exclude` in `electron.vite.config.ts` (see docs/DECISIONS.md), and the
  built app should be launched once to confirm it loads.
- Every schema change is a numbered SQL migration (`<module>/NNNN_name`). Never
  edit a shipped migration.
- No hardcoded personal paths: resolve from `app.getPath('home')`.
- Renderer access to the main process goes through `window.api` only; add a
  method to `Api` and `IPC` in `src/shared/api.ts` rather than exposing anything
  generic.
- Choose from a list with `Select` (a wrapper over `Picker`, `src/renderer/src/components/`), never a native `<select>` and never a new menu: more than seven options (or `search`) opens with a search field, a shorter list is type-ahead, and a value that is not there yet is an `add` row. Skills, People, the group field and the task box are the same list (`PickerPopup`). Not for the editor's `@` picker, Mod-K, `DatePicker`, `TimeInput`, `Segmented`.
- A tooltip is `Tooltip` (`src/renderer/src/components/Tooltip.tsx`; `whenCut` for text that may be ellipsised), never a native `title=` attribute (ESLint rejects it on a DOM element and on `Button`). A `title` prop that is a heading (`LandingHeader`, `Dialog`) is fine.
- Every keyboard shortcut is listed in Settings. App-level handlers match with `matchesShortcut` from `src/shared/shortcuts.ts`
  using the same chord string the list shows; a module adds its shortcuts to `shortcuts` in its manifest. Add or change the
  entry whenever you add or change a shortcut.
- Commits are small: one per feature and per standalone part of a feature.
- **Stop at the end of every stage of a plan and ask the user for next steps; never start the next stage in the same turn**, even when the order was agreed. The user clears context between stages.

## Where things stand and where to look

Detail lives in `docs/DECISIONS.md` (why things are as they are, including bugs found by using the app: read it before changing sync, notes, the editor or
the module structure), `docs/ROADMAP.md` (the user's review list and the TODOs for Claude: keep them current) and one `docs/*_PLAN.md` per feature. The brief
(`central-command-mvp-phase1-brief.md`) is authoritative for the visual design (section 9) and the stage plan (section 12); the app is "Central Command", the
workspaces are Life, Research and Work, data lives in `~/CentralCommand/`, and the app name lives in one place (`src/shared/app-info.ts`).

**Standing rules about the work**

- Do not start a new feature without the user's go-ahead; push only when they say so; never re-ask a decision a plan records ("agreed with the user").
- Decisions the user has not answered (the live editor questions, the stage 5 Research linking, the Watch/Home open questions) are listed in `docs/ROADMAP.md`;
  do not act on them until they answer. Never write scratch files (logs, screenshots) outside the session scratchpad.
- Reuse patterns: landings, filter rows, export buttons, people and skills fields are shared components; keep UI text short (one-sentence help, one-word buttons,
  no optional extra choices unless asked), and ask if a module needs something different.
- Everything applied to the real library is recorded in `docs/DECISIONS.md`, "One-off scripts applied to the real library" and the per-script write-ups; a dry
  run of an applied script finds nothing. Do not re-run an import with `--apply` (the ClickUp import refuses anyway).

**What is built** (all pushed unless the ROADMAP says otherwise)

- Readings (Zotero sync, notes, APA copy), Reading lists, Meetings (Research and Work), Training (entries, the plan, Export), Notes (Research, Work, Life), People
  (a page per person), global search (Mod-K, `in:<source>`) and Find in a note (Cmd-F, inside the editor).
- Tasks (`docs/TASKS_PLAN.md`): SQLite, ClickUp import applied 6 Oct 2026, Work hours linked to tasks (Work is billable work only: no billable / non-billable
  distinction anywhere). The ClickUp export is in `~/CentralCommand/imports/clickup/`; it dropped most descriptions, restored by `backfill:clickup-links`.
- Hours and Time off (`docs/TIME_PLAN.md`), Work's contracts (`docs/CONTRACTS_PLAN.md`: overlapping contracts, a client belongs to one) and the shared year (52
  weeks from a Monday, `useYear`); one top-level Tasks list per Work client (`docs/CLIENT_LISTS_PLAN.md`); the timer and tasks rule, "every hour has a task"
  (`docs/TIMER_TASKS_PLAN.md`, stages 1 to 4 done; stage 5, Research's historical data, waits for the user's answers); meetings and trainings make their own
  subtasks by themselves (`task: auto`).
- Meetings, trainings and the timer (19 Oct 2026, `docs/MEETING_TASKS_PLAN.md`): tasks the app makes for a session carry `own_kind` (`meeting`, `training`, `self-study`); a new meeting has only today's date and is removed with its task when left untouched; deleting a meeting trashes its own task in the main process; the timer's pickers hide session tasks; every titled, dated Research or Life training entry gets its self-study task from the main-process sweep (Life added 26 Oct 2026) (due on its date, done a week after its end; old trainings are never backfilled). Built, repair applied 19 Oct 2026, pushed and installed.
- Self-study tasks for trainings (`docs/SELF_STUDY_PLAN.md`; revised 19 Oct 2026, see the line above): Start and Add time on a training note go to the training's own `<title> · self-study` subtask under one
  `<series> · self-study` task per series, made when first pressed (`selfstudy:` in the note); the training's own task is the session and has no Start. `entryMinutes`
  counts the session plus both tasks.
- Hours counted the same way everywhere (`docs/HOURS_CONSISTENCY_PLAN.md`): one shown year (`hours/shared/shown-year.ts`), one year choice (`yearToShow`) and one set of
  Home figures (`periodFigures`) serve the Hours page, Home, the Home summary and `snapshot.json` (`week` and `work`). Every report of time is to the quarter hour (18 Oct 2026): a note's start and end sit on 00/15/30/45 in `TimeInput`, and `durationMinutes` rounds, so Hours and the training log agree.
- **Deleting a task, meeting or training takes its hours with it (20 Oct 2026, `docs/DECISIONS.md`, "Deleting a task takes its hours with it")**: the time linked to the task (and its subtasks, or a meeting's or training's own tasks) leaves Hours, is kept in `<time>/removed-with-task/` and comes back on Undo or restore; a Cancel-first `DeleteTimeDialog` says how much, and only when there is some. Built, driven (production and dev), pushed.
- The editor: `LiveEditor` (CodeMirror 6) replaced Milkdown everywhere; every editor sits in `EditorCard`; panels use `DocSplit` and `Panel` (architecture above).
- **Search modifiers (19 Oct 2026, `docs/SEARCH_MODIFIERS_PLAN.md`, `docs/DECISIONS.md`, "Search modifiers")**: Slack-style `in:`, `workspace:`, `with:`, `by:`, `status:`, `priority:`, `due:`, `list:`, `tag:`, `skill:`, `series:`, `has:`, `before:`/`after:`/`on:`/`during:`, `-` to exclude, quoted phrases, notices and a completion list in Mod-K (`src/shared/search-query.ts`). Built unattended, pushed, installed 19 Oct 2026. **Refined the same day (`docs/SEARCH_REFINEMENTS_PLAN.md`, `docs/DECISIONS.md`, "Refinements"; built, pushed, installed)**: the help row, notice and completion list sit at the top; only a real search says "No results."; finished modifiers are chips in the field (`ChipInput`, `useChipQuery`, rules in `src/shared/search-chips.ts`), one remaining completion shows as ghost text (Tab); the modifier table `src/shared/search-help.ts` feeds the help row's chips and Settings → Search; "See all results" grows the Mod-K window (no `/search` page: the route only redirects to the window; `SearchResultsPage` is deleted).
- **Polish round, step 1 (23 Oct 2026, `docs/POLISH_ROUND_PLAN.md`, `docs/DECISIONS.md`, "Polish round")**: the toast (`Toast.tsx`) is a dark one-line pill with the quoted title ellipsised, the action a chip, a shrinking time bar that pauses under the pointer, 9 s (12 s with an action). Built, driven (dev and production, light and dark), pushed; later steps of the plan are not started.
- **Polish round, step 2 (23 Oct 2026)**: marking a recurring task done shows "Done. The next one is due …" with an **Open** chip that goes to the new task (`setTaskStatus`; `shell/navigate-store.ts` lets code outside React navigate). Built, driven (dev and production, light and dark), pushed; step 3 below.
- **Polish round, step 3 (23 Oct 2026)**: done with no due date gives the task today (`TasksStore.setStatus`, main process; also the open subtasks a finished parent closes; not session tasks; reopening leaves the date; Undo puts "no date" back). Built, driven (dev and production, light and dark), pushed; step 4 is not started.
- **Polish round, step 4 (23 Oct 2026)**: "New training" (was "New training entry"); header buttons are `New <thing>`, list buttons `Add <thing>` (New reading list, New person, New time off, Add contract); the year choice is `Year [2026–27 ⌄]` in `YearSelect` (own label before the dropdown; `LandingSection labelHidden` starts the landings' group at the left). Built, driven (dev and production, light and dark), pushed; step 5 is not started.
- **Polish round, step 5 (23 Oct 2026)**: Hours' Week and Invoice cards show a quiet "This week" / "This month" button (`BackToToday`) beside the arrows only while away from today. Built, driven (dev and production, light and dark), pushed; step 6 is not started.
- **Polish round, step 6 (23 Oct 2026)**: the Mod-K field's focus ring is an inset `::after` (`ChipInput.module.css`), no longer clipped by the window's rounded corners. Built, driven (dev and production, light and dark), pushed; step 7 below.
- **Polish round, step 7 (23 Oct 2026)**: `taskLine` (`tasks/shared/query.ts`) builds a task's second line without a stray "·"; Home gives a subtask its parent's list. Built, driven (dev and production), pushed; step 8 is not started.
- **Polish round, step 8 (23 Oct 2026)**: the Home page's "Next meeting" card (and its Open TODOs count) is removed; `homeView` has only `tasks` and `comingUp`. Built, driven (dev and production), pushed; step 9 is not started.
- **Polish round, step 9 (23 Oct 2026)**: Home's "Today" holds today's timed meetings and trainings first (`13:45–15:00`, `Meeting · with KR`, `Training · Online`, "Untitled meeting"), then overdue and due tasks; "Coming up" starts tomorrow; one `Row` for tasks and events. Built, driven (dev and production, light and dark), pushed; step 10 is not started.
- **Polish round, step 10 (23 Oct 2026)**: a self-study subtask shows its series as a muted prefix ("Simulating Social Worlds › Day 2 self-study"): `studyLabel`/`studySeries` (`tasks/shared/study-label.ts`) and `TaskName`, in the tasks table, search, the timer's picker and popover and Hours' rows; display only, no data change. Built, driven (dev and production, light and dark), pushed; step 11 is below.
- **Polish round, step 11 (23 Oct 2026)**: locked session tasks (`tasks/shared/session-lock.ts`, `tasks/main/session-lock.ts`): a meeting's, training's or self-study task has title, list, due date, status, repeat and delete locked (refused in the main process; shown as plain text with a "Made by …" line); a series task (the parent of such tasks) has no due date (the sweep clears it) and its status stays the user's; priority, tags, notes and time stay free. The notes' own sync uses `updateForSession`/`deleteForSession`. Built, driven (dev and production, light and dark), pushed; step 12 is not started.
- **Polish round, step 12 (23 Oct 2026)**: the `new:` search modifier (`note`, `task`, `meeting`, `training`, `reading-list`): Enter on its chip makes the empty thing through `QUICK_ACTIONS` (`new-task`, `new-reading-list` added; `shell/new-kind.ts`) and opens it; a new task is ordinary, due today, and removed when left untouched. Built, driven (dev and production, light and dark), pushed. The round is finished.
- **Self-study names and dates (23 Oct 2026, `docs/SELF_STUDY_NAMES_PLAN.md`, `docs/DECISIONS.md`, "Self-study names and dates")**: a self-study subtask is named after its training ("Day 1"; the series task says `<series> self-study`, a series-less training keeps `<title> self-study`) and is due, and closes, a week after the training (end time, 23:59 with none); the "Series ›" prefix stays only in search, the timer's picker and Hours rows; a locked task's title is plain heading text; links to tasks, meetings, trainings and series are plain names with an icon button, never a chip or a hyperlink (23 Oct 2026, `docs/DECISIONS.md`, "Task links: icons, not chips"; `EntityLink` is deleted). `repair:session-tasks` renames and redates existing subtasks (applied 23 Oct 2026, a dry run finds nothing). Built, driven (dev and production, light and dark), pushed, installed.
- **Series tasks are "<series> meetings" everywhere (25 Oct 2026, `docs/DECISIONS.md`, "Series tasks are named …")**: one rule for Research and Work (`proposeMeetingTask`; "Other" is "Other meetings"; a name already ending in "meetings" is kept); the second Work contract's meetings were done with it (`luminos:meetings-2`, above). Built, tested, pushed.
- **Polish round 2 (23 Oct 2026, `docs/POLISH_ROUND_2_PLAN.md`, `docs/DECISIONS.md`, "Polish round 2")**: Select lists as wide as their field; Work's Meetings use the contract (`usePeriod`); `new:` takes title, `list:`, `due:`, `priority:`, `tag:` (`parsed.create`); a series task's due date is its latest subtask's and it is Done once all are (`seriesChanges`, `settleSeries`; replaces step 11's rule for series); the task page counts earlier-marked history its ClickUp time does not hold; tags in the details row; lighter toast; Cmd-Z's toast in the active voice (`UndoEntry.message`); `repair:session-tasks` also marks the tasks training notes name. Built, driven (production build; dev mode not driven), pushed, installed 23 Oct 2026; `repair:session-tasks` applied to the real library the same day (a dry run now finds nothing).
- **Subtasks, trainings and Home (24 Oct 2026, `docs/SUBTASK_DISPLAY_PLAN.md`, `docs/DECISIONS.md`, "Subtasks, trainings and Home")**: Home's "See all" and the landing's "All tasks" open the Open view; Coming up is 3 days; one `LateChip` ("N days late") for an overdue task in Home, the Tasks table, the task page and search; `SubtaskLine` (`↳ parent · list`) in Home, search, the timer picker and popover (420px) and Hours' rows; `hiddenTaskUids`/`visibleTasks` (`tasks/shared/session-lock.ts`) hide a meeting's and a training's own task and the series task over them from every task view (`useTasksList(workspace, true)` keeps them for the pages that must find one; hours, sync and deletion are unchanged); a self-study task shows as its training (`studyName`, "Series: Title", a cap icon, `Training · self-study`). Built, driven (production build and dev mode, light and dark), pushed, installed.
- **Contracts of any length (24 Oct 2026, `docs/CONTRACT_SPAN_PLAN.md`, `docs/DECISIONS.md`, "Contracts of any length")**: a Work contract file has an optional `end` (its real last day; `contractEnd`/`inContract` in `shared/tracking/workspace-weeks.ts` answer every question about a date), `weeks` is only the rounded-up reporting grid, days after `end` in the last report week belong to no contract, the aim is not prorated; old files (no `end`) read as before and `setContractEnd` writes `end` and `weeks` together. Research is untouched. Built, driven (production build and dev mode, light and dark), pushed, installed.
- **Task lines (25 Oct 2026, `docs/TASK_LINE_PLAN.md`, `docs/DECISIONS.md`, "Task lines")**: one second line for a task everywhere: `dueText` (`due today`, `due tomorrow`, `due 12 Nov`), `lineDue` (no date for done, undated or overdue), `TaskSecondLine` (the line plus `LateChip` for an overdue task, in Hours rows, the timer picker and popover), `detailOfTask` in `tasks/shared/task-place.ts`, and the `@` picker's `↳ Parent · list · Workspace`. Built, driven (production build and dev mode, light and dark), pushed; not installed.
- **One-line tables and one tooltip (25 Oct 2026, `docs/ONE_LINE_TABLES_PLAN.md`, `docs/DECISIONS.md`, "One-line tables and one tooltip")**: Training and Meetings rows are one 48px line (`components/ListTable.module.css`, `CutText`, `SkillChips limit`, `InitialsChips`, icons after the title), grouped under "Upcoming" / "Earlier" header rows (`shared/upcoming-groups.ts`, `GroupRow`; `grouped` prop, to follow the sort when Sorting consistency is built), "No date", "Upcoming" the only word; one `Tooltip` for every tooltip (all native `title=` replaced). Built unattended in one run, driven (production build and dev mode, light and dark), pushed; installed only if the app was not running (see the final report of 25 Oct 2026).
- **Outline as a rail, stage 1 (25 Oct 2026, `docs/OUTLINE_RAIL_PLAN.md`, `docs/DECISIONS.md`, "Outline as a rail")**: `NoteOutline` is a hairline rail with an accent line on the heading being read (`Panel bare`, no card), above Files in the Training entry's one side column; `roomySide` is removed from `DocSplit`. Built, driven (production build and dev mode, light and dark), pushed.
- **Outline as a rail, stage 2 (25 Oct 2026)**: `visibleOutline(outline, current)` (`src/shared/markdown-outline.ts`) lists the `#`/`##` headings and only the open section's `###`s (a `###` with no `#`/`##` above is a top heading); the heading holding the one being read is `--ink` with a `--border-strong` rule; a folded `###` is not in the DOM; a note with no headings shows no outline (25 Oct 2026). Built, driven (production build and dev mode, light and dark, 1500px and 1000px, Training entry and plan, Notes, Readings), pushed.
- **Home and self-study series tasks (26 Oct 2026, `docs/DECISIONS.md`, "Home shows a self-study task as its training")**: Home's task lists leave out the series task over self-study tasks (`studySeriesUids`); each self-study task is one row named as its training; other task views keep the series task. A duplicate "AI Agents for Research self-study" series task was merged by hand the same day (`docs/DECISIONS.md`). Built, tested, pushed, installed; not driven in a scratch library.
- **Right-to-left text (26 Oct 2026, `docs/DECISIONS.md`, "Right-to-left text")**: each editor line takes its first strong letter's direction (`live-direction.ts`, `src/shared/text-direction.ts`); a table's columns follow its header, each cell is its own run; `rtlEdges` in `live-selection.ts` draws the band edges CodeMirror leaves out; text fields are `dir="auto"` (`lib/auto-direction.ts`). No spell check on right-to-left lines and cells; a text cell's run includes the spaces round it (27 Oct 2026). Built, driven (production build), real-library gate passed for the first commit; pushed, installed.
- **Year heat map by rank (27 Oct 2026, `docs/DECISIONS.md`, "Year heat map: shade by rank")**: `heatLevel` (`hours/shared/heat.ts`) shades a day by its place among the year's worked days, four bands, the same in every workspace (no aim, average or busiest-day reference), so a 1 h and a 9 h day differ. Built, tested, committed; not driven in the app.
- **Subtask order (27 Oct 2026, `docs/DECISIONS.md`, "Subtask order")**: a subtask list is in the user's own order (`position`, new ones last; drag on the task page calls `moveSubtask`, which renumbers the siblings); done ones show after the open ones and keep their place; a meeting's or training's subtasks (`ownKind`) stay by date and cannot be dragged; the drag starts only from a grip at the row's left edge, shown on hover (27 Oct 2026, `docs/DECISIONS.md`, "Subtasks: drag from a handle"). Built, tested, driven (production build, light); dev mode and dark mode not driven; pushed, installed.
- **Pickers (23 Oct 2026, `docs/PICKERS_PLAN.md`, `docs/DECISIONS.md`, "Pickers")**: one type-to-search way to choose from a list (`Picker`, `PickerPopup`, `picker-match.ts`); `Select` wraps it, `ComboField` and `DescribedSelect` are gone, Series and Institution add a value. Built, driven in the built app and dev mode, pushed, installed 23 Oct 2026.
- Dark mode (colours are `light-dark()` pairs in `tokens.css`: a new colour needs both), Settings in tabs, a few Mac conventions, entities (`@` mentions as
  `[label](cc://kind/key)` chips), packaging (`npm run build:mac`, installed in `/Applications`; quit it before replacing it).
- **Life's Home and Watch per workspace (28 Oct 2026, `docs/LIFE_HOME_PLAN.md`, `docs/DECISIONS.md`, "Home: Life has one", "Watch: sources per workspace"; replaces "Home: Life is left out of the summary")**: Life's landing shows Home; `HomeSummary.tasks` is a record per workspace with caps of 5 (`SHOWN_TASKS`, `SHOWN_UPCOMING`), trainings have `trainingRoute(workspace, id)`, Life's hours count its trainings (`periodFigures(data, now, workspace)`: only Work is by invoice period), one digest per workspace (`digest:<workspace>:<date>`), the timer reminder opens its workspace's Hours, `snapshot.json` carries every workspace; Watch is per workspace (`watch/0004_workspace`, `createWatchModule('research' | 'life')`, `/life/watch`, `HomeSummary.watch` a record per Watch workspace, a Workspace column and field in Settings → Watch). Built in one run at the user's request (all five stages), tested with mutation checks, driven in a scratch library (production build and dev mode, light and dark), pushed; **not installed** (the app was running, so it was not replaced: quit it and run `npm run build:mac`).
- **Polish round 3 (28 Oct 2026, `docs/POLISH_ROUND_3_PLAN.md`, `docs/DECISIONS.md`, "Polish round 3")**: no tooltip on Export; `isUpcoming(row, today, now)` (`isUpcomingSession`, `src/shared/time.ts`): a session dated today is upcoming until its end, with every caller passing `clockNow()`; the "No hours until" lines are removed; `TimeInput invalid` and `endBeforeStart` make an end before the start red; `hasSummary` puts a summary icon on Training and Meetings rows; Hours' task, meeting and Add rows and both forms share one grid (`--hours-pad`, `HoursForm.module.css`, guard `hours/renderer/row-grid.test.ts`). Built, tested with mutation checks, driven (scratch library, production build and dev mode, light and dark), pushed, installed.
- **Polish round 4 (28 Oct 2026, `docs/POLISH_ROUND_4_PLAN.md`, `docs/DECISIONS.md`, "Polish round 4")**: `isNow` and a "Now" `Badge` on landings and in Meetings and Training tables; no late pill on Hours' task rows (`TaskSecondLine noLate`); Escape-leaves-full-screen decided from the state at keydown (`listenForEscape`, capture phase) plus an Escape/Enter table for the whole app; Home's Today and Coming up capped at 5 rows (`capRows`, `HomeSummary.upcomingCut`) with "+N more · See all" in the card header; one focus rule for text fields in `theme/base.css` (a thin accent border, no outline). Built, tested with mutation checks, driven (scratch library, production build and dev mode, light and dark, except where DECISIONS says), **not pushed, not installed**.
- **Watch (26 Oct 2026, `docs/WATCH_UI_PLAN.md`, `docs/DECISIONS.md`, "Watch: the page, the sources and what they replace")**: built unattended in one run, driven in a scratch library (production build and dev mode, light and dark), pushed. `src/modules/watch/` checks the public pages and feeds the user lists (nothing is requested while no source exists). The page (`/research/watch`, and `/life/watch` since 28 Oct 2026; each workspace's landing card): Saved, Trainings, Conferences as the landing's rows with save and dismiss, "See all trainings / conferences" lists (`WatchAllPage`), Settings → Watch (the sources table and dialog only: no suggestions, no by-hand list, no notification switches, 26 Oct 2026, the user's call). Two kinds only (a summer school is a training); no keywords in the UI; only **saved** items' deadlines reach Home's Coming up and notifications; `watchNew` and `watchSavedDays` (off by default) work without the master notification switch. `npm run watch:from-tasks` (16 addresses) is **not applied**: only on the user's go-ahead. Open: journals, quiet hours, two places without an address. **Home** (summary, weather, notifications, `data/widget/snapshot.json`; the Swift widget is not built) is in `docs/WATCH_HOME_PLAN.md`.

## Testing the app for real (unit tests are not enough)

Several bugs (a launch crash from an ESM-only dependency, lost keystrokes, a dev-only editor
failure) were invisible to unit tests and only found by driving the actual app. Do this for any
UI, main-process or data-flow change, and look at screenshots (the Read tool shows PNGs).

- Never launch the app against the user's real `~/CentralCommand/`: it migrates and syncs their
  real database. Use a scratch library: create `<scratch>/CentralCommand/data/`, copy a
  `zotero-export.bib` in, and set `CENTRAL_COMMAND_HOME=<scratch>` (read in `getAppPaths`).
- Playwright is not a repo dependency. Install `playwright-core` in a scratch folder outside the
  repo and drive Electron from there:
  - Production build: `npx electron-vite build`, then `_electron.launch({ executablePath:
<repo>/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron, args: ['.'], cwd:
<repo>, env: { ...process.env, CENTRAL_COMMAND_HOME: <scratch> } })`.
  - Dev mode (`npm run dev`, which runs React StrictMode): start `CENTRAL_COMMAND_HOME=<scratch>
npx electron-vite dev -- --remote-debugging-port=9333`, then `chromium.connectOverCDP(
'http://localhost:9333')`. Check dev mode as well as the production build; they differ.
  - Clipboard contents: `app.evaluate(({ clipboard }) => clipboard.readText())` (also `readHTML`).
  - Type real keystrokes (`page.keyboard`) rather than setting state; several bugs only showed
    up that way. Test leaving the page or quitting immediately after typing.
- Kill stray processes afterwards, but only ones you started: the user often has their own `npm run dev` running on the real library, so check
  with `pgrep -fl electron` before any `pkill`, and prefer closing your own app with `app.close()` in the script.

## Pitfalls learned the hard way

- The live editor (CodeMirror 6, `src/renderer/src/editor/`):
  - `markdown()` brings its own Enter/Backspace keymap and paste-URL handler; both are switched off (`addKeymap`, `pasteURLAsLink`) because ours replace them.
  - A keymap binding with `preventDefault: true` looks handled when it is not; press the key in a test (`runScopeHandlers`) rather than trusting the binding.
  - A line break is one position in the document but two characters in a CRLF note: use `withBreaks` and `positions` in `live-lines.ts` and insert the note's own
    break, never a bare `\n`.
  - `syntaxTree(state)` keeps the tree of the first ~3,000 characters a state was built with until a transaction follows the full parse. Build test states with
    `stateFor` (it parses first, then sets the selection); any other way makes a long note's tail look like plain text, and the gate was blind to it for stages 2 to 5.
  - Every hidden (replaced) range is an empty element in its line, and a CSS grid makes it a cell of its own (see the table rows in `LiveEditor.module.css`).
  - A CSS rule that pads a `.cm-line` class must be spelled `.wrap .cm-editor .cm-line.live-x`, or the editor's own `.cm-line { padding: 0 }` reset wins (it hid
    nested-quote indents and heading spacing for six stages; unit tests read the DOM and passed).
  - The real-library gate must pass before each editor change is finished: copy `~/CentralCommand/notes` and `backups` into the session scratchpad and run
    `LIVE_EDITOR_LIBRARY=<that copy> npx vitest run src/renderer/src/editor/live-library`. It is opt-in, so a plain `npm test` skips it; it takes about two minutes (it was ten as one file: the parts, and the slow ones in shards, are separate files so vitest runs them in parallel; add a part or a shard as a new `live-library.<part>.test.ts`).
  - Change reporting must stay synchronous (`EditorView.updateListener`, no debounce): a debounced reporter once lost the last keystrokes on quick exit.
- React StrictMode runs effect, cleanup, effect back to back without awaiting: lifecycle methods
  (`NotesSession.start`/`dispose`) must change state synchronously.
- Better BibLaTeX list fields (`publisher`, `location`, `institution`) parse as arrays, not strings.
- When scripting edits with Python `str.replace`, assert the target exists: Prettier reflows
  lines, so a stale pattern silently does nothing. Run Prettier before matching on layout.
- Focus rings (2px outline plus 2px offset) are clipped by any ancestor with `overflow` other than
  visible (the board's card lists were). Give scroll containers 4px padding and `scroll-padding`, and
  check clipping, not just that an outline exists: compare the ring rectangle with each clipping
  ancestor while tabbing through every screen, and look at screenshots.
- Chain shell steps with `&&` only when a failure should stop the chain; a failing test followed
  by an unconditional commit has happened. Keep commits compile-clean.
- For safety-critical logic (never lose notes, never overwrite, conflict handling, import rules)
  deliberately break the code ("mutation check") and confirm a test fails. This found real gaps.
- Commit granularity matters to the user: one commit per feature and per standalone part.

- Before applying any importer to the user's real files, dry-run it on them and read every line: the meetings dry run found
  that the Readings body conversion deleted `## Notes` headings, which no synthetic fixture had shown. Give importers a
  safety check that compares the converted result with the source (TODO text, counts, ticked boxes) and leaves out a
  note that fails it. Never run one with `--apply` on the real library unless the user asked.
- Driving the editor with Playwright on macOS: `Home`/`End` scroll the page (use Cmd+Left/Right), a key sent within
  milliseconds of a click can act on the old selection (wait a moment), and a controlled checkbox updates after an IPC
  round trip (click and wait; `.check()` fails). Check dev mode and the production build both.
- The React Compiler lint rules reject refs read during render and `setState` inside an effect. Keep behaviour that an
  editor extension or key handler needs in a small class held with `useState(() => new …)` (see `useTodoHelper`), and derive
  "draft" values instead of copying props into state.
- A `main` scroll container needs `scroll-padding` or a focused control's ring is cut at the edge (People settings).

## Writing meeting and training summaries

When asked for a summary of a meeting or training, write only the text for its `## Summary` section and give it in chat; the user pastes it
themselves (never edit their note). Read the existing summaries first (`~/CentralCommand/notes/meetings/research/*Supervision.md`, `notes/training/`)
and match them. Summarise `## Notes` only, never `## Previous TODOs`.

- **Meetings**: one to two lines, no bullets, no names, decisions or details: `Key topics: <topic>, <topic>. Next steps: <the main work
to do next, short>. Next meeting <Mon D, YYYY>.` Example: "Key topics: Study 1 paper introduction feedback. Next steps: Study 1 introduction
  and discussion draft. Next meeting Jul 29, 2026." Topics are short noun phrases (the `discussed` list is a good source); leave out
  "Next meeting" when the notes give no date.
- **Training**: one or two plain sentences on what the session covered, e.g. "Introduction to plotly, styling and customising plotly
  graphics, advanced charts." Do not paste the course blurb or schedule.
- If a draft runs past about two lines, it is too detailed: cut it.

## Never

- Never write to the Zotero `.bib` file or to Zotero.
- Never delete or overwrite a Readings note file. A `readings` row missing from the Zotero export
  is deleted only when nothing is attached to it (no notes, no Reading Lists mention, no `@`
  mention anywhere); a row with any of those is still never deleted, just flagged
  `missing_from_source`. Meetings differ: a meeting note can be deleted, but only by an
  explicit user action with a confirmation, and it goes to the macOS Trash (`shell.trashItem`),
  never removed outright. Meeting notes are still never overwritten: saves check the file's
  content hash, and a new meeting never replaces an existing file.
- Never send user data over the network. (Watch requests only public pages the user listed, with no identifiers; the weather sends only a town's rounded position and is off until chosen; the town's name is asked of Apple's own lookup with the precise position, the user's choice of 18 Oct 2026; nothing else gets more than the rounded one.)
- Never commit secrets or user data; user data lives in `~/CentralCommand/`.
