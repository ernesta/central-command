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
- `npm run import:notes -- --vault <path> [--workspace work] [--apply]`: import the free notes (Data Sources, Ideas, Thesis, Placement; with
  `--workspace work`, the loose notes plus Admin & Compliance) from an Obsidian
  vault into Notes, all ungrouped (dry run by default; only ever creates files)
- `npm run import:meetings -- --vault <path> --meeting-notes <path> [--apply] [--add-people]`: import meeting notes from
  Obsidian and the Word log and notes (dry run by default; macOS only)
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

## Where things stand and where to look

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
  (Cmd-F) is separate and built into `NotesEditor` itself (`docs/DECISIONS.md`, "Find in the note"). The ideas list (People pages, Home,
  writing) is at the top of "Later" in `docs/ROADMAP.md`; none is started.
- The app name lives in one place (`src/shared/app-info.ts`); it may be renamed again. A few Mac conventions were added (proper name
  in the Dock, an About panel, a Dock menu with quick actions; `docs/DECISIONS.md`, "Mac conventions sweep").
- **27 Sep 2026, six things worked through while the user was away, all now pushed**: Training's entry page gained a side
  panel like Meetings' (Files above Outline); Find in the note was redesigned as an inline bar in `EditorCard`'s own footer
  with Cmd-Option-F replace (Cmd-Return / Cmd-Shift-Return); **Reading lists** is a new module (a list is sections of
  entries, each linked to a reading or held as a placeholder citation, with an "Attach a reading…" picker); a page per
  person is built (their meetings, trainings, open TODOs, last-met/next-meeting, and links); and a Work meetings importer
  was built and dry-run against the real vault (since then Work got its own Meetings module, `createMeetingsModule('work')`,
  and the import was applied; `docs/DECISIONS.md`, "Work meetings import"). Two real bugs were found only by driving the built app, not by reading code
  (a citekey marker that Milkdown's own serialiser would have silently corrupted; a person's links silently failing to
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

- **Live markup editor (30 Sep 2026; stages 1 to 8 done, stage 8 committed but not pushed, stage 9 write-up next after the user's review)**: the notes editor is
  `src/renderer/src/editor/` (CodeMirror 6, the Markdown text is the document, markers drawn only where the cursor is). `LiveEditor` is the only
  editor: Notes, Work notes, Meetings, Training entries and plan, Reading lists and Readings notes all render it, and Milkdown and its
  dependencies were removed in stage 8. Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`; write-ups in `docs/DECISIONS.md` ("Live markup … stage 1" to "stage 8").
  Find, `@`, the outline and the Meetings TODO helper talk to it through small bridge objects (`notes/find-types.ts`, `entities/mention-target.ts`,
  `modules/meetings/renderer/todo-live.ts`). A CSS rule that pads a `.cm-line` class must be spelled `.wrap .cm-editor .cm-line.live-x` or the editor's
  own `.cm-line` reset wins (it hid nested-quote indents and heading spacing for six stages). Pitfalls: `markdown()` brings its own Enter/Backspace keymap and
  paste-URL handler (both switched off); a keymap binding with `preventDefault: true` looks handled when it is not; a line break is one position but two
  characters in a CRLF note (`withBreaks`, `positions` in `live-lines.ts`); after `prettier --write` re-check any scripted text replacement. The
  real-library gate (`LIVE_EDITOR_LIBRARY=<copy of ~/CentralCommand/notes and backups> npx vitest run src/renderer/src/editor/live-library`) must pass
  before each editor change is finished. Two more pitfalls: `syntaxTree(state)` keeps the first ~3,000 characters' tree until a transaction
  follows the full parse (`stateFor` parses first, then sets the selection; a test that builds states any other way sees a long note's tail as plain text), and every hidden (replaced)
  range is an empty element in its line that a CSS grid makes a cell of its own (see `LiveEditor.module.css`, table rows). Never write scratch files (logs, screenshots) outside the session scratchpad.

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

- Milkdown: its change listener is debounced (~200 ms) and loses the last keystrokes on quick
  exit; use the synchronous `notesChangePlugin`. Its `ctx` is only valid during plugin setup, and
  `serializerCtx` is a placeholder until the view is created.
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
  editor plugin or key handler needs in a small class held with `useState(() => new …)` (see `useTodoHelper`), and derive
  "draft" values instead of copying props into state.
- A `main` scroll container needs `scroll-padding` or a focused control's ring is cut at the edge (People settings).

## Never

- Never write to the Zotero `.bib` file or to Zotero.
- Never delete or overwrite a Readings note file, or delete a `readings` row; missing
  items are flagged, not removed. Meetings differ: a meeting note can be deleted, but only by an
  explicit user action with a confirmation, and it goes to the macOS Trash (`shell.trashItem`),
  never removed outright. Meeting notes are still never overwritten: saves check the file's
  content hash, and a new meeting never replaces an existing file.
- Never send user data over the network.
- Never commit secrets or user data; user data lives in `~/CentralCommand/`.
