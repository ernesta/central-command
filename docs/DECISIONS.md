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
- **Search text** for meetings was a 4,000-character plain-text excerpt (Readings 300); it is now the whole note (see "Global search"), because
  meeting notes are long and the plan wants note text searchable.
- **Backspace-to-unlist**: the earlier fix (see above) works through the editor's full key handling in a
  unit test (`handleKeyDown` with a real `KeyboardEvent`). A scripted Playwright run (typing `- x`,
  moving to the start of the line, pressing Backspace) did not lift the bullet in either dev or the
  production build, but that could be the script's way of moving the cursor; it is unconfirmed, so
  check it by hand in the running app.

## Meetings stage 4: the meeting page

- **One session per open meeting** (`MeetingSession`, framework-free, tested with a fake disk) owns the
  fields and the note together. Edits go out as one guarded save of only what changed (`{ meta?, body? }`),
  against the hash of the whole file, so a field edit can never overwrite the note or the reverse. The
  editor is recreated only when the note text itself changed on disk, so a field changed by another tool
  never disturbs the cursor. An outside change with unsaved edits pauses saving and asks (keep mine /
  use the file's version), as in Readings.
- **Carry-over runs in the main process** (`syncPreviousTodos`) at create and at open, using the hash the
  page just read, so two page loads racing (React StrictMode) cannot add an item twice.
- **The TODO helper is a Milkdown plugin plus a small menu controller.** `/todo` (at the start of a line or
  after a space) or Cmd/Ctrl+Shift+T opens the owner menu; the choice inserts a bold `TODO(XX)` then `: `,
  which is what the parser reads. The menu never takes focus. Owners: attendees first, then everyone else.
- **Topics**: ticking one writes `discussed` in the front matter; "Add topic" appends `### title` to the end of
  the Notes section (insert-only, tested on generated notes) and recreates the editor, so undo history is
  lost at that moment. Jumping finds the heading in the editor by its text.
- **File names follow the date and series** (`YYYY-MM-DD Series`, ` 2` for repeats). Editing a meeting's date or
  series renames its file to match, without ever replacing another file (`renameNoteFileExclusive`), and the page
  stays open on the same meeting (the session and the route both follow the new id). Other edits never rename, so a
  file with an odd name (for example an imported one) keeps it until its date or series is edited. If a rename fails
  the note is still saved under its old name.
- **Attendees** can be added from the people list or by typing a new name (`people.add`), because the People
  settings screen is a later stage. A name in the file that is not in the list shows as an outlined name chip.
- **Stand-ins for later stages**: a plain index page (create a meeting, links to existing ones) and a minimal
  Research card, so the page can be reached. The list and the landing page replace them; `meetings.list` is
  already there for them.
- Scripted checks (Playwright, scratch library, dev and production): typing with real keystrokes, the `/todo`
  menu, fields, attendees, topics, an outside edit both clean and mid-typing, quitting straight after typing,
  delete with confirmation. Two things to know about scripting the editor: on macOS `Home`/`End` scroll the page
  instead of moving the caret (use Cmd+Left/Right), and a keystroke sent within a few milliseconds of a click
  can act on the old selection (wait a moment after clicking).

## Meetings stage 5: the all-meetings list

- **The query is plain code over the index rows** (`queryMeetings`, like Readings), run in the renderer: a few
  hundred meetings filter instantly, and the list refreshes when any meeting file changes (from this app or
  another tool). `fold` (case and accent folding) moved to `@shared/text` so both modules use it.
- **Upcoming meetings are shown in the list**, marked "Upcoming" (changed at the user's request; the plan and the
  mockup's footnote had them left out). They are the only thing the future supervision-log Export must skip.
  A meeting whose date could not be read is kept, at the end, so a file with a problem is never hidden. Search
  covers the date (both `2026-09` and `Sep 10`), series, type, attendees (names and initials), summary and the
  note text.
- **Rows** are a plain `<table>` (the hover tint is painted on the cells, so the last row's corner cells carry the
  table's rounded corners): the whole row is clickable, and the date is a real link for the keyboard and
  screen readers. Not virtualised yet (performance with a few hundred meetings is a stage 9 check).
- **Stand-ins until the landing page (stage 6):** a "New meeting" popover in the list header (series and date) and
  the minimal Research card. Replace them when the landing page gets its own New meeting button.
- List filters are not remembered between visits yet; that is stage 7 (remembered list state).

## Meetings stage 6: the landing page

- **Routes:** `/research/meetings` is the landing page, `/all` the list and `/m/:id` a meeting, so a meeting whose
  file is called "all" can never collide with the list. Back from a meeting returns to where the user came from
  (landing or list), and to the landing page when there is no history. A series card opens the list already
  filtered to that series (`?series=`).
- **Open TODOs** are computed from the index (`meeting_todos` rows via `openTodos`), per series from its latest
  meeting, upcoming ones included, so a TODO carried into an upcoming meeting is listed there ("Supervision · Jan 1").
  The text is shown as plain text; owners are pills after it, and initials not in the people list are outlined,
  never dropped. Rows are read-only links to the meeting that lists them.
- **"Mine" needs a person marked as me.** The toggle only appears when the people list has one; there is no screen
  to set it until People settings (stage 7). Until then it can be set by editing `data/people.json` (`"me": true`).
- **Series cards** count meetings that have happened and show the last and the next date; every fixed series
  shows, even with none ("No meetings yet"). Other series found in the files get a card too.
- **Recent and upcoming** shows up to 3 upcoming (soonest nearest the top of the recent ones) and the 5 latest that have
  happened. "N topics ready" comes from `topic_count`, a column added by migration `meetings/0002` and refreshed
  when the index is rebuilt at startup.
- **Research card** is live: meetings that have happened, the next date and the number of open TODOs. The
  "Coming soon" tile for Meetings is gone. The New meeting popover now lives on the landing page and the list.

## Meetings stage 7: People settings and remembered list state

- **People** is a Settings section contributed by the Meetings module (`settingsSection`): add (name, optional
  initials), edit name and initials (saved when the field loses focus or on Enter), one "This is me" (ticking it
  clears it from everyone else), and remove (two steps). Initials stay unique and errors show on the row. The
  "me" person turns on the Mine view on the landing page.
- **Renaming or removing a person changes the list only.** Meeting files record attendees by full name and are
  never rewritten behind the user's back, so existing meetings keep the old name (it shows as an outlined name
  chip, and its TODO owners as outlined initials, until the list is changed back). The Settings text says so.
- **Remembered state uses one shared hook, `useModuleState`** (`settings.ui.moduleState.<module>`, normalised on
  read, written ~400 ms after the last change and when leaving the page). Readings' `useReadingsView` is now a
  thin wrapper over it (same behaviour). The meeting list remembers search, series, attendee and type.
- **A remembered series or attendee that no longer exists is treated as "all"** (`reconcileQuery`), so a stale or
  hand-edited value can never hide every meeting behind an empty list.
- **A series card on the landing page filters that visit only, with the other filters cleared**, so what you see is
  that series; it is saved only if you then change a filter.

## Meetings stage 8: the import (`npm run import:meetings`)

- **What it reads** (never modified): the Obsidian `Meetings` folder (with its `Supervision` sub-folder), the Word
  supervisor log (converted with macOS `textutil`, so the tool only runs on a Mac) and the Word notes in
  `Supervisors/` (only their first line: date and start–end). **What it writes**: one file per meeting into
  `notes/meetings/research/`, only when `--apply` is given, using an exclusive create, so an existing file can never be
  replaced; a meeting already there (matched on date and series, whatever the file is called) is skipped, so running it
  again writes nothing. `--add-people` also adds the attendees to `data/people.json` (initials worked out, clashes numbered).
- **Rules**: the file name date is the meeting's date (the `**Date**` line is only reported when it disagrees); series
  come from the tags, the folder or the name; times come from the Word note of that day, and for supervision meetings
  the summary and Online / In person come from the log row of that day (the log's Type of contact is dropped);
  attendees are full names without titles or wikilinks; `## Previous Action Items` becomes `## Previous TODOs`;
  a `## Summary` section is added to every meeting (empty when there is no log row). Nothing is guessed: a note whose
  series or date cannot be worked out, or which duplicates another's date and series, is reported and left out.
- **The Readings conversion could not be reused as it was.** It drops a heading followed straight by another heading, which
  in these notes removed `## Notes` above the `###` topics (and let the Summary swallow them); found by dry-running on the
  real files. Meeting notes now keep every heading and bullet (`keepEmptyHeadings`, `keepEmptyBullets`); Readings is unchanged.
- **Safety net**: after converting each note the planner checks that every TODO's text is still in it, that the count of
  TODO markers and of ticked boxes is unchanged, that the front matter and the summary read back the same, and leaves
  the note out (reported as ATTENTION) if anything differs. A previous item with a status word in front,
  `(Cancelled) **TODO(EO)**: …`, is kept as written; the app files it as an ownerless Previous TODO.
- **Dry run on the real files** (writing nothing): 40 notes, all importable; 4 wrong `**Date**` lines (the three in the
  plan and also `2025 11 17 Meeting with Matthew Jukes`, which says Nov 3), the four duration mismatches and five meetings
  without times, exactly as in the plan; no Word note or log row left unmatched.

## Meetings stage 9: polish and QA

What was checked (dev and production, scratch libraries, screenshots read) and what changed:

- **Brief section 9**: no raw colours, gradients or coloured left borders in the Meetings CSS; shadows only on floating
  things (menus, popovers, the delete dialog). The one exception is deliberate: the focused list row is ringed with inset
  shadows on its cells so the ring follows the table's rounded corners and cannot be clipped. Every text and background
  pair used passes 4.5:1 (lowest: muted on the panel colour and on the selected background, 4.61).
- **Keyboard and focus**: tabbed through the landing page, list, meeting page, delete dialog and Settings; every focus ring
  is visible and unclipped, the delete dialog keeps focus inside and closes on Escape, the list is one tab stop with arrow
  navigation. Found and fixed: the People inputs near the bottom of Settings had their ring cut by the scroll container
  (`scroll-padding-block` on `main`). The native calendar and clock buttons in the date and time fields keep the
  browser's own (gold) focus highlight, which is visible.
- **Empty and error states**: a brand-new library (landing, list, Research card), a meeting whose file vanished while open,
  a file with a broken header (still listed, opens with a plain-words notice, nothing changed), a folder that cannot be
  written to (error with Try again, the text stays on screen and saves once the problem is gone). Errors from the main
  process now drop Electron's "Error invoking remote method" prefix and raw file-system codes.
- **Stale rows**: the folder watcher can miss the deletion of a file removed within about a second of its creation, which
  left a row in the list until the next start. The list now drops rows whose file has vanished (one directory listing)
  before every listing.
- **Performance** with 450 generated meetings (1.8 MB): the index is complete about 1 s after launch, the landing page
  renders in ~50 ms, the list (450 rows, ~6,000 DOM nodes) in ~150 ms, a keystroke in the search box settles in ~35 ms,
  a meeting opens in ~60 ms, memory is ~600 MB across the four Electron processes. No virtualising needed at this size;
  the table is a plain `<table>`.
- **Narrow windows**: the window cannot be narrower than 960 px, and no screen scrolls sideways at that width.

## Converting bold pseudo-headings to topics (`npm run convert:topics`)

Imported notes have topics as a bold line of their own (`**Ethics Application**`), which the topics panel does not
list. `convertPseudoHeadings` (`meetings/shared/pseudo-headings.ts`) turns such a line into `### Ethics Application`.

- **Narrow on purpose.** A line converts only when it is under `## Notes`, outside code fences, is nothing but one bold
  span (a trailing colon is dropped), is at most 100 characters, is not a TODO, and follows a blank line or a heading. A
  bold line inside a paragraph, `**Decision**: text` and bold list items are never touched. A note whose Notes section
  already has `###` headings is skipped as a whole (its bold lines are then emphasis). Every bold-only line that was
  not converted is listed with the reason, so nothing is skipped silently.
- **Only those lines change.** Line endings, blank lines and the front matter are untouched. Before a result is used,
  `checkConversion` confirms the same number of lines, every other line identical, the TODOs (text, owners, ticked
  state) unchanged and each converted line reading back as a topic; a note that fails is left as it is. Mutation
  checks on each of those rules found that the whole check was untested, so it is exported and tested directly.
- **The tool** is a dry run by default. `--apply` copies each note it changes to
  `~/CentralCommand/backups/topic-headings-<time>/` and then writes with the same content-hash guard as the app, so
  a note edited meanwhile is skipped. It is idempotent: a second run finds nothing.
- **Dry run on the real notes:** 14 lines in 5 notes (the two Luminos and three Supervision notes' topics plus the
  Rastle Lab one), matching a separate search of the files. A full `--apply` on a scratch copy changed exactly those 14
  lines, the backups equalled the originals and a second run changed nothing. It was applied to the real notes on 25 Sep 2026 (backups in `~/CentralCommand/backups/topic-headings-…`); a dry run now finds nothing.

## Keyboard shortcuts list (Settings)

- **One vocabulary.** `src/shared/shortcuts.ts` defines a chord as a string (`Mod-Shift-t`, as ProseMirror writes them), a
  matcher (`matchesShortcut`: exactly those modifiers, Cmd or Ctrl for `Mod`) and the display (⌘⇧⌥ on a Mac, Ctrl/Shift/Alt
  elsewhere). Back, Ask and the TODO helper match with the same chord string the list shows, so they cannot drift apart.
- **Modules contribute groups** through `shortcuts` in their manifest (like `settingsSection`), so the shell imports no module
  code. The notes editor's group lives in `renderer/src/notes/notes-shortcuts.ts`.
- **Editor shortcuts are Milkdown's, so the list is checked against it.** Milkdown does not export its keymaps, so a test reads
  the built source of its presets and history plugin and requires every listed chord to appear there (the test caught that
  Milkdown spells redo `Shift-Mod-z`). An upgrade that changes a key fails the test.
- **A bug found by testing the app:** Cmd/Ctrl+`[` is "go back" and also the editor's "move list item out a level". Both ran, so
  pressing it in a list left the page. The shell's handler now ignores a key press the editor already handled
  (`defaultPrevented`); outside a list, or on a first-level item that cannot move out, it still goes back.
  Checked in the production build and dev mode.

## Training (`docs/TRAINING_PLAN.md`)

- **Same shape as Meetings.** Entries are Markdown files in `~/CentralCommand/notes/training/research/` (`YYYY-MM-DD Title.md`);
  the database is a rebuildable index (`training/0001`, `0002_review`). Front matter fields: `date`, `start`, `end`, `title`,
  `series`, `type`, `mode`, `skills`, `leads`, `institution`, `folder`, `organisation`, `points`, `review`; unknown keys survive
  every save. Duration is calculated from the times and there is no hours field, so hours can never disagree with the times.
- **Shared code moved, not copied.** Front-matter split/join/update, sections, time, people and the dated file-name helpers live
  in `src/shared` and `src/main/notes`; the note-editing session (saves, conflicts, outside changes) is one `EntrySession` that
  `MeetingSession` and `TrainingSession` extend, so the rules that protect the user's writing exist once. PeopleField, SkillsField,
  DeleteDialog, HoursStrip and AcademicYearSelect are shared components.
- **User's answers that shaped it:** each Inkpath type has its own type in the app (the three course types stay separate);
  the tags GS, RP and SS are General Skills, Research in Practice and Specialist Skills; format is In person, Online or
  Self-paced; Provider is the institution and leads are people (the import never turns providers into leads); PDF is the only
  export; skills are limited to three and an entry with more goes on a to-review list (`review` key, shown on the page and the
  entry); the Training page shows "plus N h of meetings". Meetings are not counted in the 200 hours.
- **Academic year** runs 1 Sep to 31 Aug (`2025–26`). Pages open on the current year (`?year=` in the address, not remembered).
  Upcoming entries are shown, marked and left out of the totals and the PDF.
- **Files are linked, never copied.** The panel lists, opens and shows in Finder; nothing else. `resolveInside` follows symlinks
  before checking containment, so `..`, absolute paths, a link that leads outside the Trainings folder and a sibling folder with
  the same prefix are all refused; links that escape are hidden from listings; files that run code (`.command`, `.app`, `.sh`,
  ...) are never opened. Each rule was mutation-checked (removing it fails a test).
- **PDF export** uses `printToPDF` on a hidden, script-less page built from a pure, escaped HTML string (`shared/report.ts`); the
  save location is chosen in a native dialog. Nothing leaves the machine.
- **Importer** (`npm run import:training`, dry run by default): reads the .xlsx with Node built-ins (zip central directory plus
  sheet XML). Findings from reading the real file: descriptions carry HTML entities (`&rsquo;`), decoded on import; typed hours
  differ from the times in 12 non-meeting entries (the app uses the times); 37 rows are supervisor or lab meetings and are left
  for Meetings. Notes and folders are matched by date and a similar title and only when the match is unique; the rest is
  reported. Every planned entry is read back and compared with its source row (title, date, times, skills, description, a note's
  lines); a failure leaves it out as ATTENTION. Mutation checks found and fixed a title matcher that treated "for" as a shared
  word. A second run writes nothing.
- **`npm run reconcile:meetings`** copies skills and missing times into meeting files through the guarded save; a time that
  differs is reported, never overwritten.
- **Bugs found by looking:** a test note typed into a heading (my script, not the app); the skills menu stayed open after a pick
  (now closes); none of these were visible to unit tests, which is why each stage was driven in the real app (production and dev).

### Training and Meetings: after the first review

- **One landing pattern.** Training now has a landing page like Meetings (`/research/training`): the academic year with its hours and a
  card per series, then "Recent and upcoming" with a link to the full list (`/all`). The pieces (`LandingHeader`, `LandingSection`,
  `SeriesCards`, `RecentList`, the "All …" link) are shared components in `renderer/src/components/Landing.tsx`, which
  Meetings uses too, as are `FilterRow` and `ExportButton`. The user asked for this after noticing Training had gone straight to
  a list: when a module needs a screen that another already has, reuse the components.
- **Same filter order everywhere**, matching the columns: academic year, search, series, type, skill, people ("Anyone"). Meetings gained a
  skill filter. **Export** sits in the header beside "New …", is called "Export" in both lists, and is quiet.
- **No date is allowed** for a meeting or a training: it is _planned_, shown first with a "Planned" tag, counted as upcoming (left out
  of hours and the PDF), and the file is named `Planned Title.md` until a date is set (clearing the date in the app renames it back).
  A missing date is no longer a "problem" in the front matter.
- **New meeting / New entry create the item at once** and open its page (no pop-up): a Supervision meeting for today; a training named
  "Untitled" for today with the title selected.
- **The to-review feature was removed from the app** (the `review` key, the list and the notice; migration `training/0003` drops the
  column). What breaks the import's rules goes on the user's TODO list in `docs/ROADMAP.md`, and the import prints it.
- **Types lose the group word** (Courses: Research methods, Academic skills, General skills, Language; Conferences: Attending, Presenting,
  Organising). Tables and the PDF show "Group: name"; the chooser lists them under the group.
- **Skills** are grouped General, Specialist, Research in Practice in the chooser, and shown as tags everywhere (Meetings and
  Training lists included), sorted alphabetically and then by group, so "Quantitative skills (GS)" comes before "(SS)".
- **Providers that are people are leads** (title removed; the same person as a note's Lead line is not added twice); institutions
  stay institutions. 27 existing entries were updated through the guarded save.
- **Initials must be unique**: adding Robyn Muir next to Ryan McKay gives the second one "RM2" automatically. Nothing is wrong, but
  the user should choose initials that are clear in notes (a TODO).
- **The people list is held in memory by the running app**, so files that change it (an importer) must not run while the app is open
  unless the app is restarted; the lead names were therefore not added to the real list (a TODO).

### Meetings' Export and the Training plan

- **Meetings' Export** saves the Supervision log of the selected academic year as a PDF: oldest first, upcoming and planned meetings
  left out, totals and hours per skill on top. It mirrors Training's export on purpose. The printing (`src/main/export-pdf.ts`) and the
  page shell (`src/shared/report-page.ts`) are shared, so a layout change after the user's review is made once.
- **The Training plan** is one Markdown file per academic year, `notes/training-plans/Training plan 2026-27.md`, edited on
  `/research/training/plan` (linked from the Training landing page). It sits in its own folder, not in `notes/training/research/`,
  because that folder is watched and indexed as training entries. It reuses `NotesSession` and `NotesEditor` unchanged (the year
  travels as the note's key, as text), so it has the same autosave, conflict handling and outside-change reload as every note. The
  outline beside it is built from the `##` and `###` headings as you type (`shared/plan.ts`). The next academic year is always offered,
  so a plan can be written before its year starts. Hours per priority were considered and left out on purpose.
- **The user's draft** (`Downloads/Training/Year 2 Training Priorities.md`) was copied, unchanged, into the real library as
  `Training plan 2026-27.md` (never overwriting).
- **Landing headers hold only "New …"** (and Training's "Training plan"). The "All meetings" / "All training" buttons were removed at
  the user's request; the "See all …" link at the bottom of each landing page is the way to the full list.

### People page (decided with the user, built)

Mockup: `docs/design/people-and-plan-mockup.html` (sections 1 to 3). The user asked for short text and one-word buttons everywhere.

- **A page of its own** for the people list (Settings → People becomes a link to it, and an initials chip can lead to it). It replaces the
  People section in Settings. Columns: name, initials, number of meetings, number of trainings, actions (Edit, Remove). "Me" is marked.
  Add person, edit name and initials, and "This is me" keep working as they do now. Initials stay unique (an automatic RM2 stays).
- **No "named in your notes, not in the list" section in the app** (a one-time job for a script, see the ROADMAP) **and no
  similar-initials warning** (the user doubted it was needed; uniqueness is already enforced).
- **Changing a name or initials is written into the files.** Only two things are rewritten: people in the structured fields (meeting
  attendees, training leads; the front matter line, exact match on the old name) and the owners inside `TODO(...)` markers in meeting
  bodies (initials, including the multi-owner forms and Previous TODOs). Nothing else in a note is touched. The dialog says one short
  sentence ("This will update the name in meetings and trainings." / "Initials in TODOs will change.") with **Cancel** and **Change**;
  there is no "list only" option. Safety still applies underneath: guarded saves (a file that changed meanwhile is skipped and reported),
  a backup of each file first (as `convert:topics` does), and a test that fails if the rewrite touches anything else (mutation check).
- **Removing a person:** if no meeting or training mentions them, **Delete** (Cancel, Delete). If notes mention them, the choice is
  **Archive** (the default) or **Merge**. Archive moves them to an "Archived" group with **Restore**; they are not offered when adding
  people to a note, their names and initials still resolve in old notes, and their initials stay reserved. Merge asks for the person to
  merge into and rewrites names and TODO initials in the files to that person, then removes the merged one.
- Deleting or archiving never edits a note. Removing someone from a note's own field stays a normal edit in that note.

**As built** (`PeoplePage`, `PeopleTable`, `RemoveDialog` in `src/modules/meetings/renderer/`; logic in `PeopleService`, `rewrite-files.ts`, `people-rewrite.ts`):

- The page is at `/research/meetings/people`; Settings → People is a link (`AllLink`). Add is an inline row (no pop-up); Edit turns a
  row into inputs with Save and Cancel, and "This is me" lives in the edit row. The person marked "me" has no Remove.
- The Change dialog only appears when a note mentions the person; initials clashes are refused before it (the same list rules as the
  main process). Counts come from the index, so `PeopleService` reindexes the notes it rewrites to keep them right at once.
- Rewrites go through `rewriteNoteFiles`: original copied to `~/CentralCommand/backups/people-<time>/{meetings,training}/`, then a
  content-hash guarded save; a note edited meanwhile is skipped and named in a Notice. Tests fail if anything but the attendee/lead
  line and the TODO owner brackets changes (fences and inline code are skipped; a merged person already listed is kept once).
- Delete is refused in the main process while any indexed note mentions the person. Archived people stay in `people.json` with
  `archived: true`, so their name and initials still resolve and stay reserved; pickers (`PeopleField`, `ownerOptions`) skip them
  unless they attended that meeting. Archiving clears "me".
- Not built: an initials chip that links to the page (mockup mentions it); it would compete with the chip's remove button.
- `npm run people:from-notes` lists people named in notes but missing from the list (dry run by default).

## Notes (`docs/NOTES_PLAN.md`)

Built as planned in nine stages (pure rules, main core, IPC, note page, list, landing, quick capture, import, polish). What was decided
or found on the way:

- **Files and index.** One Markdown file per note in `~/CentralCommand/notes/notes/<workspace>/` (only `research` is created and watched).
  Front matter is `title`, `group`, `subgroup`, `pinned`, `created`; other keys (the import adds `imported-from`) are kept as they are.
  The file name follows the title (`Methods: participants` is `Methods participants.md`: a colon followed by a space is dropped, other
  colons become `-`), ` 2`, ` 3` when taken, `Untitled` without a title. A file whose name already fits its title (the title, or the
  title and a number) is not renamed again. The index (`notes/0001_notes`) keeps the file's modified time as "edited", so edits made in
  another tool show; it is rebuilt from the folder at start and pruned before every list.
- **Groups are derived and compare loosely.** A group exists while a note uses it. Names compare ignoring case, accents and spacing and
  the first spelling found wins, so typing `thesis` files a note under `Thesis`; a lone note may still respell its own group. A name may
  not contain `/`, `\` or `›`. Moving a note to another group leaves its old subgroup behind; a note with no group has no subgroup
  (both enforced when the file is written). Choosing a group in a filter includes its subgroups.
- **Saving.** As Meetings: a save is `{ meta?, body? }` applied to what is on disk and checked against the hash of the whole file, so
  the fields and the text cannot overwrite each other; a missing file is an error and only `create` makes files (exclusively, so it
  cannot replace one, even one the index does not know). Pinning a fifth note is refused in the main process, not just greyed out.
  Delete moves the file to the macOS Trash and drops the row only after the move worked. Mutation checks (a test fails when the hash
  guard, the folder check when creating or renaming, the Trash move or the four-pin limit is removed) are in `notes-store.test.ts`.
- **Landing.** Pinned (the four most recently edited if a hand-edited file marks more), Groups (the six most recently edited as cards,
  Ungrouped always among them and last, dashed; the rest behind "Show all" as a row of names and counts) and Recent. Landing cards and
  the recent list are the shared ones; `SeriesCards` gained an optional second line, a pin and a dashed border. The group and its
  subgroups only appear as a line on their card.
- **Quick capture** (`Mod-Shift-n`) is handled by a `QuickCapture` component the module manifest lists under the new optional `globals`
  (the shell mounts it on every page), so the shell knows nothing about Notes. It starts the note in the group the All notes page is
  showing (the page tells `capture-group.ts`, a plain module variable, because the shortcut is handled outside the page) and puts
  the cursor in the text; "New note" puts it in the title. It is listed in Settings through the manifest's `shortcuts`.
- **A dev-only bug found by using the app.** The editor's first version focused itself once. React StrictMode throws the first editor
  away, so in `npm run dev` the cursor landed in nothing and text typed right after the shortcut was lost if you left at once. The
  editor now focuses each time one becomes ready (`autoFocus` on `NotesEditor`). The production build was fine, which is why both
  modes are checked.
- **Reuse.** The note page and session copy the Training entry page (`NoteSession` extends `EntrySession`, which now also reports
  `updatedAt`, used for "Updated"). The table's keyboard handling is a new shared hook, `useRowNavigation`; Meetings' and Training's
  tables now use it too (checked in the built app against copies of the real meetings and training). Readings' table is virtualised and keeps its own. `DeleteDialog` takes an optional `contents` ("and all its text").
- **The import** (`npm run import:notes`) reads the four vault folders, lists deeper folders and everything else it did not read, and
  creates files only: nothing existing is touched, so it does not make backups (the plan mentioned one; there is nothing to back up).
  A converted note is checked against its source (the text byte for byte, line count, TODO words, ticked and unticked boxes, every
  line of front matter the note already had); a note that fails is left out and reported. A note already imported (its `imported-from`
  is in the folder) is skipped, so a second run adds nothing, and a taken name gets ` 2`. Mutation checks are in `note-import.test.ts`.
- **Wiki links are stripped by the import** (the user's call): `[[Note]]` becomes `Note` and `[[Note|Shown]]` becomes `Shown`, fenced
  code is left alone, and the check expects exactly that difference. A note with an `![[embed]]` is left out and reported (the user
  believes there are none; the real vault's dry run finds one link and no embeds). This also avoids the editor's escaping of bare `[`
  (`\[\[Link]]` on the first edit), which is a known choice in "Notes editor" above.
- **Empty notes remove themselves** (the user's call). Leaving a note page asks the main process to `discardIfEmpty`: no title, no
  text, not pinned and no front matter keys the app does not own, so an imported note is never touched. It deletes the file outright
  (the one exception to the Trash rule: nothing is in it, and the Trash would fill with empty `Untitled` files). The renderer waits
  300 ms and only asks if the session is still disposed, because in development React unmounts and mounts a new page at once. Not
  swept at start-up, so an empty note left by a crash stays until opened and left.

### Editor card (after the first Notes review)

- Every notes editor (Notes, Meetings, Training entries, the Training plan, Readings notes) sits in one shared `EditorCard`: a white window
  with a quiet line under the text, "Created … · Edited … · 412 words", which stays at the bottom of the window in a long note. The
  code never had a white window around the text before (Meetings, Training and Notes pages drew it straight on the grey page, and only the
  Training plan had its own white page); the mockups did show one, so this follows them. Notes' details bar is gone; Group and Pin sit
  beside the title.
- **Created is only shown for Notes**, which records it in its front matter. The file's own creation time was tried and rejected: every
  save writes a temporary file and renames it over the note, so the creation time is the last save. Adding a `created` key to the other
  kinds of file is the alternative if wanted.
- **Edited** is the file's modified time: `readNoteFile` now returns it (`NoteContent.edited`), and both sessions keep it and use the
  time of their own saves afterwards. The word count is of the text as it stands, so it moves while typing. It counts what the editor
  writes back: a bare link the editor turns into `<https://…>` is no longer counted.
- **Readings' table keeps its own keyboard code.** It is virtualised (rows are `div`s that come and go while scrolling), so focus has to wait
  for a row to be rendered, scroll with `scrollToIndex`, and page by the height of the scroller. `useRowNavigation` is for plain `<tr>`
  tables (Notes, Meetings, Training) and would need all of that to fit.

## Global search (Mod-K, or the magnifier in the top bar)

- **One field, a command palette and a search at once.** Typing either finds things (notes, meetings, training, readings, people) or
  matches a command's name (New note, New meeting, New training entry, Open Settings, Open People, Show your data folder), and both
  can show at once ("new note" matches the command and any note whose text happens to contain those words). A result shows the title
  and one line: the part of the text that matched (with … around it) when the title itself did not match, else the details (a note's
  group and date, a meeting's summary, a reading's short citation, how often a person is mentioned). Arrow keys move through all the
  results as one list, Enter opens or runs one, Escape or Mod-K again closes. "No results." when nothing matches; nothing at all
  before typing.
- **`in:` modifiers, Gmail- and Slack-style** (`src/shared/search.ts`, `parseSearchQuery`): `in:meetings luminos` searches only
  Meetings; `in:notes`, `in:training`, `in:readings` and `in:people` do the same for the others (singular or plural, either works;
  `in:meetings in:notes` searches both). Naming a source with nothing else lists everything in it (an empty search string is not
  the same as "search nothing" once a source is named). An `in:` word that names nothing recognised (`in:progress`) is left as
  ordinary text, so it is never silently swallowed.
- **A "See all results" link** at the bottom of the window (shown once any group reaches its cap of six) opens `/search?q=…`, the
  same search with a much higher cap (40) as a full page, grouped the same way, with the field still there to keep typing or add an
  `in:` modifier.
- **How results are ranked (`SEARCH_GROUP_ORDER` in `src/shared/search.ts`).** There is no relevance score across the whole app: a
  match is either "in the title" or "in the text", and beyond that, order is two simple, fixed rules, deliberately, so this is easy
  to reason about and to change later if it stops being good enough:
  1. **Which group, fixed:** Actions (when any command matches), People, Notes, Meetings, Training, Readings. This is why searching
     "Kathy" shows the person first, then any note mentioning her, then meetings, before her papers as a co-author: it is not a
     judgement that a meeting matters more than a paper, just that Meetings is ordered before Readings.
  2. **Within a group, whatever that module's own list already sorts by:** Notes and Meetings and Training entries are most recent
     first (its own `compareRecent`/`compareNewestFirst`), Readings keeps the list's own sort (year, newest first, by default),
     People are ordered by how often they are mentioned (meetings plus trainings), most first. None of this looks at how well a
     result matches beyond title-vs-text; a future improvement, if wanted, is a real per-hit relevance score (term frequency, an
     exact-phrase boost) instead of piggy-backing on each list's existing order.
  3. A source this build does not recognise (a module search id not in `SEARCH_GROUP_ORDER`) is put last rather than dropped, so a
     future module still shows up if this order list is not updated for it.
- **People are searched** (`src/modules/meetings/renderer/people-search.ts`): by name or initials, archived people excluded (as
  every other picker in the app excludes them). A hit opens the People page with `?person=<name>` in the address, which scrolls to
  that row and tints it (`PeopleTable`'s `highlighted` prop) — there is no page of a person's own yet (see the ideas list).
- **Commands share the same window** (`src/renderer/src/shell/commands.ts`) rather than a separate palette: each does exactly what
  its own button does elsewhere (the same IPC calls as `NewMeetingButton`, `NewTrainingButton`, quick capture), so there is no
  second way for a meeting or a note to be created. A command's hit has `run` instead of `route` (`SearchHit.run`, optional); the
  window calls it instead of navigating.
- **The shell knows no modules.** A module's manifest may offer `search(query, limit?)` returning `SearchHit`s; the registry lists
  them (`moduleSearches`) and `searchEverywhere` (`src/renderer/src/shell/run-search.ts`) parses the query, asks the right sources
  (dropping one that fails), and sorts the groups. Adding a module to the search is one function and one manifest line. Each
  module's `renderer/search.ts` reuses its own list query (`queryNotes`, `queryMeetings`, `queryTraining`, the Readings list with a
  search), so a word matches here exactly as it does in that module's list (folded for case and accents, every word must match).
- **What is searched** is what the indexes hold: titles, fields and the plain text of each note, the whole of it (the index keeps up
  to 200,000 characters, `SEARCH_TEXT_LENGTH`; it was 4,000, and 300 for a reading's notes, before the search was completed), a
  reading's title, authors, tags and notes, the yearly Training plans (read from their files: the years with entries, this one and
  the next), and the people list. No new index, no new IPC. Each search asks the main process for the lists again (about a hundred
  rows each today, after a 120 ms pause in typing); if that ever feels slow, keep the lists between keystrokes.
- **Not searched:** settings, and files that are not notes.
- Checked in the built app and dev mode (StrictMode) on a scratch library: opening, typing, ArrowDown, Enter, no results, Escape,
  the button, Mod-K from inside the editor, an `in:` modifier, a command actually running (New note), "See all results" reaching
  the full page, and a person hit landing on their highlighted row. The field is a plain text input (a search input clears itself
  on the first Escape).

## Dark mode (Theme: System, Light or Dark, in Settings)

- **Each colour is written once.** `tokens.css` uses `light-dark(light, dark)` under `color-scheme: light dark`, so a component never
  knows about themes and the dark palette sits beside the light one. Two things became tokens because components had derived them
  from `black` or the ink colour: the hover shades (`--accent-hover`, `--danger-hover`) and the dialog backdrop (`--scrim`); the
  shadow colour is `--shadow-color`. Still no raw colours in components.
- **The setting decides the whole window.** The main process sets `nativeTheme.themeSource` from `settings.theme` at start and when it
  changes, so the page's `prefers-color-scheme`, scrollbars and native controls (date and time inputs, selects) follow it without any
  code in the renderer. The window's start colour (before the page paints) follows the theme too. A hand-edited unknown value falls
  back to System.
- **Dark palette** ("Cool Slate" kept cool and low-contrast at the edges): page `#14181d`, panels `#1b2128`, cards `#1f262e`, text
  `#e6eaee`, muted text `#98a3af`, accent `#86aad0` with dark text on it, danger `#dc7c77`.
- Checked in the built app (Settings, Research, Readings, a reading, Meetings and a meeting, Training and an entry and the plan, Notes and
  a note, the group menu, the delete dialog, search, Ask) and by switching Light, Dark and System live. **A note for testing:**
  Playwright emulates a light colour scheme by default, which hides the app's own; call `page.emulateMedia({ colorScheme: null })`
  first. PDF exports keep their own light page.

## Editor: opening links, and the right-click menu

- **Opening a link:** hold Cmd (Ctrl elsewhere) and click. A plain click puts the cursor in the link, as in any editor (a link inside
  editable text cannot be followed by clicking). The click calls `window.open`; the main process already opens only `http` and `https`
  addresses in the browser and refuses everything else (`isSafeExternalUrl`, now in `src/main/urls.ts`, tested). Listed in Settings
  under the notes editor keys as "Mod-Click" (one of the two keys that are ours, not Milkdown's).
- **Right-click menu** (`src/main/context-menu.ts`, tested): Electron has none of its own, so there was no spelling help and no
  Copy or Paste from the mouse. It shows spelling suggestions (up to five, "No suggestions", "Add to dictionary") for a misspelt
  word in editable text, then Open link (web addresses only) and Copy link address on a link, then Cut, Copy, Paste and Select all in
  editable text (Cut and Copy only with a selection) or Copy on selected text elsewhere. Nothing is shown where there is nothing to
  do. **Undo and Redo are left out on purpose:** the editor keeps its own history, which the system's undo would bypass; the keys work.
- Checked in the built app with the browser hand-off replaced by a recorder: a plain click opens nothing, Cmd-click opens the address
  once and leaves the note open; the menu template builds. The native menu itself is not visible to the test driver, so **look at a
  right-click by hand once** (a misspelt word in a note).

## Small, standard things added while the user was away (26 Sep 2026)

None needed a design decision; each follows what most Mac apps do. Each is tested, and checked in the built app where it shows.

- **A crash on one page** shows "Something went wrong. This page could not be shown. Your notes are safe." with a Try again button
  (`ErrorBoundary` around the routes) and the top bar, search and other pages keep working. It clears when the address changes and never
  remounts a page that is working (a note's address changes when it is renamed, and the page must keep its cursor).
- **The window opens where it was left** (`settings.ui.window`, saved half a second after a move or resize, not while maximised, full
  screen or minimised). A remembered position on a screen that is gone is dropped and only the size is kept (`restoreBounds`, tested).
- **The window is named after the open page** ("Methods · Central Command"): notes, meetings, training entries and readings. Back to the
  app's name on any other page.
- **Settings → Your data** shows the data folder with a **Show** button (Finder) and the app's version. The only two things the window
  can ask about the machine (`window.api.app`).
- **Cmd-, opens Settings; Cmd-1, 2 and 3 go to Life, Research and Work** (listed under Everywhere in Settings).
- **`lang="en-GB"`** on the page.
- **Colour contrast is a test:** every text and button colour pair is checked for WCAG AA (4.5:1) in both themes
  (`theme/tokens.test.ts`), so a new or changed colour that is hard to read fails a test.
- **Checked with a library ten times the size** (2,000 notes, 600 meetings, 800 training entries; about 9 MB of text): start to the
  Research page with counts 1.4 s; each list 4 to 50 ms in the main process (the notes list is 17 MB over the bridge); a search
  as typed 50 to 300 ms; the Notes list to its first row 250 ms. Nothing needs changing yet. The first thing to do if it ever slows is
  to send the lists without the full text and search in the main process.
- **The failure paths, in the built app, for all five editors** (a note, a meeting, a training entry, the Training plan, a reading's
  notes): typing and quitting at once leaves the text on disk; a change made outside while the editor is clean is shown in it (status
  "Updated from an outside change"); a change made outside while typing brings up the conflict notice, nothing is overwritten, and
  "Use the file's version" loads the outside text.

## Settings: categorised into tabs (27 Sep 2026, at the user's request)

The long single-column list did not scale (five module sections plus a very long shortcuts list) and wasted the window's
width. Redesigned around the Training plan's own layout, since it already solves "a sticky list of places to jump to
beside the content" (`docs/DECISIONS.md` has no separate entry for it; see `TrainingPlanPage.module.css`'s `.layout`/`.outline`):
a 220px category rail, sticky, beside a wider content panel (`SettingsPage` max width raised from 760px to 1040px). The
active category uses the same `--selected-bg`/`--selected-text` look as `Pill` and `Segmented`, so it reads as the same
kind of control across the app.

- **Categories: General, one per module that has a `settingsSection`, Shortcuts, About.** A module's tab is named after
  the module itself (`moduleSettingsSections()` now returns each section's module `label` too), so a new module's
  settings get their own tab with no naming decision and no change to `SettingsPage`. General holds the fields that
  belong to no module (Theme, the Build button's repository path and terminal). Shortcuts and About are the shell's own,
  always last.
- **Each module's tab is self-contained**, matching how Training already worked (`TrainingSettings` renders its own
  `PathField` for the Trainings folder): the Zotero export path moved out of the old top-level list and into
  `SyncSummary`, next to the sync status it feeds, so "Readings" is one card with everything about it. `AboutSettings`
  gained its own heading and card to match.
- **The chosen tab is remembered** between visits, the same way a list's filters are (`settings.ui.moduleState`, keyed
  `"settings"`; `normaliseSettingsTab` falls back to the first tab if the remembered one no longer exists, e.g. a module
  whose settings section was removed).
- **The People link is gone from Settings** (it only ever pointed at the People page, which Research now links to
  directly); nothing replaces it yet, per the user.

## Notes outline (27 Sep 2026, at the user's request)

- **A live outline beside the editor**, the same position and card look as Meetings' topics panel (`NoteOutline.tsx`, a `.split`
  layout like `MeetingPage`'s): the note's own `#`, `##` and `###` headings, in order, generated from the text as it is typed (no
  separate "add a heading" step, unlike Meetings' topics, which are ticked off; a note's outline is pure navigation). Clicking one
  scrolls to the first heading of that level with that exact text. Empty note: "Headings you write appear here."
- **The heading parser is now shared** (`src/shared/markdown-outline.ts`, `markdownOutline(markdown, levels)`): it used to live only
  in the Training plan (`planOutline`, hard-coded to `##`/`###`), which now calls the shared function with `[2, 3]` and behaves
  exactly as before (its own test file is unchanged). Notes calls it with `[1, 2, 3]`. A future editor wanting an outline needs no
  new parsing, just the levels it cares about.
- Checked in the built app: typing `##`/`###` headings updates the outline live, clicking a nested heading scrolls to it and not to
  an outer heading sharing its text.

## Find in the note (Cmd-F, at the user's request, replacing the earlier find-on-page attempt)

- **Scoped to the note, not the page.** The earlier attempt (see "Find on the page", above) used Electron's
  `webContents.findInPage`, which searches the whole rendered page (the top bar, the outline, everything) and, being
  cross-process, lost keystrokes under fast typing. This one is a ProseMirror plugin (`notes-find.ts`) living entirely
  in the renderer: `findMatches(doc, query)` walks the document's text nodes and returns `{from, to}` positions (no
  DOM search, so it survives re-renders), and a decoration highlights every match, the current one more strongly.
  Nothing is written to the file; a mutation check is not needed here since the plugin only ever adds decorations to
  a transaction, never edits the document.
- **Built into `NotesEditor` itself**, the same shared component every module already uses, so Notes, Meetings,
  Training entries, the Training plan and Readings notes all get it for free; no page had to be changed. The bridge
  between the plugin (which owns Cmd-F, the same `handleKeyDown` shape as the TODO helper's `Cmd-Shift-T`) and the
  bar (a `NotesFindController` class, the same shape as `TodoMenuController`: it keeps the `EditorView` and the
  current matches, and tells React through a setter) is `useNotesFind`, following the pattern CLAUDE.md already
  names for this ("keep behaviour a key handler needs in a small class held with `useState(() => new …)`").
- **A bar fixed to the bottom of the window** (not the bottom of the note, which could be scrolled far out of view):
  a field, a count ("2 of 3"), Previous, Next and Close. Enter/Shift-Enter move; Escape closes and clears the
  highlights. Does not collide with global search's own Cmd-K, or with a module's own editor shortcuts (checked
  against Meetings' TODO helper, Cmd-Shift-T still opens its menu after Find has been used).
- **A known limitation, on purpose:** a match cannot cross a mark boundary (a word split across bold and plain text,
  or across a heading and the paragraph after it, is not found), since matching works one text node at a time. Good
  enough for finding your own words back; a full-text engine would need to flatten the document first and map
  positions back, which is more machinery than this needed.
- Checked in the built app and dev mode (StrictMode): opening, typing, the count, Enter and Shift-Enter wrapping
  round, Escape clearing the highlights and closing, the note file unchanged, and on a Meeting's notes (confirming
  it is not Notes-module-specific and does not conflict with that module's own shortcuts).

## Find in the note, redesigned as an inline bar with replace (at the user's request, 27 Sep 2026)

- **Moved from a floating, `position: fixed` portal into `EditorCard`'s own footer strip**, in place of its
  "Created · Edited · N words" line while find is open. `EditorCard`'s `children` is now a render-prop,
  `(findSetup) => ReactNode`, instead of a plain node: `EditorCard` owns `useNotesFind()` itself (the footer is
  where the bar lives, so the footer's own component owns it), and hands `findSetup` down to whichever
  `NotesEditor` its caller renders. `NotesEditor` grew a required `findSetup` prop alongside its existing
  `setup`, applied last (outermost), exactly where it sat before this change. All five call sites (Notes,
  Meetings, Training entries, the Training plan, Readings notes) changed the same way: `<EditorCard>`'s child
  became `{(findSetup) => <NotesEditor ... findSetup={findSetup} />}`.
- **This moved the bar's lifetime with it, which needed a real fix, not just a relocation.** Cmd-F used to live
  inside `NotesEditor`'s own `Inner`, which is remounted (a fresh `useNotesFind()`) every time `key=
  {snapshot.editorKey}` changes (a reload from disk). Now that `useNotesFind` lives in `EditorCard`, which does
  not remount on that key, the same controller and its `view` reference would persist across a swap and go
  stale. Fixed at the true source of the lifetime, not the React tree: `notesFindPlugin`'s `view()` now returns
  `{ destroy: () => bridge.detach() }`, so whenever a ProseMirror `EditorView` is actually destroyed (a reload,
  or React StrictMode's throwaway first mount) the bridge closes itself, regardless of which component
  currently holds the React state.
- **VS Code's inline find/replace bar, not Emacs' `isearch`/`query-replace`**, chosen because a second row that
  only appears when wanted reads better in the narrow footer strip than two separate, differently-shaped modes
  would. Cmd-F opens find alone; **Cmd-Option-F** (`REPLACE_TOGGLE_SHORTCUT`, VS Code's own chord) opens with
  the replace row already shown, or toggles it if find is already open. Enter/Shift-Enter still move between
  matches in either field; **Cmd-Return replaces the current match, Cmd-Shift-Return replaces every match**
  (`REPLACE_ONE_SHORTCUT` / `REPLACE_ALL_SHORTCUT`), the exact chords suggested when this was scoped, chosen so
  plain Enter keeps one meaning everywhere instead of splitting by which field has focus. All three are new
  rows in `NOTES_EDITOR_SHORTCUTS`.
- **Replace-all is one transaction (one undo step).** `replaceAllMatches` applies every match back-to-front
  (highest position first) in a single `Transaction`, using `insertText`, which keeps a match's own marks
  (bold stays bold) automatically. Applying from the end backwards is what keeps every earlier match's
  position valid without remapping: replacing a match only ever changes text after its own start. A mutation
  check (CLAUDE.md's habit for safety-critical logic) confirmed this matters: sorting the other way while
  keeping the same positions corrupts every replacement after the first once the replacement text is a
  different length than the query, and three tests in `notes-find.test.ts` catch it.
- **The "does not cross a mark boundary" limitation needed no new rule for replace.** Every match `findMatches`
  returns is already confined to one text node (that is exactly why it cannot be found split across a mark or
  a block boundary), so a found match is always a plain, single-node edit; there is no case where replacing a
  match would itself need to cross a boundary the way finding one can fail to.
- **Escape had a real bug worth recording**: clicking "Replace all" (or a "Replace" that empties the matches)
  disables that button, which blurs it to nothing focused at all; Escape sent to `document.body` never reached
  the bar's own `onKeyDown`, since that only saw keys typed into its two fields. Fixed with a window-level
  `keydown` listener while the bar is open, the same "escape hatch" every other pop-up in the app needs,
  removed again on close; found by driving the real app, not by reading the code, which is why the testing
  section of `CLAUDE.md` insists on it.
- Checked in the built app and dev mode (StrictMode), on Notes and on a Meeting (to confirm no collision with
  the TODO helper's own Cmd-Shift-T): opening with Cmd-F and Cmd-Option-F, the count, next/previous, toggling
  the replace row, Replace and Replace all (by button and by chord), the facts line returning on Escape
  including right after a click left nothing focused, and a single Undo restoring a whole replace-all at once.

## Mac conventions sweep (at the user's request, 27 Sep 2026)

- **The app's real name, everywhere macOS shows one:** `app.setName(APP_NAME)` before the app is ready, so the Dock
  and (if the default menu is ever shown) the menu bar say "Central Command", not "Electron" (the binary's own
  name, which is what showed before, in dev). A native **About Central Command** panel
  (`app.setAboutPanelOptions`) gives the version without a page for it.
- **A Dock menu** (right-click or long-press the icon; `src/main/dock-menu.ts`, `app.dock` only exists on macOS)
  offers the same three "start something now" actions as the command palette: New Note, New Meeting, New Training
  Entry. The Dock menu runs in the main process and cannot call `window.api` itself, so it only sends which action
  was chosen (`IPC.appDockAction`, `DockActionId`) to the focused window; the window does the actual creating,
  through `DockActions` (renders nothing, mounted once in `Shell`) calling `runQuickAction`.
- **One list of quick actions**, not two: `New note` / `New meeting` / `New training entry` used to be defined
  only inside the command palette (`commands.ts`). They moved to `src/renderer/src/shell/quick-actions.ts`
  (`QUICK_ACTIONS`, `runQuickAction`), which the command palette, the Dock menu and any future caller all share, so
  there is exactly one place that knows how a meeting, a training entry or a note gets created from a shortcut.
- **No custom application menu bar.** Electron's own default (Quit, Hide, Edit with Cut/Copy/Paste/Undo/Redo, the
  Window menu with Minimize/Zoom/Close) already gives the core conventions (Cmd-Q, Cmd-W, Cmd-H, Cmd-M) for free.
  Building a custom one was considered and dropped: its Edit menu's Undo/Redo roles call `webContents.undo()`
  (Chromium's own undo), which would fight the notes editor's own history exactly the way the right-click menu's
  Undo/Redo were left out for (see "Editor: opening links, and the right-click menu", above); omitting just those
  two from a custom menu was possible but added risk (accelerators can still shadow a plugin's own key handling)
  for little gain over what the default already provides.
- Checked in the built app: `app.getName()`, the Dock menu's three labels, and simulating a Dock click (sending
  `IPC.appDockAction` directly, since Playwright cannot really right-click the Dock) correctly creates a note and
  opens it.

## Training entry page: a side panel, matching Meetings (at the user's request, 27 Sep 2026)

- **Same `.split` layout as `MeetingPage`** (`minmax(0, 1fr) 260px`, 40px gap, stacking under 900px):
  `TrainingEntryPage` now has a side column holding two panels, `FilesPanel` (existing) above `NoteOutline` (new
  here). Files stays first since it is the side panel Training already had; the outline is the addition.
- **`NoteOutline` is reused as-is** from the Notes module (`@modules/notes/renderer/NoteOutline`), the same
  cross-module import pattern Training already uses for Meetings' `shared/query` and `shared/hours`. It needed no
  changes: it already takes plain `text` and a `docRef`, with no assumption about heading convention, so a
  training entry's `## Summary` / `## Notes` template (and whatever the user adds under either) shows exactly as
  typed — unlike Meetings' `TopicsPanel`, which is built from a checklist convention, this is pure navigation.
- **Meetings itself does not get a second outline panel.** `TopicsPanel` already is Meetings' outline (the note's
  own `###`/`##` headings, with a discussed checkbox added); a separate, plain outline beside it would duplicate
  it. Revisit only if the user asks again after seeing Training's plain outline next to it.
- Checked in the built app and dev mode (StrictMode) on a scratch library: a new training entry shows Files above
  Outline in the 260px column, the outline lists the entry's own headings live as they're typed, and clicking one
  scrolls the editor to it.
