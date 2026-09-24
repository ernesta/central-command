# Control Center: conventions for Claude Code

A local-first Electron + React + TypeScript desktop app. The build brief is
`control-center-mvp-phase1-brief.md`; when this file and the brief disagree,
ask the user.

## Commands

- `npm run dev`: run the app with hot reload
- `npm test`: Vitest unit tests (run under plain Node; better-sqlite3 ships
  N-API prebuilds so no Electron rebuild is needed)
- `npm run lint`, `npm run typecheck`, `npm run format`

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
- Every schema change is a numbered SQL migration (`<module>/NNNN_name`). Never
  edit a shipped migration.
- No hardcoded personal paths: resolve from `app.getPath('home')`.
- Renderer access to the main process goes through `window.api` only; add a
  method to `Api` and `IPC` in `src/shared/api.ts` rather than exposing anything
  generic.
- Commits are small: one per feature and per standalone part of a feature.

## Never

- Never write to the Zotero `.bib` file or to Zotero.
- Never delete or overwrite a note file, or delete a `readings` row; missing
  items are flagged, not removed.
- Never send user data over the network.
- Never commit secrets or user data; user data lives in `~/ControlCenter/`.
