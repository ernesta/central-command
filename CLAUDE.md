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
- `src/modules/<name>/`: one folder per feature module, split into `main/` and
  `renderer/`, with an `index.ts` manifest the shell reads. Readings is the
  pattern to copy for future modules such as Books. Do not build a generic
  framework before a second module exists.
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
- Commits are small: one per feature and per standalone part of a feature.

## Where things stand and where to look

- Phase 1 stages 1 to 6 are done (foundations, shell, Readings sync, Readings UI, detail page with
  notes editor and APA copy, polish pass). What is left is the user's review and the push.
  `docs/ROADMAP.md` is the checklist; `docs/DECISIONS.md` records what the polish pass changed.
- `docs/DECISIONS.md` explains why things are the way they are, including bugs found by using the
  app. Read it before changing sync, notes, the editor or the module structure.
- The brief (`central-command-mvp-phase1-brief.md`) is authoritative for the visual design
  (section 9) and the stage plan (section 12). It has been updated for the renames: the app is
  "Central Command", the third workspace is "Work" (`work`), and data lives in `~/CentralCommand/`.
- The app name lives in one place (`src/shared/app-info.ts`); it may be renamed again.

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
- Kill stray processes afterwards (`pkill -f electron-vite`, `pkill -f node_modules/electron`).

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

## Never

- Never write to the Zotero `.bib` file or to Zotero.
- Never delete or overwrite a note file, or delete a `readings` row; missing
  items are flagged, not removed.
- Never send user data over the network.
- Never commit secrets or user data; user data lives in `~/CentralCommand/`.
