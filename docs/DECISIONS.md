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

The terminal is a setting (`terminal`: Terminal or Ghostty, Settings screen). Terminal uses
`osascript` as above. Ghostty is started with `open -na Ghostty --args -e <shell> -lic '<cd path && claude; exec shell -l>'`:
a login shell so `claude` is on the PATH (a GUI-launched app has a minimal one), an explicit `cd`
because Ghostty ignored `--working-directory` for `-e` commands when tried, and `exec shell` so the window stays
open after Claude exits, as it does in Terminal. Adding another terminal means adding it to
`TERMINALS` (`shared/settings.ts`) and a branch in `buildLaunchCommand`. A failed launch (for example
the app is not installed) reports the first line of `open`'s error.

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

## APA references are formatted by our own code, not a CSL engine

Copying an APA reference needs journal, volume, pages, DOI, publisher and so on, so the
sync now keeps those as JSON in `readings.reference` (migration `0002`), extracted from the
BibLaTeX fields. `formatApa` (`shared/apa.ts`) is a small pure function covering journal
articles, books, chapters, reports, theses, conference papers, datasets, software and web
pages, with APA 7 rules for author lists (ampersand, the 20-author cutoff), group authors,
editors, editions, DOIs, en-dash page ranges and italics. It returns plain text and HTML, and
the Copy button puts both on the clipboard so italics survive pasting into Word.

Why not citeproc-js with the official APA style? The engine is `CPAL-1.0 OR AGPL-1.0` and the
style files are CC BY-SA, copyleft terms that could complicate publishing this app later.
The trade-off: only the entry types above are covered precisely; anything else gets a
general "Author (Year). Title. Publisher. URL" pattern.

## Sentence-case titles come from Better BibTeX's own case protection

APA wants sentence case, but Zotero usually stores Title Case. Better BibTeX already wraps
words that must stay capitalised in `{{braces}}` (`{{Africa}}`, `{{What}}` after a colon), and the
BibTeX parser's default sentence casing honours them. Tested on the user's 187 entries this gave
correct results (`State-building and multilingual education in Africa`, `…language: A comparative
perspective`). Titles are stored both as Zotero has them (`full_title`) and in sentence case
(`reference.titleSentence`). Journal names keep their stored capitalisation.

## BibLaTeX list fields are arrays

`publisher`, `location` and `institution` are literal _lists_ in BibLaTeX, so the parser returns
arrays; read as strings they came out empty. They are joined with "; ".

## Reference details do not count as updates

`reference` is saved whenever it differs but is deliberately outside the change signature, so
back-filling it for an existing library (or a corrected volume number) does not bump
`updated_at` or the "updated" count. Verified on the user's library: 187 of 187 back-filled, 0
`updated_at` changes.

## Importing notes from Obsidian

`npm run import:obsidian -- --vault <path> [--apply]` (dry run by default) copies notes made by
Obsidian's Citation plugin into `~/CentralCommand/notes/readings/`. The old notes were named with
short citekeys (`@Cayado2025.md`) that no longer match Better BibTeX's (`cayadoCostNarrowLens2025`),
so each note is matched by its own title and year (with a prefix rule for shortened Zotero titles);
anything ambiguous or unmatched is reported, never guessed. The plugin's header (front matter,
title, abstract) is dropped because the app shows it; empty template sections and empty templates
are skipped; `[[wikilinks]]` become plain text; tabs become spaces; notes are written in the
editor's canonical form so they are not reformatted on first edit. It never touches the vault and
never overwrites an existing note. It is bundled with esbuild because the BibTeX parser is
ESM-only.

## A dev-only bug found by using the app: StrictMode and `dispose()`

React StrictMode (`npm run dev`) runs an effect, its cleanup and the effect again without waiting.
`NotesSession.dispose()` awaited the final save before marking itself disposed, so the late
dispose undid the second `start()` and the editor stayed in "loading" forever. The state change is
now synchronous. Production builds were unaffected, which is why earlier end-to-end runs (against
the built app) missed it; dev mode is now also checked through the debugging port.

## Backspace at the start of a list item leaves the list

Milkdown's default did nothing visible on the first Backspace at the start of a bullet (a second
press converted it), which made a bullet on a note's first line look impossible to remove.
`liftListItemAtStart` takes the item out of the list, or outdents a nested one, in one press. It
is registered before the default keymaps and only acts at the very start of an item's first block.

## Polish pass (Stage 6): what was checked and what changed

Checked in dev mode and the production build against scratch libraries.

- **Contrast:** every text token passes 4.5:1 on every background it is used on (lowest: muted
  text on the panel colour, 4.6:1). Input borders (`--border-strong`) are about 1.65:1 against white;
  that is the brief's specified colour and the fields have visible labels and placeholders, so it stays.
- **Shadows:** the Readings card had a hover shadow, which section 9 reserves for floating elements.
  It now tints its background on hover. Its title is a real link whose hit area covers the card,
  which also gives it a proper focus ring (drawn around the whole card).
- **Notes editor focus:** the editor has no outline of its own, so the whole editing area gets the
  accent ring while it has focus.
- **Failed first sync:** an empty or unparseable export used to show "Your Zotero export has no
  entries" on the Readings page and "Not connected" on the Research card, with the real error only
  behind the status dot. Both now say the sync failed, show the message and link to Settings.
- **Reduced motion:** the rule shortened animation durations, which made the infinite sync pulse
  strobe. Animations are now also limited to one iteration.
- **Back to the list:** returning from a reading used to reset the table to the top. The opened
  citekey is kept in session memory (`list-return.ts`); the table scrolls to that row and focuses it
  on return. Read in a state initialiser and cleared after a microtask, so StrictMode's double
  effect run still restores it.
- **Large library:** a synthetic 4,000-entry export (twice the real library) gave 100 to 280 ms for
  opening the table, searching, sorting, scrolling and switching views, and 450 ms for searching on the
  board with 4,000 cards. The board is still not virtualised.
- **Known, not changed:** the board makes every card a tab stop (about 190 of them); keyboard users
  can switch to the table, which has arrow-key navigation. The list pages use a 48px gutter and the
  other pages 64px, both as the brief specifies.

## Focus details found by using the app (after the polish pass)

- **Segmented control:** `overflow: hidden` on the rounded group clipped the square corners of
  the focus ring. The group no longer clips; the first and last segments carry the rounded corners.
- **Tab stop in the readings table:** the table is a single tab stop on one "active" row. That row
  was whichever was last visited, so Tab jumped into the middle of the list. Leaving the table now
  resets the stop to the first paper, and row 0 is always rendered (virtualiser `rangeExtractor`) so
  it can hold the stop even when the list is scrolled far down; focusing it scrolls to the top.
  Returning from a reading still focuses that reading, once.

## Meetings stages 1 to 3: shared notes machinery, main-process core, pure rules

- **Shared notes machinery** (a pure move, Readings behaviour unchanged): `src/main/notes/` holds
  the guarded file read/write (`guarded-file.ts`), the excerpt and the folder watcher;
  `src/renderer/src/notes/` holds the session, the editor component and its plugins;
  `src/shared/notes.ts` holds the note types. The Readings `NotesStore` keeps only what is
  Readings-specific (citekey paths and the `has_notes` / excerpt caches). `useNotesSession` takes the
  notes API as an argument. The change event still calls the note's key `citekey`; renaming it was
  left out so the refactor touched no test assertions.
- **Meeting files** are `~/CentralCommand/notes/meetings/<workspace>/YYYY-MM-DD Series.md` (` 2`, ` 3`
  for repeats). The database is a rebuildable index (`meetings`, `meeting_todos`); rows for files that
  disappear are removed, because the files are the source of truth.
- **Front matter is read and edited by our own small code, not a YAML library.** The format is fixed
  and tiny, and the requirement is that nothing else changes: `splitNote` returns `head` and `body`
  with `head + body` equal to the file, blank lines after the closing fence belong to `head`, and
  `updateHead` rewrites only the keys it is given, so unknown keys, comments and their order survive.
  A YAML library would re-serialise the whole block.
- **A save is a change, not a whole file**: `{ meta?, body? }` applied to what is on disk, checked
  against the hash of the whole file the caller last read. The front matter fields and the body
  therefore cannot overwrite each other. A missing file is an error on save; only `create` makes files,
  and it links a temp file into place, so it can never replace one.
- **Delete goes to the macOS Trash** (`shell.trashItem`, injected so tests need no Electron), and the
  index row is dropped only after the move succeeded. `CLAUDE.md`'s never-delete rule now applies to
  Readings only.
- **People** live in `data/people.json`. Initials come from the first and last word of the name (titles
  ignored), and a clash gets a number (`KR2`); explicit initials that clash are refused. Unknown TODO
  owners are kept and flagged, never dropped.
- **TODO rules**: accepted forms are `**TODO(EO)**:`, `**TODO(EO):**`, `TODO (EO):`, several owners,
  and no owner; code spans and fences are ignored; a ticked checkbox anywhere counts as done. Two TODOs
  are the same when their text matches after ignoring case, emphasis marks, spacing and a final full
  stop, and their owners match, except that a TODO with no owner (an old plain checkbox from Obsidian)
  matches any owner so imports do not double up.
- **Carry-over only adds.** `insertPreviousTodos` splices text in and never rewrites what is there (a
  test with 4,000 generated notes checks that every original character stays in order and every
  existing item keeps its ticked state). It never inserts inside a code fence that is never closed
  (found by that test: the section was appended inside the fence, so the next sync added it again).
  A TODO the user deletes from Previous TODOs comes back at the next open, as the plan says.
- **Search text** for meetings is a 4,000-character plain-text excerpt (Readings uses 300), because
  meeting notes are long and the plan wants note text searchable.
- **Backspace-to-unlist**: the earlier fix (see above) works through the editor's full key handling in a
  unit test (`handleKeyDown` with a real `KeyboardEvent`). A scripted Playwright run (typing `- x`,
  moving to the start of the line, pressing Backspace) did not lift the bullet in either dev or the
  production build, but that could be the script's way of moving the cursor; it is unconfirmed, so
  check it by hand in the running app.
