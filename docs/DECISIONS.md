# Decisions

Short log of notable technical decisions and why. Newest last.

## Renderer lives in `src/renderer/src`

electron-vite's default layout, kept rather than fighting the tooling. The
shell, theme and shared components sit inside it. Module code lives in
`src/modules/<name>/{main,renderer}`, type-checked per process.

## better-sqlite3 needs no Electron rebuild

The installed version ships N-API prebuilds that load in both Node and
Electron. Unit tests therefore run under plain Node with an in-memory or
temporary database, with no ABI juggling.

## Narrow preload instead of `@electron-toolkit/preload`

The toolkit's `electronAPI` exposes generic `ipcRenderer` methods. We expose
only an explicit, typed `window.api` so the renderer cannot invoke arbitrary
channels.

## Settings: corrupt files are set aside, not overwritten

If `settings.json` cannot be parsed it is renamed to
`settings.json.corrupt-<timestamp>` and defaults are used, in line with the
principle of never losing user data.

## Migrations are bundled SQL with per-migration transactions

Migration ids are namespaced (`core/…`, `readings/…`) so modules own their own
schema while sharing one `schema_migrations` table.

## The "Consulting" workspace is called "Work"

Renamed at the user's request. The workspace id is `work` and the label is
"Work". The build brief has been updated to match.

## Module manifests are split by process

The brief puts `migrations` in the module manifest. Because the main process
and the renderer are separate bundles, a module has a renderer manifest
(`src/modules/index.ts`: routes, landing card) and a main registration
(`src/modules/main-registry.ts`: migrations, IPC handlers). Adding a module
means adding one entry to each list.

## In-memory routing

The renderer uses `MemoryRouter`: Electron has no address bar, and an in-memory
history still gives back/forward. The last workspace is persisted in
`settings.json`, not in the URL.

## Build button is macOS-only for now

It opens Terminal via `osascript` with the path shell-quoted and
AppleScript-escaped (unit-tested). Other platforms show a clear message; adding
Windows/Linux launchers later means extending `buildLaunchCommand`.

## Ask state lives above the router

`AskProvider` wraps the router, so the conversation, draft and open state
survive page changes. The panel talks to an `AskBackend` interface; Phase 1 uses
a placeholder that replies "Claude isn't connected yet."

## The app is called Central Command

Renamed from the brief's placeholder "Control Center" at the user's request; a
later rename is expected. The name lives in `src/shared/app-info.ts`
(`APP_NAME`), `package.json`, `electron-builder.yml` (productName, appId,
executable) and `src/renderer/index.html`. The brief was updated to match
(and its file renamed to `central-command-mvp-phase1-brief.md`). The data folder is
`~/CentralCommand/` (`DATA_DIR_NAME`) and the database is
`central-command.sqlite`; the user re-pointed their Zotero export to the new
location.

## ESM-only dependencies are bundled into the main build

The main process is built as CommonJS. `@retorquere/bibtex-parser` and
`chokidar` are ESM-only (and the parser's `dist/cjs` folder is really ESM), so
requiring them from `node_modules` fails at startup. They are listed in
`externalizeDeps.exclude` in `electron.vite.config.ts`, which makes electron-vite
bundle them. Any future ESM-only main-process dependency needs the same entry.
Native modules (better-sqlite3) stay external.

## Sync strictness: any parse error, or an empty export, fails the whole sync

A half-written export produces parse errors, and an empty or blank file parses
"successfully" with zero entries, which would otherwise flag the whole library as
missing. Both are treated as failures: nothing changes except an error row in
`sync_runs`, and the UI shows the message. A genuinely empty Zotero library will
therefore show an error rather than an empty list; that trade-off is deliberate.

## Parsing details

- `sentenceCase: false`, because the parser otherwise lowercases title words.
- Text is normalised to NFC; the parser emits decomposed accents that break
  searching and sorting.
- `and others` is not stored as a person; it makes the short citation "et al.".
- Keywords come out of the parser sorted, so tags are alphabetical.
- Editors are used for the short citation only when there are no authors, and are
  not stored.
- A row that reappears in the export clears `missing_from_source` without bumping
  `updated_at`, unless a synced field also changed.

## Modules can contribute settings sections

`LiveModuleManifest.settingsSection` lets a module render its own block on the
Settings page (Readings uses it for the Zotero sync summary), so the shell never
imports module code directly. A module's `landingCard` is optional.
