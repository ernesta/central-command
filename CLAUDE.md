# Central Command: conventions for Claude Code

A local-first Electron + React + TypeScript desktop app. The build brief is
`central-command-mvp-phase1-brief.md`; when this file and the brief disagree,
ask the user.

## Commands

- `npm run dev`: run the app with hot reload
- `npm test`: Vitest unit tests (run under plain Node; better-sqlite3 ships
  N-API prebuilds so no Electron rebuild is needed)
- `npm run lint`, `npm run typecheck`, `npm run format`
- `npm run build:locate`: builds `resources/Locate.app` (Weather location helper; macOS, Xcode CLT); `build:mac` runs it first
- Library scripts all take `-- --apply` (dry run by default, which uses a throwaway copy). Apply only when the user says so, with the app closed; they back up first. Reusable ones:
  - `repair:session-tasks`: meeting/training tasks against the notes that name them
  - `import:reading-list -- --file <docx> [--title "…"] [--list-dir <folder>]`: Word reading list to a Reading list (macOS)
  - `people:from-notes`: people named in attendees/leads but missing from the people list
  - `link:citations`, `tidy:reading-lists`: re-run after adding readings to Zotero
  - `link:people [--first-names-off]`: people named in prose to person entities (rules in `src/shared/people-mentions.ts`: never the user, never a listed attendee/lead, first mention per note only)
  - `watch:from-tasks`: "Check upcoming …" reminder addresses as Watch sources; **not applied**, only on the user's go-ahead
  - `check:work-lists`: report only (expected: none)
  - **Do not re-run** (applied; a dry run finds nothing): `backfill:life-self-study`, `luminos:meetings`, `luminos:meetings-2`, `royal-holloway:meeting`, `repair:training-folders`, `watch:add-events`, `watch:add-schools`, `watch:add-training`, `watch:add-training-2`, `watch:add-ncrm`, `watch:add-course-info`, `tidy:blank-runs`, `tidy:paragraph-blanks`, `standardise:bullets`, `fullname:chips`. Details: `docs/CLAUDE_ARCHIVE.md`, `docs/DECISIONS.md`.
- A spelling `link:people` cannot resolve is the user's call and lives in `~/CentralCommand/data/people-aliases.json` (`{ text, person, workspaces?, notes? }`; neither `workspaces` nor `notes` means everywhere). Add to the file, not the script.

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
- A clickable thing follows `docs/CLICKABLES_PLAN.md`: a text link composes `components/Link.module.css` (ink, accent on hover, never underlined; `.external` + `ExternalIcon` for a link that leaves the app), blue (`--selected-bg`) is only for a selected state and never for hover (a hover or keyboard highlight is `--hover-tint`), a chip's "+ add" and "×" compose `Chip.module.css`, text edited in place composes `EditInPlace.module.css`, and focus is the `--focus-ring` tokens (`Focus.module.css` for a table row or a card). `components/clickables.test.ts` guards it.
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

**What is built**: Readings, Reading lists, Meetings, Training, Notes, People, Tasks, Hours/Time off, Contracts, Home, Watch, search (Mod-K modifiers), the live editor, pickers, dark mode, packaging. The per-feature build log (with dates and what was driven) is in `docs/CLAUDE_ARCHIVE.md`; read it, `docs/DECISIONS.md` and the matching `docs/*_PLAN.md` before changing a feature.


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
