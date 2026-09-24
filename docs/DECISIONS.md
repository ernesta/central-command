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

## Readings filtering, search and sorting happen in plain code, not SQL

`queryReadings` (`src/modules/readings/main/query.ts`) is a pure function over the
readings loaded from SQLite. SQLite's `LIKE` and `ORDER BY` are only case- and
accent-insensitive for ASCII, so "muller" would not find "Müller" and "Ålund"
would sort after "Zed". JavaScript gives accent-folded search (`fold`) and
locale-aware sorting (`Intl.Collator`), and it is trivially unit-testable. At
~2,000 readings a query takes a few milliseconds (measured in the real app:
search settles in ~33 ms). Revisit only if libraries reach tens of thousands.

## Tag filter semantics

Selected tags narrow the list: a reading must have every selected tag. Tags that
differ only in case are treated as the same tag.

## Remembered UI state lives in `settings.ui.moduleState`

A generic, per-module bucket, so core settings know nothing about Readings.
Each module validates its own slice on read (`normaliseViewPrefs`), and writes are
debounced (~400 ms) so typing in search does not write a file per keystroke.

## `CENTRAL_COMMAND_HOME` relocates the data folder

An environment variable read in `getAppPaths()`. It lets tests and experiments run
the real app against a scratch library without touching `~/CentralCommand/`.

## The board always shows all three status columns

To Read, Read and Unset are always displayed with counts, even when empty (an empty
column says "Nothing here."). The original brief showed Unset only when non-empty;
that was changed at the user's request, because columns appearing and disappearing
with the filters was confusing. The brief was updated to match.

## Board renders every card

The table is virtualised; the board is not. With 2,000 readings it rendered in
~140 ms, which is fine. Virtualise the board columns if that stops being true.

## Notes are Markdown files guarded by content hashes

Each reading's notes live in `~/CentralCommand/notes/readings/<citekey>.md`; the database
only caches `has_notes` and a plain-text excerpt (for search). Rules, enforced by
`NotesStore` and covered by tests:

- **Lazy:** a file is created only when the user first types something (whitespace-only
  content never creates one).
- **Never deleted:** clearing a note leaves an empty file. Citekey changes in Zotero
  never rename or remove a notes file; the old reading is just flagged.
- **Never clobbered:** every save says which file version it builds on (a SHA-1 of the
  content). If the file changed since, nothing is written and the user chooses "Keep my
  version" or "Use the file's version". A missing file and an empty one hash the same.
- **Atomic:** temp file plus rename.
- **Filenames** are the citekey with unsafe characters replaced, so a citekey can never
  escape the notes folder.
- **External edits** (for example by Claude Code) are noticed by a watcher on the notes
  folder: caches are refreshed, and an open, clean editor reloads in place. With unsaved
  edits the conflict notice appears instead.

## Notes editor: Milkdown, configured for plain Markdown

The spike passed: Milkdown round-trips headings, emphasis, lists, task lists, quotes,
links, fenced code, tables, strikethrough, rules and unicode byte-for-byte when
configured with dash bullets and `---` rules. A note is only written back after the user
edits it, so opening a note never reformats it. Known normalisations (equivalent, valid
Markdown): `*` bullets become `-`; a two-space hard break becomes a backslash break;
bare `*`, `_` and `[` are escaped (`\*`, `\_`, `\[`); adjacent lists alternate `-` and `*`
markers so they stay separate lists. Tests pin these down.

## Editor changes are reported synchronously (a data-loss bug found by using the app)

Milkdown's change listener is debounced (~200 ms). Typing and then leaving the page, or
closing the window, inside that window dropped the last words. The editor now reports
every document change immediately through a small ProseMirror plugin, and the session does
its own debouncing before saving (~500 ms). On top of that, the main process holds a
window open (up to 3 s) after asking the renderer to flush pending saves, so closing the
window or quitting never loses edits.

## Task list checkboxes use CSS plus a tiny plugin, not Milkdown's Vue components

Milkdown's list-item component pulls in Vue and re-renders every list item. Task items
already carry `data-checked`, so the checkbox is drawn with CSS and a ~20-line plugin
toggles it on click.
