# Central Command: conventions for Claude Code

A local-first Electron + React + TypeScript desktop app. The build brief is
`central-command-mvp-phase1-brief.md`; when this file and the brief disagree,
ask the user.

## Commands

- `npm run dev`: run the app with hot reload
- `npm test`: Vitest unit tests (run under plain Node; better-sqlite3 ships
  N-API prebuilds so no Electron rebuild is needed)
- `npm run lint`, `npm run typecheck`, `npm run format`
- `npm run import:obsidian -- --vault <path> [--apply]`: import reading notes from an Obsidian vault (dry run by default)
- `npm run import:work-hours -- --sheet <xlsx> --logs <Activity Logs folder> [--detail YYYY-MM] [--apply]`: import the Work sheet "Time Tracking" into two contracts (one entry
  per row with its client), checked against the monthly Word activity logs (dry run by default; macOS only; never overwrites a contract that holds data; `--apply` only when the
  user says so, app closed; applied on 5 Oct 2026 (both contracts, 128 + 84 entries), so a dry run now reports both as already holding data and writes nothing)
- `npm run link:worksheet -- --write <csv>` / `--check <csv>`: the editable worksheet for linking Work's hour entries to tasks (pre-filled best matches; the check says what does not add up; changes nothing in the library; sheet in `~/CentralCommand/imports/work-links/worksheet.csv` since 6 Oct 2026, rules for 5 Oct, activity logs and timers built in)
- `npm run link:work-apply [-- --apply]`: applied on 6 Oct 2026 (213 entries linked, tasks renamed, merged, split and made; a second run refuses). Dry run prints every task change.
- `npm run link:work-hours [-- --apply [--include-low]]`: link Work's imported hour entries to tasks when their minutes add up to the task's ClickUp time exactly (dry run by default; `--apply` only when the user says so, app closed; backs up `time/work/` first; not yet applied to the real library)
- `npm run import:clickup -- --file <csv> [--apply]`: import the ClickUp export into Tasks (SQLite; dry run by default; de-duplicates by Task ID and stops if two rows with one id
  differ; never adds to a store that holds tasks; `--apply` only when the user says so, app closed; the report must show 2,193 -> 1,211 rows, 1,082/98/31 by status,
  663/548 top-level/subtasks and 1,612.8 h across 628 tasks)
- `npm run import:notes -- --vault <path> [--workspace work] [--apply]`: import the free notes (Data Sources, Ideas, Thesis, Placement; with
  `--workspace work`, the loose notes plus Admin & Compliance) from an Obsidian
  vault into Notes, all ungrouped (dry run by default; only ever creates files)
- `npm run import:meetings -- --vault <path> --meeting-notes <path> [--apply] [--add-people]`: import meeting notes from
  Obsidian and the Word log and notes (dry run by default; macOS only)
- `npm run import:work-meetings -- --vault <path to the Meetings folder> [--apply]`: import the Work meetings (dry run by default; applied)
- `npm run import:hours -- --old <xlsx> --new <xlsx> [--apply]`: import the two Google Sheets (Study Hour Tracker and Time Off Tracker, one workbook
  per tracking year) into Hours and Time off year files (dry run by default; never overwrites a year that holds data)
- `npm run import:reading-list -- --file <docx> [--title "…"] [--list-dir <folder>] [--apply]`: turn a Word reading list into a Reading list
  (dry run by default; macOS only)
- `npm run import:training -- --inkpath <xlsx> [--obsidian <notes>] [--trainings <folder>] [--apply] [--add-people]`: import the Inkpath
  training log (dry run by default)
- `npm run reconcile:meetings -- --inkpath <xlsx> [--apply]`: copy skills and missing times from the Inkpath log into meeting files (dry run by
  default)
- `npm run people:from-notes [-- --apply]`: list people named in meeting attendees and training leads who are not in the people list, with
  proposed initials (dry run by default; apply only with the app closed)
- `npm run strip:created [-- --apply]`: remove the retired `created:` line from every note's front matter (dry run by default; applied on
  29 Sep 2026, so a dry run now finds nothing)
- `npm run tidy:series [-- --apply]`: one-off tidy of training series and titles (series = full programme name, title = the session; applied
  on 30 Sep 2026, so a dry run now finds nothing)
- `npm run tidy:reading-lists [-- --apply]`: bring reading list entries to reading entities (shorten linked ones, link typed citations that match exactly one reading); dry run by default, applied 2 Oct 2026; re-run after adding readings to Zotero
- `npm run link:citations [-- --apply]`: turn plain-text citations ("Kim et al. (2020)") into reading entities; only an exact single match is linked, the rest are listed (dry run by
  default; applied 2 Oct 2026, re-run when new readings exist)
- `npm run tidy:headings [-- --apply]`: take out the blank lines next to headings in every note except Readings (new notes are made without them, the editor draws
  the space itself); dry run by default, backs each note up first, applied 2 Oct 2026 (199 notes, 676 lines; a dry run now finds nothing)
- `npm run convert:topics [-- --apply]`: turn bold pseudo-headings (`**Topic**`) in meeting notes into `###` topics (dry run by
  default; `--apply` backs each note up first)

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
  remembered-UI-state hook is `useModuleState`.
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
  - tests: one `*.test.ts` per module, helpers `live-test-utils.ts`, `live-key-utils.ts`, `live-history.testing.ts`, and the real-library gate `live-library.test.ts`
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
- Every keyboard shortcut is listed in Settings. App-level handlers match with `matchesShortcut` from `src/shared/shortcuts.ts`
  using the same chord string the list shows; a module adds its shortcuts to `shortcuts` in its manifest. Add or change the
  entry whenever you add or change a shortcut.
- Commits are small: one per feature and per standalone part of a feature.
- **Stop at the end of every stage of a plan and ask the user for next steps; never start the next stage in the same turn**, even when the order was agreed. The user clears context between stages.

## Where things stand and where to look

- **Tasks is built and unpushed; the ClickUp import was applied to the real library on 6 Oct 2026 (so a dry run now reports it already holds tasks)** (5 Oct 2026, an unattended run): stages 1 to 7 and the buildable part of 9 of `docs/TASKS_PLAN.md` (SQLite, `src/modules/tasks/`, `npm run import:clickup`, the user's review list is at the top of "For the user" in `docs/ROADMAP.md`). Stage 8 (Work hours become tasks) waits for the user's answer. Decisions: `docs/DECISIONS.md`, "Tasks: plan and mockup" and the stage write-ups. The ClickUp export: `~/CentralCommand/imports/clickup/` (a CSV that lists most tasks twice; de-duplicate by Task ID). Do not re-run the import with `--apply` (it refuses anyway).

- **Tasks stage 8, Work hours linked to tasks, is done and applied to the real library (6 Oct 2026)**: all 213 Work hours entries (326:15) have a task, ClickUp time equals the hours task by task (326:15), tasks were renamed, merged, split and made, task dates follow the hours, the Month card has a balance, the task page lists hours by month. **Work is billable work only (6 Oct 2026, the user's decision): there is no billable / non-billable distinction in the app** (no Billable choice, no billable-only Month card, no filter); the 74 non-billable Work tasks (5:30) were saved to `~/CentralCommand/exports/work-non-billable-tasks.csv`, put in the trash and the `billable` tag removed from every task (`npm run drop:billable`, applied 6 Oct 2026; a second run finds nothing). Write-ups: `docs/DECISIONS.md`, "Stage 8 …" (several). Backups: `~/CentralCommand/backups/work-final-*`, `work-match-*`. The user accepted the names and merges as they are (no open items) (top of `docs/ROADMAP.md`).
- Phase 1 stages 1 to 6 are done (foundations, shell, Readings sync, Readings UI, detail page with
  notes editor and APA copy, polish pass). What is left is the user's review and the push.
  `docs/ROADMAP.md` is the checklist; `docs/DECISIONS.md` records what the polish pass changed.
- Meetings is done (all nine stages of `docs/MEETINGS_PLAN.md`) and awaits the user's review and the push. The user's
  real meetings were imported. `docs/ROADMAP.md` lists the follow-ups. What to build next is the user's call; do not
  start a new feature without their go-ahead.
- `docs/DECISIONS.md` explains why things are the way they are, including bugs found by using the
  app. Read it before changing sync, notes, the editor or the module structure.
- The brief (`central-command-mvp-phase1-brief.md`) is authoritative for the visual design
  (section 9) and the stage plan (section 12). It has been updated for the renames: the app is
  "Central Command", the third workspace is "Work" (`work`), and data lives in `~/CentralCommand/`.
- Training is done (all ten stages of `docs/TRAINING_PLAN.md`) and has had two review rounds; Meetings gained an academic-year
  selector, skills and an hours counter. Both importers have been applied to the real library (129 training entries, 35 meeting
  files updated). Everything up to the second review round is pushed. The two TODO lists (for the user and for Claude) are at the
  top of `docs/ROADMAP.md`; keep them current. Push only when the user says so.
- Reuse patterns: landings, filter rows, export buttons, people and skills fields are shared components; use them rather than
  building a variant, and ask if a module needs something different. Keep UI text short: one-sentence help, one-word buttons, no
  optional extra choices unless asked.
- Since the second Training review: Meetings' Export (the Supervision log as a PDF; printing and page shell shared with Training) and the
  Training plan (one Markdown file per academic year, `notes/training-plans/`, the user's 2026–27 draft copied in) are built. The
  People page is built (`docs/DECISIONS.md`, "People page"; mockup `docs/design/people-and-plan-mockup.html`) and awaits the user's review.
- **Notes** is built (all nine stages of `docs/NOTES_PLAN.md`; `docs/DECISIONS.md`, "Notes") and awaits the user's review: one flat folder of
  notes, a group and optional subgroup per note shown as `Thesis › Methods`, up to four pinned notes, quick capture with Mod-Shift-n, and
  `npm run import:notes`, applied to the real library on 25 Sep 2026 (12 notes, ungrouped, wiki links stripped). Notes is pushed. Studies stays "Coming
  soon"; Ideas, Data Sources, Inbox and Thesis are not modules.
- Since the Notes review: every editor sits in the shared `EditorCard` (`src/renderer/src/notes/`): a white window with a quiet line
  "Created · Edited · N words" under the text (`docs/DECISIONS.md`, "Editor card"), and a live outline of its own headings beside it
  (`NoteOutline`, Notes only so far). Meetings' and Training's tables use the shared `useRowNavigation`. All importers and the topic
  conversion are applied to the real library (dry runs find nothing left). Work since the last push (26 Sep 2026) is committed but not
  pushed. Dark mode is built (Settings → Theme; `docs/DECISIONS.md`, "Dark mode"): colours are `light-dark()` pairs in `tokens.css`, so
  a new colour needs both values. Settings is categorised into tabs (General, one per module, Shortcuts, About; `docs/DECISIONS.md`,
  "Settings").
- **Global search (Mod-K)** is built and since extended at the user's request: People, Notes, Meetings, Training and Readings, in that
  fixed order; `in:meetings` (or any source, singular or plural) restricts to it; a small command palette (New note/meeting/training,
  Settings, People, the data folder) shares the same window; "See all results" opens a full page. A module offers `search` in its
  manifest and the shell asks them all (`docs/DECISIONS.md`, "Global search", including how results are ranked). **Find within a note**
  (Cmd-F) is separate and built into the shared editor itself (`editor/live-find.ts`; `docs/DECISIONS.md`, "Find in the note" is the original, now historical, and stage 5 of the live markup work). The ideas list (People pages, Home,
  writing) is at the top of "Later" in `docs/ROADMAP.md`; none is started.
- The app name lives in one place (`src/shared/app-info.ts`); it may be renamed again. A few Mac conventions were added (proper name
  in the Dock, an About panel, a Dock menu with quick actions; `docs/DECISIONS.md`, "Mac conventions sweep").
- **27 Sep 2026, six things worked through while the user was away, all now pushed**: Training's entry page gained a side
  panel like Meetings' (Files above Outline); Find in the note was redesigned as an inline bar in `EditorCard`'s own footer
  with Cmd-Option-F replace (Cmd-Return / Cmd-Shift-Return); **Reading lists** is a new module (a list is sections of
  entries, each linked to a reading or held as a placeholder citation, since reshaped to reading entities; see the Stage 4 write-up in `docs/DECISIONS.md`); a page per
  person is built (their meetings, trainings, open TODOs, last-met/next-meeting, and links); and a Work meetings importer
  was built and dry-run against the real vault (since then Work got its own Meetings module, `createMeetingsModule('work')`,
  and the import was applied; `docs/DECISIONS.md`, "Work meetings import"). Two real bugs were found only by driving the built app, not by reading code
  (a citekey marker that the old Milkdown editor's serialiser would have silently corrupted; a person's links silently failing to
  save because the IPC handler had never heard of the field) — both fixed. Full write-up in `docs/DECISIONS.md`; immediate
  TODOs for the user are at the top of `docs/ROADMAP.md`'s "For the user" list.

- **29 Sep 2026, a long round of feedback and features, all pushed** (details in `docs/DECISIONS.md`, from "Editor feedback round" on): editor
  fixes (links: `[text](url)`, paste a URL over selected text, plain URLs always links, Cmd-hover pointer; Cmd-Shift-V plain paste, caught in
  the main process because Electron's menu owns that chord; even bullet spacing; "Saved" in the card's facts line, which no longer shows
  Created); the Training plan laid out like a note; **Notes for Work** (`createNotesModule(workspace)`, like Meetings) with the Work notes
  imported; the palette and Dock "New note/meeting" follow the current workspace; a **Workspace menu on note and meeting pages** moves the
  item (`moveNoteFile`: copy first, Trash the original after, never overwrite, keeps the modified time); `created` removed from notes
  entirely (`npm run strip:created`, applied); and **entities**: `@` in any editor mentions a person, reading, meeting or note as a
  `[label](cc://kind/key)` link drawn as a chip (registry of providers in module manifests, `src/renderer/src/entities/`, format in
  `src/shared/entities.ts`; notes and meetings get a `uid` in their front matter when first linked; person renames rewrite mentions;
  "Mentioned in" panels read the note folders on request). Tasks, when built, add one provider and one kind.

- **Live markup editor (30 Sep 2026, all nine stages done; all pushed)**: `LiveEditor` replaced
  Milkdown everywhere and Milkdown is gone (architecture above). The user's open questions about it (live editor questions 1 to 14, the stage 7 and 8 review
  items) are in `docs/ROADMAP.md`, "For the user"; do not act on them until they answer. Never write scratch files (logs, screenshots) outside the session scratchpad.

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
    `LIVE_EDITOR_LIBRARY=<that copy> npx vitest run src/renderer/src/editor/live-library`. It is opt-in, so a plain `npm test` skips it.
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
- Never delete or overwrite a Readings note file, or delete a `readings` row; missing
  items are flagged, not removed. Meetings differ: a meeting note can be deleted, but only by an
  explicit user action with a confirmation, and it goes to the macOS Trash (`shell.trashItem`),
  never removed outright. Meeting notes are still never overwritten: saves check the file's
  content hash, and a new meeting never replaces an existing file.
- Never send user data over the network.
- Never commit secrets or user data; user data lives in `~/CentralCommand/`.

- **Hours and Time off (1 to 2 Oct 2026, stages 1 to 9 of `docs/TIME_PLAN.md`, all built)**: the rules (`src/shared/year.ts`, `src/shared/tracking/`), the store, the importer
  (applied to the real library on 1 Oct 2026), the Hours page for Research (Today, the top-bar timer chip, the week, the balance card, Settings -> Hours), Dock and palette
  items, an idle Start chip in the top bar, Charts and weeks (`/hours/year`: weeks, running balance, year heat map, typical week, All weeks, Years;
  `docs/DECISIONS.md`, "Charts and weeks"), and **Time off** (`src/modules/time-off/`, its own module; "Time off page"). The 1 Oct feedback round is built
  (`docs/DECISIONS.md`, "Hours feedback round"); a running task counts whole minutes everywhere (2 Oct). **Meetings, Training, the Training plan and the search use the shared
  year** (52 weeks from a Monday, a start date such as `2026-09-21`, `useYear`); the old academic year is gone ("Training and Meetings use the shared year"). The Mac app is
  packaged (`npm run build:mac`) and installed in `/Applications`; it reads `~/CentralCommand` (`docs/DECISIONS.md`, "Packaging and installing the Mac app"); quit it before
  replacing it. Allowance days not listed as time off come off the plan on the year's last day (`docs/DECISIONS.md`, "Unlisted allowance days"). **Work's Hours (5 Oct 2026) is built** (`docs/DECISIONS.md`, "Work's Hours: weeks, contracts and months"): Work has contracts instead of the shared year (whole weeks, Friday to Thursday, `src/shared/tracking/workspace-weeks.ts`), a whole-week aim (`plan.weekAim`) and a Month card for invoicing; it has no Time off. A contract's weeks begin on its own first day, any weekday (5 Oct 2026; the past contract is Wed to Tue). Work entries and the timer carry a client (Impact, Teaching & Learning; `plan.clients`, `docs/DECISIONS.md`, "Work history import", stage 2); Research has none. Left: importing the past Work data from the user's Google Sheet (stages 3 and 4 of 4, `docs/ROADMAP.md`), and Tasks. The user's review items are at the top of `docs/ROADMAP.md`.
