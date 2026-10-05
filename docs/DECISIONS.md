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

## Notes editor: CodeMirror 6, with the Markdown text as the document (30 Sep 2026; replaces the Milkdown decision below)

Asked for on 30 Sep 2026 ("live markup, the Typora way"): every editor draws the note formatted, and shows the markers (`### `, `**`, `[` … `](url)`)
only where the cursor is. Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`; the stage-by-stage write-ups are "Live markup in the notes editor, stage 1" to "stage 8"
below. `LiveEditor` (`src/renderer/src/editor/`) is the only editor: Notes, Work notes, Meetings, Training entries and plan, Reading lists and Readings
notes all render it. Milkdown and its packages are gone.

- **Why CodeMirror, and why the Markdown is the document.** Milkdown (ProseMirror) holds a tree of rendered nodes and produces Markdown by serialising it,
  so markers are not text there. Getting the Typora behaviour out of it meant swapping the block under the cursor into a raw-text node and parsing it back
  when the cursor left: two representations of one block, every swap a document change that undo, the change reporter, Find, the word count and IME
  composition all have to treat specially, and a parse on leaving can change what you typed. For notes that matter, "the editor may rewrite what you typed
  when you click away" was the wrong foundation. With CodeMirror the document _is_ the file's text and the formatting is a layer drawn over it (how Obsidian
  does it).
- **What it gives.**
  - **Identity round trip.** Opening never reformats and saving writes exactly what is in the editor. A note with `*` bullets, a two-space hard break,
    a bare `*` or hand-written spacing stays as written; the normalisation list in the Milkdown decision below no longer applies. A file's own line
    break (`\r\n` or `\n`) is kept.
  - **Plain-text undo.** Nothing swaps in and out. `live-history.ts` only makes each command (a formatting key, a list Backspace, Enter, a paste, a chosen
    mention, a replace) its own undo step.
  - **Decorations never change content.** Hiding a marker, drawing a bullet or checkbox, a chip, a table grid or a fence is a decoration over real text
    (`Decoration.replace` and `mark`); a bug there can make a note look wrong, never change it. Markers are hidden only away from the cursor and a hidden range
    never has the cursor inside it (touching it reveals it), so only units (bullet, checkbox, chip) are atomic.
  - **The real-library gate.** `live-library.test.ts` runs over a copy of every note and backup (406 files): open with no edit reports nothing; an edit at the
    start, middle or end leaves the rest byte-identical; every formatting, list, table, fence, mention, find, replace, TODO and paste command is pressed at a
    spread of places and must change only what it should, and one undo must give the note back byte for byte. It is opt-in
    (`LIVE_EDITOR_LIBRARY=<copy of ~/CentralCommand/notes and backups> npx vitest run src/renderer/src/editor/live-library`) and must pass before each
    editor change is finished. It found real problems (setext underlines in stage 2; its own blind spot on long notes in stage 6).
- **Kept from the Milkdown editor** (the rules, not the code): the change reporter is synchronous (`EditorView.updateListener`, no debounce; the session does its
  own), `onBlur` is unchanged, the main process still holds the window open to flush pending saves on quit, and the file is not touched until the user edits.
  The file format is unchanged; a mention is still `[label](cc://kind/key)`.
- **Shortcuts are ours.** CodeMirror has no Markdown formatting keys, so `live-keymap.ts` binds every chord in Settings' Notes editor list and
  `notes-shortcuts.test.ts` fails if a listed chord is not bound (it replaced the test that read Milkdown's built source).
- **Chosen with the user**: formatted paste (web, Word) is pasted as plain text; selection across blocks shows no markers; nested quotes show one `>` per level
  as typed; typing `#` at the start of a heading raises the level; a marker is deleted like any character.
- **Cost.** About 3,000 lines of editor code were replaced, and 94 tests were retired (each recorded as ported or retired in "stage 8"). Bugs that only the
  built app showed (CSS specificity against CodeMirror's own `.cm-line` reset, grid cells made by hidden ranges, the tail of a long note seen as plain text
  in tests) are in the stage write-ups and in the pitfalls in `CLAUDE.md`.
- **Packages.** `@codemirror/view`, `state`, `commands`, `language`, `lang-markdown` and `search` are direct dependencies (and `@lezer/common`); `@lezer/markdown`
  (GFM) comes with `lang-markdown`. No ESM-only main-process dependency was involved.

## Notes editor: Milkdown, configured for plain Markdown (superseded 30 Sep 2026 by the live markup editor, above; kept as history)

> **Superseded.** Milkdown is no longer in the app. The text below describes the old editor, including the "known normalisations", which no longer happen.

The spike passed: Milkdown round-trips headings, emphasis, lists, task lists, quotes,
links, fenced code, tables, strikethrough, rules and unicode byte-for-byte when
configured with dash bullets and `---` rules. A note is only written back after the user
edits it, so opening a note never reformats it. Known normalisations (equivalent, valid
Markdown): `*` bullets become `-`; a two-space hard break becomes a backslash break;
bare `*`, `_` and `[` are escaped (`\*`, `\_`, `\[`); adjacent lists alternate `-` and `*`
markers so they stay separate lists. Tests pin these down.

## Editor changes are reported synchronously (a data-loss bug found by using the app)

> **Historical (30 Sep 2026).** The rule still holds, now as `EditorView.updateListener` in `editor/live-state.ts`; the debounce and the ProseMirror plugin below were Milkdown's. See "Notes editor: CodeMirror 6, with the Markdown text as the document".

Milkdown's change listener is debounced (~200 ms). Typing and then leaving the page, or
closing the window, inside that window dropped the last words. The editor now reports
every document change immediately through a small ProseMirror plugin, and the session does
its own debouncing before saving (~500 ms). On top of that, the main process holds a
window open (up to 3 s) after asking the renderer to flush pending saves, so closing the
window or quitting never loses edits.

## Task list checkboxes use CSS plus a tiny plugin, not Milkdown's Vue components

> **Historical (30 Sep 2026).** Milkdown is gone. A checkbox is now a widget drawn over the `- [ ] ` text (`editor/live-widgets.ts`); a click writes `[x]` or `[ ]`.

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

> **Historical (30 Sep 2026).** Written for Milkdown. The rule lives on in `editor/live-lists.ts` (`liftListItemAtStart` is gone); see "Notes editor: CodeMirror 6, with the Markdown text as the document".

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
- **The TODO helper is a Milkdown plugin plus a small menu controller** (historical: since stage 5 of the live markup work it is `meetings/renderer/todo-live.ts`, on CodeMirror; the keys and what it writes are the same). `/todo` (at the start of a line or
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

> **Historical (30 Sep 2026).** The editor group is no longer checked against Milkdown's source: `notes-shortcuts.test.ts` checks the list against `live-keymap.ts`, and chords are still written as in the list (`Mod-Shift-t`). Bullet 3 below is Milkdown-era.

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
  because that folder is watched and indexed as training entries. It reuses `NotesSession` and the shared editor (then `NotesEditor`, now `LiveEditor`) unchanged (the year
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
  editor now focuses each time one becomes ready (`autoFocus` on the editor, then `NotesEditor`, now `LiveEditor`). The production build was fine, which is why both
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

### Editor card (after the first Notes review) (the "Created" part below was later dropped: see "Moving a note or meeting")

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
  under the notes editor keys as "Mod-Click" (one of the two keys that were ours, not Milkdown's; every key is ours now).
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

> **Historical (30 Sep 2026).** Describes the ProseMirror plugin (`notes-find.ts`), which was deleted with Milkdown. Find is now `editor/live-find.ts`, on the Markdown text (stage 5 below); the match-across-marks limitation no longer exists.

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

> **Historical (30 Sep 2026).** The bar, its place in `EditorCard`'s footer and its keys still stand. The `findSetup` prop, `NotesEditor` and `notesFindPlugin` below are gone: the bar talks to the editor through a `FindTarget` (`notes/find-types.ts`) and the editor reaches the card through `FindContext` (stage 5 and stage 8 below).

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

## Reading lists (new module, at the user's request, 27 Sep 2026)

Grounded in a real example the user shared (`Language of Instruction Papers.docx`): a list has a name, and is
divided into named sections written as questions; each section holds entries, one per paper, each a citation
followed by a one- or two-sentence annotation specific to that list. This was the most open-ended of the six
things asked for that day, so several shapes below were decided rather than specified; each is written down here
for review, the same way every other module's decisions are.

- **Files and index, following Notes almost exactly.** One Markdown file per list in
  `notes/reading-lists/<workspace>/` (only `research` today), front matter holding just `title` (a list has no
  other fields at the top level — everything else is in the body). `ReadingListStore` (`main/list-store.ts`) is
  `NotesStore` with grouping and pinning removed: the same guarded-file functions (`readNoteFile`,
  `writeNoteFileGuarded`, `createNoteFileExclusive`, `renameNoteFileExclusive`), the same rebuild-from-the-folder
  index, the same watcher, the same rename-on-title-change. A list is edited in the same shared `EditorCard` /
  editor (`NotesEditor`, now `LiveEditor`) every other kind of note uses (headings and bullets, typed normally), not a bespoke form: building
  a form for a variable number of sections and entries would just be re-inventing what a Markdown editor already
  does well, and it keeps a list's file readable and editable outside the app too.
- **A section is a `##` heading; an entry is a bullet under it, its citation the bullet's own leading bold run**
  (`parseListBody`, `src/modules/reading-lists/shared/list-body.ts`, the same fence-aware line-scanning
  (`@shared/sections`) every other structural parser in this app already uses). Three kinds, so nothing is ever
  silently dropped: `linked` (`**@citekey**`, an existing reading), `placeholder` (any other bold text, a citation
  typed by hand for a paper "not yet in Zotero, but it will be"), and `missing` (a bullet with no leading bold run
  at all). The rest of the bullet's text is the annotation.
- **`@citekey`, not `[[citekey]]`, and this one was only found by testing the real app, not by reading the code.**
  `[[citekey]]` was the first design (Obsidian's own convention, and visually close to what the brief's example
  read like). Typing it live is escaped by Milkdown already (historical: see the superseded Milkdown decision and the wiki-link stripping in
  "Importing notes from Obsidian", above; the new editor does not rewrite text, so this problem no longer exists, and `@citekey` is still the format) — expected, and worked around by never expecting it to be typed by
  hand — but a second, worse problem only showed up driving the built app: even a citekey inserted programmatically
  by "Attach a reading" survived the _first_ render, but Milkdown's Markdown serialiser escapes a bare `[` on the
  way back out (`**\[\[citekey]]**`), so the very next edit anywhere in the document would have silently turned
  every linked entry in the file back into an unrecognised one on its next save. A quick check loading both forms
  into a real Milkdown editor and reading `getMarkdown()` back confirmed it, and that `@citekey` round-trips
  byte-for-byte with no escaping. Switched before this ever reached the user's files.
- **Linking is one-way and deliberately only through "Attach a reading…".** Nothing lets you type a new linked
  entry by hand (no citekey-insertion menu or shortcut): you write the citation as a placeholder, exactly as the
  brief's example already does it, and a small search-as-you-type picker in the side panel (`EntriesPanel.tsx`,
  `AttachControl`) rewrites that one bullet's citation in place (`attachReading`, one string reconstruction of the
  bullet's own line, keeping the annotation) once you find the real reading. The search itself calls
  `window.api.readings.list` per keystroke (debounced 150 ms), the same as the Readings list's own search box, not
  a client-side filter of a fetched copy: readings can change from a sync while the list is open. A mutation check
  (`list-body.test.ts`) confirms `attachReading` never leaks into a neighbouring bullet.
- **A side panel resolves and previews the list, the same `.split` layout as Meetings and Training**: for each
  section, each entry shown as the reading's real short citation (linked to its page) or the placeholder text
  as typed, with the annotation, and "Attach a reading…" wherever there is no citekey yet (placeholder or
  missing). This is a live, read-only view of what `parseListBody` sees in the body as you type, the same
  relationship Meetings' `TopicsPanel` has to its note.
- **A reading's own page shows which lists mention it** (`ReadingListMentions.tsx`, after the abstract and before
  the notes editor, per the user's own suggestion), each with that list's own short annotation for it — never the
  rest of the list, never the reading's own (often much longer) notes, matching what the user asked for verbatim.
  This reads from a second table, `reading_list_mentions`, one row per linked entry, rebuilt alongside a list's
  own index row at reindex time (`buildIndexRow`, `main/index-row.ts`) so the reading page never has to read every
  list file to answer "which lists mention this".
- **Global search**: a `renderer/search.ts` and a manifest `search` entry, `reading-lists` added to
  `SEARCH_GROUP_ORDER` right after `readings` (a list is fundamentally about readings) and to the `in:` aliases
  (`in:list`, `in:lists`).
- **What was left out, on purpose, for now:** no dedicated "add section" / "add entry" buttons (typing `##` and
  `- ` is the same as every other structured note in this app); no importer for the user's own example document
  (`Language of Instruction Papers.docx`) — none of the six things asked for that day named one, and a docx
  importer is a separate, sizeable piece of work with its own safety checks to design, in the same way the Work
  meetings importer (below) was; no reordering of sections or entries beyond editing the Markdown by hand.
- Checked in the built app and dev mode (StrictMode) on a scratch library: the landing card and page, creating a
  list, typing sections and placeholder entries, the panel resolving and offering to attach, the search-and-attach
  picker end to end, the citation rendering bold in the editor and still resolving correctly after a save and a
  full reload from disk (the round-trip that found the `@citekey` decision above), a reading's own page showing
  "In your reading lists", global search finding a list, and deleting a list (to the Trash, with the same dialog
  copy every other kind of entry uses).

## A page per person, and links (at the user's request, 27 Sep 2026)

- **`PersonPage`** (`Research → People → a name`), reusing `LandingPage`/`LandingHeader`/`LandingSection`/`RecentList`
  exactly as the rest of the app's landing-style pages do: their meetings and trainings, newest first
  (`queryMeetings`/`queryTraining` filtered to them — already built for the two lists, so this needed no new
  filtering logic), when you last met and the next upcoming meeting, their open TODOs, and their links.
  `PeopleTable`'s name is now a link there; a search hit for a person (`people-search.ts`) routes straight to it
  instead of the list with a highlight, which stays as a fallback (`PeoplePage`'s own `?person=` handling is
  untouched, in case something else still links to the list that way).
- **Open TODOs read every meeting's file, not the search index.** `usePersonProfile` calls `window.api.meetings.read`
  for every meeting (one `read` each; fine for the handful of files this app expects) and runs the existing
  `parseTodos`/`ownedBy` over the real body, rather than trusting the index's plain-text excerpt. The excerpt is
  built for search, not structure: it cannot tell a ticked "Previous TODO" checkbox from an unticked one, so
  trusting it here could have shown a finished TODO as still open.
- **Links (`PersonLinks.tsx`)**: `Person` gained `links?: PersonLink[]` (see `src/shared/people.ts`); a fixed set of
  common presets (Google Scholar, GitHub, Website, LinkedIn) fill the label, or the person types their own. Only
  http(s) is ever saved (`isSafeLinkUrl`, the same rule `main/urls.ts` enforces before opening a link). These open
  with a plain click, not the editor's Cmd-click convention, since they sit on an ordinary page rather than inside
  editable text. The edit UI lives on the person's own page, not the table row, which is already tight, per the
  brief's own note on this idea.
- **A real bug, found only by driving the "Add link" flow in the built app.** It reported success and showed
  nothing wrong, but nothing was ever saved: `MEETINGS_IPC.peopleUpdate`'s handler (`main/register.ts`) rebuilds
  the patch it hands to `updatePerson` field by field (`name`, `initials`, `me`) and had never heard of `links`,
  so it silently dropped them before they reached the part of the code that actually validates and saves a patch.
  This is exactly the failure mode CLAUDE.md's "keep IPC handlers thin" rule exists to avoid, and this handler
  wasn't thin: it re-implemented a piece of the patch shape instead of forwarding it. Fixed by validating and
  passing `links` through the same way; `usePersonProfile` also gained a `refresh()` the page now calls after a
  save, since nothing had been re-reading the profile after one either (a second, smaller staleness bug the same
  test run surfaced once the save itself worked).
- Checked in the built app and dev mode (StrictMode) on a scratch library: a person's meetings, trainings, last-met
  and next-meeting dates, and an open TODO (added at a fresh line in a meeting's body, with the owner attending)
  all appearing on their page; adding and removing a link, including that an unsafe URL (`javascript:`, `file:`)
  cannot be added at all; the link surviving a full reload from disk; and global search opening the person's page
  directly with the link showing.

## Work meetings import (built, wired up and applied — see the follow-up note at the end)

Read all 19 files by hand before writing anything, as every other importer in this app has: two sub-folders
(`Impact`, `Teaching & Learning`), and far more variation than the one sample file the request was scoped
around. Findings and decisions:

- **The format varies file to file far more than Research's.** Only one of the 19 files uses the `**TODO(XX)**:`
  initials convention Research does; most instead write `**TODO (Full Name)**:` (a space before the parenthesis,
  a person's name instead of initials) or use no TODO marker at all, writing free-form `**Decision**:` / `**Next
step**:` bullets, or even plain `Decision: …` with no bold. Section headings vary too: `## Action items` (the
  sample), `## Agenda` (Notes only, no action items), and a single-line `## Topic` with no Agenda or Action items
  section at all. None of this needed new machinery: `parseObsidianMeeting` (built for Research's own
  `**Date**:`/`**Attendees**:` header, in `meeting-import.ts`) already reads this shape as-is, and the app's
  Markdown editor and `parseTopics`/`parseTodos` are structure-agnostic enough that every one of these shapes
  converts and displays sensibly without a special case per format — checked by hand against the samples above,
  not assumed.
- **A new pure module, not a variant of the Research one**: `work-meeting-import.ts` (`planWorkMeetingImport`),
  reusing `parseObsidianMeeting`, `transformBody`, `parseTodos` and `meetingBaseName` from the Research importer
  rather than copying them, but with its own, much shorter planning loop: no Word log or Word notes to merge in
  (there are none for Work), so start, end and a summary are always left empty; the series is the vault's own
  sub-folder name, not a tag or a name pattern (`Impact`, `Teaching & Learning`) — neither is in the fixed
  `SERIES` union (`Supervision`, `Rastle Lab`, `Luminos`, `Other`), so both will show as flagged front matter
  until that union is extended or made to depend on the workspace, a decision left for the user, not guessed.
- **The `TOOD(EO)` typo (in exactly one of the 19 files, checked with a plain grep) is fixed, not left**, since an
  unfixed one would never be recognised as a TODO by the app at all (`parseTodos` looks for `TODO`), silently
  losing an actionable item — worse than a one-character spelling fix that changes no meaning. Every fix is
  reported by file, matching "report them either way".
- **The safety check is the same shape every importer in this app uses**: every `TODO` marker and every ticked
  checkbox in the source must still be in the converted body, word for word (counted independently of the
  parser, `markerCount`), or the note is left out and reported rather than written with something missing. A
  mutation check (an injected transform that deletes every line containing "TODO") confirms this actually stops
  a bad conversion, not just that the check exists.
- **The dry run (`npm run import:work-meetings -- --vault "/Users/ernesta/Consulting/Luminos/Scribbles/Luminos/Meetings"`),
  against the real vault, found:**
  - **18 of 19 notes would import cleanly.**
  - **One pair needs the user's decision, not a guess**: two distinct meetings on 2025-11-04, both "Impact"
    (`2025 11 04 Luminos (Biruke, William).md` and `2025 11 04 Luminos (Brian, Edward).md`), with different
    attendees. The importer's own de-duplication (same date + series already seen) is exactly what stops it from
    silently guessing which one to keep or merging them; it needs a name for whichever file namer would tell
    them apart, since `meetingBaseName` alone would only produce `2025-11-04 Impact` for the first and has no
    principled way to disambiguate the second beyond a bare "2" suffix, which would be no wiser than the
    computer's.
  - **One name is spelled two ways across two files**: "Chris Cumminskey" (in the 19 Feb 2026 meeting) and
    "Chris Cummiskey" (in the 12 Mar 2026 meeting) are almost certainly the same person; the importer does not
    guess this either, the same way the people-adding step of every importer in this app leaves spelling
    decisions to the user.
  - **9 distinct attendee names** across the 18 importable meetings, none of them yet in the people list (Work
    has no people of its own yet, since nothing has been imported for it before).
- **Work's own workspace wiring was not built.** The ROADMAP note that named it as a prerequisite ("Work needs a
  folder, a route and a landing page from the same components") describes what `--apply` will need somewhere to
  put these files and a page to show them on; it turned out to be a materially bigger piece of work than the
  importer itself, because the Meetings renderer is not actually workspace-parameterised today — `workspace:
'research'` is hard-coded through `MeetingPage`, `PersonPage`, the session hooks and `meetings-paths.ts`'s own
  `meetingsBase`, not read from the route. Building that properly (threading a real workspace through every one
  of those, not just adding `'work'` to `ACTIVE_WORKSPACES`) is its own piece of work, separate from "write an
  importer", and risks breaking Research's own Meetings if rushed. Left undone on purpose, flagged here rather
  than silently skipped, and needed before `--apply` — which was not run, on the user's explicit instruction —
  can have anywhere real to write to.
- Checked: the pure `planWorkMeetingImport` module has its own test suite (`work-meeting-import.test.ts`,
  including the mutation check above); typecheck, lint and the full test suite all pass; the dry run above was
  run against the real vault, reading it only, with `CENTRAL_COMMAND_HOME` pointed at a scratch folder so even
  the "already imported" check touched nothing real.

**Follow-up: Work's own workspace wiring, and the import applied.** The user asked for full parity with
Research's Meetings, not a slimmed-down view. `ACTIVE_WORKSPACES` in `register.ts` now includes `'work'`
(purely additive: an extra folder created and watched; the store classes were already workspace-generic).
The renderer's `meetings` module is now built by `createMeetingsModule(workspace)`
(`src/modules/meetings/index.ts`) and registered once per workspace in `src/modules/index.ts`; every
hardcoded `'research'` in its pages, hooks and paths (`meetings-paths.ts`, `MeetingPage`, `MeetingsLanding`,
`MeetingsPage`, `MeetingsCard`, `NewMeetingButton`, `useMeetingsList`, `useMeetingsView`, `search.ts`,
`MeetingsTable`, `OpenTodos`) now reads the workspace from the URL (`useMeetingsWorkspace`, reading the
route the same way `Shell.tsx` already did) or from the row it is showing. Work gets `/work`, a real landing
page (`WorkLanding.tsx`; both it and `ResearchLanding.tsx` are now thin wrappers around a shared
`WorkspaceLanding.tsx`, since the shape was identical). The PDF export (`report.ts`) took a `seriesFilter`:
Research's stays the Supervision log; Work's, having no such series, exports every meeting in the year as a
"Meetings log" instead. A new meeting's default series is `SERIES[0]` ("Supervision") for Research, "Other"
for Work, since Research's fixed series aren't Work's.

**People are shared, not duplicated.** `PeoplePage`/`PersonPage` are registered only once, under Research
(`peopleRoute`/`personRoute` in `meetings-paths.ts` always point there, so a Work meeting's attendee still
links to the one shared page). `usePersonProfile` now reads every `MEETING_WORKSPACES` entry and merges the
rows (each `MeetingIndexRow` already carried its own `workspace`, so nothing needed to change there beyond
querying twice and concatenating), so a person met in both workspaces shows both on their page, correctly
routed back to whichever workspace each meeting belongs to. Verified in the built app, not just unit tests:
a scratch library with a meeting created from each workspace's own "New meeting" button, a shared attendee
added by hand, and the person's page confirmed to show both, oldest/newest ordering correct, and the link
from the page back into the Work meeting landing on `/work/meetings/m/…` with the Work pill active — Research's
own Meetings, People and person pages were re-driven the same way and are unchanged.

## Editor feedback round (29 Sep 2026)

- **Save status lives in the card's facts line** ("Saved · Created … · Edited … · N words"), not above the editor. `EditorCard` takes
  `save`, `reloaded` and `hasContent`; the wording is `saveStatusText` (`notes/save-status.ts`), which replaced six copies of `statusText`.
  A failed save turns the word red. **Created** is still only shown for Notes: it is recorded in their front matter, and a file's own
  creation time is lost by the write-then-rename save. Meetings and Training show their own date in their fields. Adding a `created` key
  to the other kinds of file is the way to get it everywhere, if wanted.
- **Training plan** now has the same arrangement as a note (text, outline on the right, via the shared `NoteOutline`; `planOutline` was
  removed) and its folder button is the same icon button and "Show in Finder" label as the Files panel of a training entry.
- **Links** (`notes-links.ts`): typing `[text](address)` makes a link; pasting a web address over selected text links it (Slack-style;
  a plain paste never does, because it arrives as a made-up event and `handlePaste` ignores untrusted ones). While Cmd/Ctrl is held the
  pointer over a link becomes a hand (`data-open-links` on the editor).
- **Paste without formatting (Cmd-Shift-V)** never worked because Electron's default Edit menu owns that chord ("Paste and Match Style") and
  the page then gets an ordinary paste with the HTML still on the clipboard. The main process now catches the chord in `before-input-event`
  (`paste-plain.ts`) and sends the clipboard's text to the renderer (`app.onPastePlain`), which pastes it as plain text into the focused
  editor or text field (`usePastePlain`). Checked by sending the IPC message in the built app; the physical key chord itself cannot be
  driven by Playwright (menu accelerators are not synthetic key events), so try it by hand.
- **Uneven bullet spacing**: a list nested in an item kept the top-level list's bottom margin, so the gap after an item depended on
  whether it had children. Nested lists now have no margin, and a second paragraph in an item has a small one.
- **Addresses are always links.** A typed `https://…` or `www.…` becomes a link at the space after it (trailing punctuation stays outside;
  not in inline code); a pasted address with nothing selected is inserted as a link. Addresses already in a file load as links (the editor
  writes them back as `<https://…>`, as before). Enter straight after a typed address does not convert it; the next space or a paste does.

## Notes for Work (29 Sep 2026)

- **Same pattern as Meetings.** `createNotesModule(workspace)` (`src/modules/notes/index.ts`) is registered once per workspace; every route
  helper in `notes-paths.ts` takes a workspace and the pages read it from the URL (`useNotesWorkspace`), or from the row they show. Work's
  notes are files in `notes/notes/work/`, indexed in the same table (the `workspace` column and the main-process code already handled it;
  only the folder creation and watching had to be switched on). `NotePage` is keyed by workspace and id, so the same file name in the other
  workspace can never reuse a session.
- **Quick capture and its shortcut listing belong to the app,** so only the Research instance carries them (two copies would make two notes per
  key press). Cmd-Shift-N makes the note in the workspace being looked at (Research away from Work). The command palette's and Dock menu's
  "New note" still start in Research: they have no page to ask (changed the same day: see below).
- **Search:** Work's results are headed "Work notes" (and "Work meetings"); the same heading twice would also have shared a React key. `in:notes`
  searches both workspaces. Groups are per workspace (each list derives its own).
- **Checked** in the built app and dev mode on a scratch library: a note from the Work landing, Cmd-Shift-N in Work, both in `notes/notes/work/`
  and none in Research, search, the back link. Not done: Training and Reading lists for Work (still Research-only), and no importer for Work notes.
- **Quick actions follow the workspace (same day, at the user's request).** The command palette's and Dock menu's "New note" and "New meeting"
  start in the workspace of the page (`quickActionWorkspace`); on a page outside any workspace (search results, Settings) they use the
  workspace last visited, and Life counts as Research. "New training entry" is always Research (Training is Research-only). A Work meeting
  starts with the series Other (`defaultSeries`, shared with the New meeting button).
- **Work notes imported** (`npm run import:notes -- --vault … --workspace work`, applied 29 Sep 2026 to the real library, 6 notes, all
  ungrouped, as for Research): the loose `Document Automation Notes` and the four notes in `Admin & Compliance` plus `Luminos/Taxpayer
Reference`. The Meetings folder is left to `import:work-meetings`. **The Admin & Compliance notes hold account, tax and insurance numbers,
  and every note's text is searchable**, so they can show in search results; delete or keep them as you like. Same safety checks as the
  Research import; a second run imports nothing.

## Moving a note or meeting to the other workspace (29 Sep 2026, at the user's request)

- **A Workspace menu on the note and meeting pages** (`WorkspaceSelect`, in the header beside Group/Pin and Delete). Choosing the other one
  moves the item there and the page follows it (the address, and the top bar's workspace, change). There is no pop-up and no choice at
  creation: the default (the workspace being looked at) is simply fixable afterwards. A move is easy to undo by choosing the first one again.
- **Safe by construction** (`main/notes/move-file.ts`, `moveNoteFile`, shared by both stores): the copy is created first, exclusively (an
  existing file is never replaced; a taken name gets ` 2`), and only then is the original sent to the Trash. If the Trash move fails the copy is
  removed again and the original is untouched, so a failure never leaves two copies. Mutation checks: without the clean-up or the exclusive
  create, a test fails. The page saves what is pending before asking (`session.dispose()`), and the whole file as it is on disk is copied.
- **What changes.** A note keeps its group and subgroup (groups are derived per workspace, so the group simply appears in the new one), and
  arrives **unpinned** if the other workspace already has four pinned. A meeting keeps its series and date; series are not per workspace.
  The name is worked out again for the new folder.
- **A latent bug found on the way:** `MeetingPage` was keyed by the meeting id alone, so the same file name in the other workspace could
  reuse the old session; it is now keyed by workspace and id, as `NotePage` already was.
- **"Created" is no longer shown (the user's call, 29 Sep 2026).** With notes able to move between workspaces a creation date would mislead
  more than inform. The facts line is now "Saved · Edited … · N words" on every editor. Notes still record a `created` key in their front
  matter (written on creation and by the importers, kept by moves); nothing displays it, and it can be dropped from the files later if wanted.
  "Edited" is the file's modified time, so a move now gives the copy the original's modified time (`utimes`): moving is not an edit.
- **`created` is gone entirely (the user's follow-up, same day).** It is no longer written (new notes, the importers), read, indexed
  (migration `notes/0002_drop_created` drops the column) or shown, and a new note with nothing to record starts with no front matter
  block. `npm run strip:created` removed the line from the existing notes (18 notes in Research and Work, applied to the real
  library on 29 Sep 2026, originals in `~/CentralCommand/backups/strip-created-<time>/`); a note that still carries a `created:` line by
  hand is left alone, like any other unknown key.
- **A bug found by driving the move twice:** a page remembers the names an item has had (`known` in `NotePage`/`MeetingPage`) so a rename does
  not remount it. That memory survived a move, so moving back used the item's original name and reported "Note not found". Each workspace
  now gets a fresh page (`key={workspace}`), and the round trip (rename, move, move back) is checked in the built app for a note and a meeting.

## Entities: mentions with `@` (at the user's request, 29 Sep 2026)

A note can mention a **person, reading, meeting or note** (tasks later): type `@` and a few letters, pick one, and it is written as a
chip with the icon of its kind. The mechanism is the same everywhere an editor is used (notes, meetings, training entries, plans, reading
lists, readings' notes), since they all share the one editor (`NotesEditor` when this was written, `LiveEditor` now).

- **The file format is an ordinary Markdown link with the app's own scheme:** `[Kathy Rastle](cc://person/Kathy%20Rastle)`. It is valid
  everywhere, survived Milkdown's serialiser (the reading lists' `[[citekey]]` lesson; the live editor never re-serialises), and reads fine in any other tool or to Claude Code.
  `@shared/entities` holds the format (`entityHref`, `parseEntityHref`, `findMentions`, `renamePersonMentions`), tested.
- **What the address names, per kind.** `reading`: the citekey (stable while the reading is in Zotero; a reading gone from the export is
  still found and marked). `person`: the name (a rename or merge **rewrites the mentions** in every note folder, with the same backup and
  hash guard as the other people rewrites; a label that was the old name follows, a label the writer chose stays). `meeting`, `note`: a
  **`uid` in the item's front matter, added the first time something links to it** (never to items nothing links to), so a link survives
  renames (file names follow titles and dates) and moves between workspaces (the file is copied byte for byte). `ensureUid` writes it
  under the usual hash guard; the index has a `uid` column (migrations `notes/0003_uid`, `meetings/0004_uid`) filled from the files at start.
  A note is never offered a link to itself (writing its uid would clash with its own open editor).
- **A registry, not a list in the editor.** A module gives the shell `entities: EntityProvider[]` in its manifest (`search` for the picker,
  `resolve` for what a mention points at now, an icon, a heading); `main.tsx` registers them all. The editor knows nothing about readings or
  meetings. A new kind is a new provider plus one entry in `ENTITY_KINDS`. Only the Research instance of Meetings and Notes carries its
  providers, and they cover both workspaces. The picker lists kinds in the order of `ENTITY_KINDS`: people, readings, meetings, notes.
- **In the editor** (`src/renderer/src/entities/`): `EntityPickerController` is a plain object (as `useNotesFind` is) that the editor's extension (`editor/live-entities.ts`; two Milkdown plugins when this was written) talks to and React reads. `@` opens the picker only at the start of a word (so `a@b.org` and `meet @ noon` are left alone), not in
  code or inside a link, and not for a long or two-space query; Escape closes it until that `@` is gone. Enter or Tab links, arrows
  move, a click picks without taking the cursor out of the text. A mention is no longer followed by a space (2 Oct 2026; the
  punctuation rule that took it back is gone). The list is anchored at the `@` and opens on the side with room, fixed for the whole query; only a real pointer move selects a row. Mentions are drawn by decorations: a chip, its icon a CSS mask (the same Lucide icons, made into CSS variables by
  `entityIconVars`), struck through in red when what they point at is gone. Hovering shows a card (kind, current name, one line) and
  Cmd-click opens it inside the app. (Milkdown needed its link schema extended, `entityLinkSchema`, because it wrote an empty `href` for any scheme but http, https, mailto, tel and ftp; the live editor has no such schema. Chips are now widgets over the link text, see stage 4 below.)
- **Where a thing is mentioned** (`MentionedIn`, on a person's page, a reading's page and the side column of a note and a meeting): the main
  process reads the note folders on request (`findBacklinks`, IPC `entities:backlinks`). No index: a few hundred small files are quick to read
  and the answer can never be out of date. Each place is listed once with the line the mention is on.
- **Checked in the built app on a scratch library:** all four kinds picked with the keyboard and the mouse (the `uid` appears in the linked
  note's and meeting's front matter), chips with icons, the hover card, Cmd-click to a note and to a person, the panel on a note, a meeting and
  a person, a rename through the people API (the mention in another note rewritten, backup made), and a deleted note's chip.
- **Not done, on purpose:** mentions in the command palette's search results (search already finds the notes themselves); tasks (they do not
  exist yet); a "convert this plain name into a mention" action; renaming a note or meeting does not change the label of existing mentions
  of it (a label is the writer's text; the hover card and opening always show what it is called now).

- **Picker fixes (2 Oct 2026).** Two bugs found by the user. (1) A note called AMPL could not be picked: the picker offers five hits per kind, the
  notes' search also reads excerpts, and "ampl" is inside "sample", so recent notes about sampling filled the five places. `nameFirst`
  (`src/shared/search.ts`) now puts hits whose name has every word first, names that start with the first word before the others; used by the
  notes and readings providers. (2) A freshly linked note or meeting showed red, "no longer available": `ensureUid` writes the `uid`, but `resolve` read
  the provider's 2-second cached list, which predated it, and the resolver keeps a `missing` answer for the life of the editor. `resolve` now
  re-reads the list once before answering null. The unlinked AMPL and Reading First Impact Study lines in Data Sources Summary were linked by hand.

## People and Person page feedback (30 Sep 2026)

- **Initials**: a hyphenated last name gives a letter per part (Roger Giner-Sorolla, RGS). When the usual initials are taken,
  `suggestInitials` tries the capitals inside the last name (Ryan McKay, RMK), then the middle names, then more letters of the
  last name (RMI), and only then a number.
- **Refusals sit beside the field** (taken initials under the initials input, a blank or duplicate name under the name), not in the
  page banner; the banner is left for partial results. "Set as me" moved to the row's actions at the right.
- **Person page**: open TODOs removed (and the read of every meeting behind them); an empty Trainings section is left out; links are
  one line of pills with an icon, no presets. `RecentList` (shared) now keeps the title on one line and ellipsises the note,
  left-aligned.
- **Training entry**: the type's help is shown in the open list, under each type's name (`DescribedSelect`, a listbox, since a
  native `<select>` cannot show a second line; chosen from mockup `docs/design/training-type-help-mockup.html`). Closed, it has a fixed
  minimum width, so nothing moves. At wide widths Files is the rightmost column.
- Checked in the built app: the list opens with descriptions, arrow keys and Enter choose, and the button does not move.

## Live markup in the notes editor, stage 1: Backspace no longer jumps (30 Sep 2026)

> **Historical (30 Sep 2026).** This stage changed the Milkdown editor (`notes-block-keymap.ts`), which was deleted in stage 8; the plain-text behaviour that replaced it is in `editor/live-lists.ts`.

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. `notes-block-keymap.ts`, registered first:

- **Backspace right after an input rule undoes it** (`undoInputRule`). `###`, space, Backspace now leaves a paragraph reading `### ` on
  the same line (what was typed, including the space) instead of merging an empty heading into the line above.
- **Backspace at the start of a quote's first block takes it out of the quote** (`lift`), never merging upwards; a later block of the quote
  still joins upwards.
- **Heading Backspace needed no new code:** Milkdown's own `DowngradeHeading` already lowers a heading one level (level 1 becomes a
  paragraph). The plan expected to write it; a mutation check showed the copy was redundant, so it was removed. The tests pin the behaviour.
- Mutation checks: without `undoInputRule`, or without the quote command, two tests fail. Driven in the built app and dev mode on a scratch
  library with real keystrokes, including quitting right after typing (the last words were saved).

## Training: the year selector and what it covers (30 Sep 2026)

Reported as "last year's training list shows this year's training". Two separate causes, the second being the one seen:

- **Landing "Recent and upcoming" ignored the academic year.** `recentAndUpcoming` was fed every entry, so 2025–26 showed the newest
  entries of any year. It now gets `entriesInYearOrPlanned(all, year, today)`. The hours strip and series cards already respected the year.
- **Undated (planned) entries showed in every year.** `entriesInYearOrPlanned` now takes `today` and includes them only in the current
  academic year (tested in `rules.test.ts`). This was found first and was not what the user saw; it is still a real leak.
- Not yet checked in the running app for the landing change, and it has no unit test (the fix is in the page, not a pure function).
  The user confirmed it fixed what they saw.
- **Meetings fixed the same way** (same day, at the user's request): `meetingsInYearOrPlanned` takes `today`, and `MeetingsLanding` feeds
  `recentAndUpcoming` the selected year's meetings. Open TODOs on the Meetings landing still span all years (they are not a year view).

## Live markup in the notes editor, stage 2: LiveEditor on CodeMirror 6, behind a hidden switch (30 Sep 2026)

> **Historical (30 Sep 2026).** Stages 2 to 7 were written as they were built, when `LiveEditor` was behind a hidden switch and Milkdown was unchanged. Neither is true now (stage 8 removed both); read "Notes editor: CodeMirror 6, with the Markdown text as the document" for the state of the app.

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. New folder `src/renderer/src/editor/`; nothing changes for the user until they set the switch
(`localStorage` key `central-command.liveEditor` = `1`, then reload; no Settings entry). `NotesEditor` delegates to `LiveEditor` when it is on, so
all five kinds of editor switch together.

- **The document is the file's text.** `live-state.ts` builds the CodeMirror state with the Markdown language (GFM), history, `drawSelection`,
  line wrapping and the default keymap (minus `Mod-i`, kept for italic later). `lang-markdown`'s own keymap is on, so Enter continues
  lists and quotes for now (see the questions below). Change reporting is `EditorView.updateListener`, synchronous, full text, only when the
  document changed; opening reports nothing.
- **Line breaks are kept.** Found by a test, not by reading: `Text.toString()` always joins with `\n`, so a file with `\r\n` would have been
  rewritten on the first edit. The state now uses the file's own separator (`\r\n` if it has one, else `\n`, so a lone `\r` stays a
  character) and reports with `state.sliceDoc()`. The real library has no CRLF file; this protects imports and other tools.
- **Reveal rules** (`live-reveal.ts`, pure and unit-tested): nothing shows while the editor is not focused (else a note opens with its first
  `#` showing); a span's markers (`**`, `*`, `~~`, `` ` ``, link brackets and address) show while any selection range touches it, cursor at either
  edge included; a block's markers (`### `, `> `, `---`) show while the cursor is in the block's lines; a selection that starts and ends in different
  blocks shows nothing anywhere (a selection ending at the start of a line, as a triple-click does, counts as ending in the line before).
  Consequence, tested for every cursor position: a hidden range never has the cursor inside it, because touching it reveals it. So no atomic
  ranges are needed for markers.
- **Decorations** (`live-decorations.ts`, one `ViewPlugin` over the visible ranges): classes for headings 1–6 (ATX and setext), emphasis, strong,
  strike, inline code, links (label, and the address as marker-coloured text while revealed), addresses written out in the text, quotes (one
  rule, indent per level), rules, tables and code blocks as monospace text, list marks quiet. Markers are hidden with `Decoration.replace`,
  shown with the `live-marker` class (new token `--marker`, both values). A link with an empty label, reference links and images are not hidden.
  Setext underlines and a heading's closing `##` are ordinary markers (a first version kept them always visible, which broke "nothing shows
  across blocks"; the whole-file library check found it).
- **Cmd-click** opens the link under the pointer (web address in the browser, `cc://` inside the app), using the syntax tree
  (`live-links.ts`). Pasting stays plain text because CodeMirror's paste only reads `text/plain`.
- **Identity gate** (`live-library.test.ts`, opt-in: `LIVE_EDITOR_LIBRARY=<copy of the notes folder> npx vitest run src/renderer/src/editor/live-library`):
  for all 406 Markdown files, body and whole file: same text on load; an edit at the start, middle and end leaves the rest byte-identical; at a
  spread of cursor positions no hidden range contains the cursor and hidden ranges stay on one line; select-all across blocks shows no marker.
  Mutation check: making the state trim trailing spaces on load fails it at once.
- **Driven in the built app and in dev mode** (scratch library, `--user-data-dir` so the switch never touched the real profile): typed a mixed
  note with real keystrokes; the reveal followed the cursor for bold, links and headings; select-all hid the markers; hand-typed `### x`, Backspace
  on the space and Cmd-Z behaved as text; three real notes were opened, clicked into and left, and no file changed (hashes compared);
  quitting immediately after typing saved the last words, in the built app and (dev, disconnect right after typing) too. No console errors.

### Findings and questions for the user

- **What it feels like** is for the user to judge from the screenshots (session scratchpad `shots/`): headings, bold, italic and links reveal and
  hide as designed. A `#` revealed in a 28 px heading is small and mono, which reads a little cramped; easy to change (size or weight of the marker).
- **Not in the spike, so Cmd-B, Cmd-I, Cmd-F, `@`, Tab in lists and the Meetings TODO helper do nothing yet.** No stage in the plan owns the inline and block
  shortcut keys (`live-keymap.ts`, "Shortcuts" section). Proposal: add them to the start of stage 3 with the list keys.
- **Enter continuation is the library's** (`insertNewlineContinueMarkup`): on an empty line inside a nested quote (`> > >`) it removes only one
  level's worth, so leaving a nested quote by Enter-Enter takes several presses. Stage 3 replaces these rules with the designed ones.
- Escapes such as `\*` show their backslash (a real character); hiding it was not in the design. Blank lines are drawn shorter than a line of text
  (0.9 line-height) so paragraphs are spaced like today; a heading has half a line of space above it. Both are tuning for stage 7.
- Mixed `* ` and `- ` lists, hand spacing and so on stay untouched, as designed (18 of the 406 files use `* `).

### Answers (30 Sep 2026)

The user answered the three questions: (1) the inline and block shortcut keys (`live-keymap.ts`) move to the start of stage 3, with the list keys;
(2) the library's Enter rules stay until stage 3 replaces them; (3) marker size in headings, escape backslashes and blank-line/heading spacing are
stage 7 tuning.

## Live markup in the notes editor, stage 3: keys, lists, tasks and paste (30 Sep 2026)

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. Still behind the hidden switch. Every key is an edit of the Markdown text; nothing is rebuilt from a tree.

- **Formatting keys** (`live-format.ts`, bound in `live-keymap.ts`). Inline (`Mod-b`, `Mod-i`, `Mod-Alt-x`, `Mod-e`): a selection is wrapped, with its edge white space kept
  outside the markers; already marked (found in the syntax tree, so `_x_`, `__x__` count) means the pair comes off; a cursor in a word marks the word and keeps the
  cursor where it was; an empty spot gets a pair with the cursor between, and an empty pair goes again. Pairs of the same kind already inside the selection are removed
  first (else `**a **b** c**`). Block keys set the prefix of every selected line: headings 1 to 6 **set or change** the level (Mod-Alt-0 takes it off; they do not
  toggle), quote, bullets and numbers **toggle** (quote takes off one `>` level at a time), numbers count 1., 2., 3. down the selected lines, code block wraps in a fence or,
  inside one, takes the fence lines away. Known limit: with the selection inside a longer bold span, Cmd-B takes the whole span's markers off, it does not split the span.
- **Lists drawn as units** (`live-widgets.ts`, in `live-decorations.ts`): the indentation, marker and following space of an item (`2. `, `- [x] `, with any nesting in front) is one atomic
  replace widget (bullet, number, checkbox); it is drawn only once the space after the marker exists, so a `-` still being typed stays a dash. Arrow keys and clicks skip it.
  A click on the checkbox writes `[x]`/`[ ]` (one character, one undo step). Ticked items get a muted, struck-through text. Wrapped lines hang under the text.
- **Enter, Shift-Enter, Tab, Backspace, Delete** (`live-lists.ts`, `live-lines.ts` parses a line into quote, indent, marker, text). `lang-markdown`'s own keymap
  (`addKeymap`) and link-on-paste (`pasteURLAsLink`) are off. Enter continues bullets, numbers (renumbering the items below **only when they counted up by one** before, so a
  hand-numbered `1. 1. 1.` is left alone), unticked checkboxes and quotes; on an empty item it ends the list (a nested one moves out a level first); on an empty quoted line it
  **leaves the quote entirely**, however deep (the library's rule took one level per press); nothing continues inside code. Shift-Enter writes `\` and a new line indented under the item's text (a plain new line
  in a heading or code). Tab, Mod-] nest an item under the one before it (its children and continuation lines move too); Shift-Tab, Mod-[ move it out a level; on the first
  item or a top-level item they do nothing but keep the key. Outside lists Tab is not ours (focus moves on); Mod-] and Mod-[ fall back to CodeMirror's plain indent. Backspace at the
  start of an item's text: nested means out a level, top level means the whole bullet, number or checkbox goes as one step, with a blank line put before it when it would otherwise
  run into the paragraph above. Backspace just before the drawn marker, and Delete at the end of the line above, join the item's text onto that line without its marker.
  Quotes have no Backspace rule (their `>` is text).
- **Home and Cmd-Left** (`live-motion.ts`) go to the first non-space character, which for an indented item is inside the marker; the cursor is moved to the start of the text.
  Found by driving the app: Backspace from there deleted the indentation instead of running the list rule.
- **Paste** (`live-paste.ts`): the clipboard's plain text only, always (web pages and Word leave their formatting behind; a clipboard with no text pastes nothing); line ends become the note's own;
  a web address, `www.` address or `mailto:` pasted over a one-line selection makes `[selection](address)` (unbalanced brackets in the selection are escaped). Cmd-Shift-V arrives as
  a made-up event through the existing IPC (`shell/usePastePlain.ts`) and never links.
- **Windows line ends**: a line break is one position in the document but two characters in an inserted string, and a bare `\n` inserted into a CRLF note stays a bare `\n`.
  A test with a CRLF note found the cursor going out of range after a paste; every command now inserts the note's own break and counts positions with `state.toText`.
- **Shortcut list**: `notes-shortcuts.test.ts` has a second check against the live editor's keymap (a chord listed but not bound fails; find, `@` and Enter-with-Mod belong to later stages and
  are listed as such). One press-the-key test per chord in `live-keymap.test.ts` and `live-lists.test.ts` (keys are pressed through `runScopeHandlers`, the way a keydown reaches the keymaps).
- **Mutation checks**: 18 mutations of the Backspace, Delete, Enter, Shift-Enter and Tab rules (`live-lists.ts`) and 5 of paste were each killed by a test; one survived at first
  (Enter inside code, because the tree check also stopped list continuation there) and got a test with a `> ` line in a fence. The real-library gate was checked the same way (Backspace eating one extra character fails it).
- **Real-library gate** (`live-library.test.ts`, on a copy of `~/CentralCommand/notes` and `backups`, 406 files) now also presses every formatting and list key at 25 places per note
  (as a cursor and over the word there): the content, once markers, white space and digits are set aside, never changes; one undo gives the note back byte for byte; text before the cursor's line is
  untouched; every drawn unit covers exactly the marker; a checkbox click changes one character; pasting an address over a word changes nothing else. It caught nothing in the code, and three
  mistakes in its own first version (Enter over a selection replaces it; `2|016.` split across lines is a number to a parser; `_x_` is a marker).
- **Found only by driving the built app** (scratch library, `--user-data-dir`): (1) the list CSS lost to the editor's own `.cm-line { padding: 0 }` (same specificity trap), so bullets hung outside the
  text and nesting had no indent; (2) the checkbox widget had no height, so it could not be clicked; (3) `lang-markdown`'s own paste handler ran before ours and linked on the made-up Cmd-Shift-V paste
  (a jsdom test of the event, now added, fails without the fix); (4) Home landed inside a marker (above). Playwright's keys skip Electron's `before-input-event`, so the Cmd-Shift-V check
  sends the same IPC message from the main process. Option keys were sent as a Mac sends them (`≈`, `¡`, `ç`… with the plain key code) and all bound correctly.
- **Not done, on purpose**: the `#`/`##` of a heading being revealed with the cursor at the line start draws over the caret (stage 7 tuning); the outline does not read the live editor yet (stage 5);
  Tab in a table row is plain Tab (stage 6); splitting a bold span with Cmd-B.
- **Marker colour**: the user found stage 2's gold `--marker` ugly; it is now a slate, `light-dark(#7a8592, #8794a1)`, checked in light and dark. One token, easy to retune.
- **Pitfalls worth remembering** (also in `CLAUDE.md`): after `prettier --write`, a scripted `str.replace` on the same file can silently miss (it did, twice, and the list keys were not bound
  until a test noticed); CodeMirror's `keymap` `preventDefault: true` makes an unhandled key look handled; `markdown()` brings its own Enter/Backspace keymap and paste handler.

## Live markup in the notes editor, stage 4: entities (30 Sep 2026)

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. Still behind the hidden switch. The file format is unchanged: a mention is `[label](cc://kind/key)`.

- **Chips** (`live-entities.ts`, drawn from `live-decorations.ts`): a `Link` node that is a plain `[label](cc://…)` (non-empty label, an address of ours, no title, all on one line) is one atomic replace
  widget with the icon of its kind, whatever the cursor does (never revealed; to change one, delete it and pick again). A link that does not fit (empty label, title, unknown kind, two lines: a replaced range may not
  cross a line break) stays ordinary link text. Inside a chip nothing else is decorated. Struck through and red when the target is gone (`host.resolve`); when a lookup arrives the controller dispatches an
  effect-only transaction (`refreshMentions`), which redraws and touches neither text nor history. The label is shown without its `\[`/`\]` escapes.
- **Whole-chip Backspace/Delete** is two layers on purpose: an explicit command (`deleteChip`, bound before the list rules) and the atomic range, which the default Backspace also honours. Each is tested alone
  (the command in a bare view with no default keymap and no atomic ranges; the atomic layer by arrow keys). Mutation checks (15, run by hand): every mutation of the command's range, direction, selection rule,
  binding, or the chip test was killed; removing the atomic set was killed; two survivors were an equivalent mutant (setting the cursor after the delete, which the change mapping already does; removed) and a
  missing test for a cursor inside a chip (added, then killed). Finding: unbinding the command alone is masked by the atomic layer in a full editor, hence the bare-view test.
- **`@` picker**: `EntityPickerController` now talks to an editor through `MentionTarget` (`entities/mention-target.ts`: `coordsAt`, `refresh`, `current`, `insert`); Milkdown's adapter is `proseTarget`, the live one
  `liveTarget`, so both editors work until stage 8. The trigger rule is the shared pure `suggestionIn`. Not offered in code, links, images, or with a selection, and only while the editor has focus. The cursor's
  screen position is read in `requestMeasure` (reading layout inside an update is forbidden); the picker's own arrows/Enter/Tab/Escape come first (`Prec.highest` keydown handler). The controller learns of the editor
  synchronously on creation, or a lookup finishing before the first frame would never redraw the chips.
- **Punctuation** typed straight after a chip and its space takes the space back (`inputHandler`). **Cmd-click** is handled by the chip itself (a click between two chips could otherwise open the wrong one);
  a plain click puts the cursor beside it. **Hover card** reuses `EntityHoverCard` through the new `useEntityHover(selector)`; `NotesEditor`'s own copy stays until stage 8.
- **Real-library gate** (`live-library.test.ts`, fresh copy of notes and backups, 406 files): the library has no mentions yet, so one is written into every note at 25 places (word starts): it must be one chip over
  exactly those characters or, in code or a link, plain text; no two units overlap or cross a line; Backspace takes exactly it and one undo gives the note back; an `@ka` typed there is offered only when the
  suggestion text is exactly `@ka`, and choosing writes exactly the mention and a space. Any mention found by the plain-text scan (`findMentions`) must be a chip. Mutation: Backspace leaving a bracket fails it.
  A first version failed on ordering only: `RangeSet.between` reports in no particular order, so the test sorts.
- **Driven in the built app and in dev mode** (scratch library, `--user-data-dir`): five chips drawn from a saved note (one struck through), the picker for a person, reading and note (Tab and Enter and a click choose),
  `, ` after a choice takes the space back, Escape closes, arrows step over a chip in one press, Backspace and Cmd-Z, hover card, Cmd-click opens the linked note, no console errors; quitting straight after typing
  (built app: `app.close()`; dev: disconnect) saved every character. Screenshots in the session scratchpad `shots/`.
- **Not done, on purpose**: editing a chip in place (see the roadmap question); mentions inside bold are chips inside the bold span; a label containing Markdown is shown as typed.

## Live markup in the notes editor, stage 5: Find and replace, outline, word count, TODO helper (30 Sep 2026)

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. Still behind the hidden switch; Milkdown unchanged. Seven commits: the shared find contract, live Find and replace, the replace keys, the outline, the topics jump, word count, the TODO helper (plus the library gate and one fix found by driving the app).

- **Find bar on a `FindTarget`** (`notes/find-types.ts`): `useNotesFind` and `NotesFindBar` no longer know Milkdown; an editor hands the bar a target (search, highlight, scrollTo, replace, replaceAll), the same shape as `MentionTarget`. Milkdown's adapter is `proseFindTarget`. `EditorCard` also offers the bar's bridge through `FindContext`, which the live editor reads (Milkdown still gets `findSetup`). Replace and replace-all now search again first: the bar's list of matches goes stale when the note is edited behind it, and a replacement must never land by an old position (tested with a stale list). A destroyed editor is no longer touched when the bar closes.
- **Live Find** (`editor/live-find.ts`): matches the Markdown text, so a word inside `**bold**` is found and a query of only `*` or `#` matches markers. **Recorded, acceptable as asked:** it also matches words inside a link's hidden address and inside a mention chip's `cc://` address (the match exists; nothing visible is shaded). Matches never overlap (`aa` in `aaa` is one; Milkdown's find reported overlapping ones, which would have made replace-all overlap); case folding keeps every character's length (`İ` would otherwise shift every later position); CRLF notes keep their breaks. Highlights follow the text while the bar is open. Replace is one undo step each (`input.replace` is never joined by the history; a test with neighbouring matches pins it), replace-all one step in total. Cmd-F while the bar is already open does nothing, as before.
- **Replace keys**: Cmd-Enter and Cmd-Shift-Enter pressed in the note do Replace and Replace all when the bar shows its replace row; otherwise not handled (Cmd-Enter keeps CodeMirror's blank-line meaning). Every chord in Settings' Notes editor list is now bound in the live keymap; `LATER_STAGES` is gone from `notes-shortcuts.test.ts`.
- **Outline**: `locatedOutline` (shared, adds each heading's line; `markdownOutline` is unchanged) and `editor/live-outline.ts`. The live editor draws only the lines near the screen, so a far heading has no element to scroll to: `NoteOutline` finds the view from the page (`EditorView.findFromDOM`) and scrolls its line with `scrollIntoView`. A click on a line that has stopped being a heading does nothing. The scroll is instant, not smooth like Milkdown's page scroll. Also duplicated headings now jump to the right one (Milkdown's matched the first with that text).
- **Meetings' topics panel** had the same DOM search (`.ProseMirror h2, h3`) and would have silently done nothing with the switch on; it jumps by position now (`topicOffset`, cursor to the end of the heading line). Not in the brief; the same reason as the outline.
- **Word count**: the card already counts the Markdown text, so nothing is re-pointed, but the live editor's text is the file as typed, where Milkdown wrote its own normal form. `wordCount` now also drops nested quote marks (`> > a`), a heading's closing hashes, an empty heading, a `===` underline and backslash escapes; four of these were miscounted before (tests failed first). `wordsOf` exposes the words. The real library has `## ## Title` in one note: the second `##` is text and is counted, as drawn.
- **TODO helper** (`meetings/renderer/todo-live.ts`): `/todo` typed at a line start or after white space, or Cmd-Shift-T, opens the owner menu; arrows, Enter, Tab and Escape go to the menu; typing, Backspace or moving the cursor closes it; choosing writes `**TODO(XX)**: ` as plain text (one undo step). The menu no longer knows the editor: an editor passes a `TodoMenuRequest` (range, screen position, `insert`) instead of a Milkdown view. Differences from Milkdown, on purpose: it opens from the update after the letter is typed (not a timer), its position is read in `requestMeasure`, it is not offered inside code, and not for a pasted or multi-cursor letter.
- **Real-library gate** (fresh copy of notes and backups, 406 files, 9 tests, all passing) now also: finds a spread of words and compares with an independent regular-expression search; replace-all and replace-one must equal the text with exactly those stretches replaced, undone in one step; a TODO written at a spread of places or over a word is exactly that stretch; `/todo` triggers only after white space; no word of the count is only markers or holds an address. Its own first version flagged `=` ("mean = 500") and `## ##` as marker words; both are real text, so the gate's marker set was narrowed (recorded in the test).
- **Mutation checks** (by hand): find (overlap, case folding, range off by one, dropping a match, stale list, `isOpen` guard, highlight mapping, key flags, detach), replace (each of the above plus the `input.replace` joining), outline (line offset, heading check, range check, cursor end), word count (each of six rules), TODO (text, owner, range, cursor, lead, code check, single-letter and single-change rules, typed-event check, stale-write guard, menu keys, close rules). Survivors, each explained: `isolateHistory` (redundant, removed); a missing `return` in `NoteOutline` (falls through to a no-op); CRLF normalisation in word count (redundant, removed); overlapping matches at gate level (no real note has a self-overlapping word; the unit test kills it).
- **Found only by driving the app**: the find highlights were styled under Milkdown's wrapper only, so the live editor marked matches in the DOM and drew nothing (unit tests read the DOM and passed). Fixed in `LiveEditor.module.css`.
- **Driven** (scratch library under the session scratchpad, `--user-data-dir`, real keystrokes; screenshots in `scratchpad/shots/`: `20-highlight.png`, `21-outline-section6.png`, `22-outline-deep.png`, `31-todo-menu.png`, `32-todo-written.png`, `40-dev.png`): built app: Cmd-F on a 2,400-word note (6 matches, Enter and Shift-Enter wrap, the active one scrolled into view from far away), Cmd-Option-F, Replace, Replace all then quitting at once (disk: 6 replaced, none left); outline clicks to a far heading and a sub-heading; topics clicks put the cursor on the heading; `/todo` and Cmd-Shift-T menus choose the right owner, Escape leaves the `/todo`, the last `!` typed before quitting was saved; the word count moved as text was typed (and counted `##` mid-line as text). Dev mode (StrictMode): find, Cmd-Shift-Enter replace-all from the field, outline, and a disconnect straight after typing saved. No console errors in either.
- **Not done, on purpose**: a match inside a hidden address (question in the roadmap); Cmd-F while the bar is open does not refocus its field; the outline jump is not animated.

## Live markup in the notes editor, stage 6: tables and fenced code (30 Sep 2026)

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. Still behind the hidden switch; Milkdown unchanged. The file format is unchanged: the document is the Markdown text, opening never reformats, and a cell edit changes only that cell's characters. Commits: table rendering, cell navigation, fences, word count for fences, the gate, and three CSS fixes found by driving the app.

- **Tables** (`live-tables.ts`). Away from the cursor, each table line is a row of a CSS grid: the pipes and the white space round every cell are hidden (one hidden range per gap, never across a line), each cell is a mark (`live-cell`, alignment from the delimiter line's colons: `live-cell-center`, `live-cell-right`), the header is bold, and the delimiter line (`|---|---|`) is hidden whole and collapses to nothing, the header's bottom border being the rule. While the cursor is anywhere in the table (the block rule of `live-reveal.ts`) the lines are plain monospace text with the pipes and the dashes in the marker colour (at the text's own size, so a table padded with spaces stays lined up). Column widths are proportional to the longest text in each column (between 6 and 48 "parts"), the same for every row of one table, so they always line up; they do not fit the content exactly. A cell with no text and a space keeps the space; one with nothing between its pipes (`||`) gets a zero-width placeholder widget; a ragged table gets as many columns as its widest row. **A table inside a quote or a list item stays as text** (its lines start with something that is not the table's; drawing a grid there was not worth the risk); so does one with fewer than two lines.
- **Cells are read by `splitRow`** (pure, tested alone), not from the syntax tree: it splits at `|` not preceded by an odd number of backslashes, skips a quote or indentation prefix, and handles rows with no outer pipes. The tree is used only to find where a table is.
- **Tab and Shift-Tab** (`tableTab`, bound before the list keys): the cursor goes to the start of the next or previous cell in reading order (after the first space in an empty cell), skipping the delimiter line; from the delimiter line Tab goes to the first cell below and Shift-Tab to the last above; Shift-Tab in the very first cell stays put and keeps the key; **Tab in the last cell adds an empty row** under the table (one insert, `|  |  |` with a cell for each header column and the pipes the last row has, the note's own line break, the cursor in its first cell). A cursor after the last pipe of a row counts as in the last cell. Not handled (so the list keys and the rest run as before): outside a table, or with a selection over several lines. Moving never changes the text.
- **Fences** (`live-fences.ts`). The fence lines (backticks or tildes, any length, indented or in a quote or list, with the language) are real text: shown in the marker colour while the cursor is anywhere in the block (fence lines included), hidden otherwise, the hidden line collapsing to 8 px of padding for the block. **A fence that is never closed keeps its opening line showing** even when not focused, because everything below it is code and the note would look broken without the reason (so "select all shows no marker" has this one exception, recorded in the gate). Indented code blocks are unchanged. Cmd-Option-C still wraps and unwraps; the wrapped block shows its fences because the cursor is in it.
- **Word count**: tables already counted right (pipes and delimiter rows are dropped); `~~~` fences and indented fences were counted as words and are now fence lines like ` ``` ` (`markdownToExcerpt`, with tests).
- **Gate** (`live-library.test.ts`, fresh copy of notes and backups, 406 files, 10 tests, about two minutes). The real library has two tables (one in a work meeting, one in a research note, both with the copies in backups) and **no fenced code**, so a table and a fence are also written into each note at up to three places between plain paragraphs and at the end (812 and 500-odd checks), and checked by code that reads the text itself (a regular expression per line, not `splitRow`): every pipe and the whole delimiter line hidden, one drawn cell per cell, only the cells' text left to read (bold marks aside), a row decoration on every row; with the cursor at a spread of places in and beside the table, nothing hidden under it and no pipe hidden in it; Tab visits every cell once, exactly where the text says a cell starts, never the delimiter line, without changing the text; Tab after the last adds exactly one row and one undo gives the note back; typing a character in each cell changes that cell and no other; the same in a CRLF copy; the outline, find and replace-all and word count across a written table; a heading inside a fence is neither in the outline nor drawn as a heading; Cmd-Option-C on the written fence takes it off and one undo puts it back; an unclosed fence is not hidden; and the older whole-note checks (`checkNote`) on every variant.
- **The gate was blind to most of long notes; fixed.** `syntaxTree(state)` returns the tree of the first ~3,000 characters a state was built with and keeps returning it however far `ensureSyntaxTree` parses afterwards; only the next transaction picks the finished tree up. `stateFor` (test helper) parsed after its last transaction, so every decoration-based check of stages 2 to 5 (hidden text under the cursor, list units, chips, select-all shows nothing) saw a long note's tail as plain text. The running editor is not affected (it redraws when the parse advances), and the commands use `ensureSyntaxTree` themselves. `stateFor` now parses first, then sets the selection. Found because a real table past 3,000 characters had no decorations at all. The whole gate passes with full trees, so stages 2 to 5 lose nothing, but they are now checked over the whole of every note.
- **Mutation checks** (by hand): Tab and cell navigation, 17 (direction, delimiter skip, cell-end comparison, empty-cell caret, first-cell key, leading and trailing pipes of the new row, its cell count, the delimiter-line branches, the multi-line check, non-table handling, the new row's place and cursor, the quote prefix, the trailing-pipe test) all killed by the key tests; the escaped-pipe one by the `splitRow` tests (one more, `+0`, was an equivalent mutant); removing the key binding is killed. Table drawing: hiding the delimiter line, the nested-table rule, alignment, the row's tail: killed. Fences, 6 (unclosed rule, never hides, inverted, the language left showing, the collapse class, the closing-fence count): all killed. A multi-cursor check in `tableTab` is unreachable here (the editor allows one selection) and is kept as a guard.
- **Found only by driving the built app** (unit tests all passed): (1) every hidden range is an empty element in the line plus two of CodeMirror's spacer images, and each became a cell of the grid, so the cells sat staggered over several rows; (2) with Find open, a match over a whole cell is a wrapper round the cell, which my first fix hid with the other non-cell children, making the cell vanish and its neighbour slide into its column, and a second fix (`display: contents`) removed the wrapper's box and with it the highlight; the wrapper is now an ordinary grid item with the cell as a block inside, so the match shades the cell's whole width. A match that crosses a pipe (a query of two cells) is not drawn properly in the grid; nobody can type the hidden pipe, so it was left. (3) My own script pressed Tab twice after the last cell and got two rows, and later split a row with Enter; both worked as designed.
- **Driven** (scratch library under the session scratchpad, `--user-data-dir`, real keystrokes; screenshots in `scratchpad/shots/`: `01-table-grid.png`, `02-table-grid-dark.png`, `03-table-revealed.png`, `10-typing-table.png`, `11-table-row-added.png`, `12-fence-typed-inside.png`, `13-both-away.png`, `14-find-in-table.png`, `20-dev.png`): built app: the real research-note table drawn as a grid in light and dark and as text after a click; Tab and Shift-Tab through real cells, typing in one (the file has exactly that change); a table typed by hand line by line (shows as text while typing), Tab after the last cell adding a row, a fence typed by hand (fence lines showing while inside, gone after), Cmd-F over the rendered table, and `app.close()` straight after typing (the last words were in the file). Dev mode (StrictMode): the same, and a disconnect straight after typing saved every character. No console errors in either.
- **Not done, on purpose**: Enter in a table row is an ordinary new line (it does not add a row), the layout shifts when the cursor enters or leaves a table or a fence (grid to text; stage 7 tuning), no copy-as-table or sorting.

## Live markup in the notes editor, stage 7: interactions (30 Sep 2026)

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. Still behind the hidden switch; Milkdown unchanged. Commits: composition, undo, escapes/caret/blank lines, and the CSS fixes.

- **IME composition.** While an input method is composing (`view.compositionStarted`) the decorations are only mapped through the edits, never rebuilt; the redraw comes with the first update after it, and an effect sent 80 ms after `compositionend` covers the case where CodeMirror sends none. Tested in jsdom with composition events (selection moves mid-composition, text typed into it, a second composition starting before the timer). Driven in the built app and dev mode with CDP `Input.imeSetComposition` / `insertText` (a dead-key accent straight after a closing `**`): the markers stay while composing and go afterwards. Without the guard one `**` disappeared mid-composition; the text still came out right in Chromium, so the guard prevents flicker and a risk, not a proven loss. A real OS dead key or Japanese IME could not be driven from here; the user should try one. Mutation checks: the guard, the map, the end timer and the effect are killed; the `!compositionStarted` test in the timer is an equivalent mutant (the plugin ignores the effect while composing).
- **Selection across blocks** needed no change: real mouse drag from inside a paragraph (markers of its spans showed) into a list (none), shift-arrows from a quote line down through a grid table and a fence and back (none while the head is in another block; the table stays a grid, fence lines stay hidden), select-all and ArrowRight, all in the built app; dark and light screenshots.
- **Undo** (`live-history.ts`). CodeMirror joins typing with an adjacent edit made within 500 ms and counts every `delete.*` event as typing, so a list Backspace, a chosen mention, Enter or a paste could be undone together with the words next to it (the far-away case never joined, which is why the first version of the test passed: it typed in the wrong place). A transaction extender isolates `format.*`, `delete.list`, `delete.chip` (a mention's Backspace/Delete, renamed from `delete.backward/forward`), `input` (Enter), `input.table`, `input.replace`, `input.complete`, `input.paste`. Plain typing and the Backspace that corrects it keep the library's grouping. `live-history.test.ts` presses every command (28 scenarios) after typing and before typing at the place it edits: one extra step, one undo gives back exactly the text before. Mutation checks: each alternative of the pattern and `full` against `before`/`after` killed; `!tr.docChanged` is an equivalent guard. Built app and dev mode: typing, Cmd-B, typing is three undo steps; a list built with Enter and Tab undoes step by step; `- ` then Backspace then one undo brings the bullet back.
- **Performance** (20,558 words, 134,000 characters, 115 sections, 38 table lines, made from copies of real notes, in the built app; keydown to next paint, median/p95; the same before and after because nothing needed changing): typing at the start 12.6/16.6 ms, middle 12.4/16.8, end 12.5/17.0, in a table 12.3/16.4, with Find open on `the` 12.4/16.3 (one frame); `dispatch` itself 1.1 to 1.7 ms; no long task; opening the note 107 ms including Playwright round trips; scrolling 8 ms/frame. `buildDecorations` over a screenful, measured headlessly: 1,500 paragraphs 0.2 ms, a 5,000-line list, quote or fence under 0.2 ms, a 3,000-row table 2.5 ms (it reads the whole table for its column widths; fine up to several thousand rows, cacheable if a note ever needs it).
- **Dark mode** looked at with screenshots in both themes: markers, grid and text tables, fences, chips (one missing), Find highlights, checkboxes, selection across blocks. Nothing needed a new colour. Contrast of the marker slate: 3.7:1 on white, 3.0:1 on a code block in the light theme, 4.9:1 and 5.2:1 in the dark one; left as chosen, question in the roadmap. The caret (16:1 and 12.6:1) is unaffected.
- **Caret against the `#`.** A marker that starts its line (`# `, `> `, `---`) gets `live-marker-lead`, 3 px of room; the caret is no longer against the glyph. Markers in headings 1 to 3 are `max(0.6em, 13px)` (they were 0.85em of a 28 px heading).
- **Layout jump when markers appear.** Measured by the position of the last line after moving the cursor in: headings, bold, italic, code, strike, escapes, quotes, lists: 0 px. A link's address can wrap its paragraph (28 px in the sample); that is the same for every editor of this kind, recorded as a question. Table: was minus 20 px and grew with the rows (every grid row 33 px against 22 px of text); a table row is now 28 px as a grid and as text (`--table-row`), and the delimiter line takes half a row as text, so entering a table moves what is below by 14 px, whatever its size. Fence: its hidden lines keep their height (they were collapsed to 8 px, which moved 28.8 px), so the block has about a line of padding above and below. Rule: drawn in the middle of a full line, and when showing `---` the same line is drawn at the bottom; 0 px (it was 12.8). I chose "no change of size" over "fade in" everywhere it was possible, because the pointer stays on what it clicked.
- **Escape backslashes** (`\*`) are hidden away from the cursor and shown, as a marker, while the cursor touches the pair; not inside a table (there `\|` keeps a pipe in its cell). **Blank lines**: a line of only spaces counts as blank (the real notes have them between list items, and they drew as a full line, doubling the gap); headings get 0.4em under them, as the old editor had.
- **Found only by driving the app** (unit tests all passed): comparing with Milkdown on a real note showed it. The `.cm-line { padding: 0 }` reset outranked every `.live-…` rule that set padding, so **nested quotes never indented, headings had no space above, and code text touched the edge of its block** since stage 2 (the list rule was fixed for the same reason in stage 3 and the others were not). Fixed by spelling those rules with `.cm-line.live-x`. Also found: my first measurement of the table shift was taken with the table off screen; and Playwright's recent-notes list pushed the sample note off the page (a script issue).
- **Mutation checks for the decorations**: escape (table skip, one character, touching rule, off, always on, never wired), lead class (always, never), spaces-only blank line: all killed.
- **Not done, on purpose**: a real OS dead key or IME; the marker colour (question); the big-table column cache; the link-address wrap.

## Live markup in the notes editor, stage 8: switch and remove Milkdown (30 Sep 2026)

Plan: `docs/EDITOR_LIVE_MARKUP_PLAN.md`. `LiveEditor` is the only editor. Nothing in the file format changed. Commits: consumers, `pastedLinkTarget`, TODO helper, outline and topic jumps, the Milkdown editor, dependencies, docs.

- **Consumers.** Notes, Work notes, Meetings (Research and Work), Training entries and plan, Reading lists and Readings notes render `LiveEditor` directly (`NotesEditor` is gone). `EditorCard`'s children are a plain node now (they no longer get a Milkdown `findSetup`); the editor reaches the card's find bar through `FindContext`. `live-switch.ts` and its checks are deleted (the `central-command.liveEditor` key in `localStorage` is now ignored and can stay in any profile).
- **Deleted**: `NotesEditor.tsx` and its CSS, `notes-editor-setup`, `notes-block-keymap`, `notes-list-keymap`, `notes-task-list`, `notes-change-plugin`, `notes-find` (with `proseFindTarget`), `notes-links` (input rules and paste plugin), `entities/entity-plugin` (with `proseTarget`, `findSuggestion`, `entityLinkSchema`), the Milkdown `todo-helper` plugin, `useNotesFind`'s and `useTodoHelper`'s `setup`, the `.ProseMirror` fallbacks in `NoteOutline` and Meetings' topic jump, and three `.doc :global(.ProseMirror) h…` scroll-margin rules (the live editor scrolls with its own 8 px margin, `live-outline.ts`). Kept and still used: `notes/find-types.ts`, `EditorCard`, `FindContext`, `entities/mention-target.ts` (and `suggestionIn`), `entities/picker-controller.ts`, `useEntityHover`, the TODO menu types (moved into `todo-live.ts`).
- **Moved**: `pastedLinkTarget` (the one function of `notes-links.ts` the live editor used) is in `editor/live-links.ts`, with its tests.
- **Dependencies**: `@milkdown/kit` and `@milkdown/react` removed from `package.json`; the lockfile lost 209 packages (ProseMirror, remark/mdast/micromark, the `@codemirror/lang-*` and `katex` that Milkdown brought) and no remaining package changed version. The direct CodeMirror packages stay. `externalizeDeps` in `electron.vite.config.ts` never had a Milkdown entry (only `@retorquere/bibtex-parser` and `chokidar`), so nothing changed there. The production build was made and launched (scratch library).
- **Every old test, ported or retired** (1,639 tests before; 1,545 passing now, 94 fewer, none failing):
  - `notes-editor-setup.test.ts` (round trip, star bullets and hard breaks written in Milkdown's form, escaped asterisks): **retired**, the document is the file's text and nothing is re-serialised; the real-library identity gate and `live-state.test.ts` ("holds the file text exactly") replace it. Task-list toggle: **ported earlier** as `live-list-drawing.test.ts` ("a click on the checkbox writes [x]"). Immediate change reporting: **ported earlier** as `live-state.test.ts` ("reports the full text synchronously on every edit, and only edits").
  - `notes-block-keymap.test.ts` (Backspace right after an input rule, heading and quote Backspace): **retired**, there are no input rules (markers are text, Backspace deletes a character) and a heading's `#` is deleted like any character; list Backspace is `live-lists.test.ts`.
  - `notes-list-keymap.test.ts` (Backspace at the start of a list item): **ported earlier** as the Backspace block of `live-lists.test.ts`.
  - `notes-find.test.ts` (matches, replace, replace-all on the ProseMirror document): **ported earlier** as `live-find.test.ts`.
  - `notes-links.test.ts`: `pastedLinkTarget` **ported** (now `live-links.test.ts`); typing `[text](address)` and typed addresses becoming links **retired** (they are text, and `live-decorations.test.ts` draws a written address as a link); paste over a selection **ported earlier** as `live-paste.test.ts`.
  - `entity-plugin.test.ts`: drawing and kind/key **ported earlier** (`live-entities.test.ts`, "a mention is drawn as a chip"); the picker's key hand-over and punctuation after a mention **ported earlier**; `findSuggestion`'s cases (every query shape, code, a link, a selection) are **covered** by the `@` picker block of `live-entities.test.ts` (same cases, plus quotes, headings, a fence, and `Met |@kat|` for a selection).
  - `todo-helper.test.ts` (writing a TODO, typing `/todo`, keys): **ported earlier** as `todo-live.test.ts` (same cases, plus code, paste and multi-cursor).
  - `NoteOutline.test.ts`: the two tests that clicked a `.ProseMirror` heading are **retired**; the live-editor ones stay.
  - `notes-shortcuts.test.ts`: the check against Milkdown's built source and its self-test are **retired**; the check of the Settings list against the live keymap stays, and "does not list a chord twice" stays.
  - `EditorCard.test.ts`: kept, changed only for the new `children` type.
- **Real-library gate**: a fresh copy of `~/CentralCommand/notes` and `backups` (406 files) under the session scratchpad, `LIVE_EDITOR_LIBRARY=<copy> npx vitest run src/renderer/src/editor/live-library`: 10 of 10 pass.
- **Driven for real** (scratch copy of the whole library under the session scratchpad with its settings paths pointed at the copy, `CENTRAL_COMMAND_HOME`, `--user-data-dir`; real keystrokes through Playwright; script and screenshots in the scratchpad, `pw/pass.mjs` and `shots/`): the production build and dev mode (StrictMode), light and dark (the colour scheme is forced on the page, because Playwright otherwise emulates light over the app's own theme: my first "dark" runs were light and were redone), for each of Notes, Work notes, Meetings (Research and Work), Training entry, Training plan, Reading list and Readings notes: the page opens; typing a heading, bold, italic, a link and a bullet; the word count moves; the outline (Notes, Training) lists the new heading and a click keeps the page alive; Cmd-F finds it ("1 of 2"); the `@` picker opens, Enter writes a chip; plain paste (the main process's `app:paste-plain` message in the built app, the same event in dev); `/todo` opens the owner menu and Enter writes `**TODO**:` (both Meetings); leaving the page straight after typing saved the last characters to the file every time; and quitting straight after typing (`app.close()`, or disconnecting in dev) saved them too. 70 checks per run, none failing; Cmd-click on a mention chip opened the linked reading and its "Mentioned in" panel listed the note; the hover card showed. Console errors: none in the built app; dev mode shows one React warning about a duplicate key on a reading's page (see below).
- **Found, not caused by this stage, not changed** (both in `docs/ROADMAP.md`, "For the user"): (1) the TODO owner menu is taller than the window when the people list is long, so the top names are off screen (the old editor had the same placement code); (2) `ReadingDetailPage.tsx` gives `ReadingListMentions` and `NotesSection` the same `key` as siblings, which React warns about in development only. Not checked: Cmd-click on an ordinary web link (it would open the user's browser; covered by `live-links.test.ts` and the unchanged `window.open` path).
- **Not done, on purpose**: the final write-up (stage 9: replace the Milkdown decision above, `CLAUDE.md` architecture and the Milkdown pitfalls, `docs/ROADMAP.md`); earlier stages' text in this file still says "Milkdown unchanged" and "behind the hidden switch", which was true then. **Stage 9 (30 Sep 2026) did that write-up:** the new decision above, the old one marked superseded, historical notes on the older sections that described Milkdown, and `CLAUDE.md`, `docs/ROADMAP.md` and the plan brought up to date. Documentation only.

## Hours page, first usable cut (1 Oct 2026, stage 4 of `docs/TIME_PLAN.md`)

Built in six commits (4a to 4f), each driven in the built app on a scratch library (light and dark), and dev mode once at the end. The real library was
imported on 1 Oct 2026 at the user's word (`npm run import:hours`, both years, nothing needed attention).

- **Module and year.** `src/modules/hours/` (`createHoursModule(workspace)`, only Research registered). `YearSelect` (`components/`) and `useTrackingYear` /
  `useYearFile` (`state/`): the year is `?year=<start>` in the URL, and a year that is not offered is never asked for. The week is `?week=<monday>` (`useWeek`);
  changing the year drops it.
- **Today.** Rows from `dayRows`, running row from `provisionalMinutes` ticking through `useNow`. Start/switch/stop and edits go through `window.api.tracking`;
  the page reloads on `tracking:changed`. A running row's time is not editable (it is provisional). Typed time must be a whole quarter hour or it is refused.
  Earlier names (`earlierLabels`, `suggestLabels`) show only while typing. A session left from an earlier day shows `StaleTimer` (Today and the chip popover)
  and blocks every start until it has an end time.
- **The chip.** A module `globals` component draws into the top bar through `TopBarPortal` / `TopBarSlot` (`shell/top-bar-slot.tsx`); only the Research
  instance carries it, so Work will not draw a second one. The clock is `elapsedMinutes`, the one exact time shown.
- **The week.** Plan so far and balance come from `weekTotals`, never recomputed in the component. Bars scale to 1.4 x the aim with the tick at the aim;
  one colour (the under/over colour is `--chart-under`, stage 6). An imported day (a typed total, no tasks) shows a read-only "Imported" row and its note.
- **Balance card.** `yearTotals`; matches the sheets (2025-26: -126:30, 34:38, 1,523:30, 220 days, 1,650:00).
- **Settings -> Hours.** Edits the current year's plan (`setPlan`); a new year copies it. The last worked day cannot be switched off. When Work is registered
  its tab will need to say which workspace it is for (tabs are keyed by module id).
- **Not done:** the landing card shows only today; no charts link; no day-note editing; no under-aim colour.

## Packaging and installing the Mac app (1 Oct 2026)

`npm run build:mac` works as is (no config change): it writes the `.app`, a zip and a DMG to `dist/` (git-ignored). `better-sqlite3` loads from `app.asar.unpacked` (N-API prebuilds, `npmRebuild: false`), so no Electron rebuild is needed. The build is unsigned (no Developer ID), so the signature is ad hoc; it runs on the Mac that built it, and another Mac's Gatekeeper would complain.

Checked by launching the packaged binary against a scratch copy of the real library (`CENTRAL_COMMAND_HOME`): no page errors, the Work workspace and Research → Hours show the imported data. The installed copy at `/Applications/Central Command.app` reads `~/CentralCommand` because `getAppPaths` falls back to `app.getPath('home')` when the variable is not set; it was deliberately not launched against the real library from here. Do not run it and `npm run dev` on the real library at the same time (two processes, one database).

## Dock and palette timer items (1 Oct 2026, stage 5 of `docs/TIME_PLAN.md`)

- **Dock: Stop Timer**, listed only while a timer runs. The Dock menu is rebuilt from the store's `onChange` (and once at start-up, so a timer left running shows it); `installDockMenu()` returns the setter. It sends `stop-timer` (a new `DockActionId`, also in `QUICK_ACTIONS`) and the window calls `tracking.stop()`.
- **Palette: Stop timer** (same action, offered only while a timer runs; `whileRunning` on a command) and **Start timer**, which opens Research's Hours with `state.focus = 'start'`; `TodayCard` focuses the task field on arrival (a fresh location key each time, so it works when already on the page). A name is not asked for in the palette: one place to type task names.
- No new shortcut, so Settings is unchanged. Checked in the built app on a scratch library (Dock labels before, during, after, and after a relaunch with a timer running; palette in light and dark with a long task name). Dev mode was not driven.

## Start from the top bar (1 Oct 2026, stage 5b of `docs/TIME_PLAN.md`)

- **Idle chip.** `TimerChip` draws a quiet "Start" (Play icon) in the running chip's slot whenever no timer runs, nothing until the first read says whether one does (no flash). A click opens a popover with the task field (`TaskField`, earlier names while typing; Enter or the primary Start) and **Recent**. Starting closes it. Research only, like the chip.
- **Recent** is `recentLabels(year, today, 5)`: names used in the last seven days (`RECENT_DAYS`, today included), once each, newest first. The window was my reading of "the last few days"; change the constant if another is wanted. After a week away the list is empty and typing still suggests earlier names.
- **Shared popover behaviour** (`usePopover`: click outside and Escape close it; Escape returns focus to the button) now serves both chips. A stale session still shows the running chip, so starts stay blocked as before.
- No new shortcut. Checked in the built app and dev mode on a scratch library copy (light and dark; Playwright pins the colour scheme to light, so dark needs `page.emulateMedia({ colorScheme: 'dark' })`): focus, Escape, typing with arrow-key pick, Enter, a Recent click, a long name, Settings, Work and Hours pages, start then quit at once and relaunch (still running). The scratch copy of the real library already held a running timer, so stop it before looking for the idle chip.

## Charts and weeks, views 1 and 2 (1 Oct 2026, stage 6 of `docs/TIME_PLAN.md`)

Agreed order (the user, 1 Oct 2026), one commit each: All weeks, weeks against the plan, running balance, year heat map, typical week (a bar per weekday, weekends kept), Years. Views 1 and 2 are built here; 3 to 6 are in "Charts and weeks, views 3 to 6" below.

- **The page.** `/hours/year` (`HoursYearPage`), reached from the "Charts and weeks" button on the balance card; the year selector is the same control, and the Hours page's `?year=` and `?week=` links open a year and week (`weekRoute`, `yearRoute` in `hours-paths.ts`).
- **All weeks.** `weekTotals` (the rules, unchanged) as a table, newest first, one tab stop with `useRowNavigation`, a row opens its week on the Hours page. Weeks that have not begun are left out: the plan said newest first, and with the future weeks in, the first screen was empty dashes and the current week was far down the box. The newest row says "now". Checked against the sheet: 2025–26 ends at −126:30.
- **Weeks against the plan.** Hand-drawn SVG, width measured by `useElementWidth` (a ResizeObserver hook in `renderer/src/state/`), pure geometry in `shared/chart.ts` (tested). Columns are at most 24px with a 2px gap and a 4px rounded top. Met is the accent, under is `--chart-under` (amber), the week still running is `--chart-now` (a paler accent), all three light-dark pairs in `tokens.css`. The plan is a step line over the whole year, so a holiday week's lower plan shows and a week is judged against its own plan, not a flat 37:30. The tooltip (hover, or Left and Right on the focused chart) gives hours first, then week, dates, plan and difference; it is kept inside the card at both ends.
- **Colour check.** The dataviz validator passes the accent against amber under colour-blind simulation (ΔE 17 to 21, both themes). It flags the app's accent for chroma (it is a muted blue) and, in dark, for the lightness band; both are the app's own palette and were left as they are. Meaning does not rest on colour alone: the plan line, the tooltip and the table beneath say the same.
- **Testing note.** Playwright's `page.screenshot` blurs the page in Electron, which closes any tooltip that closes on blur. To see a tooltip, capture with `BrowserWindow.webContents.capturePage()` through `app.evaluate`. The app itself is fine.
- Checked in the built app on a scratch copy of the real library (its running timer removed), light and dark, both years. Dev mode was not driven for these two views.

## Hours feedback round (1 Oct 2026)

The user's notes on the first Hours page, answered and built. Rules are in `docs/TIME_PLAN.md` ("The timer and the rounding").

- **The running row shows exact time.** `provisionalMinutes(session, time)` is the exact length in fractional minutes; the carry and the rounding to a quarter hour are applied once, in `close` when it stops, and the new carry is stored (derived, as before). My first attempt rounded the running row without the carry; the user wanted the exact time, so that was replaced. Before either, the row applied the carry from the moment of Start, which is why a new task could show minutes it had not run.
- **Sleep.** Nothing to build: a session stores its start on the clock and its length is the clock at stop, so a closed laptop counts as time worked (and quitting the app does not stop a timer).
- **The day ends at 04:00.** `DAY_END_HOUR` in `src/shared/time.ts` (a setting later, which the user suggested). `trackingMoment()` is Hours' "now": before 04:00 it is the previous day with hours 24 to 27 (`25:30:00`), so one session can run past midnight and `timeToSeconds` accepts hours up to 27. `clockTime` shows `01:30`. The main process stops a timer whose day is over at `DAY_END_TIME` (`27:59:59`) every 15 s and at launch (`TrackingStore.closeFinishedDays`, `endFinishedDay`). Consequence the user accepted: a timer left running overnight counts up to 04:00; the fix is editing the task's time. The "set an end time" prompt (`StaleTimer`) is now only a fallback. Only Hours uses `trackingMoment`; Meetings, Training and the rest keep calendar days (`todayIso`).
- **One form on Today** (name, hours:minutes, one button): time 0:00 starts, any time adds (rounded to a quarter hour, at least 15). The week card's per-day Add keeps its own row but uses the same time field. `DurationField` is two inputs in one box: Tab lands on hours, Tab or Right goes to minutes, Left or Backspace at the start returns, a click lands on the part clicked, Up and Down step (an hour, a quarter hour); a typed value that is not a quarter rounds on save.
- **Start without a name.** `startSession` accepts an empty label (`store.start` too); rows show "No name yet" and clicking a name renames. **Rename** (`renameTask`, `tracking.renameTask`) renames one day's blocks and typed time, merges into a row of the same name, never touches frozen minutes or the carry, and refuses an empty new name. A running task can be renamed; its time cannot be edited.
- **Balance card** shows only the signed figure (no "ahead" or "behind"); "on plan" stays at exactly zero. **Roadmap:** a Mac widget for the timer is a later item.
- Checked in the built app on a scratch library (start unnamed, rename, add 1:30 by keyboard, edit minutes by click, a two-minute run). Not driven: dev mode, dark mode, the 04:00 stop in the real app (unit and store tests only).

## Time off page (2 Oct 2026, stage 7 of `docs/TIME_PLAN.md`)

A module of its own, `src/modules/time-off/` (`createTimeOffModule(workspace)`, route `/<workspace>/time-off`, registered after Hours for Research only), reading the same year files as Hours through `useTrackingYear`. The rules are `timeOffCounts`, plus the new `timeOffRows` (counted days only, each date once, oldest first, `taken` = before today) and `nextDayOff` in `src/shared/tracking/timeoff.ts`, so the list and the counts cannot disagree (a test checks it).

- **Page:** year select and **Add** in the header; the summary (days a year, taken, booked, left to book), one bar (taken in `--accent`, booked in `--chart-now`, the rest is the track; it grows past the allowance if more is booked), the count of each kind; then the list (date, type, status, a remove button). No legend and no how-it-works text.
- **Add** opens one inline row (From, To, Type, Add); To follows From until typed. Enter adds, Escape closes. A refusal from the rules is shown as a notice in the row ("Those dates are outside this year.", "To is before From.", "That is a weekend."), nothing changes then. Adding a date already listed keeps the stronger type (public, then university, then leave; changed 2 Oct 2026 after adding leave overwrote two public holidays), so adding leave over a holiday week fills only the other days.
- **Remove** is a plain icon button with a native tooltip, not `IconButton`: its hover label was cut off by the list's scroll box. It does not ask for confirmation (one day, one click to add again).
- **Landing card:** "N left to book of 40 days" and "X taken · Y booked · next Thu 24 Dec".
- Checked in the built app on a scratch copy of the real library: add (refused and accepted), remove, counts, focus ring, landing card. Light mode only; dark uses existing tokens.

## Training and Meetings use the shared year (2 Oct 2026, stage 8 of `docs/TIME_PLAN.md`)

The academic year (1 Sep to 31 Aug, a number such as 2025) is gone: `academic-year.ts`, `use-academic-year.ts` and `AcademicYearSelect` are deleted. Meetings, Training, the Training plan and the search use the app's one year (52 weeks from a Monday, the starts in Settings), named by its start **date** (`2026-09-21`) like Hours.

- **Rules:** `year` is a start date everywhere (`meetingsInYear`, `entriesInYear`, `meetingHours`, `trainingHours`, the PDF reports and their file names, the export IPC, which now checks for a real date). A year shows planned items with no date only while today is inside it (`inYear(today, year)`), which replaces "is the current academic year".
- **Renderer:** `useYear(dates, today)` (`src/renderer/src/state/use-year.ts`) reads `settings.yearStarts`, keeps `?year=<start>` in the address and falls back to the current year; the select is the shared `YearSelect`. Old links with `?year=2025` fall back to the current year. Series cards pass the start date.
- **Training plan files keep their names.** A plan is stored under the calendar year the year starts in (`planKey`: 2026 for the year starting 21 Sep 2026), so "Training plan 2026-27.md" is still found and the plan IPC and the notes session still take that number as text. The plan page and the search offer the years with entries, this one and the next (`nextYearStart`: the next listed start, else 52 weeks on).
- **No entry changed year** (checked on a scratch copy of the real library): 2025–26 still shows 129 training entries, 356.5 h, and 40 meetings. The year boundaries moved from 1 Sep to 22 Sep 2025 and 21 Sep 2026, and nothing in the library is dated between those days.
- Tests moved to start dates, with the boundary rows at the new edges (the day before a start is the previous year). Mutation check: forcing planned items to show in every year fails a test in both Meetings and Training.
- Checked in the built app (scratch library): Training landing and page with the year select, the plan page (the real plan opens, the next year is offered), Meetings, and a search hit opening the plan. The PDF export needs a native save dialog, so only its unit tests ran.

## Charts and weeks, views 3 to 6 (2 Oct 2026, stage 6 of `docs/TIME_PLAN.md`)

The rest of `/hours/year`, in the agreed order, one commit each. All are hand-drawn SVG in the style of the weeks chart (project tokens, no chart library), width from `useElementWidth`, pure geometry and data rules in `src/modules/hours/shared/` with tests. Page order: weeks, balance, year, typical week, All weeks, Years.

- **Balance chart removed (5 Oct 2026):** the running-balance line chart (`BalanceChart`, `niceRange`, `linePath`) was dropped at the user's request ("ugly"). The Balance card's figure and the Balance columns in All weeks and Years stay.
- **Year heat map** (`YearHeatMap`, `heat.ts`): a column a week, a row a weekday (weekends kept), 364 cells. Four shades of the accent mixed into the surface (none, under half, under all, all of the day's aim or more); a day with no aim (a weekend, a day off) is measured against an average work day so weekend work still shows. Days off are outlined in `--chart-under`; days to come are empty outlines, not zeros. A click or Enter opens that day's week on the Hours page; arrow keys move a week left and right and a day up and down. A month's label is left out when the next month begins within three columns, which the year's first September always does (it starts on 21 Sep) and is labelled again at the end.
- **Typical week** (`TypicalWeek`, `typical.ts`): the average hours on each weekday so far, with the daily aim as a line on work days. Today is left out (it is not over), days off are left out (a holiday would drag its weekday down), and the days that are not worked still count at zero, so Saturday and Sunday show what is really done. The tooltip says how many days each average is of.
- **Years** (`YearsTable`, `years.ts`, `useYearFiles`): one row per year with a file, newest first: hours, plan so far, balance, average week, days off taken. A finished year is counted in full. A row (or Enter on it) switches the year of the charts above, and the selected row is shaded.
- Checked in the built app on a scratch copy of the real library, both years, light and dark, and in dev mode (no errors with StrictMode). 2025–26 shows 1,523:30 hours against 1,650:00 planned, 15 days off, as the sheet does.

## A running task counts whole minutes (2 Oct 2026)

The top-bar chip floored the running time to whole minutes (9 min 40 s showed 0:09) while the Hours rows kept fractional minutes and `formatHours` rounded them (0:10), so the two disagreed. `provisionalMinutes` (`src/shared/tracking/rounding.ts`) now floors to whole minutes, so the chip, the running row, Today's total and the week totals all agree; the carry and the quarter-hour rounding still happen once, when the task stops. This replaces "fractional minutes" in "Hours feedback round" and `docs/TIME_PLAN.md` ("The timer and the rounding"). A task's row sums every block of that task today, so it can still exceed the chip, which shows only the current block.

## Notes feedback round, stages 1 and 2: library tidy and consistency (2 Oct 2026)

The user's feedback list for notes, reading notes, training notes and reading lists (2 Oct 2026) is worked through in stages; stages 1 and 2 are done and **applied to the real library**. Both are dry-run-first scripts with backups, a content-hash guard and a line-count check, and a second dry run now finds nothing (so they are one-off, like `strip:created`).

- **A wrong count that nearly misled us:** a first survey said only one Training entry had notes, because the check stopped reading `## Notes` at the first `###` subheading. The imported notes sit under `###`. Real numbers: 10 entries with notes (all 10 vault notes), 119 with an empty `## Notes` (removed), 1 with no heading. Lesson: measure a section up to the next heading of the _same or higher_ level.
- **Stage 1, `npm run tidy:library`** (`src/shared/library-tidy.ts`; applied 2 Oct 2026, backup `backups/tidy-library-…`): empty `## Notes` removed from 119 Training entries; the Training plan's links repaired (three broken shapes the old editor produced: `\[text]\(<url>)`, `\[text]\(https\://…)`, and an address linked twice); 20 LaTeX spans converted. **Decision: no maths rendering.** Plain Unicode instead: `→`, statistics APA-style as `*d* = 0.44` (italic single-letter symbol, spaces around `=`, true minus `−`, **always a leading zero** as the user asked, ranges with an en dash). `ES` stays upright (APA italicises only single letters). Prose dollars (`$150k … $150k`) are left alone.
- **Stage 2, `npm run tidy:consistency`** (`src/shared/consistency.ts`; applied 2 Oct 2026, backup `backups/tidy-consistency-…`): headings in **sentence case** and uniform statistics. A word is a proper noun when it is capitalised mid-sentence somewhere in the library, its lowercase form never appears, and it is not an ordinary word (macOS `/usr/share/dict/words` with a few suffix rules). Labels keep a capital before a number or letter (`Study 1`, `Category A`, `March 2027`). `PROTECTED_PHRASES` keeps named things as written (Loud and Clear, a World Bank publication; Bilingual Boost, a Luminos programme; Reading First Impact Study, Head Start Impact Study, Nation's Report Card, and so on); extend it, and `EXTRA_PROPER`, when a title is wrongly changed. `March` and `May` are deliberately not proper nouns. A word after a dash is not capitalised. Headings that are links (journal names) are untouched. Also fixed: a doubled `## ## ` marker, and `### **bold**` headings (bold removed). Numbered plan headings keep their numbers.
- **Mistake and fix:** the first commit of the consistency script went in with lint and typecheck errors because the chain used `;`; amended before any push. A Python patch to the script silently did nothing because Prettier had reflowed the target (the known pitfall); asserting the target exists caught it the second time.

### Stage 3 write-up: citations to reading entities (2 Oct 2026)

- **Matcher** (`src/shared/citations.ts`, tests beside it): finds `Kim et al. (2020)`, `(Castles & Coltheart, 2004)`, `Koda (2008)`, `A, B, and C (year)` outside front matter, headings, code, existing links and URLs. A citation is linked only if exactly one reading fits first author and every listed surname in order, the author count ("et al." means three or more; "A & B" exactly two) and the year. Leading non-surname words ("Pedagogical, Koda and Reddy") are tried off. Two matches are reported as ambiguous and a same-first-author-and-year match with different authors as loose; neither is linked (neither occurred in the real run). Readings come from the Zotero export, not the database.
- **Named works** (`NAMED_WORKS`): _Loud and Clear_ links to `worldbankLoudClearEffective2021` anywhere in the text (12 mentions), headings excepted.
- **Script** (`npm run link:citations`): dry run lists every link with context, then ambiguous, loose and "no reading yet". Apply backs each file up, checks that removing the new links gives back the original, and writes with the content-hash guard. Applied: 40 links, 14 files, no files skipped.
- **Not linkable:** "Kim et al." with no year (Reading Acquisition Theory note); "Seagrove, Jack (2019)" is a person, not a citation.
- **Reading list:** only the label of each bold entry was linked (`**[Kim, Lee & Zuilkowski (2020)](cc://…). Title…**`); stage 4 reshapes that file.

### Still to do from the same feedback list (stages 4 and 5), then one reminder

3. **(Done 2 Oct 2026, `npm run link:citations`, `src/shared/citations.ts`; applied: 40 links in 14 files, backup `backups/link-citations-…`. 29 citations have no reading yet; the user adds them to Zotero and asks for another pass, which is just a re-run. Works known by title, such as _Loud and Clear_, are in `NAMED_WORKS`; add one per such work. Headings are never linked.)** **Plain-text citations to reading entities** ("Castles et al., 2018", "Evans and Acosta (2020)", about 30 forms) in all notes; list the ones with no reading yet so the user can create them, then link those. Entities are `[label](cc://reading/<citekey>)` (`src/shared/entities.ts`). Dry run first, never guess an ambiguous match.
4. **(Done 2 Oct 2026, see "Stage 4 write-up" below.)** **Reading lists:** references become entities; remove "Attach a reading…" and the readings sidebar (a paper is an entity or it is not).
5. **(Done 2 Oct 2026, see "Stage 5 write-up" below.)** **Copying text with entities gives readable text:** people as their names; readings as APA in-text citations plus a reference list at the end of what was copied; check the other kinds (meeting, note).

- **Remind the user at the end** to come back to: a sidebar (or hovers, or other ideas) listing all entities in a note.

### Stage 4 write-up: Reading lists use entities (2 Oct 2026)

Supersedes the "Reading lists" decisions about `@citekey`, "Attach a reading…" and the side panel (kept above as history).

- **Format.** A linked entry is `- **[Kim et al. (2020)](cc://reading/<citekey>)** annotation`. The reading holds the title and journal, so the list does not repeat them. A reading mention typed with `@` (a plain link, no bold) counts too. `**@citekey**` and the long form (`**[label](…). Title. Journal.**`) are still read as linked, so nothing breaks before migration. A typed citation with no reading stays a placeholder with its full reference text (it is all the line says about that paper); a bullet with neither is `missing`.
- **Removed:** "Attach a reading…", `attachReading`, and the entries sidebar (`EntriesPanel`); the list page is one editor card. A paper is added by typing `@`. `reading_list_mentions` stays (a reading's page still shows the lists that mention it) and is filled from the same parser.
- **Migration, `npm run tidy:reading-lists`** (`list-tidy.ts` in `src/modules/reading-lists/shared/`, dry run by default, backup per file, content-hash guard, annotations and line count must be unchanged): shortens linked entries to their link, turns `**@key**` into an entity, and links a placeholder only when exactly one reading in the Zotero export fits (reusing the stage 3 matcher), dropping its reference text then. It is idempotent and is the re-run to use after adding readings to Zotero.
- **Real list, applied 2 Oct 2026 (backup `backups/tidy-reading-lists-…`):** 12 entries shortened; 10 placeholders still wait for a reading.
- **Checked:** unit tests (a mutation check on the "exactly one reading" rule failed a test), and the built app on a scratch copy of the real list: chips render, no side panel, `@` inserts a reading link that saves.

### Stage 5 write-up: copying mentions gives readable text (2 Oct 2026)

- **What a copy holds.** A selection with no mention copies as before. One with mentions puts on the clipboard: plain text with each mention written out, and an HTML flavour (reference list in italics, for Word) that also carries the original Markdown in a `data-cc-markdown` attribute.
- **Per kind.** Person: the full name (the key), even if the chip's label was shortened. Reading: the in-text citation (the label; `A & B (2020)` becomes `A and B (2020)` when the label is the standard short citation, a label the writer changed stays), then `References` and the full APA reference of each reading copied, alphabetical, each once (`formatApa`, same as the Readings page's APA copy). A reading that no longer exists copies as its label. Meeting and note: their label as written (the meeting heading with its date, the note title); no `copy` hook.
- **Paste back.** In the editor, an HTML flavour with our marker pastes as the original Markdown, so chips come back (and no reference list). Anything else, and Cmd-Shift-V (text only), pastes the readable text.
- **Where.** `src/shared/entity-copy.ts` (pure conversion and marker, tested), `src/renderer/src/editor/live-copy.ts` (copy and cut handler; the clipboard first gets the labels synchronously, then the full text once the providers answered), `live-paste.ts` (restores chips). A provider may define `copy(key, label)` in `EntityProvider`; the editor reaches it through `EntityHost.copyPart`. A new kind with nothing to add needs nothing.
- **Checked.** Unit tests; built app on a scratch library: Cmd-A, Cmd-C gave the expected text, reference list and HTML marker (`readText`/`readHTML`), Cmd-V restored the chips. Cmd-Shift-V: Playwright's key events do not reach `before-input-event`, so the chord itself was not driven; the message it sends was, and pasted the readable text with no chips. Dev mode not driven.

## Chip punctuation and holiday precedence (2 Oct 2026)

- **A full stop never hangs after a chip.** CodeMirror puts an empty `img.cm-widgetBuffer` on each side of a widget, and a line may break at either side of an image, so a `.` or `,` right after a mention could wrap onto a line of its own. Found with a width sweep in the built app (one hanging dot in 50 lines). A word joiner (U+2060) beside the image did not help (Chrome still breaks at the image); taking the buffers beside a chip out of the flow (`position: absolute`, `LiveEditor.module.css`) did, and typing, arrow keys and Backspace around chips behave as before (checked with real keystrokes). Plain words and punctuation were never affected.
- **Holidays beat leave, whatever the order.** `addTimeOff` replaced any date already listed, so adding leave over Easter turned Good Friday and Easter Monday 2026 into leave. A date now keeps the higher-ranked of its old and new type: public, then university, then leave (`RANK` in `src/shared/tracking/timeoff.ts`; tested for all nine pairs and for a leave range over a holiday week). This replaces "adding a date already listed changes its type" in "Time off page". Editing a day is done in the list the way People rows are edited (2 Oct 2026, replacing an earlier dropdown-and-date-field version): small **Edit** and **Remove** buttons per row; Edit turns the Date and Type cells into a date field and a select with **Save** and **Cancel** (Enter saves, Escape cancels). `editTimeOff` (`src/shared/tracking/timeoff.ts`) moves the day, changes its type or both in one step; it sets the type directly, outside the precedence rule (the one way to turn a holiday into leave), and refuses a weekend, a date outside the year or one already listed, with the notice shown under the date field. Status stays Taken (before today) or Booked (today or later), matching the Booked card above.
- **Time off review fixes (2 Oct 2026).** Opening a row for editing no longer moves the table: fixed columns (`table-layout: fixed`) and a fixed row height, so the date field and select replace the text without a jump (checked in the built app: identical widths and 56px rows before and after). Adding days that are all listed already (same or stronger type) is refused as `listed` ("Those days are already listed.") instead of closing the form with nothing changed; a range with some new days still goes through. Refusals use the shared `FieldError` (small red text under the field, wrapping in its cell, taken from People) instead of `Notice`, which is for page-level messages and was a wide bordered box in a no-wrap cell. **Add** now follows People: the header button is disabled while the form is open and the form has its own Cancel (plus Escape), rather than the button toggling the form.
- **Data repaired.** In `time/research/2025-26.json`, 3 Apr (Good Friday) and 6 Apr (Easter Monday) 2026 are public holidays again. The 2026–27 year already holds the same pair for 2027, which is how the dates were identified. The other April leave days were right.

## Unlisted allowance days (2 Oct 2026)

- **The year's plan is the weekdays less the whole allowance (40), whether or not the days are listed.** Days listed as time off still come off the plan in their own week. The rest (`unlistedAllowance`: allowance minus listed weekdays, never below zero) comes off the running plan on the year's last day (`unlistedCredit` in `src/shared/tracking/plan.ts`), so the balance is not ahead all year. A day never taken is therefore credited (7:30) on top of the hours worked, with no manual entry. It is not taken out of any week's own plan (that would go negative), only out of `yearTotals` (plan, balance, whole plan) and the last week's running `yearBalance`.
- Weeks with days typed in the old sheet still ignore the list; the remainder counts listed dates only. 2025–26 lists 39 days, so one day (7:30) comes off at the end, which replaces the 7:30 the user had added by hand on 20 Sep 2026 (that 450-minute entry can be removed; the balance is unchanged). The importer's check adds the same credit to the sheet's balance.

## Find bar and picker feedback (2 Oct 2026)

- Find: a click in the note or Escape in it closes the bar; Cmd-F while it is open puts the cursor back in the find field (selected). `FindBridge` gained `close` and `focus`; the bar's own state is cleared by the controller's `onClose`.
- `@` picker: it used to follow the caret and flip above or below as results changed height, and a list that scrolled under a still pointer moved the highlight. Now anchored at the `@`, side chosen from the fixed 360px maximum, hover ignores events without pointer movement. Checked in the built app: the list's position is identical before and after typing more.

## People pickers and time fields (2 Oct 2026)

From the user's Meetings notes, 2 Oct 2026.

- **`PeopleField`** (Meetings attendees, Training leads): one search box, "Search or add". The list under it is the people not yet added, in the People page's order (`sortPeople`: you first, then alphabetical) and filtered as you type (`matchPeople`: every word, accents and case ignored, name or initials). When what is typed is not an existing person, an `Add "name"` row ends the list, so search and add-new are one step. Arrows and Enter work from the box; the old "Someone new" form is gone.
- **TODO owner menu**: opens with the meeting's attendees (alphabetical, you first) and "No owner". Typing no longer closes it: while it is open the editor sends printable keys to the menu (`TodoMenuBridge.type`/`backspace`), so they never reach the note, and the menu searches everyone (8 results at most, "not at this meeting" on the others). Backspace on an empty search closes it and acts on the note as before. `ownerOptions` now sorts each group.
- **`TimeInput`** replaces `<input type="time">` in Meetings, Training and the stale-timer end time: a text field, typed as `9:30`, `930` or `15:45`, no clock icon or picker. Up/Down steps the part the cursor is in: hours by 1, minutes by 15, each wrapping without carrying (`stepTime`); an empty time starts at 09:00. Only a complete time is reported; half-typed text stays on screen until blur. Pure helpers are in `time-input.ts` (the lint rule wants component files to export only components).
- Checked in the built app on a scratch library (keys typed for real, screenshots looked at); dev mode was not driven. The date field still has the native calendar icon.

## No blank lines around headings (2 Oct 2026)

Requested by the user. Markdown (CommonMark, GitHub, Obsidian) needs no blank line before or after a heading, so notes keep none: a new meeting is `## Summary`, `## Previous TODOs`, `## Notes` on consecutive lines (`NEW_MEETING_BODY`; Training likewise), carry-over writes its items straight under the heading and adds no blank line of its own, and the Training importer builds its bodies the same way. The editor draws the gap instead: a heading line has 1.1em above and 0.5em below (`LiveEditor.module.css`). Blank lines between paragraphs, lists and tables still matter and stay. Existing notes are untouched until `npm run tidy:headings` is applied (`src/shared/heading-spacing.ts`: removes only blank lines that touch a heading, outside code fences; skips Readings notes; dry run 2 Oct 2026 found 199 notes, 676 lines, none left alone). Applied to the real library the same day (199 notes, 676 lines, backups in `~/CentralCommand/backups/tidy-headings-*`); the new spacing has not yet been looked at in the running app.

**Heading after heading (2 Oct 2026).** The user's screenshot showed "Notes" directly above "Context: …" with a far larger gap than a heading above a paragraph: the first heading's 0.5em below and the second's 1.1em above added up. A heading line that directly follows a heading line (`.cm-line:is(.live-h1 … .live-h6) + .cm-line:is(…)`) now has only 0.2em above, so the gap is the upper heading's bottom padding plus a little. Checked by the build and lint only, not looked at in the running app; adjust the 0.2em if the gap is wrong.

## Action row controls share one height (2 Oct 2026)

The user's screenshot of a note page showed the Workspace select, the Group trigger, Pin and Delete at four different sizes: the Workspace `Select` was the only one at the default control size (14px text, 8px padding), and the others differed in line height. `Select` and `WorkspaceSelect` gained a `compact` prop (32px high, 13px text; not called `size`, which is a native `<select>` attribute), used on the note and meeting pages. The Group trigger and every direct child of the note page's `.actions` row are fixed at 32px. Checked by typecheck, lint and tests only, not looked at in the running app; the meeting page's row uses the same `compact` select next to its small Delete button.

## Top bar Start begins at once (2 Oct 2026)

The idle Start chip no longer opens a form first: one click starts an unnamed timer (`tracking.start('research', '')`) and the running chip opens its popover on its own (a module flag, `openAfterStart`, read once by the new chip). While the running task has no name the popover shows the task field (type a new name, or pick an earlier one from the suggestions) with a Name button, and the week's recent names as one-click choices; either renames the running task's day blocks (`renameTask`, so a name already used today merges). Named timers keep the Stop and Switch-to popover. The old idle Start popover is gone. Checked in the built app on a scratch library (click Start, type, Enter); dev mode and picking a recent name were not driven.

## Work meetings feedback round (5 Oct 2026)

The user's review of Work's Meetings: three items.

- **A series can be created in every workspace, as in Training.** The Series field on a meeting is the shared `ComboField` (pick from the list or type a new name) instead of a fixed `Select`. The list is `seriesOptions(rows, fixedSeries(workspace))`: Research's four fixed series plus any others found; Work has no fixed list, so it offers only series it already has. A series exists once a meeting has it (the landing page's cards come from the files, as before). Typing would rename the file at every keystroke (the file name is `date + series`), so the text is a draft in `MetaFields`; the meeting gets it when a listed series is chosen, or on blur (a blank draft reverts). `ComboField` gained an optional `onBlur`. **Found only by driving the built app:** the main process (`checkPatch` in `meetings-store.ts`) still refused any series not in `SERIES` ("Unknown series"), so a typed series never saved. It now refuses only a blank or multi-line name. The meetings list filter uses the same per-workspace list, so Work's filter no longer offers "Supervision".
- **No skills in Work.** `tracksSkills(workspace)` (Research only) hides the Skills field, the table column, the "Any skill" filter and the per-skill hours breakdown. Files keep any `skills` they already have; nothing is removed.
- **Times work the same everywhere.** The user meant the Hours page's two-part entry, not a difference between workspaces (Meetings and Training already shared one field). `TimeInput` is now hours and minutes as separate parts, like `DurationField`: Tab, click and Left/Right move between parts, the focused part is selected, digits are typed over it (hours move on to minutes when complete), setting one part fills the other (09 / 00), Up/Down step as before (hour; quarter hour, no carry), Backspace/Delete empties the whole time. It no longer takes `className`; the stale-timer prompt on Hours uses it too. Checked in the built app with real keystrokes (typing `930`, Tab, stepping). Not checked: dev mode, Training's page, the stale-timer prompt.

The imported Work meetings still have no start or end times (the importer leaves them empty), so their Time and Duration columns show dashes and the hours strip counts them as 0; they have to be added by hand.

## Copy keeps formatting for Slack and Word (5 Oct 2026)

- **Problem.** Copying from the editor put the Markdown source on the clipboard; the HTML flavour (only there when a selection had mentions) was that same source as escaped text. Pasting into a Slack document gave `**bold**` and `* ` bullets, no formatting.
- **Fix.** Every copy and cut that has something to format now carries an HTML flavour rendered from the Markdown (`editor/live-html.ts`, a walk over the same GFM parse the editor uses): headings, bold, italics, strikethrough, code, links (bare addresses too), nested bullets and numbers, ticked boxes as ☑ / ☐, quotes, code fences, rules, tables. The text flavour stays the Markdown (mentions written out as before), so a plain-text target still sees Markdown. The HTML carries `data-cc-markdown` on every copy now, so pasting back into the app restores the exact Markdown.
- **Details.** A selection that is one plain paragraph (a few words from a line) is bare inline HTML with no `<p>`, so pasting mid-sentence does not start a paragraph. A selection with no formatting and no mention is left to the editor's own plain copy. Each line of a paragraph stays a line (`<br>`).
- **Checked.** Unit tests (`live-html.test.ts`); built app on a scratch library: Cmd-A, Cmd-C on a note gave `<h2>`, `<ul>` with a nested `<ul>`, `<strong>`, `<em>` and `<a href>` in `readHTML`, and the Markdown in `readText`. Not pasted into Slack itself (no Slack here); dev mode not driven.

## TODOs as checkboxes (5 Oct 2026)

- **`/todo` writes a checkbox** (`- [ ] **TODO(XX)**: `) on an empty line, `[ ] ` after a bullet or number already typed, and, typed in the middle of a line, a new checkbox line below it (the spaces before it go; a checkbox can only start a line). Inside a checkbox, a quote or a table row it stays plain `**TODO(XX)**: `. The parser already read checkbox lines as inline TODOs, so nothing else changed.
- **Tick from the Meetings landing** (`meetings.tickTodo`, `todo-boxes.ts`): the main process re-reads the file, ticks every unticked copy of that TODO (the list shows repeats once) and rewrites only those lines, under the usual hash guard. A TODO still written as plain text becomes a checkbox first; a line holding several TODOs is split into one checkbox each so each ticks alone, with any lead-in text kept on the first.
- **`npm run convert:todos [-- --apply]`** converts the existing plain-text TODO lines in Research and Work meetings (dry run by default, backs up each note, checks that TODOs read back the same). Applied to the real library on 5 Oct 2026: 250 lines in 53 notes, none failed the check (originals in `~/CentralCommand/backups/todo-boxes-2026-10-05T10-15-04-532Z`); a dry run now finds nothing. The Meetings landing's hint under the open TODOs was dropped (the checkboxes explain themselves). Old notes will show TODOs as unticked even where a later meeting ticked its carried copy; only the latest meeting of a series is listed as open.

## Spellcheck in the editor (5 Oct 2026)

- **What.** `LiveEditor` sets `spellcheck="true"` on its content (`live-state.ts`), so misspelt words get the system's red dotted underline. Chromium's own checker was already active on the Mac; the attribute makes it explicit and survives a change of default. Suggestions and "Add to dictionary" come from the existing right-click menu ("Right-click menu", `src/main/context-menu.ts`). The language follows the macOS spelling settings; the app has no setting of its own.
- **Checked.** Built app on a scratch library: typing "mispeled wrod" underlined both words and the attribute read `true`. The native right-click menu is not visible to the test driver, so look at it by hand. Mentions, links and Markdown markers are checked like any other text (no exclusions).

## Blank space beside the editor does not start editing (5 Oct 2026)

- **What.** Clicking the page to the right of a note's card, or the card's own padding, put the cursor in the editor. Chrome moves the caret to the nearest editable text when blank, non-editable space is pressed. `LiveEditor` now listens for `mousedown` on the document: a press outside the editor on a container with no text of its own (and not on a button, link, input or other focusable) is cancelled and the active element is blurred. Selecting text elsewhere, buttons and links are untouched.
- **Checked.** Built app on a scratch library, on a Readings notes page (the same shared editor): a click 10px right of the editor (card padding) and one 80px right (page) both left nothing focused; before the change both focused the editor. The All notes page itself was not driven.

## Work's Hours: weeks, contracts and months (5 Oct 2026)

Built from the user's description of how they are paid ("8 hours a week", "weeks run Friday through Thursday", "I invoice by month", "this contract started 1 May 2026 and ends 29 Oct 2026"). Plan: `docs/TIME_PLAN.md`, stage 10.

- **Work tracks time, not time off.** `createHoursModule('work')` is registered; there is no Time off module for Work (`TIME_OFF_WORKSPACES` is Research only) and its plan has no allowance (`allowanceDays: 0`). `defaultPlan(workspace)` gives Work `hoursPerWeek` 8:00 over all seven days (`WORK_PLAN`). Settings → Hours is one tab with a block per workspace (tabs are keyed by module id, so Research's instance draws both). The idle Start chip and the palette's Start timer follow the workspace being looked at; the timer is still one for the whole app.
- **A week aimed at as a whole** (`plan.weekAim`). The week's whole 8:00 counts against the balance from its first day (minus 8:00 on a Friday, because the user works in bursts), so there is no daily aim: `dailyAim` is null, a day's bar in the Week card is its share of the week's hours, and the typical-week and heat-map views have no daily aim line. `weekThrough` (the plan so far) returns the whole week once it has begun. Mutation check: dropping the `weekAim` branch fails the tests in `workspace-weeks.test.ts`.
- **Weeks begin on Friday for Work** (`weekStartDay`). Week navigation counts from the year file's own `start` (not `weekStartOf`, which is Monday), so `parseYear` accepts any date as a start; the heat map's row labels and the typical week start from the weekday the year starts on.
- **Contracts replace years for Work** (`hasContracts`, `src/shared/tracking/workspace-weeks.ts`). A contract is whole weeks from a Friday to a Thursday, its first and last day typed by the user (1 May to 29 Oct 2026 is exactly 26 weeks; the user confirmed Thursday 29 Oct, not Friday 30, is the last day). The year file holds `weeks` (absent means 52); `inYear`, `yearEnd`, `weeksOf` and `weekNumberOf` take it as an optional last argument and every tracking rule passes `year.weeks`. Work's years are the contract files themselves (`time/work/<start>.json`; `years()` lists the files, the current one is the file holding today), made by `store.createContract` (refuses a start that is not a Friday, an end that is not a Thursday, a longer one than 156 weeks, or an overlap; takes the previous contract's plan and carry) and changed by `setContractEnd` (never past a day that holds time, never into another contract). With no contract the timer refuses to start (`outside-year`) and the Work Hours page shows only the contract fields. The shared 52-week year (Settings → General) is not used by Work.
- **Invoice months** (`src/modules/hours/shared/months.ts`, the Month card). A week belongs to the calendar month its first day is in; a month therefore starts the day after the previous one ended and ends on the Thursday on or after the calendar month's last day (September 2026 is 4 Sep to 1 Oct, October 2 Oct to 29 Oct). A month's plan is its weeks' plans added up (4 weeks is 32:00, 5 weeks 40:00). The card shows one month at a time with arrows, a row per week (a click opens that week in the Week card), a total row, and "x of y · z to go" (or "over").
- **Not done:** the user's previous contract (1 Oct 2025 to 31 Mar 2026) is being imported in stages (see the update below and `docs/ROADMAP.md`). Tasks (a task as an entity with `@` mentions) wait for the user.
- **Update, 5 Oct 2026 (import stage 1): a contract's weeks begin on its own first day, any weekday.** The user's previous contract (1 Oct 2025 to 31 Mar 2026) runs Wednesday to Tuesday (their activity logs: "the four full weeks between March 4 and March 31"), the current one Friday to Thursday. `weekStartDay` is gone; `contractWeeks(start, end)` only asks for a real start and an end that makes whole weeks (`bad-start` now means "not a date"). Nothing else assumed Friday: weeks, the Month card and the heat map already counted from the year file's own `start`. The month rule is unchanged and holds for any weekday: a week belongs to the calendar month its first day is in, so a month ends on the last day of the week that holds (or ends after) the calendar month's last day (the previous contract's October is 1 Oct to 4 Nov). Checked in the built app on a scratch library: a Wed-to-Tue contract is added (an end of Wed 1 Apr is refused), 26 weeks, March is 4 to 31 Mar, planned 208:00 (the logs' total). Dev mode was not driven.
- Checked in the built app on a scratch library: the empty Work page, adding the contract (an end of 31 Oct is refused: Add stays disabled), the Week and Month cards, the previous month, Charts and weeks over 26 weeks, Settings. Dev mode was not driven. One crash found this way: the page drew with no year (`useWeek` asked for the week of ''), fixed in `resolveWeek`.

## Work history import: findings and decisions (5 Oct 2026)

Goal: the user's past Work data in the app (`npm run import:work-hours`, modelled on `import:hours`). Stages 1 (contracts start on any weekday, see "Work's Hours" above), 2 (a client on Work entries and the timer, see "Stage 2") and 3 (the importer, a dry run; see "Stage 3", both at the end of this section) are done. All four stages are done: stage 4 (apply) ran on 5 Oct 2026, see "Stage 4" at the end of this section.

**The sources.** (1) The user's Google Sheet "Time Tracking" (one tab, columns Date, Hours (decimal), Accounted (Yes/No), Client (always Luminos), Team (Impact or Teaching), Activity; newest first; columns G to O are scratch and a week panel, ignore them; read it with `readXlsxSheets` from `src/modules/training/main/import/xlsx.ts`, which takes a Buffer; dates are Excel serials). It is one running log, 6 Oct 2025 to 5 Oct 2026, 208 rows on 102 days, with no contract dates and no invoice totals. The export URL (`.../export?format=xlsx`) works for a link-shared sheet; ask the user for the link, it is not stored here. (2) The monthly activity logs, Word files in `/Users/ernesta/Consulting/Luminos/Documents/Activity Logs/` (`2025 10` to `2026 09`, no April); each states its period ("the four full weeks between March 4, 2026, and March 31, 2026") and lists activities with hours; from May 2026 they have Impact and Teaching & Learning sections and a "Both teams – Total".

**The user's rules (their words, 5 Oct 2026).**

- Total hours per contract must be exactly what the activity logs show. Day and week hours are the sheet's.
- Months follow the rule already built: the contract month includes the calendar month's last day (a week belongs to the month its first day is in). Months need not match the logs' own periods.
- Sheet rows go on the day the sheet gives, except items that fall outside the contract's dates or that the logs put in the other contract: those move to the date we think they belong to. Totals per contract match the logs; months do not have to.
- Contract dates are fixed. Old: Wed 1 Oct 2025 to Tue 31 Mar 2026 (26 weeks, Wed to Tue). Current: Fri 1 May to Thu 29 Oct 2026 (26 weeks, Fri to Thu). The current one was not in `~/CentralCommand/time/work/` on 5 Oct (no Work folder at all): the importer creates both. Both have the 8:00 a week plan.
- Clients, not teams: the two clients are Impact and Teaching & Learning (the sheet's "Teaching"); the Luminos column is dropped. Old contract rows are all Impact.
- Import accounted and unaccounted rows (accounted only means invoiced).
- One entry per sheet row (an adjust: date, label = the Activity, minutes, client), several a day; not a day note. Hours are quarter hours; the one exception, 2.15 on 5 Oct 2026, is 2.25 (the user's typo).

**Reconciliation, sheet against logs (dry-run findings to confirm).** Old contract: logs 32, 32, 40, 40, 32, 32 = 208.0 h; the sheet has 210.5 h inside the contract dates plus 1.5 h on 1 Apr (outside). The 4.0 h difference is the user's moved work: the "Classroom Observation Data codebook and cleanup" rows of 26 Mar (1.75), 27 Mar (0.75) and 1 Apr (1.5) were invoiced in the May log (its line is exactly 4.00 h), and removing them leaves March's codebook rows at 6.75 h, exactly the March log's line. Plan: those three rows move to Fri 1 May 2026. Current contract: logs 105.0 h through 1 Oct (May 16.75, June 40, July 22.75, August 9.25, September 16.25); the sheet has 98.75 h, so after the 4.0 h move 2.25 h of the logs is not in the sheet (the May log has a "Meetings and emails, synthesizing notes, follow up, planning next steps 2.75 h" line with no matching May rows). To decide with the user from the dry run: where those 2.25 h belong (they asked to see the rows first; an entry dated in the May log's period, 1 to 28 May, is the proposal). 2 to 5 Oct 2026 (9.25 h) is in no log yet and is imported as the sheet has it. Per-month totals differ from the logs because the user spreads hours between months (against the logs' periods: Dec -8, Jan +17.5, Feb -9.5; Jun -10.5, Jul +10.5); that is accepted, only contract totals must match. The logs' wording is summarised, so only totals can be reconciled, not activities.

**Safety checks for the importer (as `import:hours`).** Dry run by default; never overwrite a contract that holds data; read the result back through the app's rules and compare per-contract totals with the logs and the sheet (and per week and per month, reported); list every moved row, every row outside a contract and every difference; a contract that fails the check is left out as ATTENTION; `--apply` only when the user asks and only with the app closed; test on a scratch library (`CENTRAL_COMMAND_HOME`), never the real one.

**Stage 2 (5 Oct 2026): a client on Work entries and the timer.**

- **Clients, not teams.** Work's clients are Impact and Teaching & Learning (the sheet's Luminos column is dropped). The list is the plan's `clients` (`Plan.clients?: string[]`, in `WORK_PLAN`), so a new contract starts from the previous contract's list like every other plan field, and Settings -> Hours edits it with the existing `setPlan`. Research has no `clients`: nothing about clients is saved or shown there, and a client asked for is ignored (`resolveClient`). Not in app Settings on purpose: the importer and any later contract need no second place to look.
- **Entries.** `Session.client?` and `Adjust.client?`, optional text. The parser keeps them and refuses a non-text one; the plan's list must be non-empty names, trimmed, unique ignoring case (at most 20). Older Work time with no client stays without one (shown as "No client" until chosen) and the Month card lists it last.
- **A task is a label and a client.** The same label for two clients on one day is two rows (`dayRows`, `setTaskMinutes`, `renameTask`, starting the same task again all match on both; `sameTask` in `timer.ts`). Without this a typed total would have merged two clients' hours into one adjust. The API takes the client as a trailing optional argument (`start`, `setTaskMinutes`, `renameTask`, `addTime`) and there is one new call, `setClient(workspace, year, date, label, from, to)`, which moves a row to another client (a client on the plan's list only; moving into a row of the same name merges them). Retyping a row's time now keeps the row where it was (before, its adjust went to the end of the list, which was invisible while a label was unique).
- **Default client.** An entry made without choosing gets the client of the latest entry, else the plan's first (`defaultClient`). So the idle Start chip, which starts at once with no name, needs no extra step, and the Today form, Add and the popover show the same choice. A name not on the list is refused (`bad-client`); the store never silently invents a client.
- **UI.** Today and Add have a Client menu (the shared `Select`) before the time; every task row has a compact client menu (Today and the Week's days) that moves the row; the timer popover has one for the running task and "Switch to" shows each row's client. No client column or menu appears where the plan has no clients.
- **Month card.** Under the weeks, one "<Client> – Total" row per client with time in that month, then the month's total row as before. Clients are counted over the month's own days (`minutesByClient`), so they add up to the month. The user's "Both teams – Total" is the existing month row (labelled with the month's name); it was not renamed because clients are not always two.
- **Settings.** Clients as chips with an "New client" field and Add (Enter works); the last client cannot be removed. It edits the current contract's plan; older contracts keep their own list, and entries keep the name they were saved with even if it is later removed.
- Tests: `clients.test.ts` (defaults, refusal, rows, set client, per-client sums, file format), store tests (the client reaches disk, the plan's list changes, Research stays clientless), months and plan-settings tests. Mutation check: eight deliberate breaks (no list check, no latest-client default, label-only matching, month range ignored, adjusts matched on label only, client dropped from new entries, parser not checking a session's client, no default clients on Work) each failed at least one test; one survived at first (a session's client type was not tested) and now has a test.
- Checked in the built app and in dev mode on a scratch library (a 4-week Friday contract): the Client menu defaults to Impact and then to the latest, typed time and a timer for each client, the same label twice as two rows, the popover's client menu and Switch to, the Week's Add, the Month card's subtotals, Settings (add and remove), and Research has no client menu. No console errors. Not driven: changing a row's client by its menu in the browser beyond the no-op case (covered by unit tests).

**Stage 3 (5 Oct 2026): the importer, a dry run (`npm run import:work-hours -- --sheet <xlsx> --logs <folder> [--detail YYYY-MM] [--apply]`).** Built and dry-run against the real sheet and logs; `--apply` exists and was not run (the write path is covered by a unit test on a temporary folder, not by running the script).

- **Modules** (`src/main/tracking/import/`): `work-sheet.ts` reads the "Time Tracking" tab (a row that does not fit is a problem, never skipped; scratch text in columns G onwards is listed, not read); `work-logs.ts` reads the Word logs after macOS's `textutil` (period, lines, section totals; a log whose lines do not add up to its stated totals is a problem; the newer logs have their hours with no "h" under a "Time (h)" heading, which a first version missed and the real run caught); `work-import.ts` is the plan. The script only reads, prints and (with `--apply`) calls `createContract` then `importYear` for each contract that passed.
- **Rules built in as constants** (change them only when the user says): both contracts (`WORK_CONTRACTS`; the old one forces Impact and refuses a Teaching row), the three moves (`WORK_MOVES`: the codebook rows of 26 Mar 1:45, 27 Mar 0:45 and 1 Apr 1:30, all to Fri 1 May; each must match exactly one sheet row, or every contract is left out as the sheet changed), the 2.15 to 2.25 correction (`WORK_CORRECTIONS`), and `WORK_LOG_ADDITIONS` (empty: time the logs state that the sheet lacks, once the user says where it goes). Any other row that is not a quarter hour is a problem. A row that falls in no contract and was not moved is left out and listed. Accounted and unaccounted rows are both imported. One adjust per row (`import-001`…), a day's rows written from the bottom of the sheet upwards (the sheet is newest first).
- **The check.** Each contract is read back through the app's own rules (`parseYear`, `weeklyMinutes`, `monthsOf`, `minutesByClient`, `yearTotals`) and compared with the rows (total, every week, months, each client, entry count, 26 weeks, last day, plan 208:00, nothing with no client, nothing outside the contract) and with the logs: the contract's hours up to the last log's last day must equal the logs' stated total exactly; the hours after it (2 to 5 Oct, in no log yet) are reported. A contract that fails is left out as ATTENTION but its report is still printed. A log that cannot be read fails only its own contract; an unreadable sheet fails both.
- **Reports** (none fails a contract): per log period, the sheet's rows on those days against the log (and per client where the log has sections); per month of the contract (the Month card's rule) against the log of the same name; per week against the 8:00 plan; the moved and corrected rows; accounted against not.
- **The dry run on the real files (5 Oct 2026).** Old contract: imports, 128 entries, 208:00 (the logs' 208:00), all Impact. Per log period it differs by -8:00 (Dec), +17:30 (Jan), -9:30 (Feb) as the user said; the codebook move makes March exactly 32:00. Current contract: ATTENTION, 80 entries, 112:00 (Impact 60:15, Teaching & Learning 51:45; 9:15 of it is 2 to 5 Oct); up to 1 Oct it has 102:45 against the logs' 105:00, **2:15 short**. (The 2.25 h in the findings above is the 2:15 here: 2.25 h is 2 h 15 min.) By client, in the May log's period only: Impact is 0:45 short (log 15:15, sheet 14:30) and Teaching & Learning 1:30 short (the log has "Document automation background review 1.50 h"; the sheet has no Teaching row before 4 Jun). June is -10:30 and July +10:30 (the user's spreading), and August and September match the logs to the minute.
- **The missing 2:15, answered (5 Oct 2026; the user said best guesses on a day that already has work).** `WORK_LOG_ADDITIONS` now holds two entries, both guesses at the date: Impact 0:45 "Meetings and emails, synthesizing notes, follow up, planning next steps" on Thu 21 May (the day of the Matthew meeting; the May log's meetings line is 0:45 more than the sheet's meeting rows) and Teaching & Learning 1:30 "Document automation: background review" on Thu 28 May (the log's whole Teaching section; the sheet has no Teaching row before 4 Jun). With them both contracts pass and the May period matches its log per client. The month card's May is 22:30 (the user's spreading, as before).
- **Sheet downloaded again later on 5 Oct (210 rows).** The user added three rows for 5 Oct (0:30 developer contract preparation, 1:00 developer communication; and the two 2:15 rows, the 2.15 typo now typed as 2.25 in the sheet, so `WORK_CORRECTIONS` finds nothing and is left in, harmless). Final dry run: both contracts pass, no row outside a contract, nothing needing attention. Old contract: 128 entries, 208:00, all Impact. Current contract: 84 entries, 116:00 (Impact 61:00, Teaching & Learning 55:00; 105:00 up to 1 Oct equals the logs, 11:00 on 2 to 5 Oct is in no log yet; 5 entries, 11:00, are not accounted). If more rows are added before stage 4, download the sheet again and re-run the dry run first.
- Tests: `work-sheet.test.ts`, `work-logs.test.ts`, `work-import.test.ts` (rows, clients, moves, quarter hours, typo, outside rows, per-client differences, a failing total, a log that cannot be read, the user's real contract dates and moves, and writing to a temporary folder without overwriting). Mutation check: eight deliberate breaks (no log-total check, moves ignored, quarter check off, unaccounted rows skipped, correction off, day order reversed, outside rows imported, the Teaching-in-the-old-contract guard off) each failed a test; a ninth (not forcing Impact) is equivalent to the guard and survives by design.

**Stage 4 (5 Oct 2026): applied to the real library.** The user said go with the app closed (`pgrep` found no Central Command or `electron-vite` process; the only Electron process was ClickUp's).

- **Before.** The sheet was downloaded again (still 210 rows, 321:45 as typed) and the dry run was identical to the last one: old contract 128 entries, 208:00, all Impact; current 84 entries, 116:00 (Impact 61:00, Teaching & Learning 55:00); both pass, nothing outside a contract. `~/CentralCommand/time/` held only `research/` (no `work/` folder), and was backed up first.
- **Written.** `npm run import:work-hours -- --sheet … --logs … --apply` wrote `time/work/2025-10-01.json` and `time/work/2026-05-01.json`. The printed report was identical to the dry run's apart from the "Wrote" lines. The two Research year files are byte-identical to the backup.
- **Read back from the JSON, independent of the importer's check.** Entry counts, totals, per-client totals and every week match the dry run (weeks with no entries are the 0:00 ones); no sessions; plan 8:00 a week with `clients` set.
- **In the built app** on a scratch copy of the result (`CENTRAL_COMMAND_HOME`), looked at in screenshots: the old contract shows 208:00 of 208:00 planned, balance 0:00, Wed to Tue weeks ending 25 to 31 Mar, 26 weeks in Charts and weeks; the current one shows 116:00, balance −68:00, week 23 at 11:00 and Today 6:00 (the four 5 Oct rows). The Month card, stepped from October back to May, matches the dry run to the minute (May 22:30, June 23:45, July 33:15, August 9:15, September 16:15, October 11:00) and its client rows add up to each month. No console errors.
- **Afterwards.** A dry run now finds both contracts already holding data and writes nothing. Rows the user adds to the sheet later are not picked up (the importer never overwrites); new Work time goes in through the app.

## No explanatory helper text on pages (5 Oct 2026)

The user: the interface has to be intuitive and not need explanations. Removed the quiet sentences that explained how a page works: the footers under the Meetings, Training, Notes and Reading lists tables ("Newest first. Click any row…", "A dash means nothing was recorded", the Supervision series hint), the `in:` hint on the search results page, the Topics panel paragraph, the archived-people note on the People page, the skills note in the Hours strip and "Pin a note from its own page" (an empty Pinned section now shows only its heading). `LandingHint` was deleted as unused. Kept: empty-state messages, "Cmd-click to open" on the hover card and the one-line help under Settings fields. Do not add a new explanatory sentence to a page; if a feature needs one, change the feature or its label. The `.hint` and `.note` CSS rules left behind are harmless.

## Attendees: me first, others alphabetical (5 Oct 2026)

The user: in meeting notes, "me" is always the first attendee, even when selected later; the others are alphabetical. `orderNames` (`src/shared/people.ts`, next to `sortPeople`, same rule) sorts the names: me first, then `localeCompare`; a name not in the people list sorts with the others. Meetings' `MetaFields` applies it twice: to the chips it draws (so existing meetings show in the new order at once, without rewriting their files) and to the list saved on every add or remove (so a meeting's file is written in that order the next time its attendees change). Training's `TrainingMetaFields` does the same for leads (asked for right after, same day). Test: `orderNames` in `people.test.ts`.

## Untouched pages delete without asking (5 Oct 2026)

The user: when a new note, meeting, training entry (or similar) has nothing typed into it, Delete should not show the confirmation. `isUntouchedBody(body, templateBody)` (`src/renderer/src/components/untouched.ts`) is true when every non-blank line is one of the template's own headings (`NEW_NOTE_BODY`, `NEW_MEETING_BODY`, `NEW_TRAINING_BODY`, `NEW_LIST_BODY`). The four pages (`NotePage`, `MeetingPage`, `TrainingEntryPage`, `ReadingListPage`; Reading lists added on our own judgement) call `confirmAndDelete` directly when it holds, and open `DeleteDialog` otherwise. Notes also need an empty title and not to be pinned; lists an empty title; training an empty title or "Untitled". Meetings look at the text only, so a meeting with TODOs carried over under `## Previous TODOs` still asks. Anything typed, including a custom heading, still asks. The delete itself is unchanged: the file goes to the macOS Trash. Test: `untouched.test.ts`.
