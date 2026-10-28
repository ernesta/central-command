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

**Emptying the last bullet (23 Oct 2026).** Backspace on an empty top-level item removes the marker and leaves the cursor on that same line; the blank
line that keeps a paragraph from running into the line above is added only when the item has text (an empty line already separates). Found by using the app
(an empty fifth bullet; the cursor dropped a line). A bare `-` under a paragraph is not a list item in the parse, so that case is the ordinary Backspace.

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
- **New meeting / New entry create the item at once** and open its page (no pop-up): a meeting with only today's date, no series (changed
  19 Oct 2026: it was a Supervision meeting; see "Meetings, trainings and the timer"); a training named "Untitled" for today with the title selected.
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
- **`in:` and the other modifiers: see "Search modifiers" below** (they replaced the first `in:`, `parseSearchQuery`, which let
  `in:meetings in:notes` search both and left an unknown `in:` word in the text silently).
- **A "See all results" link** at the bottom of the window (shown once any group reaches its cap of six) **grows the same window**
  (wider, taller, up to 40 a kind, with a count) rather than opening a page; since 19 Oct 2026 the `/search` page is gone (see
  "Refinements" under "Search modifiers"). It was a full page with its own field until then.
- **How results are ranked (`SEARCH_GROUP_ORDER` in `src/shared/search.ts`).** There is no relevance score across the whole app: a
  match is either "in the title" or "in the text", and beyond that, order is two simple, fixed rules, deliberately, so this is easy
  to reason about and to change later if it stops being good enough:
  1. **Which group, fixed:** Actions (when any command matches), People, Notes, Meetings, Tasks, Training, Readings, Reading lists. This is why searching
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

### Search modifiers (19 Oct 2026; `docs/SEARCH_MODIFIERS_PLAN.md`, all five stages built, pushed and installed the same day)

The design is the user's (Slack-style, one session, answered the same day). Code: `src/shared/search-query.ts` (the registry
`MODIFIERS`, `parseSearch`, `planSources`, `resolvePeople`, `passesFilters`), `search-dates.ts`, `search-complete.ts`; each source's own
filtering sits beside its `renderer/search.ts` (tasks: `tasks/shared/search-filters.ts`). A search is `{ text, phrases, filters[], notices[] }`.

- **AND only, no OR, no commas.** Different modifiers AND, and so does a repeated one (`tag:a tag:b` needs both). **This replaces the old
  `in:meetings in:notes` (both sources).** Two different values of a modifier an item has one of cannot match: "No item has two sources."
  (also statuses, priorities, due dates, lists, series, workspaces, days, periods; `in:task in:tasks` is one value). It searches nothing and the
  notice stands in for "No results.". The plan named `in:`, `status:`, `priority:` and `series:`; the rule ("an item can only have one value")
  was applied to the others that are likewise one-valued.
- **Only the listed values, case and accents ignored, nothing else.** No prefixes (`in:tr`), no `priority:1`, no `Oct 3`. A known modifier
  with a value it does not take shows a notice naming the accepted values and leaves its text out of the search (the rest still runs);
  an unknown `name:value` stays in the text with "Not a filter: …"; a modifier typed with no value yet is ignored; an address
  (`https://…`) or a time (`10:30`) is not a modifier. `with:`/`by:` need a name or initials from the people list (`people-aliases.json` is
  not used); one that names nobody gets a notice and is left out.
- **`in:` has tasks** (`task`/`tasks`), and Tasks is in `SEARCH_GROUP_ORDER` after Meetings. The search that started this,
  `experiments in:task`, finds tasks mentioning "experiments".
- **`workspace:` never narrows to the sources that have the field.** Sources carry a workspace (`Searchable.workspace`; a module's own
  workspace, so the Work and Life copies of notes and tasks are Work's and Life's): `workspace:work` keeps Work's items **and every
  source with no workspace** (people, readings, the commands). `-workspace:work` leaves Work's out and keeps the rest. Readings are
  unscoped (`searchUnscoped` in the manifest) until the user tags them with a workspace (`docs/ROADMAP.md`, "For the user").
  Reading lists are Research's.
- **A negated modifier is NOT(positive match)** and never narrows to the sources that have the field: `-tag:x` keeps meetings, a task
  with no due date matches `-due:today`, `-in:readings` leaves only readings out. A positive modifier a source lacks (or a value it does
  not take: `status:done` on a reading) leaves that source out. The commands answer plain words only: any modifier (positive) or no
  words leaves them out; a plan of Training (`planHits`) has none of the fields, so a positive filter leaves it out.
- **Values, read from the app.** Task status uses the app's own labels, **`"to do"`, `"in progress"`, `done`, `open`** (the plan said
  "not started"; the app says "To do", and the plan's own rule is "as labelled"). Readings: `read`, `"to read"` (their pills say Read and
  To Read; an unset reading is neither). `priority:` P1/P2/P3 are the marks the table shows (high, normal, low). `overdue` is an open
  task due before today (a done task is not overdue); `week` is today plus six days.
- **What `with:` and `by:` look at.** Meetings: attendees; training: the leads (`by:` the same as `with:`); readings: authors (the same name,
  or the same family name and given initial: Zotero often holds only "Rastle, K."); notes: the person's full name in the note's text (chips
  are written with the full name since 12 Oct 2026; the notes index holds no mentions, and adding one was not worth a migration).
- **Dates.** `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, `today`, `yesterday` for `before:`/`after:`/`on:`; `during:` takes a month, a year, today,
  yesterday and this/last week (Monday to Sunday), month, year. The item's date is: a note's last-edited day, a meeting's and an
  entry's date, a task's due date, a reading's year. A reading covers its whole year, so `before:`/`after:` need it wholly before/after
  and `on:`/`during:` wholly inside (`during:2026-05` never matches a 2026 reading). An item with no date (a planned meeting, a task
  with no due date, a reading with no year) matches no positive date modifier.
- **Quoted phrases** (`"effect size"`) must be found as written, in the same text the words are looked for in (a reading's title,
  authors, tags and notes).
- **The completion list** (`search-complete.ts`, `useSearchCompletion`, `CompletionList`): after two letters of a modifier's name, or `-`
  and a letter, it lists the names; after `name:` it lists the values, from the fixed lists and the user's own data (people with their
  initials, task lists and `list/sublist`, task and reading tags, the skills list, series of meetings and training), read once when the
  window opens. A list of names highlights nothing (so Enter still opens a result for a plain word such as "with"); a list of values
  highlights the first. Arrow keys move, Enter inserts the highlighted one, Tab inserts the highlighted one or the first, Escape closes
  the list (and only the list: the next Escape closes the window), a click picks without taking focus from the field. Inserting a value
  adds a space; a value with spaces is quoted. Same list in the Mod-K window and its grown form (under the help row, above the results).
  Listed in Settings ("Complete a search filter").
- **Notices** show at the top, under the help row (since the refinements; they used to sit among the results). They are hidden while the completion list is open: a notice about the word still
  being typed (`with:c`, "needs a name from the people list") only flickered. _Found by driving the app._
- **Not built, by decision:** `is:`, `title:`, `type:`, `mode:`, commas, `from:`/`@`, prefixes, academic years or contracts in dates.
- **Checked in the built app and dev mode (StrictMode), light and dark, on a scratch library:** `experiments in:task`, status, priority,
  overdue, `with:` by initials, phrases, `has:todos`, readings by read state, `during:"this month"`, `workspace:work`, `-in:readings`, each
  notice, the completion list by keyboard (two letters, Tab, a value, arrows, Enter, Escape twice) and by mouse, and the same on
  `/search` reached from "See all results" (that page no longer exists; see "Refinements").
- **Mutation-checked:** `every` to `some` in `passesFilters`, dropping the negation, `workspace:` ignoring unscoped sources, a negated
  modifier narrowing, `-in:` ignored and the repeat check off each fail tests.

#### Refinements (19 Oct 2026; `docs/SEARCH_REFINEMENTS_PLAN.md`, built unattended, pushed and installed)

All of it the user's decisions from using the built feature. Code: `search-query.ts` (`isSearch`, `valueAccepted`), `search-complete.ts`
(`isFinishedValue`, `modifierAt`, `ghostFor`), `search-help.ts` (the table), `search-chips.ts` (`splitChips`, `insertPaste`,
`backspaceRemovesChip`), and in `renderer/src/shell/`: `ChipInput`, `useChipQuery`, `ModifierChip`, `SearchHelp`, `SearchSettings`, `GlobalSearch`.

- **Order, top to bottom:** field (chips and text), the grown window's count and × (only when grown), one help row for the modifier being
  typed, the notice, the completion list, the results. The help row never sits below the results.
- **What counts as a search (`isSearch`, `ParsedSearch.plainWords`).** Plain words, a phrase, or a modifier with an accepted value. Not a
  search, so never "No results.": a modifier with no value (`in:`), an unknown one (`person:`, whose token is in `text` but is not a
  plain word) and a known one with a value it does not take (`in:home`). They show the help row or the notice. `SearchOutcome.searched`
  carries it to the window. `in:meetings workspace:work` with no text is a search.
- **No list over a finished value (`isFinishedValue`).** A quoted value with its closing quote, a value the modifier takes as it stands
  (`in:meeting`, `status:done`, a date), or the exact name, initials or label of one of the user's own values. `with:Ern` and
  `workspace:re` are not finished. (The old rule only closed the list when exactly one option equalled the text, so `in:meeting` and a
  quoted person still opened it.)
- **Chips (`splitChips`).** The field is chips plus a plain `<input>`: `name:value` words that are complete and valid move out of the
  text into chips once the typist is past them (a space follows), or at once for a paste ending the text, or on Tab. A plain input was chosen over a
  contentEditable because the caret, selection and input methods stay the browser's: IME composition is not split until it ends,
  and Backspace is left to the composition. Consequences: chips sit before the text, so a query's modifier order is not kept (they
  AND, so it does not matter), and `with:`/`by:` become chips only for a person in the list (otherwise they stay text and get
  their notice). Backspace at the start of the field (nothing selected) removes the last chip whole; each chip has a × too (not in
  the Tab order). A negated chip shows its minus; quotes are not shown. Picking from the list, a help chip, Tab and paste all go through the same split.
- **Ghost text (`ghostFor`).** Exactly one completion, the caret at the end, and what is typed is the start of its label: the rest is
  drawn grey after the caret (a mirror of the input's text under it); Tab takes it (the same action as picking the one item).
  Escape, a second match, or moving the caret clears it. The list stays up beside it.
- **The table (`MODIFIER_HELP`, `summarise`).** One place for each modifier's hint, what it filters and its accepted forms; the
  completion list's hints, the help row and the Settings page read it, and a test checks it covers `MODIFIER_NAMES`. Fixed sets
  (`in`, `workspace`, `status`, `priority`, `has`) are chips that fill the value in when clicked; the rest are one muted line, and
  `with:`/`by:` also offer four people as chips. Settings → **Search** lists every modifier the same way.
- **The grown window replaces the page.** "See all results" sets `expanded` in the same dialog (same field, help, rows; 920px wide, up to
  40 a kind, headings with their counts, "N results · up to 40 of each kind"). Escape, a click outside and × close it, focus goes
  back to what had it, and the page behind never changed. Emptying the query keeps it open and lists the modifiers' names as chips
  (a state of the window, not a page). `/search?q=` is kept only as a redirect that opens the window with the query in it
  (`SearchRedirect`); `SearchResultsPage` is deleted. Found by driving it: clicking "See all results" took focus off the field, so
  the next keystroke (Cmd-A) selected the page; the button no longer takes focus (and the field is focused again).
- **Not changed:** the keys (Settings' "Complete a search filter" note now mentions grey text and chips); no "Did you mean" for an unknown modifier (declined).
- **Mutation-checked:** `isSearch` counting unknown tokens as words, `isFinishedValue` without its quoted, listed and fixed-accepted
  cases, `splitChips` taking an unterminated word and ignoring the people check each fail a test.
- **Driven** on a scratch library (a copy of the notes), production build and dev mode (StrictMode), light and dark, with real keystrokes
  and the clipboard: each state the plan lists, plus pick-with-Tab, paste (`by:"Kathy Rastle"`, mixed, plain), Backspace over chips, a
  help chip click, IME composition (Chromium's `Input.imeSetComposition`) with and without a chip in front, quitting right after typing,
  the focus ring on "See all results", Escape / outside click / ×.

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
- **The outline shows where you are (18 Oct 2026, the user's report: "doesn't show where I am").** The entry for the heading being
  read is highlighted (`--selected-bg`, bold, `aria-current="location"`). "Being read" is the last heading at or above a line 120px
  below the top of the window (`READING_LINE`, clear of the top bar), found from the editor's own line heights (`lineBlockAt`), so
  headings far off screen, which have no element, still count. The page scrolls (not the editor), so it listens to scroll in the
  capture phase and to resize, and re-reads when the headings change. A short last section that cannot scroll up to the line leaves
  the previous heading highlighted. Not yet driven in the app; the 120px is a guess to tune.

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
  - **26 Oct 2026 (the user's call):** the list no longer flips above. It opens 2px under the caret's line, left edge at the `@` (it may overlap the side column, the user likes that), and shrinks to the room below (at least 120px). Not yet driven in the app.

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
- **Contracts replace years for Work** (`hasContracts`, `src/shared/tracking/workspace-weeks.ts`). A contract is whole weeks from a Friday to a Thursday, its first and last day typed by the user (1 May to 29 Oct 2026 is exactly 26 weeks; the user confirmed Thursday 29 Oct, not Friday 30, is the last day). The year file holds `weeks` (absent means 52); `inYear`, `yearEnd`, `weeksOf` and `weekNumberOf` take it as an optional last argument and every tracking rule passes `year.weeks`. Work's years are the contract files themselves (`time/work/<start>.json`; `years()` lists the files, the current one is the file holding today), made by `store.createContract` (refuses a start that is not a Friday, an end that is not a Thursday, a longer one than 156 weeks, or an overlap; takes the previous contract's plan and carry) and changed by `setContractEnd` (never past a day that holds time, never into another contract). With no contract the timer refuses to start (`outside-year`) and the Work Hours page shows only the contract fields. The shared 52-week year (Settings → Hours → Year; moved there from General on 17 Oct 2026 so every date setting is on one tab) is not used by Work.
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

## Setting a start time fills the end (5 Oct 2026)

The user: when a start time is added, the end should change to match so an hour-long meeting or training takes little typing. `endFollowingStart(oldStart, newStart, end)` (`src/renderer/src/components/time-input.ts`) returns the end an hour after the new start (capped at 23:59) when the end is empty or still sits an hour after the old start; any other end is left alone, and clearing the start changes nothing. The second case matters because the hours part reacts to the first digit: typing 13 passes through 01, and without it the end would be stuck at 02:00. Meetings' `MetaFields` and Training's `TrainingMetaFields` send start and end in one patch. An hour was our choice (the user offered the same time or an hour later); Hours' timers have no separate start and end fields, so they are unchanged. Test: `endFollowingStart` in `time-input.test.ts`.

## Tasks: plan and mockup (5 Oct 2026)

The user is leaving ClickUp and wants a task manager in the app. Plan: `docs/TASKS_PLAN.md`; approved mockup (five rounds, clickable): `docs/design/tasks-mockup.html`. Nothing is built.

- **Build, not integrate.** Two-way ClickUp sync would be a throwaway second data model, so Tasks is a native module with a one-time import (`npm run import:clickup`, to be written). Local-first, **SQLite** (the Readings database, numbered migrations `tasks/NNNN_name`), not a file per task: queries, filters and search are SQL, and a later mobile sync needs a stable `uid`, `updated_at` and tombstones, which files cannot give.
- **The ClickUp CSV lists most tasks twice.** 2,193 rows, 1,211 unique `Task ID`s, the repeated rows identical. A first read took them for real and over-stated everything (tasks, 2,535 h instead of 1,612.8 h, "duplicate pairs"). The importer must de-duplicate by id first and fail loudly if two rows with one id differ. Lesson: check id uniqueness before counting anything in an export.
- **One level of subtasks.** 17 finished sub-subtasks (all under one course task) are moved up on import with their former parent's title in front. A subtask has a date only if given one (295 of 548 copied the parent's), keeps no priority, and surfaces in Today, Overdue and Upcoming nested under its parent only when it has its own date. Every imported date is kept as it is.
- **Recurrence** is "create the next one when I complete this", due the interval after the completion date (it drifts), with subtasks copied, so a series never has two open instances. The export has no recurrence rule; the importer lists the series it finds and proposes rules, never sets them.
- **Three priorities** shown as P1 / P2 / P3 badges (one colour family) in a sortable column. ClickUp 1 and 2 become P1, 3 and none P2, 4 P3. **No start date at all.** A task always has a list; the default due date is Today.
- **UI follows the app's patterns**: a landing with sections and list cards, All tasks with the usual filter row and a Segmented Open / Backlog / Done, one table (Status icon, Task with tags then repeat icon then subtask pill, List, Priority, Time, Due) for every list of tasks, and a task page with its details above the note. Clicking the status icon rotates it, Shift-click completes, right-click gives the menu. The row-stripe idea is used for a running timer and for the subtask thread. Add a task from every screen.
- **Why the rounds mattered.** Per-row optional items (time, a repeat badge, subtask counts) made the list ragged: fixed columns fix it, and anything that only some tasks have sits in one place after the title. Icons alone for status; priority as text badges after the icon sets (chevrons, flags, marks) were all read wrongly.

## Tasks: stage 1 write-up, store and rules (5 Oct 2026)

Built `src/modules/tasks/`: `shared/` (types, `recurrence.ts`, `views.ts`), `main/` (migration `tasks/0001_init`, `repository.ts`, `tasks-store.ts`, `snapshot.ts`, `register.ts`). No UI.

- **Rules are plain and tested.** `nextOccurrence` counts from the completion date; the views (`isOpen`, `isBacklog`, `landingSections`, `listSummaries`, `effectiveDue`, `taskTime`) take rows (a top-level task and its subtasks) so the renderer and the tests share them. A task appears once on the landing, under the first heading that fits (now Overdue, Due today, Due tomorrow, Soon, In progress), also when only a subtask's own date fits (then it comes with that subtask nested).
- **Trash is a column.** `deleted_at` hides a task and its subtasks; restore brings back only the subtasks deleted at the same moment. Hard delete exists only for a task that was never written in (`discardIfEmpty`), as with notes and meetings.
- **`series_uid`** was added to the plan's model so "only one open instance of a series" is a query, not a guess. Re-opening and re-completing a finished task starts nothing while the series has an open instance, nor when its next one was deleted (a mutation check found the second case untested).
- **Mutation checks** (break, see a test fail, restore): next date from the due date instead of the completion date; the one-open-instance guard; subtasks not copied; subtasks not trashed with the parent; restoring every subtask; discarding an imported task; completing an already-done task spawning again. All caught.
- **Daily snapshot**: the first start of each day writes `backups/tasks/tasks-<time>.json` (every task and the trash; the newest 14 kept) when any task exists.
- `earlier_minutes` and `source_id` are written when a task is created and never by `update`.

## Tasks: stage 2 write-up, the ClickUp importer (5 Oct 2026)

`npm run import:clickup -- --file <csv> [--apply]` (`scripts/import-clickup.mts`; code in `src/modules/tasks/main/import/`: `csv.ts`, `clickup-import.ts` (read, de-duplicate, plan, checks), `clickup-apply.ts`, `migration-files.ts`).

- **Dry run on the real CSV (read only), every line read.** 2,193 -> 1,211 rows (982 ids twice, identical); Research 1,009, Work 202; 1,082 complete, 98 to do, 31 in progress; 663 top-level, 548 subtasks; priority of top-level tasks High 98, Normal 360, Low 205; 1,612.8 h (96,765 min, the same as the file) across 628 tasks; 17 sub-subtasks moved up (all under the PS5302 statistics course task, titles prefixed with their former parent); 2 attachments; no checklists or comments to lose. All checks pass.
- **Where the report differs from the plan**: 270 subtask dates repeat the parent's and are dropped (the plan said 295), 248 are kept, and 2 open parents take a subtask's earliest date (the plan said 4). The plan's other numbers match exactly. Series: 11 titles repeat four or more times with exactly one open instance (the plan said "about 25 by name"; titles with a month or date in them do not match), and 5 more repeat with none open; each is listed with the median gap and a proposed rule, none is set.
- **The CSV's `Subtasks IDs` is empty for most parents** (the export fills it for about 6), so it is only a check where filled; 6 disagree (a subtask added later). Subtask order follows that list where present, else file order.
- **ClickUp writes line breaks in task text as a literal backslash-n** (55 tasks); the importer turns them into real line breaks. A task's attachments become `- [name](url)` lines at the end of its description. Done tasks have no completed date (the export has none), so none is made up.
- **Checks and refusals**: duplicates that differ stop the import; a task with no title, an unknown space, status or priority, no list, or a missing parent is left out with its subtasks and listed; the plan is compared with the file (tasks, status counts, minutes, top-level and subtasks); `--apply` refuses when any check fails, when the store already holds tasks (the trash counts), and rolls back if the rows written do not read back as planned. After a write it saves a readable copy to `backups/tasks/`.
- **Applied to a scratch library only** (`CENTRAL_COMMAND_HOME=<scratch>`): 1,211 tasks written and read back; a second `--apply` refused. The real library was not touched (a dry run only opens the real database read-only to say whether it already holds tasks).
- **Mutation checks**, all caught: differing duplicates accepted, subtask date not dropped, no sub-subtask title, the time check and the source's time, the orphan check, the apply guard, the read-back verify.
- The script bundles with esbuild like the others but keeps `better-sqlite3` external and reads the migration SQL from its folder (Vite's `?raw` does not exist there); a test proves those files equal the migrations the app runs.

## Tasks: stage 3 write-up, landing, All tasks and the table (5 Oct 2026)

Built (renderer in `src/modules/tasks/renderer/`, IPC `TASKS_IPC` in `shared/api.ts`, handlers in `main/register.ts`, which re-broadcast `tasks:changed` so every page refreshes): the landing (Overdue, Due today, Due tomorrow, Soon, In progress, list cards, Backlog link), All tasks and a list's page (filter row, Open/Backlog/Done with counts, column sorting, "Showing N of M"), the one table (`TasksTable`), the add bar, the New task dialog and Mod-Shift-A (`TaskGlobals`, research instance only), the right-click and priority menus (`TaskMenu`), and the workspace card. The list field reuses Notes' `GroupField` (now with `noun` and `allowNone`).

- **Checked against the real data in a scratch library**: the landing shows In progress 17 and Overdue 8 as the mockup counted for Research; subtasks open under a thread; the context menu, dialog, add bar, Space, the status icon and adding subtasks (Enter keeps the field open) were driven with real keystrokes, in the production build and in dev mode (no console errors).
- **Quit test**: typing a title and pressing Enter, then quitting at once, left the task in the database (the IPC call is awaited by main before the app closes the window).
- **Bug found by driving the app**: the context menu opened and closed at once, because a `contextmenu` listener added on document by the menu's effect received the same event that opened it. Only a `mousedown` outside closes it now (a second right-click's mousedown comes first).
- **Bug found by looking**: the Due column was too narrow for "Feb 24, 2027"; widened to 124 px.
- Playwright's Electron ignores the system colour scheme, so dark was checked with `page.emulateMedia({ colorScheme: 'dark' })`.
- Row buttons (status icon, priority badge, pill) are `tabIndex -1`: the table is one tab stop, and the keyboard has Space, arrows and Shift-F10 for what the buttons do.

## Tasks: stage 4 write-up, the task page and the description adapter (5 Oct 2026)

- **The adapter was proved first** (`renderer/debounced-saver.ts`, 6 tests): `change(text)` is synchronous (the text and the `dirty` state are set before it returns, nothing is debounced on the way in), the write follows after 400 ms, on blur, when the page is left and when the window closes (`registerFlushable`, awaited by the close guard). A text typed while a write is in flight is written next, and a failed write keeps the text and shows "Try again". Mutation checks (async `change`, no loop for in-flight edits, no reuse of the running write, never marking saved) all fail a test.
- **Driven in the built app** with real keystrokes: typing in the description and quitting at once left the text in the database; renaming a task and leaving the page at once saved the title; tag, priority, delete and Undo work. A real-app mutation (removing the flush on leave and on close) did **not** fail that check, because the 400 ms timer fires while the close guard waits; the layers overlap, and the unit tests are the discriminating ones.
- Page (`TaskPage`): title (a saver), tags, Status and Priority as Segmented (the shared `Segmented` gained an optional icon), Due, List, Subtasks (progress bar, add, open one, rotate status), the description in `EditorCard` + `LiveEditor`, and a Time card. A subtask's page has no priority, list or subtasks and links back to its parent. Delete asks (Cancel first) and an untouched new task goes without asking; deleting shows an Undo message (`tasks.restore`).
- Repeats is stage 5; Start/Add time stage 6; Mentioned in stage 7.

## Tasks: stage 5 write-up, recurrence (5 Oct 2026)

The rule logic was built and mutation-checked in stage 1; stage 5 added the **Repeats** field on the task page (`RecurrenceField`: Never, every day, week, 2 weeks, month, or Custom with a number and a unit) and the toast ("Done. The next one is due …") when completing a recurring task. Driven in the built app: set "Every week" on a task with a subtask, completed it from the page; the next instance appeared due 12 Oct (7 days from the completion date, 5 Oct) with the subtask copied as to do; re-opening and completing the finished one again made no second open instance. The ClickUp series are not given rules by the importer; the user sets them one by one from the importer's list.

## Tasks: stage 6 write-up, time (5 Oct 2026)

- Hours stays the only place time is stored. A session already had an optional `task`; typed time (`Adjust`) gained one (parsed, written by `addTime`, kept by `setTaskMinutes` and by rename and client changes). Existing years read as before; Hours' tests stayed green and gained two (the link is recorded, and retyping keeps it).
- A task's total = its `earlierMinutes` (ClickUp, never written) + the reported minutes of every session and typed time that names it, across all year files of the workspace, subtasks rolled up into the parent (`taskTime`, `trackedByTask`); a running timer adds its whole minutes. ClickUp's history is not in Hours' days or balance.
- The task page's Time card: total, earlier, in Hours, **Start** (or **Stop** while it runs), **Add time** (day and hours:minutes in quarter hours; refused with a message when no year of Hours covers the day). Rows with a running timer carry the accent stripe (looked at in the app, light).
- Hours' Start field offers open task titles after the earlier names and links the time when the typed name is exactly one open task.
- Driven in the built app: Start on a task (the session carries `cc://task/<uid>`), the stripe on the landing row, Stop, Add time 1:15 (the task showed 1:30 = 0:15 ClickUp + 1:15), the typed time stored with the task key.
- Found while driving: the page has two "Start" buttons (the top bar's idle chip and the card's); tests must scope to the Time region.

## Tasks: stage 7 write-up, everywhere (5 Oct 2026)

- **Entity kind `task`** (`cc://task/<uid>`; the uid always exists, so nothing is written into a file first) with a provider (`taskEntities`, Research instance carries it for both workspaces), a Lucide `ListTodo` icon, and a hover card by the existing machinery. One existing test used `cc://task/1` as its example of an unknown kind; it now uses `gadget`.
- **Mentioned in**: `findTaskBacklinks` reads the descriptions in the database (so a task that mentions a note, a person or another task is listed, with the line); `registerEntitiesIpc` now takes the database and merges both lists. The task page has the panel.
- **Mod-K**: `searchTasks` (title, tags, list, description; open and soonest due first, done last; the matching text of the description when the title did not match). **Palette and Dock**: "New task" opens the dialog in the workspace being looked at. **Shortcuts**: the Tasks group in the manifest (Mod-Shift-A, Space, arrows, Shift-F10) shows in Settings.
- **People**: a person's page gains "Open tasks" (tasks not done whose description mentions the person) next to their meetings.
- Driven in the built app: `@` in a task description offers tasks (and people); the stored text was `[…](cc://task/<uid>)` and `[…](cc://person/…)`; the target task's page showed "Mentioned in" with the line; Mod-K found a task by words of its title; the palette's New task opened the dialog.

## Tasks: stage 9 (buildable part) and what was left (5 Oct 2026)

- **Settings → Tasks** (`TasksSettings`, a `settingsSection` of the Research instance): the deleted tasks (those that stand alone; a subtask deleted with its parent returns with it) each with **Restore**, and **Save a copy now** (a readable JSON copy in `backups/tasks/`, the same as the daily one and the one after an import). Driven in the app, dark: delete, find it in Settings, Restore, copy.
- **Stage 8 was skipped by instruction** (Work's hour entries become tasks, the billable tag, Work's Month card): it waits for the user's answer. Work's tasks, the `billable` tag from ClickUp and Work's Hours already exist separately.
- **Left for the user**: review, the real import (steps in `docs/ROADMAP.md`, "For the user"), setting the repeat rules, and the push.
- **What the unattended run could not check**: the Dock menu item, the packaged app, phone widths. Everything else was driven in the built app (light and dark) and in dev mode.

## Tasks: the import was applied, and subtasks keep every date (6 Oct 2026)

The user asked for every subtask to keep its date when it has one, and for the import to be applied without another dry run. The importer no longer drops a subtask date that repeats its parent's (the earlier rule is in the stage 2 write-up, with the 270 it affected); 518 of the 548 subtasks have a date. The importer's tests were updated first. It was then applied to the real library with the app closed: 1,211 tasks (Research 1,009, Work 202), all checks passed, rows read back as planned, and a readable copy saved in `backups/tasks/`. A side effect to watch: a subtask whose date repeats its parent's now also appears nested under the parent on the landing page when that date is today, overdue or upcoming.

## Tasks: stage 8 write-up, Work hours become tasks (6 Oct 2026)

> **Superseded (7 Oct 2026):** the billable tag, the Billable choice and the billable-only Month card described in this write-up and the four rounds after it were dropped the same day ("Work is billable work only", below). The link tools no longer know about billable (every Work task counts; `drop:billable` was removed after it was applied). Read the entries as history.

What the real data showed (read only, 6 Oct 2026): 215 Work entries (212 typed, 324:00) carry log-style labels (122 distinct, 83 used once) and **none matches a task title exactly**; ClickUp's Work time (316:45) and the entries (326:15) are **the same work recorded twice** (same monthly shape; matched pairs equal to the minute, e.g. Oromia SPELL 465 = 465, Liberia RAI 435 = 435 + the 135-minute timer of 5 Oct). Counting both on a task would double it. 107 Work tasks carry `billable` (97 top-level, all in Luminos, and 10 subtasks); ClickUp tagged parents, so a subtask counts as billable through its parent (112 of the 124 timed tasks). Entries have no billable idea (the sheet's Accounted column was dropped on import).

The user's decision: match entries to tasks by the numbers, even when the wording differs; generally only billable tasks are listed under Work hours.

- **Matching** (`src/main/tracking/import/work-task-links.ts`, pure): a task's entries are linked only when their minutes add up to the task's ClickUp time **exactly**. Words (shared words weighted by rarity, a leading verb ignored) and dates (an entry falls up to 30 to 60 days before the task's due date, or 3 after) only choose between sets that already add up. Three tiers (high: words 0.8, 30 days, at most 4 entries; medium 0.5, 45 days, 4; low 0.3, 60 days, 3). A set is skipped when another is as good (within 0.03), and two tasks wanting one entry both wait unless one is clearly better; an entry goes to one task only. Only billable tasks are linked; a non-billable one whose numbers match is listed, not linked (one: Oromia SPELL for School Leaders, 6:00).
- **Result on the real library (dry run):** 66 billable tasks, 91 of 212 entries (159:00 of 324:00); high 39, medium 17, low 10. **Low is never applied unless `--include-low`**: the Data-preparation family is cross-wired there (an EGRA entry in January landed on a Core Program task). Left alone: 42 timed billable tasks no entries reach (the monthly summaries, 15-minute tasks, the big data-preparation subtasks of 12 to 24 hours whose log lines were split differently) and 4 ties; 121 entries (165:00) are linked to nothing.
- **`Adjust.earlier` (additive, `true` only):** a linked entry keeps its date, label, client and minutes, and gains `task` (`cc://task/<uid>`) and `earlier: true`. `trackedByTask` skips it (ClickUp's time already holds it), so a task's page shows ClickUp's time and "In Hours 0:00" for the history; Hours' days, weeks, balance and Month card count it as before. New time linked later (Start, Add time) has no `earlier` and is added as before. Retyping a row never replaces or merges `earlier` entries (`setTaskMinutes`: the typed total includes them and the new adjustment is the rest, keeping the row's task). Old files read as before.
- **`npm run link:work-hours [-- --apply [--include-low]]`:** dry run by default; reads `time/work/*.json` and the database (read only). Apply backs up `time/work/` to `backups/work-task-links-<time>/`, writes through `TrackingStore.linkHistory` (`linkEntries` refuses an entry already linked, missing or listed twice, and changes the whole year or nothing), reads every file back and checks each task's linked entries equal its ClickUp time and each year's total is unchanged. A second run only adds (a finished task is not reported as unmatched). **Not applied to the real library**: waits for the user.
- **Billable-only list:** Work's Start field and Add (`useOpenTasks`) offer only open billable tasks (`billableTasks`, `tasks/shared/billable.ts`: tagged, or a subtask of a tagged task). Research unchanged. Typing the exact title of a non-billable task no longer links it. The "Recent" names are unchanged.
- **Not done:** Work's Month card has no billable rows (history cannot be split: most entries are linked to nothing and the sheet's Accounted flag was dropped); say if you want them for new time only. No way yet to link an entry to a task by hand.
- Tests: `work-task-links.test.ts` (exact sums, different wording, same-title tasks told apart by date, one entry one task, not billable, far dates, no time, `linkEntries`), `billable.test.ts`, `tracked.test.ts`, `clients.test.ts`. Mutation check, five breaks each failing a test (exact sum loosened to 15 minutes, billable filter off, `earlier` counted by Tasks, an already-linked entry allowed, `earlier` replaced when a row is retyped). One real bug found by a test: two tasks wanting one entry were settled by order; now both wait.
- Checked in the built app on a scratch library with the links applied: Work's Start field offers "Liberia…", "Prepare for and complete meeting with Matthew" and "Coordinate and communicate: September" and nothing for "Reconcile and categorise", "Back up Consulting" or "Coordinate…: October" (not billable); the linked Liberia RAI task shows 7:15 from ClickUp and 0:00 in Hours (not 14:30). No console errors. Dev mode was not driven; the change is a data rule and a list filter.

### Stage 8, second round (6 Oct 2026): non-billable starts, billable Month card, reconciliation

The user's answers to the first round: (1) Work's tracker must also start non-billable tasks, with an easy way to say a task is billable when it is made from the tracker; (2) show every non-billable task in the Luminos list so they can say which are billable; some hours correspond to several ClickUp tasks, added together; (3) the match must be 100%: the billable hours tracked so far and the billable tasks must account for each other, no billable task unaccounted for, no hour without a task; tasks may be merged, split or renamed; (4) the Month card shows billable time only, and says so; (5) it also shows the balance against the month's expected hours.

- **Built (committed, not pushed).** Work's Start/Add row has a **Billable / Non-billable** choice (the shared `Select`, default Billable). A name that is exactly one open task links to it and shows that task's own state (the choice is disabled); any other name **makes a Work task** (list = the one last used in Tasks, else the billable tasks' list; due today; tagged `billable` when chosen) and links the time, so every named hour has a task. Restarting a row from today's list and the nameless idle Start do not create tasks. The Start list offers every open task, billable ones first (`useOpenTasks`; `listForNewTask` in `tasks/shared/billable.ts`). The Month card (`MonthCard`, `billableYear`, `monthPlanSoFar` in `hours/shared/months.ts`) counts only time linked to a billable task (`useBillableKeys`): its title says "Billable", client rows and the total are billable, and a quiet line gives **Balance** (billable minus the plan of the weeks begun so far, a week counting whole from its first day) and what is left out (not billable, not linked to a task). **Until the history is linked, the card shows little for past months**: that is the 100% rule, not a bug.
- **What the data says about 100%** (real library, read only). Typed entries 324:00 (19,440 min, 212 entries). Billable ClickUp time (tagged, or a subtask of a tagged task) 305:15; with the one untagged Luminos task that has real work (Oromia SPELL, School Leaders, 6:00) 311:15. So **12:45 of the hours have no ClickUp time at all**, mostly work after the last ClickUp export (5 Oct: Document automation 6:00 and others) and log-style lines. Document Automation: entries 54:00 against tasks 46:15. Data preparation: entries 100:15 against tasks 97:30 (with the parent's own 7:00 as well as its subtasks' 90:30). Meetings and communication: 47:15 against 45:15, but not equal month by month (the sheet spread hours across months: the user's own rule from the history import). Exact sets reach 56 tasks and 74 entries; a global allocation by 15-minute units (words and dates as costs, entries split when needed, tasks added together) places about 245 of 324 hours with sensible results for the audit, requirements, meeting and RAI families and some wrong pairings in the rest (an Existing-system entry on a data-preparation task, a meeting on a monthly summary), so it cannot be applied unseen.
- **Non-billable Luminos tasks** (27, listed for the user in `docs/ROADMAP.md`): 24 are invoicing admin (Add monthly billable time to FreeAgent, Create and send a monthly Luminos invoice), 2 are open Document Automation tasks, 1 is Oromia SPELL School Leaders (6:00).
- **Not built yet:** the reconciliation itself (waits for the user's billable answers). The plan: a dry-run worksheet in three bands (exact sets, the global allocation, what is left), entries split into per-task adjustments where one entry feeds several tasks, tasks made for hours that have no ClickUp counterpart (their entries linked **without** `earlier`, so Tasks counts them as Hours time), and a final check that every entry is linked and every billable task's linked history equals its ClickUp time.
- **The user's answers (6 Oct 2026):** invoicing and "Add monthly billable time to Luminos in FreeAgent" are **not** billable; Document Automation tasks and "Draft Oromia SPELL Training Manual for School Leaders" **are** (three tasks still untagged in the real library: that SPELL task and the two open Document Automation ones; they get the tag with the reconciliation, with a backup, or by hand in the app). Next: they review the list of hour entries with no ClickUp task, then the reconciliation is built.

### Stage 8, third round (6 Oct 2026): the linking worksheet

The user: they need a better way to say how to link hours and tasks; the 5 Oct billable time (6:00 by the data: 2:15 + 2:15 + 1:00 + 0:30 of Document automation, not 5:00, to confirm) should be tasks, since it was never tracked in ClickUp; the rest of Document Automation should be fully tracked in the Document Automation list; are the numbers not adding up?

- **The numbers, by client and list.** Teaching & Learning entries 55:00 against Document Automation tasks 46:15: the 8:45 is 6:00 on 5 Oct (no tasks), 1:30 of the May log line that the import placed by guess on 28 May, and 1:15 of month-to-month drift (June entries +4:00, July −3:15, two monthly-log quarter hours). Impact typed entries 269:00 against billable tasks outside Document Automation 265:00: 4:00 more hours than tasks. Together 12:45, as before. Client and list line up (T&L = Document Automation), which makes both sides checkable separately.
- **Billable, as the user decided:** tagged (own or parent's), or any Luminos task outside the Admin & Logistics sublist (so Document Automation and Oromia SPELL count; invoicing and FreeAgent do not). The tags themselves are still unchanged in the library.
- **The worksheet** (`npm run link:worksheet -- --write <file.csv>`, `--check <file.csv>`; nothing in the library changes): one CSV row per entry (a split entry has a row per part) pre-filled with the best matches: exact sums first (`work-task-links.ts`), then a minimum-cost flow over 15-minute units for the rest (`work-task-flow.ts`: entries feed several tasks, several entries add up for one), marked "best fit, check"; what is left is blank with "maybe: …" suggestions. The user edits the `task` column in a spreadsheet: a task's name (`<file>-tasks.csv` lists them; the due date is added when titles repeat), `NEW: Title [Sublist]` for a task to be made, `-` for no task, blank for undecided. `--check` reads it back and lists, per billable task with ClickUp time, SHORT or OVER, the entries still without a task, the tasks to be made, and says COMPLETE only when every entry is placed, its rows add up to the entry, and every billable task's time is met exactly. The 5 Oct timer sessions are rows too (they will link without `earlier`).
- **Not built:** applying the sheet (it needs the user's answers first): making the NEW tasks, tagging the three tasks, and linking (typed entries with `earlier` for ClickUp time, the rest as Hours time, split entries as several adjustments).
- Tests: `work-task-flow.test.ts`, `work-links-sheet.test.ts`; mutation check (four breaks: completeness ignored, a non-billable task accepted, rows not summing to the entry, task capacity inflated), each failed a test.

### Stage 8, fourth round (6 Oct 2026): the user's rules in the worksheet

The user: all 5 Oct entries are billable; activity logs are always 15 minutes per client and per month (Impact and Teaching & Learning each, except September, when Impact was not billed because it had one task), and missing tasks for them can be created; June and July are one block (things were moved); a spreadsheet is the way to answer; task dates should be changed to line up with the hours.

- **Rules before matching** (`ruleRows`, `work-links-sheet.ts`): entries after the last day ClickUp was used (the newest task creation date, 4 Oct) become `NEW: <label> [Document Automation]`; each "Monthly Activity Log" entry goes to the nearest "monthly summary" task within 25 days that still has ClickUp time to spare (one with 0:00 takes none), else `NEW: Submit activity log: <Month> (<Client>) [Admin & Logistics]` (3 are made: July for both clients, August for Teaching & Learning); a timer session goes to the task whose title ends with its name (no ClickUp time is filled by it). The T&L entry of 1 Oct is labelled "August" but is September's (it lands on the 4 Oct summary task).
- **Dates are a weak signal now**: the flow lets an entry fall up to 45 days after a task's due date (0.1 cost a day) because task dates will be moved to the hours; exact sets are unchanged (3 days).
- **Check:** timers never fill ClickUp time; it lists the task dates that would move to the day of the task's last typed entry (25 now, a new task takes its last entry's day) and each new task's date. Applying (not built) will make the tasks, tag the three tasks, set those dates and link.
- **State of the sheet:** 28 billable tasks are not exact and 53 rows (68:15) have no task; the first sheet is kept as `worksheet-v1.csv`.
- **Activity logs, final rule (user, 6 Oct 2026):** do not make a task when an existing one can take the entry. A log goes to the nearest summary task (25 days) with ClickUp time to spare, else to the nearest one with none (its hours are Hours time: the 10 Aug summary takes July for both clients and August for Teaching & Learning), and only otherwise to a new "Submit activity log" task. Every billable task with ClickUp time must still be matched exactly by hours (the check's COMPLETE rule).
- **End state (user, 6 Oct 2026):** exact match in time between the ClickUp import and the hours; each hours entry corresponds to a single, possibly merged, task; hours never change; a ClickUp task may be split, merged or renamed (the worksheet's changes file: split, rename, merge); at the end every linked ClickUp task is **renamed to its hours entry's label**. A task may carry more hours than ClickUp time only temporarily (the surplus is made up by moving ClickUp minutes between tasks). Not built: applying all this.

### Stage 8, finished and applied to the real library (6 Oct 2026)

The user said to link everything that remained as best as possible, make the numbers reconcile, make new tasks where needed, and then do the renaming, merging and splitting. Worksheet decisions came one question at a time over the day; the rest followed the rules: hours entries never change and each goes whole to one task; same-type data stays together (Classroom Observation, EGRA/EGMA and Core Program Data only cross where a type had nothing left); task dates follow the hours.

- **Applied** with `npm run link:work-apply -- --apply` (app closed, scratch run first and checked in the built app): **213 entries (326:15), all on billable tasks; every task's ClickUp time equals the hours given to it; Work's ClickUp total unchanged at 316:45.** Backups: `~/CentralCommand/backups/work-final-<time>/` (the Work hours and the database) and a readable tasks copy in `backups/tasks/`. A second run refuses (entries already have tasks).
- **What it changed.** 9 tasks made (5 from hours with no ClickUp task: background review 1:30 on 28 May, two 4 Jun planning entries 0:15, data cleaning 0:30 on 1 Sep, developer contract preparation 0:30 on 5 Oct; 4 from splits: Send TORs 1:00, Coordinate July rest, a 21 May meetings piece 0:45, Oromia SPELL guidance 0:45); 2 merged tasks went to the trash (Dagbani into the Ghana "Incorporate" task, Write up notes into the background reading task); ClickUp minutes were moved between tasks where hours disagreed (Summarise 0:15 to EGRA and 0:15 to Coordinate July, Data linking 0:15 to Classroom Observation); the `billable` tag was added to every linked task that lacked it; every linked task's date is its last typed entry's day.
- **Names.** A task whose entries all say the same thing is renamed to that wording (the user's rule); a task that gathers differently worded entries (Classroom Observation, Core Program Data, EGRA/EGMA, Data linking, Documentation, the Luminos audit tasks) keeps its ClickUp name, since one entry's name would mislead. The old names are in the backups.
- **Hours.** Each entry has `task` (and `earlier` where ClickUp's time holds it: 198 entries; 15 are hours only: the 5 Oct work, the activity logs on the 10 Aug summary task, the new tasks' entries and the Liberia timer). A task's total is ClickUp time plus the hours that are not `earlier`, which now equals the hours linked to it.
- **Month card** (billable only) on the scratch result matched the imported months to the minute (June 23:45, October 13:15 with nothing left out). The task page lists a task's hours by month instead of "In Hours 0:00" (`hoursByMonth`).
- **Tools** (all in `scripts/`): `link:worksheet` (worksheet and check), `link:work-apply` (this step), `link:work-hours` (the first, exact-sum linker, superseded). Planner and rules: `src/main/tracking/import/work-links-apply.ts` (tests), `work-links-sheet.ts`, `work-task-flow.ts`.
- **Left for the user's review:** names that came from one entry (e.g. "Document automation: project setup" for Identify relevant documents…) and tasks merged or split by judgement (see the backups for the old names); ClickUp's own admin tasks (FreeAgent setup etc.) are non-billable and untouched.

### Stage 8, ClickUp time raised to the hours (6 Oct 2026)

The user: totals must match exactly; where hours exceed a task's ClickUp time, the task is updated. `npm run link:work-match -- --apply` (applied the same day, backups in `backups/work-match-<time>/`) raised the ClickUp time of the 12 tasks that held hours but less ClickUp time (12:45: the five new tasks, the three 2025-26 "Incorporate" tasks, the three 5 Oct Document Automation tasks and the 10 Aug summary task) to their typed hours and marked those entries `earlier`. Result: **billable ClickUp time 324:00 = typed hours 324:00, task by task.** The one thing outside it: the 2:15 Liberia timer session of 5 Oct, which is time tracked live in the app (counted as Hours time on its task), not typed history.

Open question for the user (non-billable work): non-billable tasks with ClickUp time (the admin tasks, 5:30) have no hours; the user wants hours created for them that stay out of the billable summaries (Week, Balance, charts, Month card).

- **Timer sessions can be covered too (6 Oct 2026, the user):** the 2:15 Liberia timer of 5 Oct had no ClickUp counterpart, so the task's ClickUp time goes up by 2:15 (7:15 to 9:30). `Session.earlier` (additive, `true` only) works like `Adjust.earlier`: Tasks does not add a covered session again, and `hoursByMonth` still counts it. `link:work-match` handles typed entries and ended sessions. Run on the scratch library; **not yet run on the real one (the app was open)**: close the app, then `npm run link:work-match -- --apply`.

### Work is billable work only (6 Oct 2026)

The user dropped the idea of non-billable hours (about 5:30 of admin with almost no tracking): Work keeps billable work only, with no feature that tells the two apart. **Removed:** the Billable / Non-billable choice on Work's Start and Add row (a name that is no task still makes one, now untagged, in the last list used or the first list), the billable-first ordering of the Start list, the billable-only Month card (it counts all time again, its title is the month and its last row "<Month> – Total"; the Balance line stays), `billableYear`, `useBillableKeys` and `tasks/shared/billable.ts` (its list rule is `new-task-list.ts`). **Saved:** the 74 non-billable Work tasks (including subtasks, 5:30 of ClickUp time) in `~/CentralCommand/exports/work-non-billable-tasks.csv` (Task, Subtask of, List, Sublist, Status, Due, Completed, Priority, Time, Tags, Description). **Applied to the real library the same day** with `npm run drop:billable -- --apply` (app closed, backup `backups/drop-billable-<time>/`, read back): the 74 tasks (with their subtasks) are in the trash, the `billable` tag is gone from every task (137), 135 Work tasks remain and every hours entry still points at a live task. **Later (7 Oct 2026):** the billable filter, `notBillable` and the billable tag step were taken out of the applied one-off tools (`link:work-*`, `link:worksheet`), and `drop:billable` was removed; their write-ups above keep their history.

## Overlapping contracts, stage 1: rules and files (6 Oct 2026)

Plan: `docs/CONTRACTS_PLAN.md` (the user's answers are there). Stage 1 of 4 is built; the UI and the timer do not use it yet.

- **File.** `TrackingYear` gains `name?` (non-blank, trimmed) and `invoice?` (`'week' | 'month'`, absent reads as `month` through `invoiceOf`), both kept by `parseYear`. A contract with no fixed hours is `hoursPerWeek: 0` with `weekAim: true`; `parsePlan` accepts 0 only with `weekAim`, so Research can never have a zero plan.
- **Overlap.** `createContract` no longer refuses overlapping dates. It refuses `same-start` (the file is named by the first day) and `client-overlap` (a client name, compared ignoring case, that another contract has on any day of the new dates). `setContractEnd` lost the date check but keeps the client one, so lengthening a contract cannot put a client in two contracts on one day (an addition to the plan).
- **Own plan.** `createContract(workspace, start, end, terms?)`, `terms` = `name`, `clients`, `weeklyMinutes` (0 = none), `invoice`; what is left out comes from `defaultPlan('work')`, never from the previous contract (`fresh` still serves Research years). `carrySeconds` is only the rounding carry (`carryIn` plus each session's exact minus reported), so a new contract starts at 0. Also refuses `bad-name` and `bad-plan`.
- **Mutation checks.** Each of these breaks fails a test: same-start check off, client check off (create and `setContractEnd`), case-sensitive client compare, overlap ignoring dates, the zero-aim rule.
- **Not yet:** `currentStart` still picks the first file holding today (stage 2); `ContractFields` still creates a contract with the default terms (stage 3); no script names the existing contracts (stage 4).

## Overlapping contracts, stage 2: the timer and entries find the contract by client (6 Oct 2026)

Plan: `docs/CONTRACTS_PLAN.md`, decision 5. Stage 2 of 4 is built; the Hours page's own layout (selector, no-aim display, periods card) is stage 3.

- **The rule** (`src/shared/tracking/contracts.ts`, pure; `TrackingStore.startingYear`). `start(workspace, label, task, client)` looks at the contracts that hold today (`holdingToday`, which replaced `currentStart`). With a client: the one that has it (exact name, as the plan spells it). With none: the contract of the client used last, meaning the latest session or typed entry across the contracts holding today (a typed entry counts as the end of its day; a client no longer on a plan is ignored), else the newest-starting contract. A client no contract has falls to the first one, which refuses it (`bad-client`) and changes nothing. With one contract holding today everything is as before. `running()` is unchanged; starting in another contract stops the running one at the same instant (the existing stop-then-start).
- **What the screens offer** (`openContracts(workspace)`, a new read call: the contracts that hold today with their clients, plus `last`, the client used last, from `defaultClient` of the last-used contract). The idle Start chip shows a compact Client menu before Start only when there is more than one client to choose from (Research and a single-client contract look as before), on the client used last; Start still starts at once, unnamed. The Today card's Client menu lists every client of every contract holding today, grouped under the contract's name (or "From <first day>") when there is more than one contract; its Start and Add go to the chosen client's contract (Add passes that contract's year, so the entry lands in the right file even when another contract is shown). The row client menus stay the shown contract's (`setClient` refuses another contract's client). The palette's Start timer still opens Hours with the Today field focused, so it gets the menu there.
- **Tasks.** A task's list is its client when the name matches a client of a contract holding the day (`clientForList`, ignoring case): starting a timer and adding time from a task's page pass it, and the time is added to that contract's year (`yearFor(date, client)`). A list that is no client (an Inbox list) passes none, so the timer goes to the client used last.
- **Tests.** `store.test.ts` "the timer with overlapping contracts" (own file per contract, never two timers, last-used by session and by typed entry, refusals, ended contract, open contracts) and `contracts.test.ts`. Mutation checks, each failing tests: client ignored, last-used ignored, earliest instead of latest. A fourth (the fallback for an unknown client) was an equivalent mutant, so the code was simplified instead.
- **Driven on a scratch library** (two overlapping contracts, Luminos 1 May and Research Assistant 30 Sep; production build and dev mode, same result): chip Start for each client lands in its own file and stops the other timer; Today card Start and Add for each client; switching the contract selector and adding the other contract's client's time from the shown one; files read back after each step. Not driven: starting from a task's page (the list-to-client rule is covered by unit tests only).
- **Known edge, for stage 3.** The Hours page still opens on the newest contract that has started (`useTrackingYear`), which may have ended while an older one holds today; stage 3's "opens on the contract that holds today and was used last" fixes it. The Today card is drawn only for a contract that holds today.

## Overlapping contracts, stage 3: the Hours UI (6 Oct 2026)

Plan: `docs/CONTRACTS_PLAN.md`, decisions 3, 6, 7 and 8. Stage 3 of 4 is built; the user's own data (naming the two existing contracts) is stage 4.

- **Which contract opens** (`contractToShow`, `src/shared/tracking/contracts.ts`, pure; `useTrackingYear`). Among the contracts that hold today (`openContracts`): the one last chosen in the selector if it is among them (remembered per workspace with `useModuleState('hours-contract')`, so it survives a restart), else the contract of the client used last, else the newest start. With none holding today: the newest that has started, else the newest. This fixes stage 2's edge (an ended newer contract no longer wins over an older one that holds today). A contract that no longer holds today is not reopened just because it was shown last. The hook waits for the open contracts before choosing, so the page does not flash the wrong one. Only contracts with clients count as open (as in `openContracts`), which every Work contract has.
- **Selector.** `Name · May 1, 2026 – Oct 29, 2026` (`contractLabel`, `workspace-weeks.ts`); the dates alone for an unnamed contract. The plan wrote the dates as "1 May 2026"; the app's own `formatDate` ("May 1, 2026") is kept so the selector matches every other date. The Contracts table uses the same label.
- **New contract form** (Settings → Hours, `ContractFields`): Name, First day, Last day, Clients (one line, comma separated), Weekly hours (blank = no fixed hours; "0" is refused, like the plan field), Invoiced (Week / Month, the shared `Segmented`), Add. Add stays disabled until the name, dates, clients and hours read; the store's refusals show under the form in a few words (`contractRefusal`: `same-start`, `client-overlap`, `bad-name`, `bad-plan`, bad dates, anything else). A refusal clears when a field is edited. The first day still starts as the day after the shown contract ends. Unchanged: the shown contract's last-day field, plan fields and client chips below it, which now act on the contract the page would open on. Hours per week reads 0:00 for a contract with no aim and cannot be set back to "none" there (not asked for).
- **One invoice card over periods** (`periodsOf`, `src/modules/hours/shared/periods.ts`, was `months.ts`; the card is `InvoiceCard`, was `MonthCard`). A contract invoiced by month is `monthsOf` as before. One invoiced by week has one period per week, named "Week 3" by its number in the contract, with hours per client and a total, no table of weeks and no plan; arrows go between weeks. The summary, "to go" and balance note appear only where there is an aim. The Week card numbers its weeks within the month only for a month-invoiced contract.
- **No aim** (`hasAim`: `hoursPerWeek > 0`, `src/shared/tracking/plan.ts`): Week card (summary is the week's hours; no bar column), Balance card (Average week and Hours so far only), weeks chart (all columns in one colour, no plan line, legend "Hours", no plan in the tooltip), heat map (shaded against the contract's busiest day, since there is no aim to measure against), typical week (the "Daily aim" legend shows only when some day has one, which also fixes Work's week-aim contracts), All weeks (hours only) and the Contracts table (plan and balance show "–"). Average week stays (hours per planned day times days a week).
- **Driven on a scratch library** (Luminos monthly with 8:00, Research Assistant weekly with none, overlapping from 30 Sep; production build, light and dark, and dev mode for Settings): the selector opens on Research Assistant and lists both with dates; Hours, Charts and weeks for each contract; the form refuses the same start and a shared client, disables Add on bad hours, and adds a no-aim weekly contract whose file has `hoursPerWeek` 0, `invoice: week`, its weeks and name; the chosen contract is remembered across a restart. Looking at screenshots found two things, both fixed: the Week card kept an empty third column without an aim, and the weeks chart had no legend for its single colour. Not driven: dev mode for the Hours page itself, a contract that has ended while an older one holds today (unit tests only).

## Overlapping contracts (6 Oct 2026)

Plan and the user's answers: `docs/CONTRACTS_PLAN.md`; the build is in the three stage sections above. Stage 4 is the user's own data.

- **`npm run name:contracts [-- --apply]`** (`scripts/name-contracts.mts`, logic in `src/main/tracking/name-contracts.ts` so tests run without Electron) names every unnamed Work contract file "Luminos". The rule (`withName`) adds `name` after `start`, keeps the file's other keys in their order, refuses a file that does not parse or whose result would differ in more than the name, and never changes a name that exists. Dry run by default; `--apply` copies `time/work/` to `backups/name-contracts-<time>/` first, writes atomically and reads each file back. Tests: the pure rule and the dry-run/apply path (mutation check: dropping the "keep an existing name" rule fails both). Run on a scratch copy of the real `time/work/` (the two files named, a second run finds nothing, the files equal the originals except `name`); the dry run on the real library lists both files and changes nothing. **Applied to the real library the same day** (app closed, backup `backups/name-contracts-2026-10-06T13-02-18-101Z`, read back): both contracts, Oct 2025 to Mar 2026 and from 1 May 2026, are named Luminos; a second dry run finds nothing.
- **The new contracts are the user's to add** (Settings -> Hours), not made by a script: the contract named **Royal Holloway** (the user's choice, not "Research Assistant"; client Royal Holloway, 28 Sep 2026 to 28 Mar 2027, weekly hours blank, invoiced Week) and the new Luminos (clients Impact and Teaching & Learning, 8:00, invoiced Month, first day after 29 Oct 2026, which the user has not given yet).
- **Deferred** (the plan's TODO list): component tests for the stage 3 UI, driving the Hours page in dev mode, and a "none" choice for hours per week in Settings.

## The descriptions the ClickUp CSV export dropped (6 Oct 2026)

Found by using the app: "Check for new articles in Kathy's reading list" had a link to the reading list in ClickUp and none in Tasks.

- **Not the importer.** `import:clickup` reads `Task Content` into `description` (`clickup-import.ts`), and all of it survived: the CSV holds content for 89 of 1,211 unique tasks, and the library holds exactly 89 non-empty descriptions. The loss is in the export. `Task Content` carries ClickUp's **plain-text** rendering of a description (the API's `text_content`), which is empty whenever the description holds nothing but rich content. The Kathy task's description is a link embed: `markdown_description` has the Google Docs URL, `text_content` is `""`. Checked against the API that this is specific, not wholesale — "Complete Data Visualisation with ggplot2" is genuinely empty in ClickUp too. The same embed is on the earlier instances of the recurring task, so the history is affected as well. `Checklists` and `Comments` are empty for all 1,211 rows and `Attachments` for all but one, so they are likely lossy the same way; not pursued (the user wants the links only).
- **Re-exporting cannot fix it**, the column itself is the problem; the descriptions have to come from the API.
- **Fetched in bulk, not per task.** The first shape proposed was one request per task (1,122 of them, 12+ minutes at the ceiling of 100 requests a minute per token, so 429s and backoff). The workspace-wide endpoint takes `include_markdown_description=true` and returns 100 tasks a page, which is about 30 requests for the whole library — a quarter of one minute's budget, nothing to throttle. The ClickUp MCP connector's bulk tool strips descriptions, which is what made the per-task shape look necessary; the raw API does not.
- **`npm run backfill:clickup-links`** (`scripts/backfill-clickup-links.mts`, rule in `src/modules/tasks/main/import/clickup-descriptions.ts` so tests run without network or Electron). Matching is by `source_id`, which holds the ClickUp task id for all 1,211 imported tasks. An embed becomes the bare URL, since the editor draws a plain URL as a link; a label that says something the URL does not is kept and collapsed to one line; images are left alone. A description we already hold is never overwritten, so the 89 the CSV did carry and anything typed since stay as they are. A task held here that ClickUp did not return is listed and skipped, never guessed at. Token in `CLICKUP_API_TOKEN`, never in the repo. ClickUp is only read.
- **Tests**: 14 on the pure rule, the real Kathy embed among them as a fixture. Mutation check on the never-overwrite guard fails two tests.
- **Driven against a stand-in ClickUp** (`CLICKUP_API_BASE`, a dependency-free server in the scratchpad) on a copy of the real library, never the real one: pagination over three pages plus the archived pass, a 429 waited out from `X-RateLimit-Reset`, 81 existing descriptions left alone, 22 written and read back, and a re-run finding nothing left to fill.
- **Left**: the real dry run and `--apply`, which need the user's token. How many tasks actually gain a description is unknown until then; the fake server used synthetic embeds.

### The real dry run, and four things no fixture had shown (6 Oct 2026)

Run against the real library with the user's token: ClickUp returned all 1,211 tasks in **15 requests**, and the first report found 33 descriptions to fill. Reading it (the rule in `CLAUDE.md`: read every line of an importer's dry run on the real data) found four faults, all fixed and each now a test:

- **Markdown's backslash escapes.** ClickUp escapes the URL inside the label (`AH\_Ethical\_Review`), so it did not compare equal to the URL and four links kept an unreadable `[mariakna.github.io https://…\_escop2025.pdf](…)` label. The label is unescaped for the comparison only; a label that is kept keeps its own escaping.
- **Two embeds side by side ran their URLs together.** "Check new placement options" held four links in two lines, as `https://post.parliament.uk/fellowships/https://intranet.royalholloway.ac.uk/…` — a string that is no use as either URL. A bare URL now always gets a line of its own, and a separator already in the text is left as it is.
- **ClickUp's `*   ` bullets** become the `- ` the editor writes (three tasks hold bulleted lists of links).
- **A description that is only a thematic break** (`* * *`, on "Publish Study 1: Luminos data code") counts as nothing, so the task is left alone rather than given a line of punctuation.

After the fixes: **32 to fill in, 25 of them a bare link and 7 holding text too**; 81 descriptions already held and left alone, 1,022 empty on both sides, nothing held here that ClickUp did not return. The eleven instances of "Check for new articles in Kathy's reading list" each get the Google Docs link, which is what started this.

**Applied to the real library the same day** (the user's go-ahead, app closed, backup `backups/clickup-links-2026-10-06T14-00-12-630Z`, readable copy `backups/tasks/tasks-2026-10-06T14-00-12-657Z-clickup-links.json`): 32 descriptions written and read back, 89 -> 121 tasks with a description. Checked in the database independently of the script's own report: the eleven Kathy tasks hold the Google Docs link, "Check new placement options" holds its four URLs on separate lines, and "Publish Study 1: Luminos data code" is still empty. A second dry run reports nothing left to fill. Not confirmed by eye in the app: the live editor's drawing of a plain URL as a link is an existing, tested feature, so the task pages were not driven.

### Descriptions kept as plain text lost their links (13 Oct 2026)

Found by the user: "Check upcoming external trainings" had about ten links in ClickUp and none in Tasks.

- **Cause.** The 6 Oct backfill never overwrites a description we hold, and this task held ClickUp's plain-text rendering (`(or consider  and )`), which drops every link. The CSV had carried it, the importer copied it faithfully, and the backfill treated it as typed text. The same applied to any of the 89 CSV descriptions with inline links.
- **`npm run backfill:clickup-links -- --repair [--apply]`** (`planDescriptionRepair`, `clickup-descriptions.ts`). A task is repaired only when what we hold equals ClickUp's plain `description` (whitespace squashed), so anything typed here since is never touched, and only when the Markdown adds a URL the held text lacks. Bullet-only differences (about 60 tasks) are left alone, since no link was lost. Dry run by default; `--apply` backs up first and reads every change back.
- **Two faults the real dry run showed**, both now tests: ClickUp writes a URL that ends in a bracket as `…\)` (a stray `)` after the link), and a strikethrough URL counted as new.
- **Applied 13 Oct 2026** (app closed): 11 tasks, backup `backups/clickup-repair-2026-10-13T12-38-18-114Z`, readable copy `backups/tasks/tasks-2026-10-13T12-38-18-143Z-clickup-repair.json`. A re-run finds nothing. "Check upcoming external trainings" regained 7 links (the closing `)` of "(or consider … and …)" sits on its own line; left as is).
- **Not pursued.** ClickUp's comments, checklists and attachments were empty in the CSV too and have not been checked against the API.

## The Royal Holloway contract, and the kick-off meeting (6 Oct 2026)

The user's own data, changed by hand with a backup before each step; no app code changed. The one-off scripts stayed in
the session scratchpad and are not in the repo: these were data edits, not importers anything will run again.

- **The meeting note moved to Work.** `notes/meetings/research/2026-10-02 Other.md` ->
  `notes/meetings/work/2026-10-02 Royal Holloway.md`, series `Other` -> `Royal Holloway`. Copy first, the original to the
  macOS Trash after, modified time kept — what `moveNoteFile` does. Checked with `diff` that the only line that differs is
  `series`. A meeting has no contract and no client, only a workspace and a series, so "move it to the Royal Holloway
  contract" is a series named for the client, the way Work's other meetings are named (`Document Automation – Luminos`).
- **The contract** (`time/work/2026-09-28.json`): Royal Holloway, client Royal Holloway, from Mon 28 Sep 2026, 26 weeks (to
  Sun 28 Mar 2027, matching both Luminos contracts — the user gave no last day and a contract needs one, whole weeks), no
  fixed hours (`hoursPerWeek: 0`), invoiced Week. Built with the app's own `contractWeeks`, `parsePlan` and `emptyYear` and
  the same field order `createContract` writes, then checked the way the store does (no other contract starts that day; no
  overlapping contract shares the client — it does overlap the current Luminos, which runs to 29 Oct 2026, and that is
  allowed) and read back through `parseYear`.
- **Two tasks merged into one, in Work.** "Meet with Kathy and Michael about scoping work" (`uc8k3frf`) and "Write up Kathy
  and Michael meeting notes" (`xhzsavrd`) are one task: `uc8k3frf`, **Kick-off meeting and follow-up**, workspace `work`,
  **Royal Holloway › Language Mapping**, done, due 2 Oct, 75 minutes. The write-up task is in the trash (`deleted_at`, the
  app's own soft delete, restorable). Work's lists are client names with sublists (Impact, Teaching & Learning), so the new
  contract's work gets a list of its own. The name went through "Meeting with Kathy and Michael to kick-start the work, and
  writing up the notes" first: too long, because this task is reported to the client.
- **Why 75 minutes and not 60.** ClickUp holds 45 minutes for the meeting and **nothing** for the write-up; the write-up's
  30 minutes are in the app's own Hours, two timer sessions on 2 Oct. So the merged total is 45 + 30. (The first ask was to
  fold in a quarter of an hour, on the assumption ClickUp had tracked the write-up; it had not.) Not confirmed against
  ClickUp itself — the MCP connector has no token ("Oauth token not found") — only against the imported `earlier_minutes`
  and the Hours entries.
- **The hours merged into one entry, moved out of Research.** The three sessions of 2 Oct (45 + 30 + 0 minutes) are gone
  from `time/research/2026-27.json`; the contract holds one typed entry of 75 minutes, client Royal Holloway,
  `task: cc://task/uc8k3frf`, `earlier: true`. A single session could not be honest about two ranges an hour apart, so it is
  typed time. `earlier: true` is the Work history import's pattern: Hours counts the 75 like any other time, `trackedByTask`
  leaves it out, so the task page does not add it on top of the 75 it already carries from ClickUp. Research's week of
  28 Sep is 1:15 lighter and the Royal Holloway invoice week gains it, which is the point — this was contract work.
- **`earlier_minutes` was written by hand** (45 -> 75), which the column comment says the app never does. Carrying a merged
  total needs it: it is the only time these tasks hold, since the 2 Oct sessions were tracked before Tasks existed and so
  name their task only in their label, with no `cc://task` key.
- **The datasets task stays in Research**: `s9878yf9`, "Investigate early grade reading datasets in LMICs", moved from
  Language Mapping › Scoping to **Research Scoping › Initial Review**, its 180 minutes of 2 Oct hours untouched. The user
  called the destination "Initial Review under Initial Scoping"; the list is named Research Scoping, and Initial Review
  under it holds eight other "Investigate … data" tasks.
- **A list exists only through the tasks that carry it** — there is no lists table and nothing in `settings.json` — so
  Research's Language Mapping list disappeared when its last task left, with nothing to delete. The one remnant: the
  trashed write-up task still carries `Language Mapping › Scoping` and would bring the list back if it were ever restored.
- **Backups**: `backups/tasks-rename-20261006-151718/` (the database), `backups/rh-hours-20261006-152159/` (both
  workspaces' time files), `backups/royal-holloway-20261006-150948/` (`time/work/` before the new contract).
- **Not driven in the app.** Every change was checked in the files and the database; the Hours page's first invoice week for
  the new contract and the merged task's page have not been looked at.

## Notes in Life (7 Oct 2026)

- **Life is a third notes workspace**, from the same module code as Research and Work: `createNotesModule('life')`, `'life'` in `NOTE_WORKSPACES`, a `notes/life/` folder created and watched at start-up (`ACTIVE_WORKSPACES`), and a Life folder among the backlink folders, so mentions and "Mentioned in" cover Life notes. Life has no meetings, tasks, hours or training.
- **A note's Workspace menu offers Life, Research and Work**; a meeting's still offers Research and Work. `WorkspaceSelect` is generic over the choices it is given (`NOTE_WORKSPACE_CHOICES`, `MEETING_WORKSPACES`), so a meeting page cannot be handed Life.
- **New notes start where you are.** `QuickActionWorkspace` is now `life | research | work`; the palette's and Dock's "New note" and quick capture (Mod-Shift-n, via the URL) start in Life when Life is the page or the workspace last visited. New meeting, new task and Start timer have no Life, so `researchOrWork` sends them to Work when looking at Work, else Research.
- **Search already asked Life's notes** (the manifest offers `search`), but they came under a second "Notes" heading. `searchLabel` now heads them "Life notes", as Work's are "Work notes". `in:notes` still means all three.
- **Not driven in the app**: checked by typecheck, lint and unit tests only (new tests for a Life note, a task from Life, and the Life path). No Life notes exist yet in the real library.

## Timer and tasks, stage 1: a back-dated start on the running timer (7 Oct 2026)

`docs/TIMER_TASKS_PLAN.md`, stage 1. The running timer's popover says "Started [hh:mm] · 0:15 so far" and the time is the shared `TimeInput` (hours and minutes, digits, Up and Down), editable at once (`StartedAt.tsx`). A change is saved on Enter, on leaving the field, or when the popover closes; never half-typed (typing hours then minutes would otherwise trim an entry on the way). Escape puts it back. A first version took `10:15` or `-20` text with "Since last entry ended" and an overlap hint; the user asked for a plain time field instead and those were removed.

The rules are pure, in `src/shared/tracking/timer.ts`: `setStartAt` and `overlapsFor`.

- Today only (a timer from an earlier day still needs its end time), never before midnight (the field is a time of day), never after now. Moving the start later, up to now, is allowed.
- An earlier entry of the day that overlaps is trimmed to end where the timer now starts, and its reported minutes are worked out again against the carry without it, so the carry still adds up. An entry ending exactly at the new start is not an overlap.
- A start that would swallow an earlier entry whole is refused ("That would cover an earlier entry"); nothing is ever deleted.
- **The Today form's Add time is not changed**: it takes a duration only, so there is nothing to back-date.
- Mutation-checked (trim skipped, swallow allowed, touching counted as overlap each fail a test) and driven in the built app on a scratch library, including leaving by clicking outside.

## Timer and tasks, stage 2: one Start picker, every hour has a task (7 Oct 2026)

`docs/TIMER_TASKS_PLAN.md`, stage 2, Research and Work.

- **One picker** (`TaskPicker`): one field; as you type it lists the open tasks that match (title starts with it first, then contains it, accents and case ignored, list shown on the right) and always ends with **Create task "…"**. Nothing is listed before typing; with an empty field the popover offers **Recent** (open tasks used in the last week). Enter with nothing highlighted takes the task whose title is exactly what was typed, else creates one. A new task goes to the client's own list in Work when a list is named for the client, else the list last used, else the first list, else "Inbox".
- **Start is always at once.** The top-bar Start, the palette's Start timer (offered only while no timer runs; it starts in the current workspace, Life counting as Research) and Today's Start with an empty field start an unnamed timer and open the chip's popover on the picker (`startUnnamed`, `requestPicker`, `start-request.ts`). Choosing a task calls the new `tracking.assignTask`, which sets the running session's label, task and client without touching its start time. With a task already named (Today's field, a row's play button, the task page, Switch to) the timer starts straight on it. A play button on an old label-only row starts with that label and opens the picker with it typed (and the row's client as a hint), so one Enter turns it into a task.
- **Client**: where there are clients (Work) it is the task's list when the list is a client of an open contract; the only client when there is one; asked ("Which client?", one click each) only when there are several and the list names none of them. Creating a task in Work with several clients therefore always asks. If the client belongs to another contract than the one holding the timer, the session moves there (written to the new file first, then removed from the old, so a crash leaves it twice, never nowhere).
- **Stop with no task asks**: every Stop (chip, popover, row, palette, Dock, task page) goes through `stopTimer`; a running timer with no task opens the picker headed "Which task was this?" and stops once it has one. Escape leaves the timer running. A timer from an earlier day still only asks for its end time; the day-end auto close is unchanged (it cannot ask).
- **Add time** (week card) uses the same picker, limited to the shown contract's clients; Today's Add needs a task too. The old free-text field, its label suggestions (`earlierLabels`, `suggestLabels`, `recentLabels`) and the exact-title link (`taskKeyForLabel`) are gone, and so is `TodayCard.keyFor`'s Work-only creation. The Client selects on the idle chip and the Today form are gone (the task decides); the popover keeps its Client menu for a timer that has a task.
- Existing label-only data is left as it is. Rows still group by label plus client (`TaskRow` now also carries the task key).
- **Open points**: the task page's Start still takes the client from the list and falls back to the one used last when the list is no client (it does not ask); a taskless timer is not stoppable from the chip's Stop on a day boundary except through its end-time prompt.
- Tests: `assignTask` and the store's move between contracts (mutation-checked: no removal from the old file, and the not-running guard each fail a test), the picker rules, the palette. **Driven in the app on a scratch library, dev and the built app, Research and Work**: Start then pick, Create, Stop asking, Switch to, ambiguous client, creating in Work, old row play, Add time, palette Start; no console errors. One bug found only that way: an older row's client was lost, so the picker asked for it again (fixed by the hint).

## Client lists, stage 1: Work's top-level lists are its clients (7 Oct 2026)

`docs/CLIENT_LISTS_PLAN.md`, stage 1. Answers to the four open questions: **empty client lists are always shown** on the Tasks page (stage 3); **removing a client whose list holds tasks is refused**; **a client name in two contracts has one list** (Luminos twice); **sublists stay free text**.

- **The rule** is a plain module, `src/modules/tasks/shared/work-lists.ts`: `workClients` (every client of every contract, past and present, once each, case-insensitive), `listFor` / `canUseList` (in Work a list must be a client, and the client's own spelling is stored; Research is free) and `outsideRule`.
- **The store enforces it** (`TasksStore`'s optional third constructor argument, the clients provider). `create` and `update` refuse a Work top-level list that is no client ("... is not a client, and Work's lists are its clients (...)"); a subtask has no list, so nothing to check. `update` checks only when the list actually changes, so a task already outside the rule can still be renamed; the next occurrence of a repeating task and its subtasks keep their list (completing a task must never fail on the rule). Importers and scripts build the store with no provider and are unchanged.
- **`register.ts`** gives the store a provider that reads the Work contracts from disk on every call through a `TrackingStore` (read-only use; Work has contracts, so nothing is created), so a client added in Settings counts at once. It fails closed: with no contracts there are no clients, so no Work task can be made until one exists.
- **`npm run check:work-lists`** only reports (database opened read-only): the clients with their task counts and every live top-level Work task outside the rule, exit code 1 when there are any. **On a copy of the real library (7 Oct 2026): Impact 79, Teaching & Learning 28, Royal Holloway 1, none outside the rule.** It reported a task I moved to "Luminos" on the copy.
- **Mutation checks**: removing the create check, the update check, or the series exemption each makes a test fail (2, 2 and 1 tests).
- Not driven in the app: no UI changed (stage 3 changes the UI and is where the app is driven). Until then the UI still offers "new list" in Work, and choosing it now fails with the store's message.

## Client lists, stage 2: lists follow clients (7 Oct 2026)

`docs/CLIENT_LISTS_PLAN.md`, stage 2. Research untouched.

- **How a list with no tasks exists.** It does not: lists are derived from tasks (there is no lists table). A client's list is "allowed" because the client is in some contract's plan (`workClients`, read from disk on every call), so **adding a client in Settings or creating a contract is all it takes**; nothing is written to Tasks. Stage 3's Tasks page will show every client as a list, empty or not, by merging `workClients` with the task lists.
- **Rules** are plain functions in `src/shared/tracking/client-names.ts` (`cleanClientName`, `allClients`, `canonicalClient`, `clientsLost`, `checkRename`, `renameClientInYear`, `clientRefusal`); the store applies them (`TrackingStore.setPlan`, `createContract`, new `renameClient`), the IPC handler is one line.
- **Seam to Tasks.** `TrackingStore.setClientTasks(ClientTasks)` (`count`, `rename`), given in `main/index.ts` once the database is open (`src/modules/tasks/main/client-tasks.ts`, top-level Work tasks only, compared ignoring case). Without it (tests, scripts) nothing is checked. A rename sends the Tasks windows a changed event.
- **Removing a client** (`setPlan` with a shorter `clients`): refused with `client-has-tasks` (and `detail: { client, tasks }`: "Teaching still has 1 task. Move or delete them first.") when no _other_ contract still has the client and its list holds tasks. **Trashed tasks count** (restoring one would otherwise break the rule). A client that another contract also has is removable; its list stays.
- **Renaming** (`renameClient`, new `tracking:rename-client`; in the UI, click a client's chip in Settings -> Hours, Enter saves, Escape cancels, an empty or 40+ character name or one another client has is refused): the tasks move first, then every contract that has the client gets the new name in its plan and on each session and typed entry (reported minutes untouched). If a contract cannot be saved, the contracts already changed and the tasks are put back. Changing only the case is allowed.
- **One spelling per client.** A name that another contract already has in other case ("impact") takes that contract's spelling, in `createContract` and `setPlan`, so a client has one list.
- **Tests**: `client-names.test.ts` (rules) and `src/main/tracking/client-lists.test.ts` (real files, in-memory database, the real task store with the stage 1 rule). **Mutation checks**: removal guard off, tasks not renamed, tasks not restored on failure, contracts not restored, the first-contract-only rename, and the spelling rule in `createContract` and in `setPlan` each fail a test (the last one first survived; its test was added).
- **Driven in the app** (scratch library, built app and dev, `Settings -> Hours`, Work): remove a client with a task (message, nothing changes), rename (tasks, both contracts' plans and the hours entry follow), rename to an existing name (message), Escape cancels, add a client (a task can be made in its list at once), add a contract with a new client (same). No console errors. The editing chip is a few pixels taller than the plain chip.
- **Not done:** the real library has not been touched; a client edited by hand in a year file is not noticed.

## Client lists, stage 3: the UI offers only client lists in Work (7 Oct 2026)

`docs/CLIENT_LISTS_PLAN.md`, stage 3. Research untouched (its lists stay free). Not pushed, not installed.

- **Where the renderer gets the clients.** A typed `window.api.tasks.clients(workspace)` (`tasks:clients`): Work's clients (the same read as the store's provider, from the contracts on disk), `null` in Research. The hook `useWorkClients` (`src/modules/tasks/renderer/`) reads it again when a contract or client changes and when the tasks do; until Work's are read there are none (nothing outside the rule is offered meanwhile), and Research returns null at once with no call.
- **Plain rules** (all tested, mutation-checked): `listChoices(rows, clients)` and `reconcileQuery(query, rows, clients)` (a filter on an empty client list survives), `listSummaries(rows, today, clients)` (a card with 0 open), `defaultList(..., { clients })` (the list being looked at, the last one used and the busiest all have to be clients; with none, the first client; with no client at all, empty, which the store refuses), `offeredLists(tasks, clients)` (what a move offers: every client, empty ones too, and the sublists in use in the client's own spelling, never a list that is no client) and `listForNew` (a client's own list, empty or not).
- **The Tasks page** shows every client as a list, empty ones included: the list filter, the landing's Lists cards (`0 open`), and a page for an empty client list says "No tasks yet. Add one above." rather than offering to clear a filter.
- **The list field** (`ListField`, now given the workspace) offers only the client lists and their sublists. `GroupField` has `allowNewTop` (default true): in Work the form is "New sublist", "Inside" has no "Inside nothing" and starts at the current list, so a new name can only be a sublist (sublists stay free text). The Add bar and New task fall back to the default when the list chosen earlier is no longer a client (renamed or removed meanwhile). The task page's list field is the move.
- **The Start picker's Create** in Work puts the task in the client's own list (the client it asked for, or the only one) instead of "where one was last added" or "Inbox".
- **The task page's Start** asks "Which client?" (the same words and choices as the picker) when the task's list names none of the open contracts' clients and there are several; it no longer falls back to the client used last. Escape closes the question and returns focus to Start. Add time on that card still takes the client from the list and, with none, falls back as before (open point).
- **Two bugs that were already there, found by driving the app, fixed in `GroupField`**: (1) the new list form was a `<form>` inside the Add bar's and New task's own `<form>`, and a form inside a form never submits, so "New list" had never worked from the Add bar or New task (it is now a plain group; Enter in its name adds the name and does not reach the form around it, which would add a task); (2) Escape in the list menu also closed the New task dialog behind it, because a native `<dialog>` closes on Escape unless it is prevented (`preventDefault`, as `DatePicker` does).
- **Driven in the app** (scratch library with Luminos, a past contract with its own client, Research tasks; built app and dev, light mode, screenshots): an empty client list (its page, the add bar defaulting to it, the filter and cards); the list menu in the Add bar, New task and the task page (clients only, "New sublist", a new sublist made and used, a task moved to another client); Start on a client's task (starts at once) and on a task in a past contract's client (asks, Escape, then Impact starts the timer with that client); Create in the picker (asks, Royal Holloway, the task lands in that list); a client renamed (through the same IPC call Settings -> Hours makes) while the Tasks page was open: the heading, filter, add bar and menus followed, a filter on the old name went back to All lists, and a list chosen in the add bar before the rename gave way to the default; Research (free lists, "New list" with "Inside nothing", a new list made and used). No console errors in either mode.
- **Open points.** The list menu is clipped by the New task dialog (it was before this stage: the menu is cut at the dialog's edge, so the form at its foot cannot be reached there; the Add bar and the task page are fine); a position-fixed menu as in `DatePicker` would fix it. A saved filter on a renamed client goes back to All lists rather than following the rename. Not run on the real library (nothing here writes to it).

## Tasks: subtasks have no page, and the due date is a calendar (7 Oct 2026)

User feedback after the Tasks review. Design rule they gave: as few clicks as possible, clear and intuitive.

- **A subtask has no page of its own.** `TaskPage` redirects a subtask's route to its parent's page (`<Navigate replace>`), so the table, search, mentions and "Mentioned in" all land on the parent. The parent's Subtasks card edits each row in place (`SubtaskRow`): status, title (saved on Enter or blur; an empty title is put back), due date, delete with Undo, and a chevron that opens tags and notes. A subtask's time is shown but not editable there (time is added on the parent's Time card); that is open if the user wants per-subtask time.
- **Due date is a calendar, not a dropdown.** `DatePicker` (`src/renderer/src/components/`) is a button ("Today", "Oct 9", "No date") opening a Monday-first month calendar; one click on a day sets it and closes; **Today** and **No date** are in the calendar's footer. `DueField` is now a thin wrapper used by the task page, the Add bar, the New task dialog and subtask rows. The Today/Tomorrow/Next week presets (`presetDate`, `presetOf`) are gone.
- **The calendar that "randomly disappeared"**: the old field showed the native date input only while the date was not one of the presets, so picking today, tomorrow or +7 days switched back to the dropdown and removed the input mid-pick. The new picker has no such mode.
- **Driven in the app (7 Oct 2026, scratch library, dev and production build, light and dark)**: the calendar was clipped inside the New task dialog (the dialog scrolls, so the absolutely placed popover was cut off after one week row). It is now `position: fixed`, placed under the button or above it when there is no room (`popoverPlace` in `calendar.ts`), and follows scroll and resize. Fine on the task page, the Add bar and subtask rows (the last row opens upward). Escape closes only the popover (a second Escape closes the dialog; the task page stays) and returns focus to the button; Enter opens it, arrows and Tab move over the days, Enter picks; a click outside closes it. Subtask title (Enter saves, empty is put back), due date, tags and delete with Undo all work; no console errors.
- **Subtask notes (approved 7 Oct 2026).** `npm run move:subtask-notes [-- --apply]` moves each live subtask's note into its parent's description as a `### <subtask title>` section after the existing text and clears the subtask's own (one transaction; a parent's text only grows; backs the database up first; a second run finds nothing; logic and tests in `src/modules/tasks/main/subtask-notes.ts`). The dry run on the real library found 20 notes under 10 parents (the plan said 11). `SubtaskRow` no longer has a notes field, so run `--apply` (app closed) before using the new build, or those notes are only reachable in the database. **Applied to the real library on 7 Oct 2026** (20 notes under 10 parents; backup `~/CentralCommand/backups/move-subtask-notes-*`; a dry run now finds nothing).

## Timer and tasks, stage 3: Meetings (7 Oct 2026)

`docs/TIMER_TASKS_PLAN.md`, stage 3, Research and Work. Not pushed, not installed. **Nothing was run against `~/CentralCommand`**: no existing note, hours file, task or database row was changed; everything was driven on a scratch library.

Answers agreed with the user before building: (1) tasks are generic and named by series: Research "Supervision", "Rastle Lab", "Luminos" and "Meetings" for "Other", in a Research list "Meetings"; Work "<Client> meetings" (e.g. "Impact meetings") in that client's own list, a series that is no client gets no proposal (the picker asks which client); (2) derived minutes are read-only rows under Today and the week with a link to the note; (3) a note with no times has no hours until both exist; (4) the link is stored in the note's front matter **and** an index column (schema change approved by the user).

- **Storage.** `task: <uid>` in the front matter (plain text, written only when a task is chosen or cleared; an empty value removes the line; the store refuses anything that is not a uid). `MeetingMeta.task` and `MeetingIndexRow.task` ('' = none); migration `meetings/0005_task` adds a column the startup reindex fills from the files (it is only an index). **No minutes are stored anywhere.**
- **The field** (`MeetingTask`): with no task it shows the proposal pre-filled (Check icon when an open task with that title exists, Plus when it will be created), one click takes it; "Other" opens `TaskPicker`; with a task it shows title and list, "Change" and a clear button. Escape: the picker's own list closes first, a second Escape closes the picker and returns focus to Change/Other, never leaves the page. Series changes do not change an existing task. A task that is gone, or from the other workspace after a move, counts as none and the note shows the proposal again (the stale uid stays in the file until a task is chosen).
- **Derivation** (pure, `meeting-entries.ts`): one entry per note with a task that still exists, a date not after today, and an end after the start. Reported to the quarter hour per meeting like any other block (the meeting counters still use exact minutes, so a 40-minute meeting is 40 min there and 0:45 on Hours), with no effect on the rounding carry. In Work the client is the task's list in the client's spelling; an entry with no client cannot be placed and is left out.
- **Hours page** (`withDerived`, `useShownYear`): a copy of the year with `derived` sessions added in memory, so Today, the week, the invoice/month cards, balance, charts and the Years table all agree; `dayRows` skips derived sessions so they never mix with editable rows, `MeetingRows` lists them (read-only, link to the note, no play/edit/delete). They update at once when the note, task or clients change.
- **Overlap** (`overlapping`, strict: touching is fine; a running timer counts until now and at least its start): the meeting page says "Overlaps Supervision 12:29–now." and the Hours row shows a warning icon; nothing is changed. The check covers the workspace's timer blocks, the timer if it runs in the other workspace, and other meetings that have a task. Typed time has no clock time and cannot overlap.
- **Also on the page:** a quiet "No hours until it has a start and end / a date" when a task is set but times are missing.
- **Mutation-checked:** future-date guard, end-after-start, missing task, strict overlap, running-until-now, self-exclusion, derived sessions excluded from rows, year and client filters, Work's list rule, subtask exclusion each fail a test (two survivors were equivalent/redundant and the redundant check was removed).
- **Driven in the built app and dev mode, scratch library, screenshots:** Research (proposal then Create, Use an existing task, a note with no times, an overlap with a running timer, edit of the end time and clearing it, Escape/focus) and Work (contract, "Impact meetings" created in the Impact list, a series "Other" with no proposal, Hours showing the row and the Month/invoice totals). One bug found only that way: a just-started timer was zero length and never overlapped (fixed, test added).
- **Open points.** The task page's Time card (`trackedByTask`) does not include meeting hours yet. Overlap between a meeting and a typed-time-only day cannot be detected. Moving a note to the other workspace keeps its (now foreign) task uid. A meeting dated today counts in full before it has happened (same rule as the meeting counters).

## Timer and tasks, stage 4: Trainings (7 Oct 2026)

`docs/TIMER_TASKS_PLAN.md`, stage 4, Research. Not pushed, not installed. **Nothing was run against `~/CentralCommand`**: no existing training note, hours file, task or database row was changed; everything was driven on scratch libraries (built app and dev mode, screenshots). Mockup the user decided from: `docs/design/training-tasks-mockup.html`.

Answers agreed with the user before building (they replaced the plan's "one click" for trainings):

1. **The lecture task is made automatically, once a series is chosen.** Not at note creation (a new note is "Untitled" with no series), and never by a click. The subtask is named after the note's title and **follows it** (and follows the series: change it and the subtask moves under the new series task). Deleting the entry takes its task to the Tasks trash. A note with no series has no task and no hours.
2. **Time can be added from the training note, from the task and from Hours**, because these are tasks like any other.
3. **The task page's Time card (and the Tasks table) now include meeting and lecture hours.**
4. **Deleting a lecture that has self-study time**: the dialog says "It has 0:30 of self-study: that time stays in Hours."; the subtask goes to the trash, the tracked time stays in the Hours file under the lecture's name. No question is asked for a lecture with none. **Superseded 20 Oct 2026:** deleting now takes the time with it (`docs/DECISIONS.md`, "Deleting a task takes its hours with it").
5. **Only new trainings, for now.** Old notes are left exactly as they are (no task, no field, no derived hours) until stage 5. **Clean-up to do then**: drop the marker below and treat every training note the same way (also in `docs/ROADMAP.md`).

- **Storage.** `task:` in a training note's front matter (plain text) and an index column (`training/0004_task`, filled from the files at startup; the index only). The value is a task uid, `auto`, or absent. `auto` is the **marker**: a note made in the app (New entry, the palette, the Dock) is saved with `task: auto`; the first time a series exists the page makes the subtask and replaces `auto` with its uid. A note without the key (every older note, every importer's note) is never planned, renamed or given hours. No minutes are stored anywhere.
- **What does it, and when.** `planLectureTask` (pure, `shared/lecture-task.ts`) says what to do (`create`, `sync` or `none`); `useLectureTask` (renderer) does it, one thing at a time, after the series and title have been still for 0.8 s. The series task is an open top-level task called the series (list "Training" first, else any list), or one made in the list "Training" (`parentFor`). A task the user chose that is not a subtask is never renamed or moved. A deleted task is not made again by itself: the note says "The task was deleted." with **Make it again**. Clearing the series leaves the subtask where it is. **Found by driving the app**: the series field commits on every keystroke, so the first version made a series task called "I" from the first letter and left it behind; now nothing is made until the text settles, and a series task this page made that the lecture then leaves empty is put in the trash (`strandedParent`: only ever one the page made itself; restorable).
- **Hours.** A lecture's own session derives from the note (`lectureEntries`, same rules as a meeting: a task that exists, a date not after today, both times with the end after the start) into the year at read time (`withDerived`, in memory). `DerivedEntry` and `Session.derived` gained a `kind` (`meeting` or `training`) so the two never collide (`noteKey`); the Hours rows (`MeetingRows`, now "Meetings and training") show a graduation-cap row that links to the note. **One total with no split** (`entryMinutes`): the note's session (exact minutes) plus everything tracked on the subtask, used by the training counter, per-skill totals, the table, the landing, the series cards and the PDF. For a note with no task or no self-study the numbers are the same as before (tested; the PDF page is byte-identical with no self-study). The PDF reads the Hours files read-only in the main process (`trackedByTask`).
- **On the training page.** The Task field (shown only for a note that has or is waiting for a task: title and series · list), then one line: "1:30 in total", **Start** (straight on the lecture's task, no picker) and **Add time** (the same block every task has: `TaskTimeActions`, moved out of the task page's Time card and shared by both), then the overlap line (`MeetingHoursNote`, shared with Meetings): a self-study timer that overlaps the lecture's session says so and changes nothing.
- **From the task.** A task with open subtasks gets a **For** choice in its Add time form (the task itself or one subtask), so a series' lectures keep their own time and the series task can take time for any lecture. The Start picker lists lectures with their series beside them (`detailOfTask`).
- **Tasks' time.** `useTaskTime` reads the years through `withDerived`, so the Time card, the Tasks table and the by-month list count meeting and lecture hours as the Hours page does (a derived block is rounded to the quarter, as there). This changes what existing meeting tasks show once their meetings have a task.
- **Task store change.** `update` accepts `parentUid` to move a subtask under another top-level task of the same workspace (tests: end of the new parent's list, refuses a top-level task, a subtask as parent and another workspace).
- **Mutation-checked**: future-date guard, end-after-start, `auto` taken for a task, self-study ignored, an older note given self-study, a plain task renamed, a create without a series, a done series task reused, a meeting and a lecture of one name colliding. One survivor is equivalent (the empty-task guard in the planner; the next line returns the same).
- **Driven in the app** (scratch libraries, built and dev, Research): a new training (no series: "Choose a series and the task is made"; typing the series made one series task and one subtask; the title and series then followed), no times (0:00, "No hours until it has a start and end"), edited times (the total follows), a timer started from the page (starts at once; overlap warning "Overlaps …14:59–now"), Stop, typed time, the Hours row and totals, the series task's page (46:00 including the lecture, "For" lists the task and the lecture), an older note (no field, no hours, its file byte-identical after opening it and editing its series), the delete dialog with self-study (Escape closes only the dialog) and the delete itself (subtask trashed, time kept), the pause-while-typing case. No console errors in either mode.
- **Open points.** Typed time cannot overlap (no clock time). The running timer is not in the page's "in total" until it ends. The task page's "In Hours" line on a series task counts the task's own time only (the total above it includes the lectures). Renaming a lecture's task in Tasks is undone the next time its note is opened (the note's title wins). A lecture dated today counts in full before it has happened (as meetings do). The "Task" field is not editable (no Change) on purpose; to link a lecture to a task made by hand is stage 5.

## Linking Work's meetings (7 Oct 2026, stage 5 of `docs/TIMER_TASKS_PLAN.md`, Work only)

The user's rule: Work's hours were reconciled with tasks already, so **a meeting's time sits inside an existing task that also holds its prep and follow-up**. No task is created and no hours change. The matches were listed with the user (a page, row by row; four needed their decision: 21 May took the "Meeting with Matthew" task, 2 Feb the task of that day's entry, 29 and 30 Sep one shared "Developer interviews and follow-ups", 5 Oct "meetings and emails").

- **Applied to the real library the same day** with `npm run link:work-meetings -- --apply` (app closed; backup `~/CentralCommand/backups/work-meeting-links-<time>/`, read back; a second run finds nothing): all 23 Work notes have `task: <uid>`, and the two 0-minute timer sessions of 5 Oct have the Liberia task (the one beside them). A task is one per meeting (same titles, different tasks), except 29 and 30 Sep, which share one. The 9 Feb note's task is a subtask of "Complete the Luminos Existing Data System Audit" (its hours entry sits there); its list shows empty on the note's Task field.
- **Rule added so nothing counts twice:** `withDerived` leaves a note's derived entry out when a session or typed entry of the same task on the same day is marked `earlier` (imported history already linked to the task). Without it the four Work notes with times (29 Sep, 30 Sep, 2 Oct, 5 Oct; 4:00 in all) would add their hours on top of the entries. Tested and mutation-checked (the skip, the date match, the task match, `earlier` on typed time; the session `earlier` check first survived and has a test). The notes' times stay for the Supervision log.
- **Not installed:** the installed app does not have that rule yet. Until it is rebuilt, opening it would show those four notes' hours twice on Hours.
- **Left:** 18 Work notes have no times (no effect on hours). Research is not started: its 2025-26 hours are daily totals with no labels (cannot be linked), the 36 timed supervision meetings match a "Prepare for the upcoming supervision meeting" task by date (34 of 36), and the trainings match existing "Complete …" tasks by title for about 50 of 132 (DataCamp, SENSS, PS2021); the rest have no task. Those tasks hold ClickUp time that is the same work as the notes' sessions, so any link needs the same no-double-count rule.

## Linking Research's historical data: what is there (7 Oct 2026, stage 5 of `docs/TIMER_TASKS_PLAN.md`, Research; nothing changed)

A read-only look at a copy of the real library; the table the user decides from is an Artifact page (https://claude.ai/artifact/8bbh2gsUXqPrxL44FL2uum). **No script was written and nothing was applied.** Findings:

- **Trainings (132): 67 have a task by title**: DataCamp 38 (32 exact, 6 with a slightly different title), Research Training Seminar 13 (each has a "Complete pre- and post-work for …" or "Prepare for …" task, which the earlier count had missed), SENSS Experimental Methods 9, PS5302 6 (its 6 "Complete work for the … lecture" tasks, by syllabus order; Simple Regressions is 3:30 on both sides) and Epigeum 1. **65 have none**: SEDarc 30, no series 16, Psychology Seminar 6, Researcher Development 4, PS5210 3, PS2021 2, SENSS Specialist 2, LSE 2. A fuzzy first pass wrongly matched PS5302 to "Create course preparation tasks …", a SEDarc live session to a DataCamp task and PS5210 "Introduction" to another "Complete Introduction"; those are not matches.
- **Supervision (36 with a date): 34 have a "Prepare for the upcoming supervision meeting" task due within a day** (35 such tasks, 30:15 of ClickUp time). Without: 16 Oct 2025 (a second meeting that week; the 14 Oct meeting takes the 13 Oct task) and 5 Oct 2026 (no times). Research meetings without times: 4 Luminos, 1 Other, the planned supervision; Rastle Lab is timed.
- **1-5 Oct label-only hours**: 6 labels match a task by exact title; three equal the task's ClickUp time exactly ("Fix the R setup in Visual Studio Code" 0:15, "Attend dinner with Kathy and Michael Crawford" 2:15, "Attend and present at the lab meeting with Michael Crawford" 3:45), three are shorter. "Admin" and "Investigate datasets for Michael and Kathy" have no task.
- **Why nothing may simply be linked.** A derived session lands in the year that holds its date. A note dated before 1 Oct 2026 would add its session to 2025-26 Hours (daily totals, already complete) and to the task (which holds the same work as ClickUp time). `withDerived`'s `earlier` skip cannot help: Research tasks have only `earlier_minutes`, no sessions. Recommended rule, **not decided**: notes dated before 1 Oct 2026 derive no hours. The training counter, per-skill totals and PDF read the note's own times (`entryMinutes`: the note's session plus tracked sessions on its task, never `earlier_minutes`), so they stay the same; two notes sharing one task would each add that task's tracked time, so give each note its own task or accept that.
- **Waiting for the user:** the six decisions on the page (the cut-off rule, the supervision links, the 65 trainings with no match, the untimed meetings, the 1-5 Oct hours, retiring `task: auto`).

## PS5210 linked (8 Oct 2026, stage 5, Research; applied 8 Oct 2026)

The user asked to fix PS5210 alone (3 notes: 30 Sep Introduction, 7 Oct fNIRS and fNIRS Practical Lab). Found: 30 Sep's lecture (2:00) sits inside Hours' unlabelled daily total of 4:15 (21-30 Sep are daily totals); the two 7 Oct sessions (3:00) are in no hours; no PS5210 task existed.

- **Linking instead of a cut-off rule** (the user's idea): no hours were changed in sum. The 30 Sep total goes 255 -> 135 and a typed entry of 120 on the Introduction subtask, marked `earlier`, takes its place, so `withDerived` leaves the note's session out (the rule from "Linking Work's meetings") and `trackedByTask` leaves it out of the lecture's self-study (`entryMinutes` = the note's 2:00, once). The 7 Oct notes derive their sessions normally (3:00 added, no overlap with that day's timers).
- **Tasks:** series task named as the notes' series ("PS5210 Applied Neuroscience Methods", Training, in progress) with subtasks named as the notes (done, due on the lecture date), so the page's lecture sync (`planLectureTask`) finds nothing to change. Notes get `task: <uid>`.
- `npm run link:ps5210` (`src/modules/training/main/import/ps5210-link.ts`): dry run by default, backs up the database, `training/research` and `time/research`, all checks before the first write, reads files back; refuses a note that holds another task, a day with less than 2:00 or a second run. Tested, mutation-checked (the day lowering and the `earlier` flag are caught; the subtasks' status is not and is cosmetic). Dry run and `--apply` tried on a copy of the real library: the diff was exactly the above.
- **Applied to the real library on 8 Oct 2026** (backup `~/CentralCommand/backups/ps5210-link-2026-10-08T07-37-18-949Z`, files read back). **Installed the same day** (`npm run build:mac`, replaced `/Applications/Central Command.app`, old copy in the Trash; not launched from here), so it now has the stage 3 to 5 features and the `earlier` skip. **Left:** the general cut-off rule for the other 129 notes is still open (PS5302 parked: its note times are lecture plus self-study, rounded to 30 minutes, so the real lecture times are needed).

## How stage 5 (Research) is being worked through with the user (8 Oct 2026)

The first report listed six decisions at once and the user asked for **one decision at a time, after the matching is done**. Method since: show one training series at a time with its notes, hours, the task's real name (a lecture is a subtask: name the parent task too) and the difference in hours. Facts learnt: a training note's time is lecture plus self-study (backfilled from the user's tracker, rounded to 30 minutes), ClickUp time is self-study rounded to 15, so for PS5302 the real lecture times must come from the user; the 56 of 67 title-matched trainings whose task has no ClickUp time need no double-count rule; 2025-26 hours and 21-30 Sep 2026 are unlabelled daily totals, but a day can be split into a total plus a typed `earlier` entry on a task (as done for PS5210), which links hours without a general cut-off rule. **Parked by the user:** PS5302 (waiting for the lecture times); the other series (SEDarc 30, no series 16, Psychology Seminar 6, Researcher Development 4, PS2021 2, SENSS Specialist 2, LSE 2) and the title-matched DataCamp, Research Training Seminar and SENSS rows are still to be shown and confirmed one series at a time. Supervision, untimed meetings and the 1-5 Oct hours are not started.

## Discard a running timer (8 Oct 2026)

The user started a timer by accident (the idle Start chip starts at once with no task and asks afterwards) and found no way to remove it: Stop on a taskless timer asks for a task first, so a mistake always became a saved entry, and the app had no delete for sessions (`deleteSession` existed in `src/shared/tracking/timer.ts`, the store, IPC and preload, but no screen called it).

- **Built:** a quiet **Discard** button (Trash2 icon) at the foot of the timer popover (`TimerChip.tsx`, `.discard` in its CSS). It calls `tracking.deleteSession` for the running session and closes the popover; nothing is saved. Shown for any timer that is running today, with or without a task; not for a stale timer from an earlier day (`StaleTimer` has its own end flow). No new IPC. Typecheck, lint and tests pass; **not driven in the real app** (no screenshot, not tried in dev mode).
- **The two stray entries** (Daily admin, 0 minutes each, 16:36 and 16:41 on 8 Oct) were removed by hand from `time/research/2026-27.json` with the app closed (backup `~/CentralCommand/backups/time-research-*`).
- **Unexplained:** a second taskless timer started 2 seconds after the first was stopped. Suspect: Stop and the idle Start chip occupy the same spot in the top bar, so a double-click on Stop starts a new timer. Not reproduced.
- **Left:** a Delete on saved entries (Today and week rows), with a confirmation, the same pattern in every row; then check whether Stop and Start should sit apart.

## A meeting that starts as a timer stops is not an overlap (9 Oct 2026)

The user stopped a task at 15:00 and started a meeting at 15:00; the meeting page warned "Overlaps Prepare a presentation for CastlesFest 14:52–15:00". Cause: a note's times are whole minutes, a timer's carry seconds (the stop was probably 15:00:25), and the warning shows only HH:MM, so it looked like a false alarm. The seconds were inferred from the code, not read from the library.

- **Rule (`overlapping`, `src/modules/meetings/shared/meeting-entries.ts`):** both sides are compared in whole minutes (seconds dropped). Touching is still not an overlap; an overlap of a minute or more still warns. A running block lasts until `now` but occupies at least its first minute. It is the same function for the meeting page (`useMeetingClashes`) and the Hours rows (`MeetingRows`).
- Test: "ignores the seconds of a timer that stopped as a meeting starts". Typecheck, lint and tests pass; not driven in the app, not installed.

## A lecture's row in Hours names its series (9 Oct 2026)

A lecture's derived row showed only its subtask's title ("fNIRS", "fNIRS Practical Lab"), so two series with a lecture of the same name looked alike. The row's label is now "Series: lecture" (`lectureLabel`, `src/modules/training/shared/lecture-entries.ts`), the series being the note's own `series`. A note with no series, or a title that already equals the series, shows the title alone. Only the derived Hours rows change; the task, the note and the totals do not. Test: "labels a lecture without a series by its title alone". Typecheck, lint and tests pass; built and installed on 9 Oct 2026, not driven (the installed app reads the real library, so it was not launched from here).

## Delete a task's time for a day (9 Oct 2026)

Hours rows are one per task per day (sessions and typed time added together), not one per entry, so Delete on a row is a new rule, agreed with the user: it removes all of that task's saved time for the day.

- **Rule (`deleteTaskTime`, `src/shared/tracking/totals.ts`; store, IPC `tracking:delete-task-time`, `window.api.tracking.deleteTaskTime`):** removes the day's ended sessions and typed time for the row's task and client (same matching as the row). Kept: a running session (Discard is for that), history linked to a task (`earlier`, its hours are already in ClickUp's time) and derived blocks (meetings and lectures, edited in their notes). Nothing is recalculated: other sessions keep their frozen minutes, so the rounding carry does not move. `TaskRow.removable` says whether Delete would remove anything; a row without it (only `earlier` time) or running shows no Delete.
- **UI (`TaskList.tsx`):** one quiet **Delete** (Trash2, same look as the popover's Discard) at the end of every row on Today and in an opened week day, with a Cancel-first dialog ("1:15 on Draft methods will be removed from this day, and from the task's tracked time."). Meeting and lecture rows (`MeetingRows`) have none. The column is always reserved, so times line up.
- **Effects:** day, week, balance and hours so far drop at once; a task's tracked time and its by-month list (`trackedByTask`, `hoursByMonth`) read the same sessions and typed time, so they drop with it (tests). No tombstone: the time is gone.
- **Found by a test:** the first version also matched a derived block with the same label; it now skips derived ones explicitly (mutation-checked, as is the `earlier` rule).
- **Driven (scratch library, dev and production build, screenshots looked at):** Cancel changes nothing; confirm removes both sessions of a task on Today (file and totals checked); week day rows offer Delete; a running timer's row has none; Discard on a taskless timer removes it and leaves no session. **Not driven:** Work's Hours, a task-linked row (the Tasks Time card is covered by tests only), a derived row on screen.
- **Open (not changed):** Stop and the idle Start chip share a spot in the top bar; a double-click on Stop may start a taskless timer. Not reproduced here.

## Work's Hours: Delete, Undo and Discard driven (11 Oct 2026)

Queue item B (`docs/ROADMAP.md`). Driven on a scratch Work library (a contract with two clients, task-linked and label-only sessions and typed time), in dev mode and in the production build, with real keystrokes, screenshots looked at.

- **Works:** Delete on a Work week day lists one trash button per row; Enter on the dialog does nothing (Cancel has focus); confirm removes the sessions and typed time of the row's task and client only (same label for the other client is untouched); day, week, "Hours so far" and the average week drop at once; the toast's Undo restores the time; Discard on a running timer started in Work removes it and leaves no session.
- **Bug found and fixed:** Undo put the time back as typed time **without the task link**. A deleted row takes its `task` with it, and Undo re-typed the minutes by label and client only, so a task-linked row (every Work hour has one) came back label-only and its time left the task's tracked time and monthly list. `setTaskMinutes` now takes an optional `task` (through `Api`, IPC, preload and store) and uses it when the row has none left; the dialog's Undo passes the row's task. Test in `totals.test.ts` (mutation-checked: without the fallback it fails). Re-driven in both modes: the restored entry carries `cc://task/...`.
- **Left as is (small):** after Undo the restored row moves to the end of the day's list, and sessions of the row come back as one typed entry (the minutes are the same). The confirm text says "removed" for the whole row total even when part of it is `earlier` history, which stays; only a row with such history shows it.
- Not driven: a task-linked row on the task page's Time card (covered by tests).

## A training is "Series: title" everywhere (9 Oct 2026)

The Training landing's "Recent and upcoming" list showed a title without its series, so an entry like "Lecture 1" did not say what it belonged to. Hours rows already read "Series: lecture" (previous section), so the user asked for one pattern, not a second one.

- **One helper:** `lectureLabel(series, title)` (`src/modules/training/shared/lecture-entries.ts`, now exported) gives "Series: title". It returns the title alone when there is no series, when the title is the series, or when the title already starts with "Series:" (older notes have titles such as "DataCamp: R basics"; the series must not be doubled).
- **Used in:** the landing's recent list (the title itself; no separate line, and `RecentRow` is unchanged), the "Mentioned in" panels (`titleOf` in `src/main/entities/backlinks.ts`), the entry page heading (label, then the date), and the search hit's title (its detail is now only the date, since the series would repeat). Hours rows, as before.
- **Not changed:** the Training table keeps Series as its own column; the Person page's Trainings list keeps the series in its note column; the PDF report keeps its series tag; a lecture's subtask keeps its bare title, because a task page and the task lists always show it under its parent. Training entries are not an entity kind, so there are no chips for them.
- **Added the same day:** the Research landing's Training card ("Latest: …") had been missed; it now uses `lectureLabel` too (`TrainingCard.tsx`).
- Tests: the backlink title ("PS5210: Lecture 1", a bare title without a series) and the search hit. Typecheck, lint and tests pass; not driven in the app.

## The Time card names what it shows (9 Oct 2026)

The task page's Time card always listed "Earlier, from ClickUp" and "In Hours", even at 0:00. Both labels were unclear ("Hours" is an internal module name, and where the time came from does not matter to the reader), and a task with no time looked broken.

- **Earlier:** ClickUp's older time (undated, imported) is one line, "Earlier", shown only when it is above zero. It now shows next to month lines too; before, it was hidden whenever any month existed, so the lines did not add up to the total.
- **Months:** tracked time shows by month ("Oct 2026"), as before.
- **No time at all:** the card shows the current month at 0:00 instead of two zero lines. The "In Hours" line is gone.
- Code: `src/modules/tasks/renderer/TaskTimeCard.tsx` only. The card shows the task's own time; the total still includes subtasks. No test covers the card; typecheck, lint and tests pass; not driven in the app.

## Copying a to-do leaves the checkbox out (9 Oct 2026)

Copying notes into Word carried the checkboxes of TODOs over as ☐ / ☑ characters, which are just text there and cannot be ticked.

- **Rule:** in the HTML flavour of a copy (`markdownToHtml`, `src/renderer/src/editor/live-html.ts`) a `TaskMarker` writes nothing, so a to-do pastes as a plain bullet with its text. Ticked and open to-dos look the same outside the app.
- **Not changed:** the plain-text flavour is still the Markdown (`[ ]` stays); a paste back into the app uses the Markdown the copy carries, so the checkboxes come back there.
- Test: `live-html.test.ts` ("draws nested bullets and numbers, and leaves checkboxes out"). Typecheck, lint and tests pass; not driven in Word.

## Entity kind `file` (9 Oct 2026)

A note can link to a file kept beside the notes (a spreadsheet, a PDF): `@` lists it under "Files", it is drawn as a chip with a file icon, and Cmd-click opens it in the app the Mac chooses (`shell.openPath`).

- **Address**: `cc://file/research%2FData%20Sources%20Summary.xlsx`, the path inside `notes/notes/`. A file has no front matter for a `uid`, so **moving or renaming it breaks the link** (the chip shows struck through, "No longer available"). Chosen over a hash or an index because the files are put there by hand and rarely move.
- **Which files**: those directly in `notes/notes/<research|work|life>/` that are not `.md`, not hidden and not symlinks (`src/main/entities/files.ts`). Keys are checked with `isSafeFileKey` (`src/shared/entity-files.ts`) before the disk is touched, so a hand-written link cannot reach outside that folder.
- **Wiring**: `fileEntities` in the Notes manifest (`modules/notes/renderer/entities.ts`); `EntitySummary` gained `open` (wins over `route`); `window.api.entities.listFiles / fileInfo / openFile`.
- **Not done**: a "Mentioned in" panel for files (a file has no page); a way to add files from inside the app.
- Checked in the built app on a scratch library: picked with `@`, saved as the link above, drawn as a chip. Opening in Excel was not clicked.
- **Applied to the real library, 9 Oct 2026**: the line "Full comparison table" in Research's Data Sources Summary note now links its spreadsheet (backup `backups/file-link-2026-10-09/`). The app was rebuilt and installed in `/Applications`.

## Cmd-Left and Cmd-Shift-Left in a list item (9 Oct 2026)

Cmd-Shift-Left used to select the bullet with the text, because the line boundary of a top-level item is the bullet itself (only a nested item's boundary fell inside the marker, where `outOfMarkers` moved it to the text start).

- **Rule** (`listStep`, `src/renderer/src/editor/live-motion.ts`): in a bullet, number or checkbox item, a line-start motion goes in two steps. From inside the text it stops at the start of the text; from there (or from before it) it goes to the start of the line. With Shift the first press selects the text only, the second the whole item, so deleting then removes the item. Cmd-Left and Cmd-Shift-Left behave the same (the user's choice, 9 Oct 2026), and so do Home and Shift-Home.
- **Not changed**: a wrapped row of an item still goes to its own visual row start; headings, quotes and plain lines keep the default; Shift-Up/Down and Option-Shift-Left are untouched.
- Tests in `live-list-drawing.test.ts` press Home and Shift-Home (jsdom is not a Mac, so the Cmd chords are not pressed). Typecheck, lint and tests pass. Not driven in the built app, and the real-library editor gate was not run.

## Timer popover, stage 1: the picker (9 Oct 2026)

Plan: `docs/TIMER_POPOVER_PLAN.md`. Stage 1 only (`TaskPicker.tsx`, `start-picker.ts`); the popover layout is stage 2.

- **List on every row**: `detailOfTask` is now the task's list; a subtask shows its parent's list (before, its parent's title).
- **Create row**: `Create "X" in [List ▾]`, always last once something is typed. The list is the New task dialog's `ListField`, so the same menu and, in Work, only client lists (a new name can only be a sublist). Until changed, the default is shown, never silent. `listForNew(open, clients, last, hint?)`: Work, the time's client (`hintClient`), else the last list if it is a client, else the first client; Research, where a task was last added, else the first list, else Inbox. The client of the new task is then told from the chosen list like any other task's.
- **Layout**: the matches list no longer scrolls (at most eight rows) so the list field's menu is not clipped; the list stays open while focus moves into the Create row.
- **Tests**: `start-picker.test.ts` for the two rules. Not driven in the app yet (stage 3), and the Today, Add time and meeting Task field uses were not looked at.

## Timer popover, stages 2 and 3: the popover, and the check (9 Oct 2026)

Plan: `docs/TIMER_POPOVER_PLAN.md`. Stage 2 built the layout (`TimerChip.tsx`, rules in `src/modules/hours/shared/timer-popover.ts`); stage 3 drove it in the real app and fixed what showed.

- **Popover**: the five states of the plan, top block always the running timer (title, its list, `Started [hh : mm] · 0:01`, Stop, Discard); no Switch; the Client select only for an old entry with a name but no task; Stop greyed out with the hint in state 5.
- **Running task's list** (`popoverHead`): the task is looked up among all tasks (`useTasksList`), not only open ones, so a done task still shows its list. A task that is gone shows none.
- **Picker rows**: the title takes the room and wraps; the list is quiet, right-aligned, `max-width: 40%`, one line with an ellipsis and the full name as a tooltip. Recent rows follow the same rule (the `.choices` grid had `minmax(0, 1fr)` missing, so a long row clipped its list).
- **Create row**: one line, `+ Create "X…" in [List ▾]`; the title truncates (tooltip), the list field shrinks (max 45%) with an ellipsis. The divider above it shows only when matches are above it. `GroupField`'s trigger now wraps its label in a span (`triggerLabel`) so it can truncate; its chevron does not shrink.
- **Narrow fields**: the meeting's Task field is about 260px wide, and its list inherited `white-space: nowrap`, so the title overlapped the list text. The list now has `min-width: 320px` and `white-space: normal`.
- **Checked** on a scratch library with a long title, a long list name and a subtask: production build and dev mode, light and dark; states 1 to 5, Recent, Today (match and create), a past day's Add, the meeting Task field. Work and the done or trashed running task were checked afterwards (below).
- Typecheck, lint and tests pass.

### The two checks that were left (9 Oct 2026)

Driven in the real app on a scratch library with a Luminos contract (clients Impact, Teaching & Learning): production build light and dark, dev mode light. Nothing was broken, so no code changed.

- **Work, client lists.** The Create row defaults to a client list (Impact) and its list field offers only the clients, plus "new sublist" inside them. Picking a task in a client's list starts the timer with that client, with no "Which client?" question. Stop with no task (state 5) asks "Which task was this?", Stop is greyed out, picking a task stops the timer with its client. The meeting Task field proposes "<Client> meetings" in the client's list; one click creates it, Other opens the picker.
- **A running task that is done:** the popover still shows its list. **Trashed:** the timer keeps running and the popover shows the label with no list line (as decided: a task that is gone shows none).
- **Left as it is:** in the meeting's narrow Task field a long title squeezes the Create row's list to "Imp…"; and the Today row still shows the Client select for a running timer with no task or a trashed one (the legacy exception). Not driven: dev mode for the done and trashed step, dark mode for it, the installed build before this install.
- Playwright pins the colour scheme to light: emulate dark with `page.emulateMedia({ colorScheme: 'dark' })` (a `settings.json` theme alone does not show in its screenshots).

## `/todo` in every notes editor (9 Oct 2026)

The TODO helper (`/todo` or Cmd-Shift-T, owner menu) is no longer Meetings'. It lives in `src/renderer/src/editor/` (`todo-live.ts`, `useTodoHelper.tsx`) and `LiveEditor` installs it itself, so every note, task description, training entry, reading list and Readings note has it. Owners are the whole people list; a meeting passes `attendees` to have them suggested first. The shortcut is listed once under Settings → Shortcuts → Notes editor (the Meetings group is gone). What it writes is unchanged (`- [ ] **TODO(XX)**: `); only meetings read TODOs as structure (Previous TODOs, open TODOs), elsewhere it is plain text. Checked by driving the built app in a Notes note.

## A timer started on a task puts it in progress (9 Oct 2026)

Starting a timer on a task, or giving a running timer its task, sets the task to In progress when it is still To do. A done task stays done (my reading: working on a finished task is not a reason to reopen it; change `setTaskStarted`'s hook in `src/main/index.ts` if the user wants that). `TrackingStore.setTaskStarted(fn)` is the seam, called after a successful `start` with a task and after `assignTask` (both the same-file and the moved-contract case); `main/index.ts` gives it a `TasksStore` and broadcasts `TASKS_IPC.changed` so an open Tasks page refreshes. Meeting and lecture hours are derived, not timers, so they are unaffected. Tests: `src/main/tracking/task-started.test.ts` (they mirror the hook; the wiring in `index.ts` itself is driven only by the app).

## Consistency sweep (9 Oct 2026)

A review for UI, label and behaviour mismatches; the user decided which differences were deliberate. Typecheck, lint and tests pass; **not driven in the app** (changes are small and mostly CSS, labels and one confirmation dialog).

- **`CreateButton`** (`src/renderer/src/components/`): New note, meeting, list and training entry were four copies of one component, each with inline error styling. Each now passes only a `create` function; a refusal shows beside the button in one style.
- **`Button` variant `danger-outline`**: the Delete button on the note, meeting, training entry, reading list and task pages (five identical `.delete` rules) uses it.
- **"Couldn’t …"**: 13 user-visible "Could not …" messages (stores, Time off, Hours, Meetings, Training, people) now say "Couldn’t …", as the rest of the app does. `console.error` text is unchanged.
- **Time off rows** say **Delete** (not Remove) and ask first ("Delete this day?"), like Hours rows. People keep "Remove" (it archives or merges).
- **Hours days are month first**: `formatDay` gives "Thu, Oct 1" (was "Thu 1 Oct") and `formatRange` "Sep 28 – Oct 4", matching "Sep 24, 2026" everywhere else. The Work importer's contract labels (already applied) are unchanged.
- **Training's button is "New training entry"**, as in the palette and Dock (it was "New entry"; earlier write-ups still say "New entry").
- **Notes empty state** says "Try a different search or filter." like the other modules.
- **Tokens**: the task context menu and toast use `--radius-control` (were 10px); a task-table subtask row uses `--text-13` (was 13.5px).
- **Relative time** (Readings sync) falls back to `formatDate`, not the system locale.
- **Left as it is (the user confirmed)**: floating panels use `--radius-control` for small menus and `--radius-card` for larger popovers, on purpose.

## Punctuation after a hidden marker (9 Oct 2026)

A full stop after italic text (`*General*.`) could wrap onto a line of its own. CodeMirror puts an empty `img.cm-widgetBuffer` beside every replaced (hidden) range, and a line may break at either side of an image; the closing `*` is one such range. Chips already had the fix (the image taken out of the flow with `position: absolute`, which keeps it in the DOM so the caret sits where it did); it now also covers the images beside hidden markers: `span[contenteditable='false']:empty:not([class])` is how a classless `Decoration.replace({})` shows up (checkboxes, bullets and chips have classes).

- Found and checked in Chrome with the real `createLiveState` on a bare page, sweeping the width one pixel at a time (150 to 300, and 300 to 520 for the original line): before, italic, bold, code, strikethrough and links each hung a `.` or `,` at one or more widths; after, none. Opening brackets and quotes before a marker never wrapped. Not driven in the app itself. Not checked: headings, quotes, escaped characters (`\*`).
- If another hanging mark shows up, look first for a widget buffer beside it.

## Escape in full screen, and renaming an hours row (9 Oct 2026)

Two things the user found on Today (a running row's name field in full screen). Typecheck, lint and tests pass; **not driven in the app** (the built app was installed, not exercised).

- **Escape leaves full screen only when the page did not want it.** The main process used to leave full screen on every plain Escape (`before-input-event`), so Escape in a rename field cancelled the edit _and_ left full screen. That check is gone from `src/main/index.ts`. `useEscapeFullScreen` (`src/renderer/src/shell/`, in `Shell`) listens on `window` in the bubble phase and calls the new `app.leaveFullScreen` IPC (`app:leave-full-screen`, a no-op outside full screen) unless `escapeLeavesFullScreen` says no: the key was already used (`preventDefault`, or `stopPropagation`, which keeps it from reaching `window`), it has a modifier, the focus is in an input, textarea, select, contenteditable or `.cm-editor`, the focused element sits in an `aria-expanded="true"` control, or a `dialog[open]`, menu, listbox or dialog is on the page. The focus and open-layer rules are a net for the ~40 Escape handlers that do neither `preventDefault` nor `stopPropagation`; a new popup that uses Escape and has none of those signs would also leave full screen, so give it `aria-expanded` or `role="menu"`.
- **Renaming a row renames its task.** An hours row's label was a copy of the task's title taken when the session started, so editing it renamed only that day's label and left the task, and any other day, behind. Now `renameRow` (`src/modules/hours/renderer/rename-row.ts`): a row with a task renames the task (`tasks.update`); a row with no task yet still changes only that day's label (`renameTask`).
- **A task renamed anywhere renames its hours.** The tasks `update` handler tells `title-hook.ts` (`notifyTitleChanged`) when a title was sent; `main/index.ts` sets the listener to `TrackingStore.relabelTask(taskKey(uid), title)`, which rewrites the label of every session and typed entry that carries the task, in every workspace, contract and year file (rule `relabelTask` in `src/shared/tracking/timer.ts`; minutes untouched; files that need no change are not rewritten). The hook is a module-level setter, like `setTaskStarted`, because Tasks' own store instance is not the app's tracking store. Without the listener (tests, scripts) only the task changes. Not done: a task's subtasks and meeting or training derived entries keep their own titles (derived entries read the note, not a stored label).
- **A refused rename says why.** `TaskList` shows the error under the list (`role="alert"`) and leaves everything as it was.
- Two different tasks with one title on one day show as one row (rows group by label and client); this was already true and is unchanged.

## Notes in Life, driven in the app (9 Oct 2026)

"Notes in Life" (7 Oct) built the module but left `/life` showing the generic "Nothing here yet" placeholder (`WorkspaceEmpty`), so nobody had actually opened Life's Notes in the running app. Life now gets the same landing page as Research and Work.

- **`LifeLanding.tsx`** (`src/renderer/src/shell/`) renders `WorkspaceLanding(workspace="life")`, same as `ResearchLanding`/`WorkLanding`; `Shell.tsx`'s `/life` route uses it instead of `WorkspaceEmpty`, which is deleted (nothing else used it). The Notes card (already registered, `landingCard: NotesCard`) now shows on Life's landing page.
- **Bug found by driving it**: `NotesLanding`'s back link (`backLabel={workspace === 'research' ? 'Research' : 'Work'}`) had no Life case, so Life's Notes page read "← Work". Switched to `WORKSPACE_LABELS[workspace]`, the same pattern `HoursPage` and `TimeOffPage` already use. This had been sitting in the 7 Oct code the whole time; type-checking and unit tests never exercise a rendered label string.
- Checked on a scratch library, production build: opened Life, saw the Notes card, opened Notes, created a note, typed into it, reopened the app and saw it listed and the breadcrumb reading "← Life". Typecheck, lint and the full test suite pass.

## Readings sync, stage 1: skip blank entries at parse time (9 Oct 2026)

Plan: `docs/READINGS_SYNC_PLAN.md`. Stage 1 only: `parseBib` (`src/modules/readings/main/parse-bib.ts`) now leaves out any `.bib` entry with no title, no author/editor and no year — e.g. a Zotero item created by hand with nothing filled in yet, like the blank "Report" entry that prompted the plan. It never becomes a `SyncedFields` row, so it never reaches `applySync` and is never inserted.

- The skip sits after `authors`, `editors`, `year` and `fullTitle` are computed, so it reuses the same blank checks the rest of the function already does (`toCreatorList` returns an empty array, `toYear`/`toText` return `null`/`''`). An entry with _any one_ of the three — only a year, only a title, or only an author — is still kept.
- Fixture: added `@report{blankPlaceholder2026,}` (title, author, editor and year all absent) to `tests/fixtures/readings-sample.bib`; `parse-bib.test.ts` asserts it's left out, plus a synthetic minimal case and the three "keeps a partially-filled entry" cases.
- Mutation check: commented out the skip, confirmed three tests failed (the blank fixture entry and the two synthetic blank cases appeared in the result), restored it.
- Typecheck, lint and the full test suite pass. Not driven in the app (no UI or sync-flow change; stage 2 touches `applySync` and is the one to drive against a scratch copy of the real library, per the plan's closing note).

## Readings sync, stage 2: delete-if-unattached when missing (9 Oct 2026)

Plan: `docs/READINGS_SYNC_PLAN.md`. A citekey missing from the Zotero export, found missing for the first time, is now deleted outright if nothing is attached to it — no notes, no Reading Lists mention, no `@` mention anywhere — and flagged `missing_from_source` otherwise, same as before. `status` and `tags` never protect a row (open question 1); no deletion trace is kept (open question 3). A citekey already flagged from an earlier sync is left exactly as it is: no retroactive deletion sweep, no re-counting.

- **`applySync`** (`src/modules/readings/main/repository.ts`) takes a fourth, optional `mentionedCitekeys: ReadonlySet<string>` (default empty). For each citekey that's newly missing (absent from the incoming export, not already flagged), it checks `has_notes` (already a column on the row, no I/O), a `reading_list_mentions` lookup (indexed, prepared only when there's at least one candidate, so a test or caller without the Reading Lists table never pays for it), and membership in `mentionedCitekeys`; attached rows are flagged as before, bare ones are `DELETE`d, inside the same transaction.
- **The `@` mention set** is built once per sync, not per citekey (`findBacklinks` reads every file per call — fine for an on-demand "Mentioned in" panel, too slow here). New `collectMentionedReadingKeys` (`src/main/entities/reading-mentions.ts`) scans every folder `backlinkFolders` already lists (notes for all three workspaces, meetings, training, reading lists, reading notes, training plans) plus every task description (same `tasks` table query `findTaskBacklinks` uses), and collects every `cc://reading/<citekey>` found into one `Set`.
- **`SyncService`** takes a new `findMentionedCitekeys` option (`() => Promise<ReadonlySet<string>>`, default empty set); `register.ts` wires it to `collectMentionedReadingKeys(db, backlinkFolders(paths))`. The scan runs once per sync, after the `.bib` parses and before `applySync`, inside the same try/catch as the rest of the sync, so a scan failure is recorded as a sync error and changes nothing (consistent with "a failed parse or read changes nothing").
- **`SyncCounts`/`SyncRun`** gained `deleted`; `sync_runs` gained a `deleted` column (migration `readings/0003_deleted_count`, additive, default 0 — the shipped `0001_init`/`0002_reference` migrations are untouched even though `0001`'s top comment ("Rows are never deleted by sync") is now only historically true). `SyncSummary.tsx` shows "N removed" alongside "N no longer in Zotero" when it happens.
- **`CLAUDE.md`**'s Readings "Never" line now states the real rule instead of "never delete a readings row."
- Tests (`repository.test.ts`, `sync-service.test.ts`, new `reading-mentions.test.ts`): a notes-bearing, a Reading-Lists-mentioned and an `@`-mentioned row each kept (one test per path, plus one combining Reading Lists + `@` in `sync-service.test.ts`); a bare row deleted, not flagged; status/tags don't protect a bare row; an already-flagged row is left alone on a later sync even after its attachment is removed (no retroactive deletion). Existing "missing from source" tests that used to exercise bare citekeys now attach notes first, since a bare row's new fate is deletion, not flagging. `repository.test.ts` and `sync-service.test.ts` both now also run `readingListsMigrations`, since `applySync` queries that table whenever there's a newly-missing citekey to evaluate.
- Mutation check, both directions: forced the attached branch to always flag (`if (true)`) — the two delete-path tests failed, as expected; reverted. Forced `attached` to always be `false` — thirteen flag/keep tests across both files failed (notes, Reading Lists, `@` mentions, and the already-flagged-stays-flagged case), as expected; reverted.
- **Driven against a scratch copy of the real library** (`CENTRAL_COMMAND_HOME`, production build, Playwright): copied `~/CentralCommand`, pointed the copied `settings.json`'s `zoteroExportPath` at the copied `.bib` (copying the folder carries over the _real_, absolute path, which the first attempt missed — it read the live export from `~/CentralCommand` by mistake, harmlessly, since only the scratch database was written to), then removed four real entries from the copied `.bib`: one bare, one with notes, one with a Reading Lists mention, one with only an `@` mention (in a plain note). Synced: the bare one vanished from the table entirely; the other three gained "Not in Zotero" and showed up under "4 readings are no longer in your Zotero export. Your notes are safe."; the one pre-existing flagged row from before this stage (the original blank "Report" item that started the plan) was untouched. `sync_runs`: `entries_seen 187, flagged_missing 3, deleted 1`. Toggling "Show all" showed the remaining 187 normally. Typecheck, lint and the full test suite pass.

## Readings sync, stage 4: suggested rename matching by title/authors/year (10 Oct 2026)

Plan: `docs/READINGS_SYNC_PLAN.md` (open question 2, answered 10 Oct: the existing "no longer in your Zotero export" banner grows a row per suggestion, and Dismiss is permanent per pair). A vanished citekey and a newly-seen one that match on title + authors + year, but share no DOI/URL, are no longer just flagged and inserted as unrelated rows: the pair is recorded as a suggestion and surfaced for the user to confirm or dismiss, rather than merged automatically the way a DOI/URL match (stage 3) is — a coincidental title/author/year share could splice notes onto the wrong work.

- **`rename_suggestions`** (migration `readings/0004_rename_suggestions`): `old_citekey`, `new_citekey`, `status` (`pending`/`dismissed`), `created_at`, `UNIQUE (old_citekey, new_citekey)`. A dismissed row is kept, never deleted — its unique pair is what makes the dismissal permanent for that exact pair (not for either citekey alone, since the same old citekey could legitimately pair with a different new one later): `applySync` always `INSERT OR IGNORE`s a fresh match, so a pair already present (pending or dismissed) is left exactly as it is.
- **The match itself** (`repository.ts`) reuses stage 3's `matchByKey` with a new composite key (`title.trim().toLowerCase()`, the serialised authors, the year — undefined, so never matched, if title or year is blank), computed only among vanished citekeys that are _attached_ (would be flagged, not deleted) — a bare row is about to disappear in the same sync regardless of any match, so a suggestion for it would have nothing left to link into once gone. "Attached" is now computed once, up front, for every remaining vanished citekey (previously inline, only for ones not already flagged); an already-flagged row from an earlier sync counts as attached by the invariant stage 2 established (a bare row is never left flagged), so it's eligible for a suggestion on a later sync too, without re-querying `has_notes`/`reading_list_mentions` for it. The match never removes anything from `vanished`/`appearing` (unlike stage 3's merge): both rows are inserted/flagged normally, same as if no match existed.
- **`listPendingRenameSuggestions`** joins the table against `readings` on both citekeys and only returns `status = 'pending'` rows — besides filtering dismissed ones, the join itself is a second line of defence: a suggestion whose row got deleted some other way (there's no such path today, since the matched candidate is always attached) simply stops showing up rather than erroring.
- **`linkRenameSuggestion`** applies the same merge stage 3's automatic DOI/URL match does, by hand: the duplicate row under the new citekey (inserted by the sync that raised the suggestion) is deleted first — `citekey` is `UNIQUE`, and the old row is about to take it — then the old row (keeping its `id`, notes, `reading_list_mentions`) is relabelled to the new citekey with the new row's current synced fields (status/tags included, same "the newer data wins" rule as stage 3), and the suggestion row is deleted. `register.ts` then moves the reading's own notes file on disk (`notes.rename`, the same helper stage 3's automatic rename uses).
- **`dismissRenameSuggestion`** only flips `status`; neither `readings` row is touched.
- UI: `useRenameSuggestions` (new hook, same shape as `useReadingsList`) feeds `ReadingsPage`, which now renders one more `Notice` row per pending suggestion, below the existing missing-count banner, reusing its `styles.notice`/`styles.link`: "X looks like it may now be Y — link them?" with a Link button (calls `renameSuggestions.link`) and the `Notice`'s own Dismiss. Both actions bump a local `actionVersion` that's folded into the same `refreshKey` already driving the readings list and counts, so the table, the missing-count banner and the suggestion rows all refetch together without a real sync.
- Tests (`repository.test.ts`): a title/author/year match with no DOI/URL on either side produces a suggestion, not a merge; Link survives id/notes/`reading_list_mentions`; linking an unknown id is a no-op; Dismiss clears the suggestion without touching either row; a dismissed pair doesn't resurface even when the match is genuinely recomputed on a later sync (the realistic path: the new citekey's own bare row later vanishes and gets deleted by stage 2, then reappears, making it "newly seen" again); a pair that also shares a DOI is handled by stage 3's automatic path and never suggested; an ambiguous title/author/year share produces no suggestion; a bare vanished citekey is never even written to `rename_suggestions`, not just hidden by the join.
- Mutation check, two places: disabled the title/author/year match entirely — the 4 tests that expect a suggestion to exist failed, the 4 that expect one _not_ to (ambiguous, DOI-sharing, unknown-id, bare-row) still passed, as expected; reverted. Disabled the attachment filter on its own — the bare-row test (checking `rename_suggestions` directly, not just the joined view) failed, as expected; reverted.
- **Driven against a scratch copy of the real library** (`CENTRAL_COMMAND_HOME`, production build, Playwright): seeded notes for two real readings so they'd stay attached, synced once, then in a copied `.bib` renamed both citekeys and stripped their `doi`/`url`/`urldate` lines (forcing the low-confidence tier rather than stage 3's). Resynced: both appeared as pending suggestions with the correct short citations ("Abadie et al. (2023) looks like it may now be Abadie et al. (2023) — link them?", same for Abdullah et al. (2015), since the short citation is author+year and doesn't include the citekey). Clicked Link on one: the suggestion row disappeared, the old citekey was gone, the new citekey carried the old notes (`hasNotes`, the note file itself under the new filename) and tags, `missingFromSource` cleared. Clicked Dismiss on the other: the row disappeared, neither reading changed. Forced a second sync (`sync.now()`) with nothing else changed: the suggestions list stayed empty and neither row reappeared in the banner. Typecheck, lint and the full test suite pass.

## Feedback on adding and removing rows (10 Oct 2026)

The user: "Removing an entry is very quick, which is great, but there is no visual feedback like the list moving so it's hard to know if its happened unless you check. New addition should also be briefly indicated so I know where to look. Make sure other interactions also display feedback. Then apply the same pattern for other similar interactions. I am going to be away for a while so build this without guidance." Built, not pushed, not installed.

- **Shared primitives, not a one-off**, so the pattern reads the same everywhere it's used (the user's "reuse, don't build a variant" preference):
  - **`src/renderer/src/components/toast-store.ts` + `Toast.tsx`**: Tasks' own `task-toast.ts` (a short message with an optional "Undo" action, shown a few seconds) is promoted to a shared store, mounted once by `Shell.tsx` instead of per-module. Tasks now imports the shared `showToast` instead of its own copy; `TaskGlobals` lost the toast it used to render. One toast for the whole app, not two independent ones.
  - **`src/renderer/src/components/useNewRowKeys.ts`**: which of a list's keys appeared only after the hook first ran — never a page's own rows on open, only ones a later add or edit brings in (an edit reads as a new row when its key includes the field that changed, e.g. Time off's `date|type`, so an edit that moves a day also flashes it at its new spot). Each key flashes once, for 1.4s, with a `row-added` keyframe (`--selected-bg` fading to transparent) that must be declared **inside each consuming CSS module**, not shared from `tokens.css`: Vite's CSS Modules scope an `animation`/`animation-name` value to local keyframes of that same file, so a shared global one is silently never matched (confirmed live: `animationName` computed to a hashed name with no matching `@keyframes`, so nothing animated, though the class itself was applied correctly the whole time — a bug invisible without opening DevTools, not caught by a screenshot).
  - A real bug, found only by driving the app: the first version tied the "clear the flash after 1.4s" timer's cleanup to the add/edit-detecting effect's own re-runs (`useEffect(..., [keys])`), so when the list re-rendered for any other reason before 1.4s was up, the cleanup cancelled the pending timer and the effect's next run found nothing new to schedule — the highlight stuck forever. Fixed by keeping one timer per flashing key in a ref, cleared only on the hook's own unmount. A regression test reproduces it (several same-content renders in a row, then advance the fake timer) and fails on the old code, confirmed by temporarily reverting the fix and watching it fail.
- **Time off** (`TimeOffList.tsx`): a day just added, or moved here by an edit, flashes; Delete now shows "Removed Mon, Oct 12. Undo" (undo re-adds the same day and type, and says so if that fails) instead of the row just vanishing.
- **Hours' `TaskList.tsx`** (Today and Week share it): the same two changes — a newly added task flashes, Delete shows "Deleted "X" (1:00). Undo", undo calls the same `onSetMinutes` the row's own time edit uses. One change in the shared component covers both pages.
- **Not changed, flagged for later** (candidates that are the same shape of problem — a chip or row added/removed in place, nothing to show it happened — but each needs its own look before changing): `SkillsField`/`PeopleField` chips (Meetings, Training, People — arguably already visible enough, since the chip appears right next to the click), Settings → Hours' `ClientFields` chips, and Reading Lists' entries. Listed in `docs/ROADMAP.md` for review rather than changed now, to keep this round to what was asked plus its truly identical twin.
- **Driven against a scratch library** (`CENTRAL_COMMAND_HOME`, dev mode, Playwright, CDP): added a day in Time off, watched its `className`/computed `background-color` move from `rgba(220,230,238,0.98)` down to fully transparent over ~1.4s and the class disappear (not stuck); deleted it, saw the toast, clicked Undo, saw the day return. Same for an Hours task: added with a typed duration (not a running timer, since a 0:00 stop discards the row entirely — unrelated, pre-existing behaviour), watched it flash, deleted it, saw "Deleted "Undo test" (2:00). Undo", clicked Undo, saw the row return with its 2:00. Typecheck, lint and the full test suite pass; new tests for both shared primitives, including the stuck-flash regression.

## Readings sync: catching up the row that started the plan (11 Oct 2026)

The user found the exact "Untitled (n.d.)" / "Not in Zotero" row that prompted `docs/READINGS_SYNC_PLAN.md` still sitting in the real library after stages 1–4 shipped: `applySync`'s delete-if-unattached logic (stage 2) only decides a citekey's fate the first time it is newly found missing, and treats any citekey already flagged `missing_from_source` as attached by invariant (its own comment: "stage 2 never leaves a bare row flagged, so this never re-checks"). That invariant only holds for rows flagged _after_ stage 2 shipped (9 Oct 2026); `zotero-item-474` was flagged by the old pre-stage-2 code, which never checked attachment at all, so it was genuinely bare (no notes, no Reading Lists mention, no `@` mention) and permanently stuck.

- **`findOrphanedFlagged`/`deleteOrphanedFlagged`** (`src/modules/readings/main/repository.ts`): the same unattached check `applySync` applies to a newly-missing citekey, run instead over every row already flagged `missing_from_source`. `deleteOrphanedFlagged` re-checks the condition at delete time (notes, `reading_list_mentions`, `has_notes`) rather than trusting the earlier read, so a row that gained an attachment between planning and applying is skipped, not swept up.
- **`npm run cleanup:orphaned-readings [-- --apply]`**: dry run by default, lists what it would delete; `--apply` backs up the database (`VACUUM INTO`, `~/CentralCommand/backups/cleanup-orphaned-readings-<time>/`) and deletes, app closed. A one-time catch-up — once run, the invariant `applySync` already assumes is actually true, and a plain sync never needs it again.
- The script builds its own small `AppPaths`-shaped object and its own copy of `backlinkFolders`'s folder list rather than importing `src/main/paths.ts` or `src/main/ipc/entities.ts`: both pull in `electron` (`app`, and `ipcMain`/`shell`) at module scope for code this script never calls, which plain Node can't load.
- Tests (`repository.test.ts`): finds a flagged+bare row; leaves out one with notes, a Reading Lists mention, or an `@` mention; leaves out a bare row that was never flagged; `deleteOrphanedFlagged` deletes exactly the given citekeys and reports the count; re-checking skips a citekey re-attached since planning. Mutation check: loosened the attachment filter to always match — the two "leaves out" tests on notes/mentions failed as expected; reverted.
- **Applied to the real library, 11 Oct 2026** (app closed first; backup `~/CentralCommand/backups/cleanup-orphaned-readings-2026-10-11T09-35-49-442Z/`): deleted `zotero-item-474` (the "Untitled (n.d.)" row), the only one found. `missing_from_source` count is now 0. Typecheck, lint and the full test suite pass.

## Readings: a stuck "no matching readings" page (11 Oct 2026)

The user opened Readings right after the catch-up above ran and saw "No matching readings" / "Try a different search or filter" with every visible filter control at its default (no search, All statuses, no tags) — only "Clear filters" brought the list back. Cause: `missingOnly` (the "readings no longer in your Zotero export" filter) has no control of its own in the filter bar — it's toggled only by the "Show them" link on the missing-count `Notice` banner (`ReadingsPage.tsx`). That banner, and so its only on/off switch, is itself gated on `missing > 0`. The user must have clicked "Show them" at some point while a row was flagged; `missingOnly: true` then sat in the remembered UI state (`settings.ui.moduleState.readings`, persisted by `useModuleState`) surviving restarts. Once the catch-up deleted the last `missing_from_source` row, `missing` hit 0, the banner — and the only way to turn the filter back off — vanished, leaving the page permanently filtered to "missing only" with nothing left to show, and no visible sign why.

- **Fix** (`ReadingsPage.tsx`): an effect clears `missingOnly` back to `false` as soon as `missing` reaches 0, so the filter can never outlive the one control that sets it.
- Typecheck, lint and the full test suite pass (no new unit test: the bug is in page-level effect timing, which the codebase doesn't unit-test for this page; covered instead by driving the app).
- **Driven against a scratch library** (`CENTRAL_COMMAND_HOME`, production build, Playwright): forced `missingOnly: true` into a scratch `settings.json` with zero missing-from-source readings, then confirmed the pre-fix build reproduced the bug exactly (blank list, "Clear filters" shown, `missingOnly` still `true` on disk afterwards) and the fixed build did not (the readings showed immediately and `missingOnly` was written back to `false`).

## Citekey markers to reading entities (11 Oct 2026)

The user asked for a review of the notes for text that should be an entity, naming `[@Harm2004]`. A sweep of the whole
library found exactly one such class left: the Pandoc/Obsidian citekey shorthand that came in with the imported Obsidian
notes — 23 markers over 6 distinct readings, in `notes/research/Study 1 Model.md` (18) and
`meetings/research/2025-10-22 Supervision.md` (5). Nothing else was outstanding: no wiki links anywhere, and
`npm run link:citations` finds nothing left to link (its 30 remaining plain-text citations all name readings that are not
in Zotero, so there is nothing to link them to). The marker form survived that earlier pass because `findCitations` looks
for "Author (Year)" or "Author, Year" and a marker is neither.

- **Rules in `src/shared/citations.ts`**, beside the plain-text pass rather than in the script, and reusing its
  `protectedRanges`, `sameName` and `Resolution`: `findCitekeyMarkers`, `resolveCitekeyMarker`, `citekeyLabel`,
  `apaNames`, `proposeCitekeys`, `applyCitekeys`, `undoCitekeys`, `unreadableCitekeys`.
- **A marker carries less than a citation does**: only the first author's surname and the year, never how many authors
  there were. So it is resolved on those two alone and linked only when exactly one reading fits; the label cannot come
  from the marker's own text and is built from the reading's authors instead (`apaNames`: "Pretorius",
  "Harm & Seidenberg", "Chang et al."). This is the one real difference from `link:citations`, which keeps the text the
  user wrote as the label.
- **Two label forms, chosen by what the sentence does with the marker.** The library already writes both: "Author (Year)"
  when the sentence reads the name out, "Author, Year" when it is a reference in brackets (`[Conn, 2017]` inside
  "(e.g., …)"). A marker gets the bracket form only when it _closes_ brackets it sits in — the next non-space character
  is `)` and a `(` is still open earlier on its line. That is narrower than "is inside brackets" on purpose: in
  "(like the agglutinating languages [@Pretorius2019] discusses)" the marker is inside brackets but is the subject of
  "discusses", so it needs the narrative form. The rule was checked against all 23 real markers and matches the
  hand-made judgement on every one (5 bracket form, 18 narrative).
- Brackets inside an existing `[label](addr)` link or inline code are not counted as open, or the already-linked
  `[Seidenberg (2011)](cc://reading/…)` earlier on the Supervision note's line would have made the `[@Harm2004]` after
  it look parenthetical.
- **Safety**: `undoCitekeys` puts every new link back to the marker it came from, and the script refuses to write unless
  that gives the original text byte for byte (and the line count is unchanged) — the same shape of check
  `link:citations` uses, but it cannot reuse that one, since there the label _is_ the original text and here it is not.
  Writes go through `writeNoteFileGuarded` against the hash read at the start, after copying each note to
  `~/CentralCommand/backups/link-citekeys-<time>/`.
- **The notes' own prose is not touched**, only the markers. Two sentences read a little oddly afterwards, exactly as
  they did before ("Ziegler & Goswami (2005) offers", singular verb for two authors, and "Chang et al. (2020) paper
  describes", missing possessive). Fixing those is editing the user's writing, not linking an entity, so they are left
  for the user; flagged in `docs/ROADMAP.md`.
- Mutation checks, all four caught by a test: resolution guessing the first of several candidates; `undoCitekeys`
  claiming the round trip held; every marker treated as parenthetical; `findCitekeyMarkers` ignoring protected ranges.
- **Tried on a copy of the real library** (`CENTRAL_COMMAND_HOME` pointed at a copy of `notes` plus the Zotero export):
  dry run and `--apply` both, then diffed against the originals — 23 links in 2 files, nothing ambiguous, nothing
  unreadable, and every changed line differs only at its markers. The copy then passed the real-library editor gate
  (`LIVE_EDITOR_LIBRARY`), so the new chips parse; the 4 failures that gate reports are pre-existing at HEAD on the
  user's unmodified notes (confirmed by stashing), unrelated to this change, and are listed in `docs/ROADMAP.md`.
- **Applied to the real library, 11 Oct 2026** (app closed first; the first attempt was refused by the sandbox and the user then authorised it explicitly): 23 links in 2 files, no markers left anywhere in the library, backup `~/CentralCommand/backups/link-citekeys-2026-10-11T10-33-06-476Z/`.

## People named in prose to person entities (11 Oct 2026)

Asked for straight after the citekey pass ("I want prose to be changed to entities as well"): the same treatment for
people the notes name in prose rather than in a field. 13 mentions of 6 people, all in Research meeting notes.

- **Two passes, because the first name question is the user's to answer.** The first pass linked full names only, on the
  reasoning that a first name is often ambiguous, often not the person, and often the writer's own shorthand. The user
  then asked for first names too ("replace people with entities where clear; ask me to map where not"), so a second
  pass links a first name that exactly **one** person in the list has, keeping the first name as the label
  (`[Kathy](cc://person/Kathy%20Rastle)`) — the shape `renamePersonMentions` in `entities.ts` already anticipates ("a
  label the writer chose, such as 'Kathy', stays").
- **A first name two people share is never guessed**: Caitlin (Baron / Collis) and Chris (Prosser / Cummiskey) are
  reported with their surrounding line for the user to map — 21 mentions. Robert (Darby / De Vries) appears only in
  front matter, so there is nothing to map; the first version of that report did not apply protected ranges and wrongly
  listed it, which would have sent the user looking for prose that is not there.
- **Two shapes of first-name false positive, both skipped with a printed reason** rather than silently:
  a capitalised word right after it makes it part of a longer name ("Thomas Henry Huxley", "Dr James D Williams",
  "**Name**: Ernesta Orlovaite" — a form field whose spelling lacks the diacritic, so the full-name pass did not catch
  it); and a year in brackets makes it a citation's author ("Collier and Thomas (2017)" is not Thomas Ormerod). An
  acronym does **not** count as a longer name, or "Share with Kathy PGR Student…" and "Ernesta OOO April 2" would both
  have been skipped — found by reading the skip list, which is why the script prints it. Five skips in the real
  library, every one correct.
- **Front matter is never touched.** `attendees:` and `lead:` are structured fields with their own UI, so a person's
  name there is already data, not prose. Headings are skipped too: the one full name the pass now leaves behind is the
  `### Michael Crawford` section title in `2026-07-29 Supervision.md`, whose very next line links him anyway.
- **`protectedRanges` moved out of `citations.ts` into `src/shared/note-text.ts`** (verbatim, plus a small
  `isProtected` helper) so both passes agree on what is off limits rather than keeping two copies. No behaviour change;
  the existing citation tests passing is the check.
- Longest name first, so a name wholly inside another is matched whole. The real people list has no such pair (checked),
  but the rule is tested, since the list is the user's to edit.
- Same safety shape as the citekey pass: `undoPersonMentionsInProse` puts every name back and the script refuses to
  write unless that reproduces the original byte for byte; `writeNoteFileGuarded` against the hash read at the start;
  each note copied to `~/CentralCommand/backups/link-people-<time>/` first.
- Mutation checks, all four caught by a test: word boundary dropped (so "Matthew Jukeson" would link), protected ranges
  ignored, the round-trip check claiming success, and shortest-name-first. The fourth exposed a weak test — the original
  containment case had no real containment in it, so the mutation passed; the test now uses a name genuinely inside
  another and fails on the mutation.
- **Applied to the real library, 11 Oct 2026, in two passes** (app closed; each tried on a copy and diffed first):
  13 full-name links in 10 files (backup `backups/link-people-2026-10-11T10-38-37-929Z/`), then 330 links in 50 files
  once first names were asked for (backup `backups/link-people-2026-10-11T10-50-31-927Z/`). 356 person chips in the
  library now; a re-run finds nothing. Verification on the copy before writing: all 50 changed notes differ **only** in
  person chips (compared by stripping every person chip from both sides), and every chip's address resolves to a real
  person in `people.json`. The real library was then diffed against that copy and is byte-identical. The editor gate
  shows the same 4 pre-existing failures as HEAD and no new ones.
- **The user's own convention points the other way, and she was told.** Her hand-made `meetings/work/2026-10-05
Document Automation – Luminos.md` chips full names (Matthew Jukes, Caitlin Baron twice, Amrita Gopal, Caitlin Collis,
  Manuella Ankrah, Claire Wyatt) and deliberately leaves first names plain — "Neha" sits unchipped on the same line as
  two chips, and "Amrita" is plain on three lines after "Amrita Gopal" was chipped on one. So the second pass changes
  the convention her notes had been following. It was applied because she asked for it explicitly after the trade-offs
  were put to her, and it is one command to undo from the backup. Flagged to her in the report.
- **81 of the 330 are the user's own first name** in her own notes. Raised with her before applying (a chip pointing at
  oneself adds little), and she asked for everything clear, so it was included; also one command to undo.
- Mutation checks on the first-name rules, all four caught by a test: short-form checks disabled, a single initial
  counted as an acronym, a shared first name guessed as the first person, and the citation check removed. Two of the
  four needed the test tightened first — the originals passed under mutation, which is the whole point of doing it.
- **Left for the user**: mapping the 21 Caitlin/Chris mentions, and five spots where the prose reads oddly around a new
  chip (both in `docs/ROADMAP.md`). The prose ones are edits to her own writing, not entity conversions, so none was
  made.

## The three rules for people in prose (11 Oct 2026)

After seeing the second pass chip every mention, the user set the rules herself: "I don't want chips when the people
are in the meeting. It's clear whom we are referring to", "No need for me to have chips, ever", and, asked where that
left a non-attendee's repeat mentions, "first mention per note". So:

1. **Never the user themselves** — the person flagged `me: true` in `people.json`, which already existed, so nothing is
   hardcoded.
2. **Never someone the note says was present** — `attendees`, or a training's `lead`/`leads`, read with the shared
   front-matter reader (`peoplePresent`) so the inline-list, quoted and `- item` spellings all work.
3. **Only the first mention of a person per note** — counting the full name and the first name as the same person, so
   "Amrita Gopal" on one line and "Amrita" three lines later is one mention, chipped once.

- **The rules describe what her own notes were already doing**, which is the real find here. Her hand-written
  `meetings/work/2026-10-05 Document Automation – Luminos.md` chips only non-attendees, leaves "Neha" (present) and
  "Ernesta" (herself) plain, and chips "Amrita Gopal" once before writing "Amrita" plain three times. The two earlier
  passes had been reasoning about full names versus first names, which was the wrong axis; the axis that mattered was
  who was in the room.
- **The pass had to become authoritative**, since 290 chips already existed that the rules forbid. `planPersonChips`
  works from the note's text alone: take every person chip off, apply the rules to the plain prose, put back the chips
  they call for. That both adds and removes, and is idempotent by construction — verified by running it on its own
  output and getting no change, on the real library.
- **The safety check changed shape with it.** The old one (undo the links, compare with the original) cannot see a
  _removal_. The new invariant is `unchipPersonMentions(next) === unchipPersonMentions(text)`: only chips may move,
  never the prose — and it is checked per note before writing. On the real library all 50 changed notes passed it, no
  non-person chip changed in any note (reading chips in the same lines are untouched), and the result holds zero rule
  violations.
- **Effect**: 356 chips -> 66. 174 removals were someone in the meeting, 83 were the user, 32 were repeat mentions, and
  the rest were the earlier skip rules. 43 of the 66 survivors carry a first name as the label, 23 a full name.
- **One hand-made chip was overridden, and the user confirmed it (24 Oct 2026).** Rule 3 removed the second of her two
  `[Caitlin Baron]` chips in the 5 Oct note. It is the rule working as asked, not a fault, but it is a change to
  something she typed herself. An earlier check of mine reported "all 10 hand-made chips survived"; that check used
  list membership instead of counting, so two identical chips both matched the one survivor. Corrected to 9 of 10 —
  the kind of error a multiset needs counting for, worth remembering for any "did we keep everything" check.
- Mutation checks, all five caught by a test: rule 3 ignored, rules 1 and 2 ignored in the scan, the plan never
  removing a chip, `peoplePresent` reading nobody, and un-chipping doing nothing (which blinds the invariant).
- **Left for the user**: the 21 Caitlin/Chris mentions to map, and the five spots where the prose reads oddly around a
  chip (`docs/ROADMAP.md`).

## Mapping the names the rules could not resolve (11 Oct 2026)

The three rules left 21 mentions of a first name two people share. Reporting them with their context, rather than
guessing, turned out to matter twice over: the rules themselves disposed of 13 of the 21 (the person was in that
meeting, or was already chipped earlier in the note), so the user only had 8 real decisions to make, and two of the
_attendee lists_ answered the question — Chris Cummiskey attended `2026-02-19 Impact`, Caitlin Baron attended
`2025-10-16 Luminos`, which is as good as being told.

The user's decisions: "In Work, Chris is always Cummiskey; Caitlin B. is Baron; Dr Caitlin should be replaced by
Caitlin Collis." Three mentions fell outside those, and were put to her with a reading each, which she took:

- `2025-10-02 Supervision` (Research), "Caitlin" — Baron, because the same series names "Caitlin Baron" 20 days later
  in the same context (the Luminos CEO Kathy wanted to meet).
- `2025-10-20 Impact` (Work), "Caitlin" — Baron; written plain, not "Caitlin B.", so her rule did not strictly reach it.
- `2026-05-21 Luminos` (Research), "Chris" — Cummiskey; her rule said Work, but that note's two Chris lines are
  verbatim those of `meetings/work/2026-05-21 Impact.md`: one meeting, written up in both workspaces (the Research copy
  carries extra PhD content, so they are not duplicates, just overlapping).

- **The decisions live in the user's library, not the repo**: `~/CentralCommand/data/people-aliases.json`, entries of
  `{ text, person, workspaces?, notes? }`. The repo must not hold user data (CLAUDE.md), and an alias list is exactly
  the thing that will need extending whenever a new shared first name turns up, so it belongs where she can edit it.
  `aliasesFor` (pure, tested) decides which entries apply to a note; `workspaceOf` reads the workspace out of the path.
  The script refuses to run if an entry names someone absent from the people list, and a settled spelling drops out of
  the "to map" report, so the report shrinks to nothing as decisions are made.
- **"Dr Caitlin should be replaced by Caitlin Collis" is a prose edit, so it was kept out of `link:people`.** That
  pass's invariant is that only chips ever move; letting it rewrite words too would have cost the one check that makes
  it safe. It was done first, as a separate one-off against the single note that uses that spelling (two occurrences),
  guarded by asserting that mapping the new spelling back gives the original and that the line count is unchanged, with
  the original copied to `~/CentralCommand/backups/dr-caitlin-2026-10-11T13-02-04/`. `link:people` then chipped the
  first "Caitlin Collis" as an ordinary full name, and left the second plain under rule 3.
- **Applied to the real library, 11 Oct 2026** (app closed; the whole sequence — prose edit then chipping — run on a
  copy and diffed first, then the real library diffed against that copy and found byte-identical): 8 chips added in 7
  notes, **74 person chips** in the library, zero rule violations, nothing left to map, and a second run changes
  nothing. A possessive reads correctly: `[Caitlin](cc://person/Caitlin%20Baron)'s guidance`.

## A reading's metadata belongs in the side column (11 Oct 2026)

The user, looking at a reading's page: "this looks terrible. Of course the vertical spacing between the two components
is an issue but more importantly, this is the sort of metadata that should be displayed in the sidebar on the right.
Review similar features and make sure there is a consistent way to do it."

**What was wrong.** The reading page stacked everything in one column: the APA reference, the abstract, the reading
lists, where it is mentioned, then the notes. Each block set its own `margin-top` (24px, 28px, 8px) and `MentionedIn`
set none at all — it was built for a side column, where the column's gap does the spacing — so on this page the
reference card and the Mentioned-in card touched. The spacing bug and the layout bug were the same bug: **nothing
owned the spacing**, because the page was a stack of blocks that each guessed.

**The arrangement, now the same on all five pages with a note.** What the thing _is_ at the top, the text in the main
column, and everything _about_ it in a column of cards on the right. Meetings (Topics, Mentioned in), Notes (Outline,
Mentioned in) and Training entries (Files, Outline) already did this; Readings now does too, with an outline of the
user's own notes, the lists it is in, and where it is mentioned.

**Three pieces came out of it, and none is a new idea — each is the existing pattern, written once.**

- **`SidePanel`** (`renderer/src/components/`): the card each panel drew for itself — surface, border, radius,
  small-caps label — with the padding and gaps that had drifted apart (gap 8 or 10, padding 16 or 16/20) settled at one
  value. It takes a `label` (the accessible name), an optional fuller `heading` where one says more ("Topics · 1 of 3
  discussed"), `actions` for the heading row, and `as` for the landmark: `nav` for a way around the page, `aside`
  beside it, `section` otherwise. Adopted by Topics, Files, Mentioned in, the outline, the APA reference and the
  reading-list mentions.
- **`DocSplit`** (`renderer/src/notes/`, beside `EditorCard`): the grid four pages had each copied — text capped at
  780px, a 260px column of panels, 40px between, one column under 900px. The two real differences are asked for by
  name rather than re-specified: `roomySide` (Training's two panels side by side at 1400px and up) and `fullWidth`
  (the Training plan, whose text is deliberately uncapped while that question is still open in `docs/ROADMAP.md`).
- **`NoteOutline` moved** to `renderer/src/notes/`. Three modules drew it and Readings is the fourth; it was never
  Notes' own, and CLAUDE.md already says shared notes machinery lives there.

**Decisions worth keeping:**

- **The column scrolls, not each panel.** The outline and topics panels were each `position: sticky` with their own
  `max-height` and `overflow`, inside a column that was _also_ sticky. That works for two panels and fails for four:
  the ones past the fold cannot be reached. The column owns it now, which is what lets Readings carry four. It keeps
  4px of padding (taken back with a negative margin) so a focused row's ring is not clipped by that scrolling — the
  pitfall CLAUDE.md records.
- **The abstract stays in the main column.** It is the paper's own prose, not metadata about it, and a paragraph in a
  260px strip reads badly. The main column is "the paper, then your notes on it".
- **So does the APA reference** (corrected the same day, see below). The side column holds the outline, the reading
  lists and the mentions, in that order: the outline first because it belongs to the text beside it, the two "where
  does this appear" panels after it, both drawing nothing when empty.
- **Readings gained an outline** it did not have. Every other page with an editor has one, and the user has said their
  reading notes are often long.
- **The notes session moved up to the page.** The outline needs the text as it is typed, and `NotesSection` owned the
  session. The page opens it (`ReadingView`, keyed by citekey, the shape `MeetingPage` already uses) and hands it down.
- **A reading-list mention shows its section on its own line**, not after a `·` left dangling at the end of a narrow
  line, and its annotation is quieter (12px, muted) now that it sits in a side column and not the page body.

**How it was checked, and what that does not cover.** This was built in a Linux cloud container, where the app cannot
be driven: no Electron, no macOS, no screen. Instead the real components were mounted in Chromium through a Vite
harness with a stubbed `window.api` (the reading from the user's own screenshot, nine backlinks, a reading list, a
four-heading note) and photographed: light and dark, 1440px and 860px, scrolled, plus the four panels in both the
one-column and the `roomySide` arrangement. The side column measured sticky and scrollable at 1440px and static at
860px, as intended. Unit tests cover `SidePanel` and `DocSplit`. **Not done:** the app itself (production build and dev
mode), and the real-library editor gate, which needs `~/CentralCommand`. Nothing here touches the editor's internals,
but every page that holds one moved, so Meetings, Notes, Training (entry and plan) and Readings each want a look in the
real app before this is pushed.

## Which side of "about it" the APA reference falls on (11 Oct 2026)

Moving the reading page's blocks to the side column took the APA reference with them. The user: "APA reference should
have been left there at the top since it's really part of the paper."

**The line this draws, and it is the useful part.** The side column is for what the app knows _about_ a thing — where
it is mentioned, which lists it is in, how to get around the text. The reference is not that: it is the paper's own
identity, the same kind of fact as its title and its authors, and the user reads and copies it as part of the paper.
Everything the reading page shows now sorts cleanly by that test. The abstract was already kept in the main column for
a weaker reason (a paragraph reads badly in a 260px strip); this is the stronger one, and it covers both.

- The reference is back at the top of the main column, above the abstract, at the width it had before.
- The abstract draws the same card as the reference now, so the two blocks that _are_ the paper match. Each had set
  its own padding (16 against 18/22).
- **`SidePanel` became `Panel`.** It was named after the one place it was first used; a card in the body of a page is
  the same card. The side column is something `DocSplit` does _to_ panels (keeps them in view, scrolls them), not part
  of what a panel is.

Checked the same way as the change it corrects: rendered in Chromium through the Vite harness, light and dark, 1440px
and 860px. Still not driven in the real app.

## Blank lines in imported notes (11 Oct 2026)

The user saw empty lines in imported notes: one between the end of a list and a heading and another between the heading and the list under
it, and an empty line after the last bullet at the end of a note. Plan: `docs/BLANK_LINES_PLAN.md`.

**Why.** Since 2 Oct 2026 notes keep no blank lines around headings (see "No blank lines around headings"), but the Readings importer still
padded every heading, and `tidy:headings` skips `readings/`, so every imported Readings note kept them. The Meetings importer built
`## Summary` with a blank line either side as well.

- **The rule** is `tidyBlankLines` in `src/shared/heading-spacing.ts`: `tightenHeadings`, then no blank line at the start of the body and
  none after the last line of text, which ends with exactly one line break (the last line's own LF or CRLF). A body with no final line break
  gets none (it only ever removes), a blank-only body becomes empty, and blank lines inside a code fence (even one never closed) stay. Blank
  means empty or whitespace only, non-breaking spaces included. Mutation-checked: each of its six parts, broken in turn, fails a test.
- **Importers.** Readings (`transformBody`, which the Training and Work meeting importers also use) and Meetings now run their result through
  it, so a fresh import is already in the editor's form. Their tests changed from "puts a blank line around a heading" to the opposite.
- **`npm run tidy:blank-lines`** applies the same rule to the notes already in the library, over every folder including `readings/`.
- **Readings notes are rewritten here, and that is deliberate.** "Never delete or overwrite a Readings note file" guards against sync and
  imports replacing what the user wrote. This removes only blank lines (the script refuses a note where any non-blank line would change),
  backs each file up first and writes through the content-hash guard, the same as a save in the app.
- **Blank lines after the front matter are not touched** and cannot be counted as "at the start": `splitNote` puts them in the head (they
  are the separator the app itself writes), so the editor never shows them. The start rule matters only for a note without front matter.
- **The empty last line may stay.** A body that ends with one line break is the shape every note the app writes has, and CodeMirror draws it
  as an empty last line. The dry run counts those notes, so the user can tell whether that is what their screenshot shows (stage 2 of the plan).

Tried on a fixture library in the session scratchpad (a Readings note with spaced headings, a CRLF note, trailing blank lines, a code fence,
a note without front matter): dry run wrote nothing, apply changed 5 of 8 with backups, the second run found nothing.

**Applied to the real library on 11 Oct 2026**, with the app closed: **20 of 248 notes, 33 blank lines** (0 at the start, 28 around headings,
5 at the end), by folder `readings` 17, `meetings/work` 1, `notes/research` 1, `notes/work` 1. **No note was left alone** — every one of the
20 changed in blank lines only, so the "every non-blank line identical" check never had to refuse one. The originals are in
`backups/tidy-blank-lines-2026-10-11T14-31-25-833Z/`. The second dry run finds nothing.

Readings being 17 of the 20 is the predicted shape: those are the notes `tidy:headings` skipped on 2 Oct, still carrying the Readings
importer's padded headings. The five at the end were in two notes only, so a blank line after the last line of text was never the common
case — which the last line of the report bears out: **213 notes ended with exactly one line break and would change in no other way**, and
that, not a stray blank line, is what the user's screenshot showed. Hence stage 2. (After the apply the count is 233: the 20 tidied notes now
end that way too, the shape every note the app writes has.)

### Stage 2: the empty last line is drawn with no height (11 Oct 2026)

Built at the user's word ("Build stage 2") rather than after their dry run, so it does not depend on what the dry run showed. `LiveEditor`
gives the empty last line a note's final line break leaves (`live-endbreak`, in `live-decorations.ts`) no height, so a note ends at its last
line of text. Nothing in the file changes and the app still writes the same final line break. While the cursor or any part of a selection is
on that line it is drawn normally, so arrowing down into it, or clicking below the text, still shows where you are. It applies only to a
truly empty last line of a note with more than one line: a last line holding spaces or text is drawn as before. Decoration rules are
unit-tested (and the selection check mutation-checked); the CSS was not seen rendered, since this was built in a cloud session without the
Mac app.

**Seen rendered on 11 Oct 2026**, driven with Playwright against a scratch library in both dev mode and the production build, on a note
ending with exactly one line break. The two agree to the pixel: with the cursor elsewhere the last line is `cm-line live-blank live-endbreak`
at **height 0**, and the bottom of the note is the bottom of its last line of text (y=410 in both); with the cursor on it the class is gone,
the line is **14.4px** and the caret is drawn on it. Clicking below the text puts the caret there from anywhere inside the editor — tried 15,
45, 90 and 95px below the last line of text, all four focus the editor and show the caret at the end — and typing lands the character at the
end of the note. So the CSS does what the decoration rules say, in both builds.

One trap worth recording for the next person driving the editor: **"below the text" is only the editor's own area.** The content box here is
98px taller than the text (bottom 508 against the last text line's 410), and a click past _that_ lands on the card, not the editor — it
focuses nothing and looks exactly like the feature being broken. Measure the content box and click inside it. (Two unrelated Playwright
notes: over CDP, `page.screenshot` and `setViewportSize` hang on a backgrounded Electron window, so `bringToFront()` first; and CodeMirror's
caret blinks, so a screenshot catches it only half the time — overriding `.cm-cursorLayer { animation: none }` makes it show every time.)

## Previous TODOs carry-over switched off (11 Oct 2026)

The user ran `remove:previous-todos` (29 notes) and then found the section back on `2026-07-29 Supervision`. Not a bug in the script: the app's carry-over rebuilt it from the previous meeting's unticked items when the note was opened (the file's modified time, 13:18, was the moment of opening). The one-off cleanup could never stay clean while carry-over was on, so the user chose to turn carry-over off.

- **New meetings** are made with `## Summary` and `## Notes` only (`NEW_MEETING_BODY`); `create` no longer reads the previous meeting.
- **Opening a meeting writes nothing**: `MeetingsStore.syncPreviousTodos` returns `{ status: 'saved', added: 0 }` without reading or saving. The IPC method and the session's `prepare` call stay, so turning carry-over back on is a change in one place.
- `shared/carry-over.ts` (and its tests) stays, unused by the app. `Previous TODOs` sections that a person writes by hand are still parsed and counted as before; only the automatic adding is gone.
- The three notes that had come back (`2025-10-02`, `2025-10-14`, `2026-07-29` Supervision) were cleaned with `remove:previous-todos --apply`; backup `backups/remove-previous-todos-2026-10-11T16-16-03-589Z`. A dry run now finds nothing.
- Tests: the old carry-over cases became "a new meeting gets nothing from the previous one" and "opening a meeting writes nothing". Checked by tests only; the app was not driven.

## The real-library gate caught up (11 Oct 2026)

`LIVE_EDITOR_LIBRARY=<copy> npx vitest run src/renderer/src/editor/live-library` failed 4 of 10 checks on the user's unmodified notes. None was an editor bug; the gate had fallen behind behaviour that shipped later:

- **Mentions:** it expected a space after a chosen mention. Commit `3934c33` removed that on purpose ("no space after a chosen mention"); the gate now expects the mention and nothing more. The earlier guess that a chip at position 0 of `## Summary` lost its space was this same stale expectation.
- **`/todo`:** it expected a bare `**TODO(XX)**: `. The helper now writes a checkbox item (`todo-live.ts`, `leadFor`). The gate checks what does not depend on that lead: the marker ends at the cursor, the text after the range is untouched, the text before it only loses trailing spaces, one undo restores the note.
- **List markers and tables:** both counted a mention chip (a `widget`) as a list marker or a table cell. Both now skip widgets whose text holds `](cc://`. The table text check also ignores backticks, which the editor hides in inline code.
- Copying `backups/` into the gate's library, as CLAUDE.md says, puts every note's earlier versions through the same checks; that is how the chip cases (the `link:people` backups) were found. A run takes about 8 minutes.

## One-off scripts applied to the real library (record kept when CLAUDE.md dropped them, 11 Oct 2026)

The scripts stay in `scripts/` and `package.json`; each is dry-run by default, refuses or finds nothing now. CLAUDE.md no longer lists them.

- **`repair:session-tasks`, training markers and series tasks** (applied to the real library 23 Oct 2026, after a dry run read line by line and a trial on a copy; backup `~/CentralCommand/backups/session-tasks-2026-10-23T14-16-18-792Z`): marked 31 tasks the Research training notes name (24 PS5210 subtasks, 2 Simulating Social Worlds, 2 AI Agents for Research, 1 SENSS Specialist Training, CastlesFest, Response Surface Analysis Workshop), and brought the series tasks in step with their subtasks (date, Done). A dry run now finds nothing.
- **`repair:session-tasks`, self-study names and dates** (applied to the real library 23 Oct 2026, after a dry run read line by line; backup `~/CentralCommand/backups/session-tasks-2026-10-23T14-57-04-964Z`): 34 self-study subtasks renamed to the training alone ("Day 1 self-study" → "Day 1"; the first version's " · self-study" ending read too) and their due dates moved to the training's date plus 7 days; no name collisions; 6 series tasks followed (latest subtask's date). A dry run now finds nothing.
- **`tidy:work-tasks`** (applied 6 Oct 2026): split Work's Luminos list into Impact and Teaching & Learning by the client of each task's hours, set due dates to the latest hours entry, made tasks with hours "in progress".
- **`merge:research-lists`** (applied to the real library 9 Oct 2026, after a trial on a copy): Research's "Coursework & Training" joined "Training" and "Supervisor Meetings" joined "Meetings" (94 + 75 tasks); backed up the database first.
- **`link:citekeys`** (applied 11 Oct 2026, backup `backups/link-citekeys-2026-10-11T10-33-06-476Z`): the Pandoc/Obsidian markers (`[@Harm2004]`) became reading entities, labelled from the reading's authors in the library's style; 23 markers, 2 files, 6 readings, nothing ambiguous. Only a marker fitting exactly one reading by first surname and year was linked, and a rewrite was refused unless putting every marker back gave the original byte for byte (rules in `src/shared/citations.ts`).
- **`link:people`** (applied 11 Oct 2026): 343 chips added over two earlier passes, 290 taken away once the three rules were set, then 8 added from the user's decided spellings (`~/CentralCommand/data/people-aliases.json`), leaving 74; last backup `backups/link-people-2026-10-11T12-02-05-056Z`.
- **Also dropped from CLAUDE.md, recorded elsewhere in this file or in `docs/ROADMAP.md`:** `import:clickup`, `backfill:clickup-links`, `import:work-hours`, `link:worksheet`, `link:work-apply`, `link:work-hours`, `move:subtask-notes`, `link:work-meetings`, `link:ps5210`, `import:work-meetings`, `name:contracts` (applied 6 Oct 2026), `strip:created`, `tidy:series`, `tidy:headings`, `tidy:blank-lines`, `cleanup:orphaned-readings`, `remove:previous-todos`, and the first importers (`import:obsidian`, `import:notes`, `import:meetings`, `import:hours`, `import:training`, `reconcile:meetings`, `convert:topics`).

## Contracts: component tests, mutation checks, driven in dev mode (11 Oct 2026, roadmap queue item A)

Closes the first two bullets of the deferred list in `docs/CONTRACTS_PLAN.md`.

- **Component tests** (`src/modules/hours/renderer/hours-contracts.test.ts`, `hours-contract-form.test.ts`, helpers in `hours-ui-test-utils.ts`). There was no component-test setup, so these follow `ErrorBoundary.test.ts`: jsdom, `createElement` (the Vitest `include` is `*.test.ts`, no JSX), `act` from React; no new dependency. They cover `InvoiceCard` (month and week, with and without an aim, the arrows), the no-aim and aim branches of `WeekCard`, `BalanceCard`, `WeeksChart` (the plan line), `AllWeeks` and `YearsTable` (dashes for plan and balance), and the new-contract form (disabled until name, last day and clients are valid; a last day that makes no whole weeks; unreadable weekly hours; a blank weekly hours is sent as 0; every store refusal's message, form kept; the message goes when the form is edited). `ContractFields` and `YearsTable` read their data through hooks that the test replaces (`useTrackingYear`, `useYearFiles`, `useShownYears`).
- **Mutation checks**, each run against the whole suite and each caught: `hasAim` as `>= 0`, always true, always false (8 to 9 tests fail, new component tests among them); `contractToShow` with the remembered contract ignored, the oldest of those holding today, the newest even when it has not started, no fallback to the newest when none has started, the client-of-last rule dropped, and "remembered" no longer required to hold today (1 test each, in `contracts.test.ts`). `contractToShow` was already well covered; `hasAim` was only caught by the new tests for the component branches.
- **Driven in dev mode** on a scratch library (`CENTRAL_COMMAND_HOME`, never the real one): Work with Alpha (1 May 2026, 26 weeks, 8:00 a week, invoiced Month, holds today), Beta (6 Jul, 8 weeks, no aim, Week, **ended on 30 Aug while Alpha holds today**) and later Gamma (28 Sep, 26 weeks, no aim, Week, holds today). The page opened on Alpha with Beta newer in the selector; choosing Beta showed its last week, no Today card, no plan, balance or "to go", and Charts and weeks showed Weeks, Dates and Hours only and dashes in the Years table; Gamma (newest holding today, nothing remembered) opened first. No console errors or warnings. Looked at the screenshots; found no bug, so no fix commit.
- **Not bugs, noted:** choosing an ended contract is not remembered on the way back from Charts (the page reopens on the one holding today: `contractToShow` ignores a remembered contract that does not hold today, as designed); the Weeks legend says "This week" for a contract that has ended; a weekly-invoiced contract shows its week header on both cards (item D).

## Hours per week for a no-aim contract, and the weekly week header (11 Oct 2026, roadmap queue item D)

- **Bug fixed: "Hours per week" in Settings → Hours.** A Work contract with no weekly aim (`hoursPerWeek: 0`) showed `0:00` in the field, and the field's parser refused 0 (`parseWeekHours`: "more than none"), so it could not be set back to none. The storage already allowed it (`parsePlan` takes 0 when `weekAim` is true). Fix: for a plan with `weekAim` (Work) the field shows `none` for 0 and accepts a blank or `none` as 0 (`formatAimHours`, `parseAimHours` in `src/modules/hours/shared/plan-settings.ts`), the same blank-is-none rule as the new-contract form's Weekly hours. Research still needs more than none, so its field is unchanged. No new UI choice: the word `none` is the roadmap's own.
- Tests: `plan-settings.test.ts` (parse and format) and `hours-settings-aim.test.ts` (component: shows `none`, clearing saves 0, nonsense is not saved). Mutation check: putting the plain `formatHours`/`parseWeekHours` back fails two of the three component tests.
- **Not a bug: the week header.** A weekly-invoiced contract shows `Week N · range` on both the Week card and the invoice card, and the numbers agree for every week stepped through (1, 2, 3, and via the invoice card's own arrows). A test now pins it (`hours-contracts.test.ts`, with and without an aim, two weeks each).
- **Driven** on a scratch library (a copy of the Royal Holloway contract, invoiced Week, no aim, one session), in the production build and in dev mode, with real keystrokes and screenshots: the field read `none`; `6:30` + Enter saved and showed `6:30`; clearing + Enter went back to `none`; typing `none` + Enter stayed `none`. Both headers read `Week 2 · Oct 5 – Oct 11` on opening and followed the arrows together. Nothing in the real library was touched.

## The duplicate-key warning on a reading's page (11 Oct 2026, queue item E)

- **Not where the roadmap said.** `ReadingDetailPage.tsx` gives no two siblings the same `key` (only `ReadingView`'s own `key={reading.citekey}`); the note from the live-editor stage 8 was a guess. Opening readings on a scratch library in dev mode showed no warning at all.
- **The real cause**: `ReadingListMentions` keyed each row `${list id}-${section}`, so a reading that one list names twice in the same section (two entries for the same paper) gave React two children with the same key (`Dup-One` in the test). Dev mode only, harmless in the built app, but it would also have confused row identity.
- **Reproduced** on a scratch library (`CENTRAL_COMMAND_HOME`, never the real one) with a reading list that names one reading twice under one heading: dev mode logged "Encountered two children with the same key" on opening the reading. **Fixed** by adding the row's index to the key (the list is read-only, so the index is a stable identity). Afterwards dev mode (StrictMode) and the production build both opened the reading, showed both mentions and took typed keystrokes in the notes editor with an empty console (no warnings or errors).
- No unit test: the repo has no component tests, and the check is a console warning that only a rendered list shows.

## Tasks at narrow widths (11 Oct 2026, queue item C)

- **There is no phone width to fix.** The window cannot be narrower than 960 px (`MIN_SIZE` in `src/main/index.ts`; "Narrow windows" above) and the app has no media queries. So "narrow" means 960. At 400 (forced by lifting the minimum in the test script) the shell itself, not Tasks, is what overflows: the top bar's actions sit past a 600 px floor. Not changed, since the window cannot get there.
- **Two real clips at 960, both fixed.** (1) The task tables (landing sections and All tasks) had `min-width: 900px` inside a content column of about 856, so the Due column was cut off behind a hidden horizontal scroll; now `720px`, with the List column 180 instead of 220 (a long list name ellipsises, as it already did). (2) The task page's title was a one-line `<input>`, so a long title was cut off mid-word; it is now a one-row `<textarea>` with `field-sizing: content` that grows to fit (Enter still saves and blurs, and no line break can be typed).
- **Left as is:** a subtask's title on the task page is a one-line input and is cut off when long (as any narrow text field is); it is edited in place and the full text shows on focus.
- **Driven** on a scratch library (ClickUp import applied there, `CENTRAL_COMMAND_HOME`, never the real one): the Tasks landing, All tasks and a task page, in Research and Work, at 960 wide, in the production build and in dev mode, light and dark (`prefers-color-scheme` emulated), with screenshots and a check that no element extends past the window and the page does not scroll sideways (none did after the fixes). Typed into the new title field with real keystrokes: the text saved and showed in the table. There is no board in Tasks, so none was driven.

## A described select near the right edge no longer shifts the page (12 Oct 2026)

- **Bug (found by the user, Training entry page):** opening the Type menu moved the whole page left by about 33 px. `DescribedSelect`'s list was `position: absolute; left: 0` and up to 360 px wide, so from the Type field, the rightmost on the page, it ran past the window and made the page scroll sideways.
- **Fix:** on opening, a layout effect (`src/renderer/src/components/DescribedSelect.tsx`) checks whether the list's right edge passes the window by more than 8 px; if so it sets `left: auto; right: 0`, so the list opens leftwards from the button's right edge. It writes the style straight to the element (no state), so there is no extra render and the list unmounts with its override on close. A select with room to the right is unchanged. Every `DescribedSelect` gets this, not only Training's Type.
- **Not driven in the app, and no unit test** (the repo has no component tests and jsdom has no layout, so a test could not show an overflow). Check: open Type on a Training entry in the running app; the page should stay still and the menu sit under the field, aligned to its right edge.

## The Files panel: no sizes, lock files hidden (12 Oct 2026)

- **Why (the user, Training entry page):** the panel showed sizes, which are irrelevant, and the size column left the names so little room that they broke mid-word (`00_START_HERE.h` / `tml`), plus an Office lock file (`~$SA_Workshop_Participant_Guide.docx`).
- **Change:** `FilesPanel` no longer shows a size (`formatSize` removed; `FolderEntry.size` stays in the listing, unused by the panel). Names wrap at word boundaries (`overflow-wrap: break-word`, not `anywhere`) and the row's gap and padding are a little tighter, so most names fit on one line. `listFolder` (`src/modules/training/main/files.ts`) leaves out names starting with `~$` as well as hidden (`.`) ones.
- **Left as is:** other non-dot files such as `_quarto.yml` still show; hiding underscore-prefixed files was offered, not asked for.
- **Not driven in the app, no new test** (no component tests in the repo; the listing change is one line). Check: open a Training entry whose folder holds long names.

## Training: a lecture's task with or without a series (12 Oct 2026)

- **Why (the user):** standalone trainings (no series) must behave like series ones, automatically, and the task must follow the series both ways with no thinking.
- **Rule** (`planLectureTask`, `src/modules/training/shared/lecture-task.ts`): a marked (`auto`) note gets its task once it has a series (a subtask under the series task) or a real title (not empty, not "Untitled"; a task of its own, top level in list "Training"). Adding a series moves the task under the series task, clearing it makes the task top level again; the title always follows. A top-level task is only treated as the lecture's own when it is in Training with nothing under it, so a series task or a plain task is never renamed or moved. A series task this page made and the lecture has left empty goes to the trash (as before).
- **Tasks store:** `update` now lets a top-level task with no subtasks and no repeat become a subtask (it loses its list), and `parentUid: null` with a `list` makes a subtask top level (`TaskChanges.parentUid`). It used to refuse both.
- **Driven in a scratch library (built app):** title typed, task "Plotly workshop" in Training; series typed, it became a subtask of a new "Intro to Python" task; series cleared, it was top level again and the empty series task was gone. Dev mode not checked.

## Training: the lecture's task, hours and actions in one side panel (12 Oct 2026)

- **Why (the user):** the task was a field in the header with no way to reach it, and its hours and Start / Add time sat apart from it. All of it is about one task, so it belongs in one place.
- **Change:** `LectureTask` (`src/modules/training/renderer/`) is now a `Panel` labelled Task at the top of the entry page's side column, above Files and Outline. The task title is a link to the task's page (`taskRoute`; a lecture under a series opens the series task, since a subtask's page redirects to its parent, and the panel's second line names that parent). `LectureHours` (total, Start, Add time, overlap note) is rendered inside it as children. The header's Task field and the `taskField` prop of `TrainingMetaFields` are gone. The "Making the task…", "Give it a title…" and "The task was deleted. Make it again" states are in the same panel; an older note with no marker shows no panel.
- **Alternative not taken:** all of it in the header where the buttons were. The header row is full, and the side column is where what the app knows about a thing goes.
- **Not driven in the app, no new test** (no component tests in the repo). Check: open a Training entry with a task; the panel should show title (link), list, total, Start and Add time without clipping in the narrow column.

## Training entry: Task as a strip, Outline beside the text, Files on the right (12 Oct 2026)

- **Why (the user):** the side column was "a jumble": Task, Files and Outline in two columns in an order set by a CSS trick, FILES lower in its card than OUTLINE. Mockup with three options: `docs/design/training-side-panels-mockup.html`; the user chose A.
- **Change:** `LectureTask` is a wide one-line `Panel` (new `row` prop) under the details block: task link and list, total, Start, Add time; an overlap or missing-time note takes a line of its own under it and no room when there is none. The side column is Outline then Files; `roomySide` is now plainly "first panel in the inner column, second on the far right" (the `order` trick is gone), and the entry page is `fullWidth` so the outline sits against the text.
- **Alignment:** `Panel`'s heading row has a 28px minimum (the height of an icon button), so a label sits at the same height in every panel in the app.
- **Driven in the app** (built app, scratch library, 1500px and 1200px): checked by screenshot. A linked folder (icon buttons in Files) and dev mode not checked.

## Training: a linked folder that moved is followed; a missing one reads plainly (12 Oct 2026)

- **Why (the user):** renaming a folder left the Files panel with a raw `ENOENT: no such file or directory, realpath '…'` and a dead link.
- **Error:** `resolveInside` turns ENOENT into `NotThereError` ("“<name>” is not there. It may have been moved or renamed."); `listFolder` still reports it as `missing`. Show in Finder is disabled while the folder is missing.
- **Following a move:** a folder's device and inode survive a rename or a move on the same disk, so `training_folder_memory` (`training/0005_folder_memory`) remembers them, keyed by the relative path, whenever the panel lists a folder that is there. When the path is gone, `listLinkedFolder` (`main/folder-memory.ts`) searches the Trainings folder for that identity (no symbolic links, no hidden folders, at most 20,000 folders and 10 levels deep) and, failing that, for the only folder with the same name; two or none means no guess. A hit comes back as `movedTo`, and the panel saves it through the normal entry change, so the note's `folder:` is rewritten by the usual guarded save, not behind the editor's back. It is checked when the page opens, so a rename made while the app was closed is followed too.
- **Limits:** a move to another disk, or a sync tool that recreates folders, changes the identity; then only a unique name matches. A folder never opened in the panel before it was renamed has no memory, so the name is all there is.
- **Tests:** `folder-memory.test.ts` (rename, move with a sub-folder, unremembered unique name, ambiguous name, nothing found, a new folder at the old path). **Not driven in the app:** the IPC and the panel's save of `movedTo` are checked by typecheck and reading only.

## Files that notes link to (`cc://file/…`) are followed when renamed or moved (12 Oct 2026)

- **Why (the user):** the same as for a Training entry's folder (previous section); a file entity broke ("That file is gone") when its file was renamed or moved.
- **Memory:** `entity_file_memory` (`notes/0004_file_memory`) holds the device and inode of each file whenever a chip or Open resolves it (`FileMemory`, `src/main/entities/file-memory.ts`). Files sit directly in the three workspace folders, so a search is a listing of three folders.
- **Resolving** (`resolveEntityFile`): a file that is there is returned as before; one that is not is looked for by identity (also across workspaces), failing that by the only file with the same name; two or none means no guess and the old "gone" behaviour.
- **Following:** unlike a folder link (one field of one note), a file's address is written into every note that mentions it, so a hit rewrites all of them (`moveFileMentions`, `file-links.ts`): every folder of notes in `backlinkFolders` through `rewriteNoteFiles` (backup in `~/CentralCommand/backups/file-moved-<time>/`, the hash guard, a note that changed meanwhile skipped) and the descriptions of tasks (`updated_at` set). `renameFileMentions` (`@shared/entities`) changes the address and the label only when it was the old file name. One move is handled once however many chips ask at the same time (`resolving` in `ipc/entities.ts`).
- **Limits:** as for folders: another disk, or an app that saves by replacing the file (a new inode), leaves only the unique-name match; a file never resolved before it was renamed has no memory. A skipped (changed-meanwhile) note keeps its old address and is retried the next time a chip asks.
- **Tests:** `file-memory.test.ts`. **Not driven in the app.**

## Series cards: up to four equal columns; Meetings hides empty series (12 Oct 2026)

- **Why (the user):** on Meetings' landing, four series cards stopped short of the right edge, and series with no meetings ("Luminos", "Other": "No meetings yet") took room.
- **Grid:** `SeriesCards` (`Landing.module.css`, `.cards`) is `repeat(auto-fill, minmax(max(290px, calc((100% - 49px) / 4)), 1fr))`: a column is at least a quarter of the width (so never more than four on a line) and at least 290px (so fewer on a narrow window). Four cards fill the row exactly; fewer keep the size of a card in a full row instead of stretching (a first try with `auto-fit` made a lone card full width). The 49px is the three 16px gaps plus 1px against rounding, which would otherwise drop to three columns. Shared, so Tasks, Training and Notes landings get it too.
- **Empty series:** `MeetingsLanding` leaves out a series with no meetings in the year and none planned (`count === 0 && !next`). A planned meeting keeps its card. Training's cards are unchanged. `seriesLine` still has its "No meetings yet" text (other pages use it).
- **Not driven in the app**; typecheck, lint and tests pass.

## Skill and aim hours as h:mm (12 Oct 2026)

- **Why (the user):** "everywhere where we have time reported, I want h:mm, not fractions": Meetings' "Hours of meetings" card showed "2.8 h" and a skill chip "2.3 h".
- **Change:** `formatHours` in `@shared/skills` (Meetings, Training, the hours strip, both PDF reports, the training meetings line) is now the Hours pages' `formatHours` (`@shared/tracking/format`): "2:48", "36:30", "0:00", no unit. Aims are formatted the same way ("of 200:00" in `TrainingCard`, `HoursStrip` and the Training report). Tests updated.
- **Left as it was:** the length of one meeting or training (`formatDuration`: "1 h 30 min"), which never had fractions. Ask if those should be h:mm too.
- **Not driven in the app**; typecheck, lint and tests pass.

## Meeting and lecture rows line up with task rows (12 Oct 2026)

- **Why (the user):** on Hours' Today card the last row (a lecture, `MeetingRows`) looked very different from the task rows above it.
- **Change:** `MeetingRows.module.css` uses the task rows' grid: a 32px first column (the icon centred in it, where tasks have the play button) and a 14px gap. The time keeps room on its right (40px) for the delete button the task rows have, so the times line up in one column.
- **Spacing, one rule on both pages:** the meetings list is a second `<ul>` after the tasks, so it got the container's gap (14px on Today, 8px in the Week card's open day) instead of the 2px between task rows. Each container now sets `--stack-gap` (`TodayCard`, `WeekCard` `.detailBody`) and `TaskList.module.css` has `.list + .list { margin-top: calc(2px - var(--stack-gap, 0px)) }`; `MeetingRows` rows have `grid-auto-rows: minmax(32px, auto)`, the height of a task row with its play button. A new place showing both lists sets `--stack-gap` and gets the same rhythm. Other screens that list time entries were not checked.
- **Not driven in the app**; typecheck, lint and tests pass.

## Lists: nesting across bullet characters, deeper indent, one bullet character (12 Oct 2026)

- **Why (the user):** in `2025-10-02 Supervision.md` the last two bullets (`-`) could not be indented under the `*` list above them; they also found sub-bullets hard to tell from their parent.
- **Cause:** Markdown starts a new list when the bullet character changes, so such an item is the first of its own list and `indentItem` had no item before it. `previousItem` (`live-lists.ts`) now takes the last item of the list directly above (same list kind, no blank line between) when there is none in its own list.
- **Match on edit:** Tab and Shift-Tab give the moved item the bullet character of the list it joins (`matchBullet`): the existing nested list's first item when indenting into one, the parent's when outdenting. Numbered items and items that start a new nested list keep their own. Opening a note still never reformats (the text is the document).
- **Indent:** a list line's left padding follows its depth in the syntax tree (`--li-depth`, `listDepth` in `live-decorations.ts`), 1.6em per level, so a sub-bullet starts exactly where its parent's text begins, whatever the spaces in the file (`--li-cols`, 0.5em per column, is gone). Driven in the built app on a scratch library (bullets, tasks, numbered parent, three levels); dev mode not driven.
- **One bullet character, once:** `npm run standardise:bullets [-- --apply]` (`scripts/standardise-bullets.mts`, rules in `src/shared/bullet-style.ts`) writes every `*` or `+` list marker as `-`. It reads real list marks from the Markdown tree (code, `* * *`, emphasis, numbers, front matter and `notes/readings/` untouched), checks that only those characters changed, backs each note up first. **Applied 12 Oct 2026: 655 bullets in 19 notes** (backups: `~/CentralCommand/backups/standardise-bullets-2026-10-12T14-16-26-033Z`); a dry run now finds nothing.
- **Tests:** `live-lists.test.ts` (Tab, Mod-], Shift-Tab, Mod-[), `bullet-style.test.ts`.

## A chip never breaks across lines (12 Oct 2026)

- **Why (the user):** at the end of a line a person chip showed its icon alone and the name began the next line.
- **Cause:** the icon is an inline-block `::before` of the chip, and the line may break after an inline-block, so the icon and the label were two fragments.
- **Change:** `.live-chip` has `white-space: nowrap` (`LiveEditor.module.css`): the line breaks before a chip, never inside it. A label wider than the whole line would overflow rather than wrap; not checked with a very long title.
- **Not driven in the app**; typecheck, lint and tests pass.

## A chip always says what it points at is called now (12 Oct 2026)

The user did not know a mention's label could be written, and does not want that: a chip says exactly what the thing is, as it is today. `EntitySummary.label` (every provider's `resolve`) is the name: a person's full name, a reading's short citation, a meeting's heading, a note's or task's title, a file's name. `chipText` (`live-entities.ts`) draws it; until it is looked up, or when the thing is gone (struck through), the text's own label stands in. Display only: files are untouched, so `link:people`'s un-chip check holds, and a rename still rewrites an address (and a label that was the old name) as before; the stored label is now inert text that keeps the link valid Markdown. Copying a chip outside the app uses the same name (`copyPart` falls back to it; a reading still has its own `copy`, always from the reading, never the label). Not driven in the built app.

Same day, two follow-ups the user asked for: a person rename now rewrites the label too, whatever it was (the prose follows the rename; `renamePersonMentions`), and `npm run fullname:chips` writes every existing person chip's label as the full name (dry run: 52 chips in 30 notes, the same chips and addresses, only labels differ; `fullNamePersonChips` in `people-mentions.ts`). Chips of other kinds keep their stored label in the files (the editor shows their current name regardless).

`fullname:chips` was applied to the real library on 12 Oct 2026 (52 chips in 30 notes; backup `backups/fullname-chips-2026-10-12T14-58-41-239Z`); a dry run now finds nothing. `link:people` was then applied for the one chip it proposed (Manuella Ankrah, in `meetings/work/2026-10-05 Document Automation – Luminos.md`; backup `backups/link-people-2026-10-12T14-59-56-248Z`); a dry run now finds nothing.

## Done items are dimmed, not struck through (12 Oct 2026)

- **Why (the user):** a done item's line-through made the text unreadable, and the chip in it (a mention) was not struck at all.
- **Looked up:** Bear dropped the strikethrough on checked items for lighter grey so done items fade; Day One did the same and users asked for the line back to keep reading them; Fibery, Notejoy, ClickUp, Trello and Dynalist all have requests to drop it or make it optional. A line can also read as "cancelled", and dimming that is too faint fails in some themes.
- **Change:** `.live-done` (`LiveEditor.module.css`) is only `var(--text-muted)`, no line; `.live-done .live-chip` has `opacity: 0.7`, so a chip dims by the same rule as the text. The ticked box already says done. Real `~~strikethrough~~` and the red strike on a chip whose target is gone are unchanged.
- **Not driven in the app** at the time of writing (typecheck, lint and tests pass); if the dimmed text is too faint in either theme, adjust the colour and the chip's opacity.

## Add a person from the `@` picker (12 Oct 2026)

- **Why (the user):** typing `@Greg Veramendi` for someone not in the people list showed only "Nothing found."
- **Change:** the person provider (`personEntities`, `src/modules/meetings/renderer/entities.ts`) appends an "Add <name> · New person" row when the typed query is at least two words and is not an existing person's full name. Choosing it calls `window.api.meetings.people.add({ name })` (initials worked out and made unique as on the People page), then links the new person like any other. One word never offers it: it is more likely a search. No way to choose initials in the picker; change them on the People page.
- **Not driven in the app** (typecheck, lint and tests pass); no test of the provider itself, which reads `window.api`.

## Tasks table: Back returns to its list, and everything edits in place (12 Oct 2026)

- **Why (the user):** Back on a task page went to the Tasks landing, not the filtered list the task was opened from; and due date, title, tags and list needed the task page, which is too many clicks.
- **Back:** the table passes `state.from` (path, filters and a label: "All tasks" on `/all`, else "Tasks") when it opens a task; `useTaskBack` (`tasks-paths.ts`) reads it, with the Tasks landing as the fallback (search, a person's page, a link). Delete and the "not found" page use it too; a subtask redirecting to its parent keeps it.
- **Due:** the Due cell is the shared `DatePicker` with a new `plain` option (text only, a border on hover). A parent with no date of its own shows its subtasks' earliest as the placeholder; "Add date" when none.
- **Title:** a click on the title text edits it in place (selected; Return or leaving saves, Escape cancels, empty is not saved). Clicking elsewhere on the row still opens the task.
- **Tags:** the shared `TagsField` (new `inline` option) in the title cell: × removes, "+ Tag" shows on row hover. **List:** the shared `ListField` in the List cell (top-level tasks only; Work offers only client lists). Controls inside a row stop click and key events so they never open the task.
- Driven in the built app on a scratch library (rename, remove and add a tag, due placeholder, back link); the list picker's change and the due calendar were not exercised. The list picker first looked heavy as a bordered button on every row, so it is now plain text until hover, focus or open (`plain` on `GroupField` and `ListField`: no box, arrow hidden). Opening it showed the menu clipped by the table's scrolling box, so a plain picker's menu is `position: fixed` from the trigger's rectangle (above it when there is no room below) and closes on a scroll or resize outside it; the List cell no longer clips. Driven in the built app: idle, open, and the menu in full.

## A lecture's task starts in progress (12 Oct 2026)

- **Why (the user):** creating a training entry makes its lecture task; that task should be in progress from the start, like a task whose timer has started (`putStartedTaskInProgress`).
- **Change:** `useLectureTask` creates the lecture task with `status: 'doing'`. The tasks `create` IPC (`CreateTaskInput`, `register.ts`) now accepts an optional `status`, validated against `TASK_STATUSES`. The series task, when the page makes one, is left to do: only the lecture's own task starts in progress.
- **Not driven in the app** (typecheck, lint and tests pass); the hook reads `window.api`, so it has no unit test.

## Back is one icon in the top bar (12 Oct 2026)

First attempt (commit `521f548`) made one sticky `BackLink` per page; the user did not want a floating element and asked for Back in the top bar, icon only. Now there is exactly one Back: an `IconButton` (arrow, tooltip "Back (⌘[)") at the left of the top bar, before the workspace pills (`TopBar`, `Shell`). It goes through history (`navigate(-1)`, same as Cmd-[ and the mouse's back button), so a task opened from a training goes back to the training, a reading to wherever it was opened from. It is disabled when the window has no earlier page. That is tracked by the shell's own position in history (`useCanGoBack`, `shell/history-position.ts`), not by `location.key !== 'default'`: the start-up redirect from `/` already has a real key, so the key test left Back looking usable on launch with nothing behind it. In a normal (not full-screen) window the traffic lights are larger than the old 84px inset assumed: measured from a screenshot of the user's Mac, the last one ends about 81px in. The bar's left inset is 94px and Back is a 28px button with no gap to the tabs, so the arrow sits about 18px after the lights and about 21px before the first tab's text (first try: 10 and 23, which looked uneven). Every per-page back link and the landing header's `backTo`/`backLabel` are gone; the fallback to a named parent is gone too (the router is a memory router starting at the workspace, so a page with no history never occurs in practice). Deleting a page replaces its history entry so Back never returns to a deleted page.

## Meetings get their tasks by themselves (12 Oct 2026)

The user's request: new meetings get their task assigned, created and kept up to date like trainings do. Answer agreed: **one subtask per meeting**, under the series task (not the shared series task of stage 3).

- **Rules** (`planMeetingTask`, `shared/meeting-task.ts`, pure): a meeting made in the app is saved with `task: auto` (New meeting button and palette/Dock; `CreateMeetingInput.task`). Once it has a date and its series names a task (`proposeMeetingTask`: Research "Supervision" in "Meetings", "Other" is "Meetings"; Work "<Client> meetings" in the client's list, a series that is no client makes nothing), the page makes the subtask "<series task> · <date>" (e.g. "Supervision · Oct 12, 2026") under the series task, found or made, and replaces `auto` with its uid. After that the subtask follows the date and series. `useMeetingTask` does it after 0.8 s of stillness.
- **A task the user chose is never touched**: only a subtask whose title ends in " · Mon D, YYYY" (`isOwnMeetingTask`) is renamed, moved or trashed. Older notes (no `task:`) are never planned. A deleted task is not made again by itself.
- **Delete meeting** trashes its own subtask (restorable); time tracked on it stays in Hours. Clearing the Task field (the x) opts the meeting out and leaves the subtask in Tasks. **Superseded 20 Oct 2026:** deleting now takes the time with it (`docs/DECISIONS.md`, "Deleting a task takes its hours with it").
- **Hours:** unchanged. `auto` is not a task, so a note that waits for its date has no hours.
- **This year's existing meetings** (`npm run link:year-meetings`, `src/modules/meetings/main/import/year-meeting-links.ts`): Research notes dated from the year start (21 Sep 2026) with no task get the same subtask. A meeting already inside a day's imported total (`days`) is taken out of that total by what it reports (its length to the quarter), so the day's sum does not change and the note's derived session puts it back, labelled. Dry run by default; backs up the database, the notes and the hours; stops before the first write on any problem. Dry run on the real library 12 Oct 2026: 24 Sep Supervision (465 -> 435 min on that day) and 12 Oct Supervision (no total to lower); 8 Oct Rastle Lab already has a task. **Applied to the real library on 12 Oct 2026** (app closed; backup `~/CentralCommand/backups/year-meeting-links-2026-10-12T18-06-47-188Z`, files read back, a second run finds nothing): the series task "Supervision" in "Meetings" and two subtasks were made, both notes have `task: <uid>`, 24 Sep's day total went 465 -> 435.
- **Driven in the built app** (scratch library): New meeting made the series task and subtask and wrote `task:`; changing the date and the series renamed and moved the subtask; deleting the meeting trashed it. Found only that way: the cleanup was first put in the move handler instead of the delete handler.
- **Work, the same as Research (the user's answer, 12 Oct 2026):** every Work meeting gets a task. A series that is a client is "<Client> meetings" in that client's list; any other series ("Document Automation – Vecten", "– Luminos", "– Other") is its own series task, named after the series, in the list of **Teaching & Learning** (`OTHER_SERIES_CLIENT` in `meeting-task.ts`; the plain series "Other" is "Meetings"). With that client gone from Work's plan nothing is proposed. Existing Work notes, tasks and hours are untouched (checked on the real library: no Work task has a dated title, no Work note is marked `auto`).

## Marking a task done marks its subtasks done (13 Oct 2026)

The user's request. `TasksStore.setStatus` (`main/tasks-store.ts`): when a top-level task goes from open to done, every subtask that is not done is set to done with the same `completedAt`; subtasks already done keep theirs. One transaction, so the task and its subtasks change together.

- **One way only:** moving the parent back does not reopen its subtasks, and finishing the last subtask does not finish the parent.
- **Repeating tasks:** the next occurrence is copied before the subtasks are marked, so it starts with open subtasks. The finished occurrence keeps all its subtasks done; the test that expected an open one to stay open was changed to match.
- Not driven in the built app (store rule, covered by unit tests only).

## Task tags suggest the tags already in use (13 Oct 2026)

The user's request: task tags need to autofill and show a list. `TagsField` takes `suggestions` and offers them in a native `<datalist>` on its "+ Tag" input, so the browser filters as you type; tags the task already has are left out. Hosts pass `tagsIn(rows)` (`shared/query.ts`, the same set the Tasks filter uses) from rows they already hold: the table row (`allRows`), the task page and its subtask rows. No extra load per field. A typed tag is still lowercased and added as before.

- A datalist, not a custom dropdown: least code, matches the filter's tag set. A dropdown that opens on focus is the alternative if the native list proves too quiet.
- Not driven in the built app (typecheck, lint and tests only).

## Adding a task: priority, tags, and #tags in the title (13 Oct 2026)

The user's request, after looking at the add bar: the bar's "Return" hint was unhelpful (Enter only works while typing), priority and tags were missing, and the New task popup needed tags too.

- **Tasks page: no add bar.** "New task" (button and shortcut) covers it. `AddBar` stays, used by the Tasks landing only, in case another view wants a one-line add.
- **AddBar:** the "Return" hint is an **Add** primary button (disabled until there is a title; Enter still submits). It gained the shared priority `Segmented` and `TagsField`; priority and tags reset after each add, due and list stay.
- **New task popup:** a Tags row (`TagsField`, suggestions from `tagsIn(rows)`) under Priority. `tasks.create` already took `tags`; no store or IPC change.
- **`#tag` in the title** (`splitTitleTags`, `shared/title-tags.ts`, pure and tested): a `#` at the start or after a space, followed by a letter, up to the next space, is a tag (lower case, once each) and leaves the title. "Fix issue #12", "C#" and "a#b" are left as written. Tags typed this way merge with ones picked in the field. The `#tag` text stays visible in the field until the task is added; no chip is drawn while typing (a possible later step).
- Checked by unit tests, lint and typecheck only; not driven in the built app.

## Tasks landing: every list, with its sublists (13 Oct 2026)

The user's report: the landing's Lists section did not show all lists, and the user's lists are nested while the cards were flat. Three layouts were mocked up (`docs/design/tasks-lists-mockup.html`); the user chose C.

- **Cause:** `listSummaries` skipped done tasks before it counted anything, so a list whose tasks were all done had no card (Research Scoping, Study 1: Luminos Analysis in the real library). Only Work clients were forced in. Sublists were listed only if they had an open task, as one line of text.
- **Now:** `listSummaries` (`shared/views.ts`) keeps every list and every sublist. A list has `open` and `total` (done tasks included); a sublist is `{ name, open }`, most open first. Cards show lists with something open, or a Work client with no tasks at all; a list with `open: 0` and `total > 0` goes to a **Nothing open** line under the cards, each name a link with its sublist count.
- **Sublists** are chips on the card (`chips` on `SeriesCard`, shared `Landing`), dimmed when none is open. The chips are not links: the whole card opens the list, as before. Overdue keeps its own line.
- Unit-tested (`views.test.ts`); not driven in the built app, so how the chips and the line look is unchecked.

## Subtasks are ordered by date (13 Oct 2026)

The user's request, looking at a task's Subtasks card: always order subtasks by date, soonest at the top, undated at the bottom.

- `orderSubtasks` (`shared/views.ts`) sorts by `due`, `null` last; ties keep the old order (position, then when added). Every place that lists subtasks (the task page, table rows) goes through it via `groupTasks`.
- Position is no longer what the user sees; nothing was dropped (the field and any reordering code stay).
- Unit-tested (`views.test.ts`); not driven in the built app.

## A top-level list's page groups by sublist (13 Oct 2026)

- **Why (the user):** opening a top-level list should show the tasks of all its sublists; of four mockups (`docs/design/tasks-list-page-mockup.html`) they chose B, a section per sublist.
- **Now:** the filter already matched a list's sublists; `groupBySublist` (`shared/query.ts`) splits the rows into one section per sublist (heading and count, each section in the page's sort), tasks directly in the list last as "No sublist". Only for a whole-list filter where some task has a sublist; a sublist's own page, All lists and Backlog stay flat. Grouped sections are not cut at 50 rows. Not yet driven in the app.

## A subtask's due date follows its parent only until dates are set (13 Oct 2026)

- **Why (the user):** a new subtask should start with its parent's due date, and a parent that gets its first date should not leave undated subtasks behind; once dates exist, nothing should move on its own.
- **Now (`TasksStore`):** a new subtask with no `due` given takes its parent's (an explicit `null` stays undated; the repeat copy, `ruled = false`, keeps the dates it was given). When a parent's `due` goes from none to a date (`update` or `setDue`), `passDown` gives it to the subtasks that have none. Every other change to a parent's date, and a subtask's own date, leave the others alone.
- Unit-tested (`tasks-store.test.ts`); not driven in the built app.

## Task tags are one lower-case word (13 Oct 2026)

- **Why (the user):** every tag one word, always lower case, and nothing else allowed from then on.
- **Now:** `normaliseTag` (`tasks/shared/tag.ts`) trims, lower-cases and refuses (empty) a tag that still holds whitespace. `TasksStore` runs every tag through it on create and update; the tag field strips spaces as you type. `#tag` in a new task's title already took one word only.
- **Data:** the only offenders were `study 1` and `study 2`; renamed first to `study-1` (40 tasks) and `study-2` (7), then, the user's second choice, to `study1` and `study2` (no hyphen), both applied 13 Oct 2026 with `update task_tags` (backups: `~/CentralCommand/backups/tags-before-rename/`, `tags-rename-*.sqlite`; no script kept).
- **Not touched:** a reading's tags are Zotero keywords, which the app never writes (about 29 have spaces, 28 capitals); renaming them here would be undone by the next sync. Only if the user asks (e.g. normalising at sync time).
- Unit-tested (`tag.test.ts`, `tasks-store.test.ts`); installed in `/Applications`, not driven in the app.

## The task row's trash icon stays muted and lines up (13 Oct 2026)

- **Why (the user):** the trash icon in the Tasks table turned red on hover, unlike every other delete control, and sat off the due date's line.
- **Now:** the red hover is gone (hover is the light background only, as for the subtask trash icon on the task page); the due date and the icon share an `inline-flex` row (`.dueCell`, `TasksTable.module.css`) so they centre together.
- Not driven in the app.

## The task row's trash button is a tight square (13 Oct 2026)

- **Why (the user):** the trash icon in the Tasks table looked off-centre with a lot of empty space around it.
- **Cause:** `.remove` kept the shared `.iconButton` padding and negative margin plus an 8px left margin, on top of the 8px the plain date button already pads on its right, so the hover box was loose and the gap wide.
- **Now:** `.remove` (`TasksTable.module.css`) is a 24px square with no padding, the icon centred, 4px from the date button.
- Not driven in the app.

## The task row's trash is right-aligned in a fixed Due column (13 Oct 2026)

- **Why (the user):** after three tries the trash still floated next to the date with 71px of empty space after it, and the user wanted it right-aligned with the row's usual padding, the empty space narrower, and the date zone as wide as the widest date so nothing jumps. Chosen from a to-scale mockup (the user picked "right aligned").
- **Now:** the Due column is 133px (`.colDue`): 12 padding, an 81px date zone (`.dueDate`; the widest date, "May 28, 2027" in 13px IBM Plex Sans, measures 80.4px), a 12px gap, the 16px icon, 12 padding. `.remove` has margin `0 -4px 0 8px`, so the icon (not its 24px button) sits 12px from the cell's right edge, like every other cell's padding. The column was 160px; Title takes the 27px.
- Driven in the built app on a scratch library: the cell is 133px, the icon's right edge is 12px from the cell's, its centre is on the row's centre line, and it is 12px from the date zone.

## Tasks landing: order, Upcoming window, and every section that fits (13 Oct 2026)

_"Every section that fits" was reverted on 18 Oct 2026 ("Tasks landing: a task shows once"), and the order was changed on 13 Oct 2026 ("Overdue, Today, Tomorrow, Soon, In progress"); the rest below stands as history._

- **Why (the user):** the sections should run Due today, Overdue, Upcoming (next 7 days), In progress; and a task that fits several (due today and in progress) should show in all of them, not only the first. Their CastlesFest task (in progress, due tomorrow) had only appeared under In progress.
- **Now:** `LANDING_SECTIONS` is `today, overdue, upcoming, doing` and `TasksLanding` renders in that order; `UPCOMING_DAYS` is 7 (label "Next 7 days"). `landingSections` (`tasks/shared/views.ts`) no longer stops at the first match: a task is listed under every section whose own date or status fits, or where an open subtask's own date fits (that subtask nested under it, only in the section it fits). Done tasks are never listed.
- **Consequences:** Overdue's "Move to Today" (no confirmation, no "Move to Backlog") acts on the whole Overdue section, so an in-progress, overdue task moves and stays in In progress. A task with a date in the next 7 days and a subtask due today shows in Today (subtask nested) and Upcoming (nothing nested).
- Unit-tested (`views.test.ts`); not driven in the app.

## Priority choosers show P1, P2, P3 (13 Oct 2026)

- **Why (the user):** the add bar showed priority as High / Normal / Low while the table showed P1 / P2 / P3; consistency matters more than either wording, and the user kept the P marks.
- **Now:** the three `Segmented` priority choosers (`AddBar`, `NewTaskDialog`, `TaskPage`) use `PRIORITY_OPTIONS` (`task-labels.ts`): label `P1`/`P2`/`P3`, hover title the word. `Segmented` options take an optional `title`. The "Filter by priority" dropdown and the row menu (badge plus word) still use words.
- Not driven in the app.

## The New task dialog is switched off (13 Oct 2026)

The user: tasks are made another way (the Add bar on the Tasks landing and the Start picker's Create), so the New task dialog goes, but its code stays in case task creation is wanted from another place.

- **Removed from the UI:** the "New task" buttons (landing and Tasks page), the Mod-Shift-A shortcut (`TaskGlobals` is no longer in the manifest, and its Settings entry is gone), the palette's "New task" and the Dock's "New Task" (`DockActionId` lost `new-task`).
- **Kept, unmounted:** `NewTaskDialog`, `NewTaskButton`, `TaskGlobals`, `new-task-store`, `NEW_TASK_SHORTCUT`. To bring it back: mount `TaskGlobals` in the manifest, add the shortcut entry, the buttons and the quick action again.
- Checked by tests, lint and typecheck only; not driven in the app.

## The date chip has a minimum width (13 Oct 2026)

- **Why (the user):** the Due chip in the task page's fields row was only as wide as its text, so choosing a date ("Oct 30" after "No date") changed its width and moved the fields beside it.
- **Now:** `.button` in `DatePicker.module.css` has `min-width: 112px`, enough for the icon, the gap, padding and the widest short date ("May 28"); the inline `plain` variant (table cells) keeps `min-width: 0`. A date in another year ("Oct 30, 2027") is longer and still widens the chip; left as is, being rare.
- Not driven in the app; the 112px is estimated, not measured.
- **Update (13 Oct 2026, the user):** 112px was too narrow for a date with a year, so `min-width` is now 132px ("Sep 30, 2027").

## Subtask rows on the task page look like the table's (13 Oct 2026)

- **Why (the user):** a subtask's date was a boxed chip and it had a caret, while the same subtask in a task list has a plain date and its tags under the title.
- **Now:** `SubtaskRow` uses the table's pieces: a `plain` `DatePicker` coloured by `dueTone` (overdue, today), the tags inline under the title, no caret (the tags were all it opened). Same date text as the table (`DatePicker` and `formatDue` give the same words). Not driven in the app.

## Training tasks are called "Complete <name>" (13 Oct 2026)

The user's rule: a training's task, series task and lecture subtask alike, is titled "Complete <name>" (`completeTitle` in `src/modules/training/shared/lecture-task.ts`). The series is found by its name with or without the prefix (`bareTitle`), so an old ClickUp "Complete <course>" task is reused; a title already starting with "Complete" is not doubled. The page keeps the task in step, so a lecture renamed in the note renames its task to "Complete <new title>". The five tasks made so far (PS5210 and its three lectures, Response Surface Analysis Workshop) were renamed on 13 Oct 2026 with the app closed (backup `~/CentralCommand/backups/complete-titles-1791885353`, read back). Installed the same day (`npm run build:mac`).

## Landing sections are ordered by the date that put the row there (13 Oct 2026)

- **Why (the user):** the task lists on the Tasks landing page must read sensibly: by date, then priority within a date; Overdue starts with the most overdue, Upcoming with the soonest (tomorrow).
- **Cause:** `landingSections` sorted every section with `compareRows`, i.e. by the task's `effectiveDue` (its own date, else its earliest open subtask's). A task listed in Upcoming or Overdue only because of a nested subtask was placed by its own, unrelated date.
- **Now:** each section is sorted by the earliest date of the row (its own or a nested subtask's) that falls in that section (`sectionDate` in `src/modules/tasks/shared/views.ts`), then priority (P1 first), then title. Both Overdue (oldest first) and Upcoming (soonest first) are ascending. "In progress" still uses `effectiveDue`. `compareRows` and the All tasks table are unchanged. Test in `views.test.ts`; not driven in the app.

## The priority popup closes when its badge is clicked again (13 Oct 2026)

- **Why (the user):** with the Priority popup open, clicking the row's P-badge again left it open.
- **Cause:** `TaskMenu` closes on any mousedown outside it, which includes the badge that opened it; the badge's click then opened the menu again.
- **Now:** `TaskMenu` ignores mousedowns on an element marked `data-menu-trigger`, and the table's `onPriorityMenu` toggles (the same task's open priority menu closes). Not driven in the app.

## Series cards: even spacing and one chip font (13 Oct 2026)

- **Why (the user):** the list cards on the Tasks landing page were poorly spaced: "9 open" and "8 overdue" sat far apart in one card and close together in its neighbour, and the chips mixed fonts.
- **Cause:** `.card` is a grid, and its auto rows stretched to fill a card made taller by a neighbour in the same row. Chips with a count were monospace (`.chip`), zero-count chips were sans (`.chipZero`).
- **Now:** `.card` has `align-content: start`, so rows keep the 4px gap whatever the neighbour's height; chips inside a card (`.cardChips`) use the body font. The change is in the shared `SeriesCards`, so Notes and Training group cards get it too. Not driven in the app.

## Open TODOs list the most recent meeting first (13 Oct 2026)

- **Why (the user):** on a meetings landing page, "Before next meeting" should have the most recent TODOs on top.
- **Cause:** `openTodos` ordered series by the fixed `SERIES` order, so a series with an older meeting (Luminos, May 21) sat above a newer one (Other, Oct 13).
- **Now:** series are ordered by the date of the meeting their TODOs come from, newest first; the same date falls back to the fixed series order, then by name; within a meeting the note's order stands. Test in `open-todos.test.ts`; not driven in the app.

## Recent rows' people chips sit level with the title (13 Oct 2026)

- **Why (the user):** on the Training landing page, the initials chip (KI) in "Recent and upcoming" sat lower than the entry's text.
- **Cause:** `Landing.module.css` defined `.chips` and `.chip` twice, once for the recent rows and once for the series cards. CSS Modules merge them, so the later series-card rules (`margin: 8px 0 0`, a border, more padding) also applied to the row chips and pushed them down.
- **Now:** the recent rows use their own `.people` and `.person` classes. `RecentList` is shared, so Meetings and the other landings get the fix. Not driven in the app.

## A renamed meeting no longer overlaps itself (13 Oct 2026)

- **Why (the user):** on a new meeting, while filling in its details, the page warned "Overlaps Meetings · Oct 13, 2026 13:00–14:00", which was the meeting itself.
- **Cause:** changing the series or date renames the file, and `MeetingPageIn` keeps the page mounted under the name it opened with (to keep the cursor). `MeetingHoursNote` was given that old name as the meeting's own, so its entry under the new name looked like another meeting. The 14:00 end was the default, before the user set 13:05.
- **Now:** `MeetingView` takes `currentId` (the name in the address) and passes it to `MeetingHoursNote`. File operations still use the name the page opened with. Not driven in the app; no test for the rename case.

## Hours layout, stage 1: the Week card summary (13 Oct 2026, `docs/HOURS_LAYOUT_PLAN.md`)

- **Why (the user):** the page should answer "am I on track this week and this month?" at a glance. Decided with the user on 13 Oct 2026: both balances (week and, in stage 2, the invoice period) are measured against the **whole aim** (the full week, the full month), not against what is expected by today; and **Research follows the same layout as Work**.
- **Now:** `PeriodSummary` (`src/modules/hours/renderer/`) is the one summary row and bar: hours worked large with `of <aim>` small, the signed balance on the right in `--chart-under` when behind, and one bar (no pace marker). The Week card uses it in place of the "0:50 of 8:00 so far · -7:10" text. The aim is the rules' plan for the week's last day (`weekTotals` at day 7), so it matches the week's plan in the balance and the year. With no aim the card shows only the hours worked. Today's row has the accent stripe (`data-today`, the same `inset 4px 0 0 var(--accent)` as a running task in Tasks). The table already fills the card, so the stripe sits at the card's very left edge.
- **The same stage fixes meeting rows' icon:** `MeetingRows` had a 32px centred icon column and a 14px gap, so the title began 46px in. The icon column is now 16px, left-aligned where plain task text starts, with an 8px gap.
- **Driven:** scratch library (a copy of the real time files, meetings and database), production build in light and dark, Work and Research, and dev mode. The meeting row itself does not appear in the scratch copy (its hours need the real task rows), so its alignment was checked with the row's real classes injected into an open day.

## Hours layout, stage 2: the invoice card (13 Oct 2026, `docs/HOURS_LAYOUT_PLAN.md`)

- **Now:** `InvoiceCard` uses the same `PeriodSummary` as the Week card: hours of the period's whole plan, the balance against it (`-15:45` for 16:15 of 32:00; the old "Balance … against … expected so far" line and "to go" are gone) and one bar. The weeks table has Week, Hours and a bar per week (its hours against its plan); the Plan column and the Total row are gone (the summary says it). The page's current week is bold with the accent stripe at the card's left edge (the same `inset 4px 0 0 var(--accent)` as today's row in the Week card), replacing its shaded row; hover still tints. A weekly-invoiced contract has no weeks table: the summary, then the hours per client. With no aim the card shows only the hours.
- `periodPlanSoFar` is no longer used by the card (it keeps its tests; the balance card may still want it).
- **Driven:** scratch library, production build, light and dark, Work.

## Hours layout, stage 3: the contract line and the layout (13 Oct 2026, `docs/HOURS_LAYOUT_PLAN.md`)

- **Now:** the right-hand column is gone. `BalanceCard` is one quiet line under the cards: "Whole contract: 121:15 of 208:00 · balance -70:45 · average week 5:03" with "Charts and weeks" beside it ("Whole year" in Research; with no aim: hours and average week only). The balance there is still against the plan up to today (`yearTotals`, unchanged). The link sits next to the text, not at the far right, where the floating Ask button covered it. Today stays full width; the Week and invoice cards sit side by side and stack below 1100px (at about 975px they were cramped: week labels wrapped). Research has no invoice card, so its Week card takes the full width (changed the same day, see below).
- **Research follows (the user, 13 Oct 2026):** the same Week card, summary and line, so Research's week reads "10:06 of 37:30" with its per-day bars and aim ticks unchanged.
- **Driven:** scratch library, production build, light and dark, Work wide, Work stacked, Research. Dev mode was driven for stage 1 only (the same CSS and components).

## Hours layout: the "today" tag and the day bars (13 Oct 2026, the user's feedback)

- **Now:** the Week card's day rows no longer carry a "today" tag (the accent stripe already says it; `AllWeeks`' "now" tag is a different thing and stays). The bar column is 21% of the card, half of the 42% it had, so a day's bar is half as wide; the summary bar is unchanged.

## Hours layout: a lone Week card keeps half the width (13 Oct 2026, the user's feedback)

- **Now:** Research's Week card is half the page, like Work's: `.cards` is always two columns (stacking below 1100px), so a page with no invoice card leaves the right column empty instead of giving the Week card the full width. Replaces the "takes the full width" line above.

## Hours: Today beside a Charts card, no Charts page (13 Oct 2026)

- **Why (the user):** Today at half width with a simpler version of the charts page beside it; the full page ("Charts and weeks") is not needed. Mockup: `docs/design/hours-charts-card-mockup.html`. Decided and built in one go at the user's instruction (busy; no questions).
- **Names:** the module is **Charts**; its views are **Year**, **Weeks** and **Typical week** (the same words as before, so nothing is renamed twice). The button "Charts and weeks" and the `/hours/year` route are gone; `?year=&week=` links (a heat-map day opens its week) still work.
- **Now:** `ChartsCard` (`src/modules/hours/renderer/`) is a card with a `Segmented` switch (the app's own control) over `YearHeatMap`, `WeeksChart` and `TypicalWeek`, which are bodies now (their own card, title and header are gone). The chosen view is remembered (`useModuleState('hours-charts')`, default Year). **Its height never changes**: the body is a fixed 240px (legend row plus a `CHART_HEIGHT` of 200 for the plot); the heat map is centred in it. The page's first row is Today and Charts (grid, stretched to the same height; Today grows with its tasks, Charts only gains space), the second row Week and invoice as before (Research: a lone Week card keeps its half). Under 1100px everything stacks.
- **Weeks has no plan line** (the user: colour already says over and under; the legend lost its "Plan" key). Typical week keeps its daily-aim ticks.
- **Removed:** the Charts and weeks page, `AllWeeks` (every week as a table) and `YearsTable` (contracts table) with their tests; the contract line under the cards no longer has a link. The year/contract select in the header still switches contract. Their rules in `src/shared/tracking/` stay (unused by any page now: `weekTotals` still feeds the chart).
- **Looked at** in the built app on a scratch copy of the library (Research and Work, all three views): the card is 355px (Research) and 329px (Work) in every view. Light mode only; dev mode and dark were not driven. The user did not answer whether Today should scroll when its list is long, so the Charts card simply stretches.

## Hours: Patterns card, review fixes (13 Oct 2026)

- **Names (the user asked for one word each; mine, change freely):** the card is **Patterns**; its views are **Calendar** (the year heat map), **Weeks** and **Weekdays** (the average of each weekday, was "Typical week"). The stored view ids (`year`, `weeks`, `typical`) are unchanged, so a remembered choice survives.
- **Height:** the card is as tall as it needs, not stretched to Today (`.top` no longer stretches the first row). It never changes with the view: a body of 232px, a legend row (18px minimum, also when Weekdays has no aim) and a plot of `CHART_HEIGHT` for all three. The heat map used to be centred in the space; its cells are now as tall as the plot allows (wider than the weeks need, so not square) and the grid fills it like the other two.
- **Tooltips are not cut off:** the body no longer clips (`overflow: hidden` removed), which was cutting the Weekdays bubble at the top.
- **Weekdays has no aim lines.** A bar is blue when the weekday's average meets the daily aim (or the day has none, such as a weekend) and amber (`--chart-under`) under it, as in Weeks; the legend says Plan met / Under plan, the tooltip still gives the aim. The axis is scaled to the averages only.
- **Day off in the Calendar** is outlined in `--text-muted`, not amber, which means under plan everywhere else.
- Not driven in the app beyond the build (dark mode and dev mode unlooked at).

## Hours: the Calendar's days are square and numbered (13 Oct 2026)

- **Why (the user):** the cells were tall bars ("the squares must be square") and only Mon, Wed and Fri were named ("label every day").
- **Now:** a cell is a square, as large as both the weeks across and the plot's seven rows down allow (at most 26px), so the grid is left-aligned and the card keeps its fixed height. Each cell shows its day of the month (11px; dark on pale cells, `--accent-contrast` on the two darker levels, so it reads in both themes) and all seven weekday names run down the side. Under 15px a cell is too small for a number, so a narrow window shows squares only. The number never takes the pointer from its cell: hover, tooltip and click-to-open-week are unchanged. Replaces the "wider than the weeks need, so not square" line above.
- Alternatives not taken: numbering only the 1st of each month, or only Mondays.
- Not driven in the app (typecheck, lint and tests only).

## Hours: the Calendar slides with the date (13 Oct 2026)

- **Why (the user):** the Calendar left empty space under it. The cause was width, not the row: 52 weeks across a half-width card (about 650px) made the squares about 12px, so the grid was about 100px tall in a 200px plot (and too small for day numbers). Five options were mocked at the card's real size (`docs/design/hours-patterns-empty-space-mockup.html`); the user chose A, half a year at a time, without the control.
- **Now:** the squares are as large as the plot's seven rows allow (about 25px, the cap is 26) and the card shows as many weeks as fit across, **ending with the week that holds today**, so the grid slides with the date and shows as much of the past as there is room for (about 23 weeks at 697px; fewer in a narrower window). Rule and tests: `heatWindow` in `modules/hours/shared/heat.ts`; `monthColumns` takes the window (its first week is always labelled).
- **Early in the year** (fewer weeks behind today than fit) the window starts at the year's first week and runs on into the weeks to come to fill the width (they are the usual empty outlines), rather than leaving the right side empty. This is my reading of "as much of the past as is available"; changing `heatWindow` to stop at today's week would be one line. At the year's end the window stops at the last week.
- Day numbers now always show (the cell is never under 15px). Hover, keyboard (arrows stay inside the window) and click-to-open-week are as before; the key is still the day's index in the year.
- **Not built:** the ‹ › control to look at earlier or later weeks. Until then the earlier weeks of a year are reachable only in Weeks and the week pages.
- Driven in the built app on a scratch library (light mode; keyboard tooltip). Dark mode and dev mode not looked at.

## Segmented control: a segment keeps its width when selected (13 Oct 2026)

- **Why (the user):** on the Hours view choice (Calendar / Weeks / Weekdays) a chip changed width on selection, which was "disturbing". The selected segment is bold (600), which is wider than the regular text, so it grew and pushed its neighbours.
- **Now:** in the shared `Segmented`, each label sits in a span whose `::after` is a hidden copy of the label in bold (`data-label`, zero height), so the segment is always as wide as its bold text. Every segmented control in the app gets it; nothing is set per page.
- Alternative not taken: keeping the weight the same and marking selection by colour only (the bold is part of the selected look).
- Not driven in the app (typecheck, lint and tests only).

## Hours: Patterns views renamed, Calendar shows today, Weeks and Days line up (13 Oct 2026)

- **Why (the user):** the Calendar did not show which day is today; switching between Weeks and Weekdays made the plot move; the three views should be called Year, Weeks and Days.
- **Names:** the segments are now Year, Weeks and Days (stored values `year`, `weeks`, `typical` unchanged, so a remembered choice still works).
- **Today:** in Year, today's cell has a small dot under its number (the contrast colour on a filled cell, secondary text otherwise), and the legend has a "Today" key with the same dot. A day off keeps its grey outline, so the two read apart.
- **The movement:** Weeks used a top padding of 12px and Days 22px, so the plot area, gridlines and value axis sat in different places. Both now use `top: 22` (Days needed the room for its value labels), so the frame is the same; the axis labels still differ because each chart scales to its own data.
- Typecheck, lint and tests only; not driven in the app.

## Hours: today is a corner notch; charts no longer redraw 8px narrower (13 Oct 2026)

- **Why (the user):** the dot under today's number in Year was disliked; asked for options consistent with the app. Seven were mocked in light and dark, on a pale and a filled cell (`docs/design/hours-patterns-today-mockup.html`): A ring, B bold number, C bar under the number, D badge, E tint with edge, F corner notch, G accent bar on the left (like the Week table's today row). The user chose **F, without the legend entry**.
- **Now:** today's cell has a small triangle in its top-right corner (`notch` in `YearHeatMap.tsx`, following the cell's rounded corner, size about 36% of the cell): accent on a pale cell, the contrast colour on a filled one (level 2 and up). The "Today" legend key and the dot are gone. A day off keeps its grey outline and the hover/keyboard ring stays ink, so the three read apart.
- **The chart "settling" (the user's suspicion, not proved):** Year, Weeks and Days each measure their plot with `useElementWidth`, whose ref callback read the border box (`getBoundingClientRect`) while `ResizeObserver` reports the content box; the plots have 4px side padding, so the first draw was 8px too wide and the observer then redrew narrower. The hook now reads the content width from the start (`clientWidth` minus padding). Whether anything else also moves was not checked; if it still does, drive the app and look.
- Typecheck, lint and tests only for the code; the mockup was looked at in headless Chrome. The notch was not driven in the app before this write-up.

## Hours: a finished year puts the Week card beside Patterns and opens on its first week (13 Oct 2026)

- **Why (the user):** in a completed year or contract there is no Today card, so Patterns sat alone in a half-width row with the Week card below it, and the Week card opened on the last (empty) week.
- **Layout:** when today is outside the year (finished, or not begun), the first row is the Week card on the left and Patterns on the right; the invoice card, if the contract has one, gets its own row below. A current year is unchanged: Today and Patterns, then Week and invoice (`HoursPage.tsx`).
- **Default week:** `defaultWeek` returns the year's first week when today is after the year's end (before the start it already did). A `?week=` in the URL still wins.
- Typecheck, lint and tests only (`week.test.ts` updated); not driven in the app.

## ComboField: typing narrows the list (13 Oct 2026)

- **Why (the user):** the Training entry's Institution field "doesn't allow searching": typing "royal" left the whole list showing.
- **Before:** `ComboField` showed every option whatever was typed (a deliberate contrast with a native `<datalist>`). That made a long list impossible to search.
- **Now:** typing opens the list narrowed to the options containing the text (case-insensitive, trimmed); an empty result hides the list, and the typed value is still accepted as new. Opening it with the chevron or the arrow keys, without typing, shows every option, so the full list stays reachable. Enter picks from what is shown. Applies to every `ComboField` (Institution, Training series, Meetings series).
- Typecheck, lint and tests only; not driven in the app.

## Training: the Files panel looks again (13 Oct 2026)

- **Why (the user):** files added to or renamed in a linked folder did not show until the page was reopened.
- **What:** `FilesPanel` listed the folder only when the page opened. It now lists again when the window regains focus or becomes visible, and every 4 seconds while visible. The listing is replaced under the same key, so nothing flashes. Not driven in the app; check: open an entry, add and rename a file in Finder, come back.

## Tasks table: one fixed order in a row's title line (13 Oct 2026)

- **Why (the user):** the repeat icon "hung nowhere" in a row at rest, while the hover pills ("+ Tag", "+ Subtask") with the icon beside them looked right.
- **Cause:** the hover pills are `opacity: 0`, not removed, so they keep their width. Anything placed after one (the repeat icon, or a real subtask pill after an invisible "+ Tag") sat after an empty gap. Moving the icon alone could not fix it for every combination of tags, repeat and subtasks (seven combinations were mocked at rest and on hover; the user chose the one below).
- **Now:** the title line orders its items with CSS `order`: tags (1), repeat icon (2), subtask pill (3), then the hover-only ghosts "+ Tag" and "+ Subtask" (4). `.tags` and the `TagsField` root are `display: contents` so the chips and the add button take part in the title line's flex. Every item has a 6px left margin. Real items never follow an invisible gap, and hovering adds the ghosts at the end without moving anything.
- Checked in the built app on a scratch copy of the library, light mode: tags with repeat and subtasks, a subtask pill without tags, a plain row, at rest and on hover. Dark mode and dev mode were not driven.

## Tasks landing: Overdue, Today, Tomorrow, Soon, In progress (13 Oct 2026)

- **Why (the user):** the landing should lead with what is due now, split today from tomorrow, and not show empty blocks.
- **Now:** sections run Overdue, Due today, Due tomorrow, Soon, In progress (`LANDING_SECTIONS`, `landingSections` in `shared/views.ts`). Soon is the old Upcoming without today and tomorrow (days 2 to 7). A section with no rows is not drawn at all (no empty table, no "Nothing is overdue"), so Overdue's Move buttons only exist when something is overdue. Subtask nesting and date ordering are unchanged.
- Typecheck, lint and tests only; not driven in the app.

## Tasks table: the line marks where a task ends (13 Oct 2026)

- **Why (the user):** with subtasks open it was not clear where one task stopped and the next began.
- **Cause:** a parent row kept its bottom line, so the line sat between the parent and its own subtasks, while the subtasks and the add row had none, so nothing closed the group.
- **Now:** a row directly followed by a subtask has no bottom line (`.row:has(+ .kid)`); the group's last row (`.kid.end`: the add row when open, the last nested subtask when closed) has it. Layout, columns and the thread are unchanged.
- **Considered and dropped:** the subtask-row layouts in `docs/design/tasks-subtask-rows-mockup.html` (inherited values shown faint, a title-and-date thread, subtasks inside the parent's row, a richer pill). The user kept the current layout. Subtask priority is untouched: a subtask still stores one and shows none; making it read the parent's is open.
- Not driven in the app (CSS only); typecheck, lint and tests pass.

## Tasks table: a band behind the subtasks (13 Oct 2026)

- **Why (the user):** after the line moved to the end of a group, they wanted a subtle sign that a task is "opened". Mockups: `docs/design/tasks-group-expansion-mockup.html`, `docs/design/tasks-group-band-mockup.html`. A left rail was ruled out because it already means "the running task"; a very dark recessed area was too heavy.
- **Now:** the subtask rows and the add row have a background slightly darker than the table (`color-mix(in srgb, var(--bg) 35%, var(--surface))`, so it follows light and dark); the parent row is untouched. Hover and keyboard focus still win over it. No shadow (the user chose the plain band, option A).
- Not driven in the app (CSS only); typecheck, lint and tests pass.

## Task page: subtasks are the Tasks table's own rows (13 Oct 2026)

- **Why (the user):** the task page's subtask list looked and behaved unlike the Tasks table (tags on their own line, an always-visible "+ Tag" and trash icon). "I want everything to be consistent."
- **Cause:** `TaskPage.tsx` had its own `SubtaskRow` and CSS, a second copy of what `TaskRowView` draws.
- **Now:** the Subtasks panel renders `TasksTable` with a new `flat` prop. Rows are the same component, so status, title, tags on the title line, time, due date, hover-only delete and "+ Tag", right-click menu, Space to change status and the "+ Add a subtask" row are shared. Flat leaves out the header, the parent row, the List and Priority columns, the table's own frame and the thread/band; Enter or a click on a subtask does nothing (a subtask has no page). The old `SubtaskRow`, its add field, "Add subtask" header button and about 140 lines of CSS are gone. A change to the table's rows now reaches the page too.
- Typecheck, lint and tests pass. Not driven in the app: check a task with subtasks in light and dark mode.

## Training tasks are named after the training again (15 Oct 2026)

The user changed their mind about "Complete <name>" (13 Oct 2026, above): a training's task, series task and lecture subtask alike is now just "<name>". `completeTitle` is gone from `src/modules/training/shared/lecture-task.ts`; `bareTitle` stays so an older ClickUp "Complete <course>" series task is still found. Meeting tasks never had the prefix ("<series task> · <date>"). Applied to the real library the same day with the app closed: the seven app-made tasks (PS5210 and its four lectures including Numerical Skills, Response Surface Analysis Workshop, CastlesFest) lost the prefix (backups `~/CentralCommand/backups/uncomplete-titles-1792050545` and `uncomplete-castlesfest-1792051038`, read back). Two of the first three were set wrongly by a query that bound to the wrong table (all five got one title) and restored from the backup; a one-off, no script kept. Meetings never had the prefix. The ClickUp "Complete …" and "Prepare for and complete meeting with …" tasks are untouched; ClickUp meetings are a separate conversation (the user, 15 Oct 2026).

## Watch, Home, notifications and the widget file: the backends (15 Oct 2026, an unattended run)

The user asked, before going away, for: a Watch module that checks conferences, trainings, summer schools and journals (the URLs they open by hand each month), a Home page backend with weather and "coming up", notifications, a Mac widget, mockups of all of it, and a tidy of CLAUDE.md. "Do as much as you can without building something completely unchecked." Everything below is backend only: **no renderer page exists yet**, only the mockups in `docs/design/` (`home-mockup.html`, `watch-mockup.html`, `notifications-mockup.html`, `widgets-mockup.html`). Plan and open questions: `docs/WATCH_HOME_PLAN.md`. Nothing is pushed, installed, or applied to the real library.

- **Where the URLs came from.** The four monthly reminders "Check upcoming conferences / external trainings / internal trainings / summer schools" in Tasks hold the addresses. `npm run watch:from-tasks` lists them (dry run, read-only): 17 readable pages become suggested sources; two cannot be opened by the app (the campus intranet and a shared Box folder) and are listed "by hand"; "Researcher Development Programme" and "SEDarc (Inkpath)" have no address. `--apply` (app closed) backs the database up, creates Watch's tables and adds them. **Not applied.** Kathy's reading list (a Google Doc behind a sign-in) cannot be watched. One task description holds a plain-text password (the SENSS course site); it was not copied anywhere, but it sits in the tasks table in clear text.
- **Watch** (`src/modules/watch/`, migration `watch/0001_init`): sources (`feed`, `page`, `crossref`), items, keywords. A feed is RSS/Atom (LINGUIST List has them: `/issues/rss/confs|calls|sum|toc`, checked on 15 Oct). A page gives its new links, plus sentences naming a coming date (for prose pages such as EPS's meetings page, which has no links), plus a "page changed" flag when the text changes with nothing new to show. A journal comes from Crossref by ISSN (public API, no key; the ISSNs in `shared/suggestions.ts` were each checked against Crossref). Dates are read only when written out ("by 10 November 2026"); numeric dates are ambiguous and ignored. A date after "by / deadline / submit …" is a deadline.
- **Baseline.** The first good check of a source stores what is there; only feed/Crossref items from the last 21 days are "new" (a page's links are all "seen"), so adding a source never buries the inbox in history. A failing source is tried less and less often (the interval doubles, up to a week). One run at a time, 2 s between requests; a conditional GET (ETag / Last-Modified) is used when the site gives them.
- **Baseline revised (26 Oct 2026, the user's call).** Adding a source made 4 items that the card still called "Nothing new". Now everything a source has is New, the first check included (still at most 60 per check); the exception is an item whose every written-out date has passed (`isOver`, `shared/dates.ts`), which is never added, on any check. An item with no date is added.
- **What is sent over the network.** Only requests for public pages the user listed, with a plain `User-Agent` and no cookies or identifiers. `makeNetFetcher` refuses non-http(s) and private addresses (also after a redirect), times out at 20 s and caps the body at 5 MB. **With no source, nothing is ever requested.** This is consistent with "never send user data over the network"; flagged because the app now makes requests on its own.
- **Home** (`src/modules/home/`): `buildHomeSummary` is a pure function (tasks overdue / due today, next meeting, open TODOs, hours against the week's aim, running timer, the merged "coming up" list, the Watch brief, weather); `collectHomeSummary` reads it from the database and the tracking files. Meeting and lecture subtasks are left out of the task lists (their time and place are the meeting's own). Hours count timer sessions only, not the hours derived from meeting notes (those are derived in the renderer). `window.api.home.{summary, weather, findPlace}`.
- **Weather** (Open-Meteo, no key): **off by default, and cannot be on without a place.** Only the town's coordinates rounded to one decimal (about 10 km) and the unit are sent; the place search sends the typed name only. Cached 30 minutes; a failed request keeps the last reading for a few hours. This is the one thing that sends something about where the user is, hence the explicit opt-in.
- **Notifications:** `planNotifications` (pure) decides, `Notifier` shows (Electron `Notification`, silent) once a minute and remembers what it said in `data/notifications-sent.json` (pruned after 30 days). Digest, meeting reminder, timer left running, new Watch matches (grouped), deadlines. **Off by default; turning them on does not announce what already exists.** A real bug the tests caught: a grouped notice must record every item it covers, or the next minute repeats the first one. A click opens the page (`window.api.app.onOpenRoute`, `RouteOpener` in the shell).
- **Widget:** with `home.widget.enabled`, `data/widget/snapshot.json` is rewritten (atomically, only when something a widget shows changed) every minute. The widget itself is a Swift/WidgetKit extension, which Electron cannot build; it waits for the user's decision (signing, an App Group).
- **Settings:** a `home` slice (weather, notifications, widget), normalised like the rest; a hand-edited file cannot switch weather on without coordinates. No Settings page for it yet (mockups only).
- **Driven in the built app** on a scratch library (production build, not dev mode): home summary with a created task, a feed (20 items, baseline), a page (17 links), Crossref (25 articles), a second check adding nothing, a `file:` address refused, the place search, weather for London (a test place) and its summary, the notifier writing its "sent" file after a digest, the widget file appearing after a minute. Mutation checks: the baseline rule and the URL scheme check each make a test fail when removed.
- **Not done / for the user:** every renderer page (Home, Watch, Settings tabs), the Swift widget, "in:watch" search, quiet hours, ticking the monthly reminder when a group is all seen (a proposal in the Watch mockup), and `npm run watch:from-tasks -- --apply`.

## Home page: one page for both workspaces, hours shared with Hours (15 Oct 2026)

`src/modules/home/renderer/`. A card page on Research's and Work's landing, **above** the module cards (they are the only way into the modules; Life has no Home). The user's feedback on the mockup, applied: Research and Work behave the same (one card called **Next meeting** in both), **Coming up is the next 7 days**, and **This week / This month does not show the running timer** (it is in the top bar). Weather and Watch cards are not drawn; the summary's fields for them are ignored.

- **Cards:** Today (overdue, then due today; each row opens the task), Coming up (tasks, meetings, trainings, days off in one dated list), This week (Research) or This month (Work, with hours per client), Next meeting (with Open TODOs). `home-model.ts` takes one workspace's share of the summary, which holds both; Watch items in `upcoming` are left out (their routes are web addresses).
- **Hours are not read from `summary.hours`.** That field is Research-only and leaves out meeting-derived hours, which are worked out in the renderer, so it would disagree with Hours. The card uses the Hours page's own code, `hours/shared/so-far.ts` (`weekFigures`, `thisWeek`, `thisPeriod`), which the Week card now calls too. Like the Hours page, it shows the invoice period when the plan has a whole-week aim (`plan.weekAim`), the week otherwise. A contract's weeks start on its own first day, not on a Monday, so the period is found from `defaultWeek`, not `weekStartOf`: that was a bug the first run showed (7:00 of 0:00 with no clients). Driven in the built app: Home and Hours agree in both workspaces (Research 8:11 of 37:30; Work 7:00 of 67:30, Luminos 5:00, Impact 2:00).
- **Gaps in the summary (a backend change, the user's call):** `meetings.next` is either workspace's and `openTodos` counts Research's only, so Work's next meeting is taken from `upcoming` (21 days) and Work shows no Open TODOs count; `upcoming` is capped at 12 before one workspace's 7 days are kept, and Watch items count towards it; Today's "N more" is unknown per workspace when the summary cut a list at 8 (the count is then left out and "See all" stays).
- **Driven** on a scratch library in the built app and in dev mode, light and dark, focus rings checked while tabbing (none clipped): tasks, a meeting, a training entry, a day off, a running timer, a Work contract with two clients. No shortcut was added.

## Timer picker: Suggested replaces Recent (15 Oct 2026)

The user's review of the picker before anything is typed: it should not list done tasks and should lead with what is due today, then the tasks in
progress that are worked on every day (Daily admin).

- **Done tasks** were already left out (`useOpenTasks` drops `done`); nothing changed.
- **`suggestedTasks`** (`src/modules/hours/shared/start-picker.ts`, replaces `recentTasks`, heading "Suggested", at most six, each once): open tasks due
  today first; then the tasks the timer was on in the last `RECENT_DAYS` (7) days, those with status "doing" before the rest, and within each the ones
  used on the most distinct days first (daily work rises), then the most recently used.
- **Overdue** tasks are not suggested, only those due today (the user said "today"); adding them after today's is a small change if wanted.
- **Not done:** the ROADMAP question on how far back it reaches is still open (a task not timed for a week and not due today is not suggested).
- Not driven in the app; unit tests only.

**Changed 18 Oct 2026 (the user, looking at the picker):** the tasks already worked on **today** come first (latest used first), then the other tasks due today, then the last week's as above. A task worked on today and due today is listed once, in the first group. Test: "puts tasks already worked on today before the others due today" in `start-picker.test.ts`. Not driven in the app.

## Group picker: one field to find or create (15 Oct 2026)

The user's review of the Group menu: a "New group" form under the list (name, "Inside", Add) beside the search field was convoluted when other places (the timer's task picker) use one field for both.

- **One field.** `GroupField` (`src/modules/notes/renderer/`) has the search input only. A name that is not there yet ends the list with **Create “name”** and an **Inside** menu (nothing, or an existing group) for a sub-group, as the task picker does with its list.
- **Enter** picks the only match, else creates the typed name; it never reaches a form around the field. The Create row is left out when the name already exists at that level or contains `/` or `›` (so the old inline error is gone). Where new top-level groups are not allowed (Work's lists), Inside starts at the current group and has no "nothing".
- Unit tests and lint pass; not driven in the app yet.

## Icon button tooltip: hover or keyboard focus, not any focus (15 Oct 2026)

The user saw the "Back (⌘[)" label appear without the pointer on it and stay for a long time.

- **Cause:** `IconButton`'s tooltip showed on `:focus-within`. Clicking the button leaves focus on it, and Back then disables itself at the first page and keeps focus, so the label stayed until the user clicked elsewhere.
- **Fix:** the tooltip shows on hover or `:has(:focus-visible)` (keyboard focus only). A mouse click no longer pins it; tabbing to the button still shows it. Applies to every icon button.
- Not driven in the app; unit tests and lint pass (no unit test covers the CSS).

## Top bar in full screen: content drops below the revealed system strip (15 Oct 2026)

The user saw the arrow and workspaces slide right at the top edge in full screen (room for the traffic lights), and then the system strip (menu bar and title bar) come down and hide them.

- **Cause:** the revealed strip is opaque and overlays the top of the window, covering the top of our 64px bar (and the Build button on the right). Only the dots were assumed to slide in over the content.
- **Fix:** while the pointer is on the top sentinel (`.topSentinel:hover`), `.lead` and `.actions` in `TopBar.module.css` also move down by `--fullscreen-strip-shift` (28px), with a 220ms transition, besides the existing left padding.
- **The 28px is a guess**: the strip's height could not be read from the user's screenshots and Playwright cannot capture the native strip. If the controls still touch the strip or sit too low, change that one value.
- Not driven in the app; typecheck, lint and Prettier pass.

## Wide tables scroll sideways (15 Oct 2026)

The user's screenshot: a four-column table in a narrow note broke words mid-word ("Memb ers"). Wanted: scroll horizontally, as Claude desktop does.

- Each drawn table row is its own grid line, so each line has `overflow-x: auto` (bar hidden) and `tableScroll` (`live-tables.ts`) copies a row's `scrollLeft` to the other rows of the same table (a scroll event does not bubble, so it listens while capturing).
- Column minimums (`columns`): the longest word in the column (at most 40 characters) or 16 characters of its longest cell, in `ch`; the `fr` share is as before. A table that fits looks as before; one that does not is wider than the page.
- `.cm-content { min-width: 0 }` is required: without it the whole editor grew to the table's width instead of the rows scrolling.
- Driven in the built app on a scratch library (seven columns: rows scroll together). Not checked in dev mode; no unit test covers the scrolling.

## A click in a table placed no cursor (15 Oct 2026)

The user: a table could not be edited by clicking in it; the cursor had to come in from above or below.

- **Cause:** `LiveEditor.tsx` has a document-level mousedown that blurs the editor when the click lands on blank page outside it (`wrapRef.current.contains(target)`). A click on a drawn cell moves the cursor into the table, the table turns into text and CodeMirror replaces the clicked cell before that handler runs; the detached cell is no longer "inside", so the editor was blurred, and a table is only text while the editor has focus. Found by logging `focusout` with a stack trace; not a CSS or `live-tables.ts` problem (reverting the sideways-scroll commit changed nothing).
- **Fix:** the handler checks `event.composedPath()` (taken when the event was dispatched) instead of `contains`.
- Any element the editor replaces on mousedown would have hit the same handler.
- Driven in the built app on a scratch library: click a cell, the table shows as text, typing lands in the cell. Not checked in dev mode; no unit test (it needs a real mousedown and layout).

## Spacing between blocks (15 Oct 2026)

The user: notes were crammed (no room between text and a table), and "no new line and 5 new lines should look the same". Audit of every block type in the built app, then `live-spacing.ts`.

- **The gap depends on the two blocks, not on blank lines.** A blank line is drawn with no height (`live-void`) except while the cursor is on it (otherwise the caret has nowhere to be; that line takes its full height, one line of movement below it) and inside fenced code. The first line after a block boundary carries the gap: `--block-gap` 16px between blocks and between paragraph lines (each line of text is its own paragraph, as the notes are written), `--item-gap` 4px between list items, none inside a quote, table or code block, none next to a heading (a heading pads itself).
- **Padding, not margin.** A vertical margin on `.cm-line` is invisible to CodeMirror's height map: with margins, a click below the first gap landed one to three lines too high. The gap is `padding-top`, clipped away with `clip-path` so a quote's rule and a code band start after it. Lines that set `padding` (table rows, code) now set `padding-inline`, or they would wipe it. A drawn rule line has its own `min-height` (it holds no text).
- Quote and code blocks get 6px inside at their first and last line (`live-pad-first`/`live-pad-last`).
- **Line length:** no cap. A 60ch cap (`--measure`) wrapped text well short of the card's right edge, which the user called wrong wrapping (16 Oct 2026); removed, lines use the whole width.
- Replaces the 0.9-line blank line and the table margin of earlier the same day. Checked in the built app on a scratch library (light mode, clicks and typing on each block type land on the right line); not checked in dev mode or dark mode (no colour changed).

## Delete and Backspace beside empty lines (15 Oct 2026)

The user: after deleting a paragraph, Delete on the empty line it left "does nothing", and a second press removes the line. Cause: a blank line is drawn with no height unless the cursor is on it (see "Spacing between blocks"), so the first press removed a line nobody could see. Fix: a key press beside empty lines always changes something visible. All in `live-lists.ts`, bound before the list keys in `live-keymap.ts`, tests in `live-lists.test.ts`.

- **Delete on an empty line followed by more empty lines** (`deleteBlankRun`): removes the whole run; the cursor lands at the start of the next text.
- **Backspace on an empty line below other empty lines** (`backspaceBlankRun`): removes the ones above, keeps one, the cursor lands on it.
- **Backspace at the start of text, Delete at the end of text, beside two or more empty lines** (`backspaceAboveBlankRun`, `deleteBelowBlankRun`): collapses the run to one empty line, the cursor stays. With a single empty line the ordinary key runs (it joins the paragraphs, which is visible).
- Not in code blocks, not with a selection or several cursors. Not yet driven in the app.

## Home shows every task's priority as P1/P2/P3 (15 Oct 2026)

The user: Home's Today card labelled a task "High", a word nowhere else in the app, and showed nothing for Normal and Low. Tasks calls them P1, P2 and P3 (`PRIORITY_MARKS`; the word is only the hover title). Fix: `TaskRow` in `HomePage.tsx` renders the Tasks module's `PriorityBadge` for every task, so the mark, colours and the show-all rule match the Tasks table. The old `.chip` is still used for "N days late". Not yet driven in the app.

## A loosely typed checkbox becomes a task (15 Oct 2026)

The user: a line starting `[ ] text` stayed plain text (a checkbox needs `- [ ] ` in Markdown), and typing the dash first drew a bullet before the brackets were written, so it was unclear what would work. They asked for `[]` at the start of a line to become a checkbox, and for the exact form to be fixed up once written.

- **Trigger:** typing a space right after `[]`, `[ ]` or `[x]` at the start of a line (after any quote and indent). `looseTask` in `live-lists.ts`, an `EditorView.inputHandler` added in `live-state.ts`. Only the space triggers it, so nothing changes while the brackets are being typed.
- **Result:** `- [ ] ` or `- [x] `. A bullet or number already typed is kept (`- []` becomes `- [ ]`, `1. []` becomes `1. [ ]`), so the order of dash and brackets does not matter. If the cursor sat inside `[ ]` on a line that goes on, the space after it is reused, not doubled.
- **Left alone:** `[]` after other text, and in code (fenced, indented or inline).
- **Undo:** its own step (`input.task`, listed in `live-history.ts`); undoing gives back what was typed.
- Tests in `live-lists.test.ts`. Driven in the built app with real keystrokes on a scratch library; not checked in dev mode.

## Home's task rows work like Tasks' rows; the date sits beside the workspace name (15 Oct 2026)

The user, on the Research Home: the date should be next to the workspace name; "due today" is redundant in a card called Today; the circle should be the task's real status and change it, as elsewhere; Coming up's tasks should follow the same layout.

- **Date:** `HomeDate` (`HomePage.tsx`) renders in `WorkspaceLanding`'s heading line, baseline-aligned beside the `h1`. It reads the system clock, not the summary, so a window left open past midnight keeps the old day until the page re-renders.
- **Today card:** the circle is `StatusButton` (`HomeParts.tsx`): `StatusIcon` with the same click rules as the Tasks table (click moves on, Shift-click goes to done, via `setTaskStatus`, which now takes just `{ uid, recurrence? }`). The note line is the list only. Priority is on the far right, with "N days late" before it. A done task leaves the list when the summary reloads. The red circle for late tasks is gone: the chip says it.
- **Coming up:** a task event carries `task: { uid, status, priority }` (`HomeEvent`, `buildHomeSummary`), so it gets the same circle and a priority badge on the right, and its due date moves into the note line ("Writing · due tomorrow"). Meetings, trainings, time off and Watch items keep their icon and the right-hand "Tomorrow" label.
- Typecheck, lint and tests pass. Not yet driven in the app.

## Selecting down to a heading (15 Oct 2026)

The user: selecting from one block down to the next heading and pressing Delete also took the heading's `## `; and the highlight was "ragged and unequal in height".

- **Cause (delete):** a drag that ends at a heading's left edge lands after the hidden `## ` (the replaced range has the same x before and after). `live-selection.ts` (`snapSelectionToLineStart`, a transaction filter) ends such a selection at the line's start, only when it starts on an earlier line and ends exactly after the `#`s; a selection starting inside the heading is left alone.
- **Cause (highlight):** CodeMirror's `drawSelection` runs a selection that ends at a line's start down through that line's top padding (a heading's gap), and takes the bands' left edge from the first line's padding. The same file draws the selection layer instead (`RectangleMarker.forRange`): a selection ending at a line's start stops at the end of the line before, bands start at the content's edge, each piece runs a pixel into the next (no hairline). The default selection layer is hidden in `LiveEditor.module.css`; `drawSelection` stays for the cursor.
- Reproduced and checked in the built app on a scratch library, dark mode. Unit tests in `live-selection.test.ts` (mutation-checked). The left-edge shift in the user's screenshot was not reproduced (the scratch note's first line has no padding); fixed by construction only. Not checked in dev mode.

## Enter at the start of a paragraph (15 Oct 2026)

The user: "I kept pressing enter but nothing was happening" with the cursor at the start of a paragraph under a heading.

- **Cause:** Enter put the new line above and the cursor went down with the text; a blank line is drawn with no height unless the cursor is on it ("Spacing between blocks"), so nothing showed.
- **Fix** (`enterAt`, `live-lists.ts`): at the very start of a plain, non-empty paragraph line the empty line goes above and the cursor stays on it, so the text moves down by the cursor line. Headings, items, quotes and code keep their rules.
- Still true by the earlier decision: a second, third… blank line is not drawn, so repeated Enter on empty lines shows only the one with the cursor.

## Library gate and empty table cells (15 Oct 2026)

`live-library` "draws every list marker…" failed on `POST Placement Interview Application.md`, also on the commit before the day's editor changes. Cause: the check counted every widget as a list marker, and a table row ending in `||` has the table's zero-width empty-cell widget (`EmptyCell`, `live-tables.ts`). The check now skips widgets over no text. Not an editor bug; the whole gate passes on a copy of the real library.

## Hours, Tasks and Training in Life (15 Oct 2026)

Life had only Notes (7 and 9 Oct). It now has the other three, from the same module code as Research and Work (`createHoursModule('life')`, `createTasksModule('life')`, `createTrainingModule('life')`), so the "Life has no meetings, tasks, hours or training" line of the 7 Oct entry is out of date for all but meetings and time off. Done unasked-questions-free, following the pattern of the other workspaces.

- **Tasks**: `'life'` in `TASK_WORKSPACES`; its own list of tasks and lists, no client lists (those are Work's). The `tasks.workspace` CHECK could not be widened in place, so migration `tasks/0002_life` makes the table again (tags set aside while it is swapped; the new table points at itself by its own name, which the rename changes: dropping a parent that rows still point at leaves a deferred foreign-key violation that making a new one does not clear, found by the test). Dry-run on a copy of the real database: 1,254 tasks and 221 tags before and after, `foreign_key_check` and `integrity_check` clean. `migrations.test.ts` checks rows, subtasks, tags, indexes and that the constraints still hold.
- **Hours**: `'life'` in `HOURS_WORKSPACES`; year files in `time/life/`, the shared 52-week year, no contracts, no time off. The first year's plan is `LIFE_PLAN`: no fixed hours (a week aim of 0, the same "no aim" a Work contract can have), any day, so there is no balance or "to go", only what was tracked. No Invoice card (only contracts are invoiced; Life shares `weekAim` but not the card), no meetings or lectures derived into it. Hours' settings gets a Life block like the others. The Start button, the palette's Start timer and the timer chip now start in the workspace being looked at, Life included (they sent Life to Research before).
- **Training**: entries in `notes/training/life/`, same file format and index (`workspace` was already a column). Life's is a plain log: date, times, duration, series, format, institution, leads, linked folder and notes, with the year's hours. What is Inkpath's stays Research's: the 200-hour aim, hours of meetings, per-skill hours, type and skills (fields, columns, filters), the PDF export, the training plan, the lecture task (so Life entries make no subtask, and `New training entry` omits `task: auto`) and the Training settings tab. "New training entry" in the palette and Dock starts in Life when looking at Life, else in Research. Search heads Life's entries "Life training" and Life's tasks "Life tasks".
- **People**: renaming or merging a person rewrites Life's training entries (backup folder `training-life`) and, a gap since 7 Oct, mentions in Life's notes; counts include Life's entries. Backlinks cover Life's training folder.
- **Driven in the app** (production build, scratch library): Life's landing shows Notes, Hours, Tasks and Training; each page opens; a new training entry opens with the Life fields only and appears in the list without Inkpath columns. Not driven: starting a timer on a Life task and the people rewrite (unit-tested).

## A lone `-` under a line is not a heading (16 Oct 2026)

Found by using the app: typing a paragraph, Enter, then `-` to start a list turned the paragraph into a heading. In Markdown a text line directly above a line of only `-` is a setext level-2 heading, and `- ` (with the trailing space the list key adds) still counts as an underline until something follows it. `live-decorations.ts` now skips the heading class and the hidden-underline treatment when the setext underline is exactly one `-`, so the text stays a paragraph and the dash shows as plain text; once the item has text the parser reads a list. Longer underlines (`---`) and `=` underlines still make headings (existing test). The spacing and HTML copy code still read the tree as a heading for that one moment; not changed. Unit-tested; not driven in the app.

## Files panel: no folder name at the top level (16 Oct 2026)

The Training Files panel opened with a crumb repeating the linked folder's name above its contents. The panel's header already has an open-folder button, so at the top level the crumb is gone. Inside a subfolder the path still shows, with the linked folder's name as its first link, because that is the way back up. Not driven in the app.

## Extra blank lines are drawn (17 Oct 2026)

Plan: `docs/EXTRA_BLANK_LINES_PLAN.md`. The user could not add empty lines: since "Spacing between blocks" every blank line drew no height, so Enter on an empty line changed nothing anyone could see. They want 0 and 1 blank line to look the same (some Markdown uses one for a new paragraph, some does not) and each blank line after the first to be visible.

- **The rule** (`live-spacing.ts`): the first blank line of a run keeps no height, as before; each one after it has a normal line's height, so a run of n adds n - 1 lines to the block gap. Nothing edits the text. Blank lines in code are code. A note's empty last line (the final line break) is never part of a run, so a note ending "text, blank, line break" is still one blank line.
- **Backspace and Delete beside empty lines are the ordinary keys again.** `deleteBlankRun`, `backspaceBlankRun`, `backspaceAboveBlankRun` and `deleteBelowBlankRun` (15 Oct, "Delete on an empty line …") took a whole run because the lines were invisible; with the extra lines drawn, one press removing one line is the visible, expected thing. Removed with their bindings.
- **Existing notes** were brought to "no run longer than one" first: `npm run tidy:blank-runs`, applied 17 Oct 2026 (8 of 261 notes, 58 blank lines, backup `backups/tidy-blank-runs-2026-10-17T09-19-14-649Z/`; two of them had the run between the front matter and the first heading, which the script handles too). Commit `3f6a98a`.
- **Checks**: `live-spacing.test.ts` (runs of 1 to 5, cursor on a line of a run, start of a note, after a heading, the last line, code); mutation checks on the first-line, start-of-note, end-of-file and previous-line-blank clauses, all caught (a fourth clause could not be reached and was removed); the built app driven with real Enter presses on a scratch library: heights 0/29 for the first blank line and 29 for every one after it.

## Settings: one tab and one picker for dates (17 Oct 2026)

The user found the date settings confusing: the shared year was in General and the contract dates in Hours, and the editable ones were native `dd/mm/yyyy` boxes while the read-only ones read "Sep 21, 2026".

- **One place:** the shared year (`YearFields`) moved from Settings → General to Settings → Hours, a "Year" block above the Life, Research and Work blocks. The Work contract dates stay in Work's block (a contract belongs to Work). General has no date settings left.
- **One control:** "Next year starts", "Contract ends" and a new contract's "First day" and "Last day" use `DatePicker` instead of `<input type="date">`, so every date reads "Sep 20, 2027". `DatePicker` gained `full` (always the whole date, never "Today") and `isDisabled` (days that cannot be chosen are dimmed and do nothing).
- **Nothing is refused after the fact:** a year start offers only the Mondays `withNextStart` accepts; a contract's last day only days that make whole weeks (`contractWeeks`). The draft/red-border state is gone. Changing a new contract's first day drops a last day that no longer fits.
- **Not changed:** the native date inputs in Meetings and Training (Date), Time off (add and edit) and the task "Day" are still `dd/mm/yyyy`; converting them is the user's call.
- **Checks:** `hours-contract-form.test.ts` picks dates through the calendar (`pickDate` in `hours-ui-test-utils.ts`), including a dimmed last day; driven in the built app on a scratch library (calendar offers only Mondays; Hours tab shows the Year block).

## Selection: no drawing without focus, and hidden span markers at a line's start (17 Oct 2026)

The user sent three screenshots of selections in the editor: one with an odd tail below a list, one still drawn after the window lost focus, one where deleting also took the `**` of the next line.

- **Unfocused editor draws no selection.** The custom selection layer (`live-selection.ts`) painted `--selected-bg` whether or not the editor had focus, so a selection stayed after the window lost it, though the text could not be edited. The rule in `LiveEditor.module.css` now makes `.cm-selectionBackground` transparent unless `.cm-focused`, in line with markers, which already show nothing without focus. A dimmer unfocused colour instead is a one-line change if the user prefers it.
- **A selection ending at a line's start stops before its hidden markers.** `snapSelectionToLineStart` only knew a heading's `## `. A drag or Shift-arrow that ends at the first visible character of the next line sits after that line's hidden `**`, `*`, `~~` or `` ` ``, so deleting took them and left the note with a broken span. It now snaps to the line's start when the selection starts on an earlier line and ends inside the leading markers (after an optional quote or list prefix, which is never snapped to). A selection that starts inside the line, or ends past its markers, is left alone. `live-selection.test.ts`, four new cases.
- **Selections ending on blank lines** no longer draw a stub on each blank line: the drawn end moves back to the last line with text. The odd tail in the first screenshot looked like this, but it could not be reproduced afterwards (mouse drags, Shift-Down, Shift-Up on the user's note in a scratch library, built app), so it is "probably fixed", not confirmed. The user also could not reproduce it after the change.
- **Checks:** typecheck, lint and tests pass; the unfocused case driven in the built app (blurred editor: every selection rectangle transparent).

- **Shift-Enter's backslash is hidden away from the cursor** (17 Oct 2026, the user's choice over writing a plain new line, which other viewers would join). `live-decorations.ts` hides the `\` of a `HardBreak` like an escape's and shows it while the cursor touches it; the file still holds the backslash. A two-space break has nothing to hide. Real-library gate passes; not driven in the app.
- **The backslash right after Shift-Enter is hidden too (17 Oct 2026, the user's report: a `\` showed on the line above the new, still blank line).** The parse reads a backslash before a blank line as plain text, so there is no `HardBreak` to hide until something is typed. `buildDecorations` also hides a line-ending `\` (odd run, not in code) while the cursor sits on the blank line below it; once the cursor leaves, it shows as the text it is. Unit-tested. The real-library gate had two stale expectations, fixed the same day (all 10 pass): the `@` test now expects the suggestion to cover the whole word the cursor is in (`@kavarious`, not `@ka`), and the tables test takes GFM's rule for where a table ends (a plain line right under it is a one-cell row, as in `POST Placement Interview Briefing.md`) and expects a new row to take the shape of the row above it (indent, edge pipes) rather than a fixed `|  |  |`. The editor was right in both.

## Tasks: right-click offers the part you clicked, Shift goes backwards (17 Oct 2026)

- **Right-click on a task row** opens only the menu for the cell under the pointer: the status cell gives Status, the priority cell gives Priority (a subtask has no priority of its own, so it gets the full menu). Anywhere else on the row, and the menu key or Shift-F10, still give the whole menu (status, priority, Add subtask). `TasksTable.tsx`: cells carry `data-cell`, `MenuState.kind` is `status | priority | row`.
- **Shift-click on a status icon, and Shift-Space on a focused row, go round the circle backwards** (done, in progress, to do, done). Before, Shift-click jumped straight to done (or back to to do); the user chose backwards instead ("ideally one would cycle backwards"). `nextStatus` and `PREVIOUS_STATUS` in `task-actions.ts`; the Today card's circle on Home shares them. The icon's tooltip names both directions, and Settings lists Shift-Space.
- **Not changed:** the menu has no modifier-click; it opens only from a right-click or the menu key.
- **Checks:** typecheck, lint and tests pass; not driven in the app.

## The cursor no longer changes the space between paragraphs (17 Oct 2026)

The user found it jarring: Enter makes a blank line with space, moving the cursor away makes the space vanish, so they pressed Enter again and got two blank lines. The rule stays (none or one blank line between paragraphs look the same, because some Markdown writes none and some one); only the cursor stops changing the layout.

- **Cause:** the first blank line of a run is drawn with no height (`live-void`) and the line after it carries the gap; the line the cursor was on took a full line's height back so the caret had somewhere to be. One blank line therefore looked like a big gap with the cursor on it and like none with it away.
- **Fix** (`live-spacing.ts`, `LiveEditor.module.css`): a first blank line with the cursor on it gets `live-gap-cursor`, the height of the block gap, and the text line after the run gives its gap up, so the total is the same with the cursor there or away. A second blank line keeps a full line's height as before.
- **Not changed:** where the gap is not the block gap (next to a heading, which pads itself; between list items, which have a small gap) the cursor's blank line still takes a full line's height, so the page can still move there.
- **Checks:** typecheck, lint and tests pass (`live-spacing.test.ts`); not driven in the app.

## The cursor's blank line is drawn as the paragraph typed there (17 Oct 2026)

The user's screenshots: Enter at the end of a paragraph put the cursor on a very short line, with another blank line under it; typing the first letter made the line suddenly full height. The change before this one (the 16px `live-gap-cursor` line) had "not been driven in the app"; driving it showed the cause.

- **Cause:** with one blank line already after the paragraph, Enter makes a run of two. The cursor's line was only the 16px gap (the caret sat against the text above) and the second blank line kept a full line, so the page showed a cramped cursor over a spare line. The first letter then made a real paragraph (gap plus line), so the line grew and everything under it moved.
- **Fix** (`live-spacing.ts`): a blank line with the cursor on it, with text above it, carries the gap the typed paragraph would carry (`live-gap`), so the caret does not move when the first letter is typed. In a run of two or more, the cursor on the first blank line makes the _second_ the free (zero-height) one, and the text after the run gives its gap up, so the run is as tall as with the cursor away (unit-tested as a height model, for each blank line of several runs). Not under a heading (it pads itself) or directly under a list item or quote line (typed text would continue it).
- **Kept:** a single blank line between paragraphs is still the 16px gap itself (the user's rule: none or one look the same, and the cursor does not change the space). The caret is lifted 3px to sit in the middle of it. Typing there still opens a paragraph under the caret, which moves the caret about 19px: the price of that rule.
- **Caret on an empty bullet, number, checkbox or quote line** (`live-caret.ts`): CodeMirror sized it from the whole line (29px on a bullet against 21px for text, off-centre on checkboxes and quotes), so it changed at the first letter. A zero-width space widget at the caret, in the line's own font, gives it the text's box; it is not in the document and not an atomic range. Driven: the caret's top, height and centre are identical empty and typed in each context.
- **Not changed, by the user's rule:** the caret on a single blank line between paragraphs still moves about 19px at the first letter, the paragraph below a longer run still moves 16px (a blank line becomes a paragraph), and ArrowDown skips a lone blank line (it has no height, so `a\n\nb` navigates like `a\nb`). Each follows from "none or one blank line look the same, and the cursor does not change the space".
- **Checks:** driven in the production build on a scratch library: Enter then a letter at the end of a heading, paragraph, bullet, checkbox, quote, code line and last paragraph, and in the user's case (no caret movement). Not driven in dev mode.

## Research: how other editors treat blank lines (17 Oct 2026)

The user asked whether this was already solved elsewhere. Obsidian (a blank line is a real, full-height line), Typora (one Return is a new paragraph), Bear (Return twice, plus a spacing setting) and Notion/Logseq/Roam (Enter makes a block) all draw the line you type on as it is and never change the layout with the cursor. None hides the first blank line. Sources are in the mockup session; the hidden-first-blank-line rule ("none or one blank line look the same") was the cause of every cursor and new-line problem of that day.

## Every line takes the same space (17 Oct 2026, stage 1 of `docs/UNIFORM_LINES_PLAN.md`)

The user compared three options in `docs/design/editor-blank-lines-mockup.html` and chose C ("I think I want C?"; earlier "Fix old notes for C"): every line, a blank line included, is one unit, and one Enter already looks like a new paragraph.

- **The rule** (`live-spacing.ts`): a line of text carries the block gap above it, so a unit is 45px (16px gap plus the 29px line); a blank line carries the gap a typed paragraph there would (none under a heading, the list's small gap under a list item, a quote's under a quote, none inside code or on the note's first line), so typing moves nothing and the cursor never changes the layout. n blank lines are n units. The note's empty last line stays hidden until the cursor is on it.
- **Removed:** the hidden first blank line (`live-void`), the stand-in `live-gap-cursor`, the swapped blank line, and the 3px caret lift. `live-caret.ts` stays (the caret on empty list and quote lines).
- **Enter at the start of a paragraph** pushes the text down and the cursor goes with it (the 15 Oct rule that kept the cursor on the new empty line existed only because that line was invisible). Backspace and Delete already took one blank line per press.
- **Selections** end on blank lines like on any line (`live-selection.ts` no longer steps back over them).
- **Checks:** typecheck, lint and tests pass, and the real-library gate; driven in the built app on a scratch library (heights 29 / 45 per line; Enter, a letter, a second Enter, Up and Down onto blank lines, Backspace twice, Enter at a paragraph's start; a selection over blank lines). Not driven in dev mode or dark mode (no colour changed).
- **Until stage 2** notes with one blank line between paragraphs look loose (90px between the text). Stage 2, the old notes, waits for the user (`docs/UNIFORM_LINES_PLAN.md`).

## `npm run tidy:paragraph-blanks` (17 Oct 2026, stage 2 of `docs/UNIFORM_LINES_PLAN.md`; written, dry run only, not applied)

- **Scope (the user's):** remove a single blank line only between two paragraph lines. Blank lines next to lists, headings, tables, quotes, rules or code are not touched; the dry run lists each by kind (`above + below`, with note, line number and both lines) for the user to decide.
- **Reads the same, checked with the editor's parse** (`paragraph-blanks.ts`): outside this app two paragraph lines with no blank between are one paragraph. A removal is kept only if every non-blank line has the same Lezer nodes (Paragraph and Document aside; nodes crossing the line carry `<` / `>`) and the same decorations (spacing classes aside) before and after. Each candidate is tried alone, then the surviving set together; if the set differs (`*a` / `b` / `c*` each pass alone, together they make emphasis) nothing is removed from that note. The checks catch hard breaks, setext underlines, HTML blocks and emphasis across lines (tests). The decoration half has no test that fails without it (no case found where the tree is equal but decorations differ); it stays as a second net.
- **Same safety as `tidy:blank-runs`:** dry run by default, back each note up to `backups/tidy-paragraph-blanks-<time>/`, guarded write, refuses a note where any non-blank line would change, runs of two or more blank lines and blank lines in fences or the front matter untouched, CRLF kept, apply with the app closed. A second run finds nothing to remove.
- **Recount on a copy of the library (17 Oct):** 371 single blank lines in 51 of 263 notes, not the 287 / 50 of the first count. Paragraph + paragraph 133 (18 notes, none refused by the parse check), list + paragraph 91, heading + paragraph 32, heading + list 28, paragraph + table 25, list + table 15, list + list 14, heading + table 13, rule + table 5, heading + rule 5, quote pairs 8, list + rule 2.
- **The heading count (82, not 41) is real, and is not a hole in `tidy:blank-lines`:** all of it is in four notes written after the 11 Oct run (`POST Placement Interview` Writing a Briefing 31, 5 STAR Competencies 31, Application 13, Host Preferences 7; modified 15 to 17 Oct). No older note has one. The earlier count of 41 was probably taken while those were still being written.
- **Checks:** mutation checks (checker always equal; combined check off; wrong line dropped; pair filter widened; single-blank guard removed; tree nodes ignored) each fail a test. The in-fence guard in `singleBlanks` is redundant with the neighbour test (equivalent mutant). Real-library gate passes. Applied to a copy of the library and to a CRLF note: 19 notes changed, a second dry run found nothing, bytes of line breaks kept. Driven in the built app on a scratch library (one note before, one after): paragraph lines 45px apart after, list blank lines unchanged.

**Widened and applied (17 Oct 2026).** The user, shown the other pairs: "Remove all, of course, so it is all consistent. Ensure when implementing after this cleanup that spacing is consistent regardless of type. Apply." So the script now removes every single blank line between two lines of text, not only paragraph + paragraph, with the same reading check (the script keeps its name). Candidates are tried alone, then added one at a time and kept only while the whole set still reads the same. Blank lines next to a code fence are never candidates.

- **Result on the real library (app closed):** 294 removed in 40 of 263 notes (paragraph + paragraph 133, heading + paragraph 32, heading + list 28, list + paragraph 25 (paragraph above the list), paragraph + table 20, list + table 15, list + list 14, heading + table 13, heading + rule 5, heading + quote 4, paragraph + quote 3, list + rule 2). No note left alone. Backup `backups/tidy-paragraph-blanks-2026-10-17T13-50-51-402Z/`; all 40 notes checked against it: only blank lines differ. A second dry run removes nothing.
- **77 blank lines kept** because removing them changes how the editor reads the note: 66 a list item above a paragraph (the paragraph would join the item), 5 a table row above a paragraph, 5 a table row above `---`, 1 a quote above a paragraph. Such a blank line is what ends the block, so it cannot go.
- **Superseded the same day (see "A blank line Markdown needs is drawn as the gap" below):** those 77 are a whole 45px line, against 16px between blocks elsewhere. Making them look the same needs an editor rule (a blank line that ends a block drawn as the usual gap), which brings back a blank line that is not a unit; not built, because it is the opposite of option C.

## A blank line Markdown needs is drawn as the gap (17 Oct 2026, after stage 2 of `docs/UNIFORM_LINES_PLAN.md`)

The user, on the 77 blank lines `tidy:paragraph-blanks` had to keep: "Of course you need first and foremost respect markdown. but the gap should still look consistent"; then, unsure: "maybe finish up and I will tell you if it doesn't work once I start using it". **Provisional: the user has not used it yet.**

- **Rule** (`live-spacing.ts`, `separator`): a lone blank line (text on both sides) between a list, quote or table row above and a paragraph below, or a table row or paragraph above and `---` below, is the separator Markdown needs (without it the line below joins the block above). It is drawn as the gap itself, class `live-sep`, 16px, and the line below carries no gap, so those blocks are 45px apart like two paragraphs. Two or more blank lines, and every other blank line, stay whole units (option C).
- **No cursor-dependent layout:** the line is 16px whether the cursor is on it or not. The caret there is short.
- **Matches the cleanup exactly:** on a copy of the library from before the cleanup and on the real one, the lines drawn as `live-sep` are the ones `tidy:paragraph-blanks` keeps, no more and no fewer. The rule is by block kind, so a pair the parse check keeps for another reason (a hard break, a setext underline) is still a whole unit.
- **Typing:** typing on such a line turns it into text and the layout moves, as for any blank line.
- **Checks:** tests in `live-spacing.test.ts` (distance equals two paragraphs, no change with the cursor, only the listed pairs) with mutation checks; driven in the built app on a scratch note (list, quote and table, each followed by a paragraph: 16px separator, 29px line). Not driven in dev mode or dark mode (no colour changed).
- **To undo:** delete `separator` and its two uses in `drawSpacing` and the `.live-sep` rule.

## Training entries: one time line, overlaps without a task (17 Oct 2026, `docs/TRAINING_ENTRIES_PLAN.md`)

Built in one go while the user was away (their explicit exception to "stop at every stage"); the plan's defaults were used and nothing was pushed.

**Stage 1: one row format.** `rowTimeLine` / `rowTimeParts` (`training/shared/row-time.ts`) give `09:30–15:00 · 5 h 30 min · In person`, upcoming or past. No times (or an end with no start) is "No time yet"; a start with no end shows the start (the table already did, and an upcoming entry often has only that); no mode leaves the part out; a duration appears whenever there is one (a lecture's self-study counts, so "No time yet · 45 min · Self-paced" is possible). Used by the Training landing, the Meetings landing (its "N topics ready" stays after it on an upcoming row) and a person page's training rows. The Training table keeps Time and Duration and gets a **Format** column (not "Mode": that is the entry page's label, and "Type" is taken by the activity type), after Duration and before Type, so "Type before Series" holds. `TrainingCard`'s "Latest:" line is unchanged.

**Stage 2: overlaps need only a date and both times.** `noteSpans` / `notesOverlapping` (`training/shared/note-clashes.ts`) take every meeting and training note of a workspace and answer, for one note, the others of the same date whose `[start, end)` overlaps (touching is fine; `overlapping` and `noteKey` reused, so a meeting and a lecture of one name are two things). `useMeetingClashes` keeps the timer and typed-block sources and uses `useNoteSpans` (meetings and training lists, any date, no task) instead of the task-only hours entries. **Behaviour change for Meetings:** a meeting with no task, or on a future date, now warns too, and its label is the series (a task's title before). The warning on a training page is drawn under the details for Research and Life alike, apart from the Task card (`MeetingHoursNote show="clashes"`); "No hours until it has a start and end" stays in the card (`HoursLine`). Wording unchanged. Entry page only: no marker on the table, landing or card.

- **Found by driving the app:** the page stays mounted under the id it opened with, but changing the title renames the file, so the first version never excluded the entry itself ("Overlaps Stats workshop …" on Stats workshop). The check now takes the id in the address (`currentId`). The meetings page already did.
- **Mutation checks** (each fails a test): `<` to `<=` in `overlapping` (5 fail), self exclusion dropped (3), date filter dropped (1), workspace filter dropped (1).
- **Driven** on a scratch library (built app light and dark, dev mode): two overlapping trainings with no series, upcoming ones on 30 Oct (clash warns, touching 15:00 next to 14:00–15:00 does not), the landing rows, the table and the entry page, screenshots read. Not driven: a meeting against a training in the app (unit tests only), the Life workspace, the Meetings landing.

**Stage 3: audit** (landing, table, series page, entry page and fields, Task card, plan page, `TrainingCard`, search, person page, PDF, Life).

- **Fixed:** a person page's training row had the bare title and only the series as its note (the bug the landing had before 9 Oct); it now reads like the landing. The "start without end" rule above came from comparing the landing with the table.
- **Checked, consistent:** search hits and the series page (it is the table); sort order everywhere is `compareNewestFirst`; Life's table and landing use the same helper and column; the plan page has no entries.
- **Left for the user** (`docs/ROADMAP.md`): Meetings' "Type" against Training's "Format"; the PDF (no Format, blank instead of "No time yet", hours as `1:30`, series after the title); hours of a note with no task are in the Training counters but not in Hours; whether an overlap may be marked outside the entry page; the landing row's time line is not in a column.

**Answers from the user (17 Oct 2026).** Attendance is **Format** in Meetings too (the table column and the meeting page's field; the Meetings PDF still says Type until the PDF is reviewed). The PDF differences wait for the user's review. Hours of a note with no task stay as they are: they are counted correctly, just not linked to tasks, which are not linked to trainings (the migration question).

## Editor: a table under a list item is a grid, a lazy line under an item is a paragraph (17 Oct 2026)

Two things the user saw in a real note (`POST Placement Interview Briefing`).

- **Tables in list items** (`live-tables.ts`, `renderable`): a table inside a list item used to keep its text because its lines start with something that is not the table's. Indented under a bullet it is standard Markdown, so it is now drawn as a grid, padded by 1.6em per list item it sits in (`listDepthOf`) so it lines up with the item's text. Still text: a table in a quote, a table that starts on the marker line (`- | a | b |`), and any row with something other than white space in front.
- **A line under a list item that is not indented with it** (`live-spacing.ts`, `lazy`): with no blank line above it, Markdown reads it as the item's paragraph, but it is drawn at the page's margin, so it now takes the paragraph gap (16px), not the list's 4px. A blank line directly after a list item takes the same gap, because text typed on it would be such a line (the no-layout-change-on-typing rule). An indented continuation line keeps the small gap.
- **Checks:** tests in `live-tables.test.ts` and `live-spacing.test.ts`; full suite, lint and typecheck pass. **Real-library gate:** 9 of 10 pass; the table test fails on that same note with and without this change (its table's last row, `  Australia is the fastest.`, has no pipe, which the gate's own table finder does not expect), so the gate's table finder needs to learn that shape. **Not driven in the app** (unit tests and the gate only).
- **To undo:** restore the `ListItem` return in `renderable` and delete `lazy` and its use in `gapOf`.

## Editor: the `@` picker, three fixes (17 Oct 2026)

The user's report: the picker only read the text before the caret, Add sometimes created nothing, and a just-added chip was sometimes dark instead of blue.

- **Caret inside a word** (`findSuggestion`, `live-entities.ts`): when the caret is in the middle of a word, the rest of that word (letters, digits, `'`, `’`, `-`) belongs to the query and to the range the chosen mention replaces, so `@Laura Web|b (POST)` searches "Laura Webb" and replaces `@Laura Webb`. A caret after a space does not extend. Only the rest of the word: where a name ends cannot be known, so it never reaches into the next word. Tests in `live-entities.test.ts`.
- **Add did nothing** (`LiveEditor.tsx`): found by driving the built app. The page-level mousedown handler that blurs the editor on a press outside it (so blank space beside the editor does not put the cursor in the text) also caught the picker, which is drawn in a portal outside the editor. A press on a row's padding or icon (an element with no text of its own) blurred the editor, `onBlur` closed the picker, and the click never reached the row; a press on the name's own text slipped through, hence "sometimes". The handler now leaves `[role="listbox"]` alone.
- **Dark chip** (`LiveEditor.module.css`, `LiveEditor.tsx`): not reproduced. The user saw it turn blue after hovering and moving away, which is the hover shade (`--panel`, dark in dark mode) left on by a stale `:hover`. The shade now follows `data-hover`, set and cleared by the mouseover and mouseout the editor already listens to (`chipUnder`), so a chip drawn fresh never starts shaded. Driven in the built app: blue, shaded under the pointer, blue again after it leaves. A guess at the cause; if a dark chip shows up again, say whether moving over it and off still fixes it.
- **Checks:** full suite, lint and typecheck pass. Driven in the built app on a scratch library, light and dark: mid-word query, Add with a new name (person added, chip drawn), the click on a row's padding.

## Editor: ending a numbered item renumbers the items below (17 Oct 2026)

The user's report (`POST Placement Interview Briefing`): a list of 1, 2, 3; Enter after the first made a new 2 (the 3 became 4, correctly); Enter again on the empty 2 removed it, but the 3 stayed 3.

- **Cause** (`live-lists.ts`, `enterAt`): Enter on an empty item deleted its marker and nothing else. Enter after an item already renumbered the items below (`renumberAfter`), so only the way out was missing.
- **Fix:** `renumberAfter` takes a shift (+1 for a new item, -1 for an emptied one) and the "item ends" branch uses -1. The same rule as before: only when the items below were counting up in order from this one; any other numbering is left alone. One undo step, as the Enter was.
- **Checks:** test in `live-lists.test.ts` (`1. a`, empty `2.`, `3. b`, `4. c` gives `1. a`, blank, `2. b`, `3. c`); full suite, lint and typecheck pass. **Not driven in the app** (unit tests only).
- **To undo:** drop the `renumberAfter(state, item, -1)` entry from the "item ends" changes.

## Self-study tasks for trainings (17 Oct 2026, `docs/SELF_STUDY_PLAN.md`)

- **Why (the user):** a lecture's session and the work done for it afterwards are different things. The lecture's own task is the session (derived from the note's start and end, due on the note's date, marked done by the sweep) and has no Start; time put on a lecture goes to a self-study task.
- **Shape:** one top-level task per series, `<series> · self-study` (in Training, found by title first, else made), and under it one subtask per lecture, `<note title> · self-study`, made when Start or Add time is first pressed on that lecture's note. A lecture with no series gets a top-level task of its own, which moves under the series' task once a series is typed and back out when it is cleared. Nothing is made in advance. The subtask has no due date and status `doing`; the sweep never touches it.
- **Data:** `selfstudy: <task uid>` in the note's front matter (after `task`; an empty value removes the key), `TrainingMeta.selfStudy`, index column `self_study_task` (`training/0006_self_study_task`, filled when the index is rebuilt from the files). `entryMinutes` is now the note's session + time tracked on its lecture task (older notes keep theirs) + time tracked on its self-study task, a task counted once. Every caller already passed the row, so the landing, table, series cards, per-skill totals and the PDF follow; tests assert one number for the entry, the year, the skill, the series and the PDF, and the PDF of a library with no `selfstudy:` is byte for byte unchanged.
- **Rules** (`planSelfStudyTask`, `selfStudyParentFor`, `shared/self-study-task.ts`): in the style of `planLectureTask`, with `asked` as the one new input (`none` while the note has no self-study task unless Start/Add time asked). A task that is not the note's is never renamed or moved: a subtask only under a `· self-study` series task, a top-level task only in Training with nothing under it. The page does what the plan says (`self-study-sync.ts`, `useSelfStudyTask`, 0.8 s settling like the lecture task); a series self-study task the page made that a lecture has left, with nothing else in it, goes to the trash.
- **Start and Add time** on a note go to the self-study task, before and after the session is over. `TaskTimeActions` gained an optional `ensure` (a task with `uid: ''` is made the moment a button is pressed, and the time goes to the task that comes back), so the logic is not copied. The Task panel shows a short "Self-study" link beside the lecture's own link once the task exists; no new sentence.
- **Decisions taken for the user (each easy to change):** time already tracked on lecture subtasks stays there and is still counted (nothing moved, no script); a deleted self-study task is made again silently by the next Start or Add time; deleting a lecture trashes its self-study subtask (restorable), never the series task; the delete dialog's "that time stays in Hours" now counts both tasks. **Superseded 20 Oct 2026:** deleting now takes the time with it (`docs/DECISIONS.md`, "Deleting a task takes its hours with it").
- **Driven for real** (scratch library; the built app and dev mode/StrictMode; `scenario.mjs`-style Playwright script, 24 checks, screenshots read): a new training with no series (nothing made until Add time), a series typed (both tasks follow, the series self-study task made), a second lecture of the series (same series task), a rename (follows), a series change and a cleared series (moves; the emptied series task the page made goes to the trash), the self-study task deleted and Add time pressed again (made again), deleting a lecture (both its tasks trashed, series task and the other lecture kept), a lecture whose session was over (Start still on self-study, lecture task `done`), an older note (file byte for byte unchanged after opening), leaving the page right after Start (the file and the timer kept it). No console errors in either mode.
- **Left:** (1) the top-bar Start picker and a task's own page still offer Start on a lecture's session task: hiding it needs the training rows in Hours' picker and the Tasks page, which is cross-module machinery, so it was not built (`docs/ROADMAP.md`). (2) Deleting a self-study task keeps its time in Hours under the old name, but the note's total no longer counts it (it counts the new task). (3) A series whose name equals a series-less lecture's title would adopt that lecture's self-study task as its series task. (4) The series' self-study task never closes by itself.

- **Revised 18 Oct 2026 (the user's review of the first version):** (1) titles have **no middle dot**: `<series> self-study`, `<note title> self-study`; tasks made with the dot are still found (`plain` in `self-study-task.ts`), a lecture subtask made with it is renamed by the normal sync when its note opens, a series task made with it keeps its old name until renamed by hand. (2) The lecture's own task is a small icon link at the end of the note's details row (`TrainingMetaFields`, `lectureTaskTo`), no longer text in the Task panel. (3) The Task panel (`LectureTask`) shows the **self-study task** (its link, or its name as plain text until Start or Add time makes it) with the total, Start and Add time. (4) **A lecture's own task cannot be started or have time added**: `useOpenTasks` leaves lecture task uids out (so the timer picker, its suggestions and Add time's picker never offer them), the task page of a lecture task hides its Time card's Start and Add time, and a series task's Add time no longer lists its lecture subtasks (`useLectureTaskUids`, from the training rows, Research only). This closes the "Left" item above. **Not driven in the app before pushing** (the user asked to push and install straight away); look at the icon's place and the unlinked draft title.
- **Revised again 18 Oct 2026 (the user's look at it):** the Task panel's total is the **self-study task's own time** (0:00 until something is put on it), not the lecture's session plus self-study (`LectureHours`; `entryMinutes` is unchanged and still what the counters use). The icon's label is **"Open task"** (the wording Meetings' Task field uses, no new term) and it sits **beside the Duration value**, since the lecture's own task is the session Duration measures. Other places offered: a text link in the Task panel's row, or a "Task" field like Meetings'.
- **And the label (18 Oct 2026):** the Task panel's time has **no label**. "in total" was used nowhere else and meant the session plus self-study before; "Time on this task" is the task page's Time card label, which needs it among other lines, but here the task's name is beside the number, so it is just `0:00`.

## Hours counted the same way everywhere (17 Oct 2026, `docs/HOURS_CONSISTENCY_PLAN.md`)

- **Why (the user):** every place that shows or reports hours must give the same number for the same period, now and for whatever is built on the data later (a widget is wanted some day; none was built, no Settings switch, no new page; the Home and Hours pages look as before).
- **The audit as found** (reading the code, confirmed): the Hours page and its cards, Home's `HomeHours`, a task's Time (`useTaskTime`) and the training counters (`entryMinutes`) already counted the _shown year_ (stored sessions and typed entries plus the hours the notes derive, `withDerived`), the training counters by their own path. **The main-process Home summary did not**: it read `years('research')[0]` (the newest file, not the year holding today, and never checked that today is in it), the stored sessions only (no meeting or lecture hours, so a week with a supervision and a lecture read short), Research only (no Work), and its week aim was the plan's `hoursPerWeek` (37:30) where the Hours page's week aim takes leave days off (30:00 in the fixture). Everything the widget file said about hours came from it. The plan's table was right except for how the page picks its year: Research is `currentYear(today, settings.yearStarts)`, Work is `contractToShow` (the contract holding today that was shown or used last), not "the newest whose range holds today".
- **One shown year** (`hours/shared/shown-year.ts`): `derivedEntries(sources)` (the task-to-list mapping, a subtask in its parent's list, `meetingEntries`, `lectureEntries`) and `shownYear(year, sources)` (`withDerived`). The Hours page's `useMeetingEntries` calls it, and so does the main process. **One rule for the year** (`@shared/tracking/current-year.ts`, `yearToShow`): `useTrackingYear` calls it, and so does the main process (the contract the page remembers is renderer state, so in the main process a Work year with two contracts open at once picks by the last client used, then the newest).
- **One decision about "time so far"** (`periodFigures` in `hours/shared/so-far.ts`): the label, the period's minutes and aim (the invoice month, or the week), today's minutes and the clients. `HomeHours.tsx` calls it (the page is unchanged: same figures, same markup, checked by driving), and so does the main process.
- **Main process** (`home/main/collect.ts`): per workspace (Research, Work) it picks the year as the page does, requires today to be in it (a finished Work contract gives nothing, as the page shows nothing), reads the meeting rows, Research's training rows, the tasks and Work's clients from the database and the contract files, and builds the shown year. Read only; no file or table is changed. `HomeSummary.hours` is now `{ research, work }`, each `{ label, minutes, aimMinutes, todayMinutes, clients } | null`. The Research time off still comes from the same year file (stored on purpose).
- **Widget file:** `week` is Research's figures (now with derived hours, and with `label`, `todayMinutes`, `clients` beside `minutes` and `aimMinutes`), and `work` is new. **No version bump** (still 1): nothing reads the file yet, the change only adds fields, and `week.minutes` and `week.aimMinutes` keep their meaning, but the numbers in them change (derived hours now count; the aim follows leave days). A reader that arrives later gets the corrected file from the start.
- **Left as it was (on purpose):** the meeting clash warnings read the stored entries (they look for overlaps with them), and Time off is not hours worked.
- **One difference between places that could not be closed:** Hours (the page, Home, the summary, the widget file, a task's Time) reports a note's derived session **to the quarter hour**, like any block (a 10:00–11:10 lecture is 1:15), while the training counters (landing, table, series cards, per-skill totals, the PDF, Inkpath's log) use the session's **exact minutes** (1:10). This is a recorded decision (the meeting counters are exact too: "a 40-minute meeting is 40 min there and 0:45 on Hours"), changing either side would change figures the user has already reported or reviewed, and it differs only for sessions that are not a multiple of 15 minutes. It is pinned in a test (`parity.test.ts`) so it cannot move by accident. **The user's call:** whether the training log should report to the quarter too. Tracked time (timers, typed time, self-study) is quarter-based on both sides and agrees exactly.
- **Parity tests** (`hours/shared/parity.test.ts`, with `collect.test.ts` for the summary and widget): a fixture library (a lecture with a session and typed self-study, a supervision meeting, a typed entry; a Work contract with a meeting under a client) read as the Hours page (days, week, "Meetings and training" rows), Home (`periodFigures`), a task's Time (`trackedByTask` of the shown year) and the training totals (`entryMinutes` over the stored year; per skill, per series): same numbers. Mutation checks (each makes a test fail): `withDerived` dropped, the lectures dropped, a subtask not taking its parent's list, the wrong `today` passed, the label rule changed, the period branch dropped, the main process taking the newest year, the "today is in the year" check removed (found a missing test: a Work contract that had ended), Work's clients dropped, `entryMinutes` without the tracked map in the PDF.
- **Driven for real** (scratch library; the built app and dev mode; Playwright): a Research lecture (10:00–11:30, task and a self-study task with 0:30 typed), a Research supervision (14:00–15:00), a typed hour, a Work contract with a typed 0:45 and a Work meeting (1:00) under the Impact list. Hours page: week 4:00 (Tue 2:00, Wed 1:00, Thu 1:00); Home Research "This week 4:00 of 37:30, Today 0:00"; Home Work "This month 1:45 of 80:00, Impact 1:45", the Hours page's Work week 1:45 and month 1:45; the series task's page 1:30 and its self-study task's 0:30 (the lecture's 2:00 across the two); a supervision task 1:00; Training page "2:00 of 200:00", "plus 1:00 of meetings"; `data/widget/snapshot.json`: `week` 240 min of 2250 and `work` 105 min of 4800, with the old build's file for contrast (`week` 90, no `work`). Dev mode gave the same figures as the built app, no console errors.
- **Left:** a library where one Work client is on two contracts that both hold today, and the page remembers the older: the main process cannot know what the page remembers (see above).

## The real-library gate runs in parallel (17 Oct 2026)

- **Why (the user):** tests took ten minutes or more, which made each editor change slow. A plain `npm test` is 7 seconds (2,800 tests); the cost was the opt-in real-library gate, which ran every check over 406 notes one after another in one file (619 s measured, one core).
- **Change:** the checks live in `live-library.gate.ts` (`registerGate(part, shard, shards)`) and run as nine small files, `live-library.<part>.test.ts`, with the slow parts sharded by note (blocks in 4, keys in 3, notes in 2: `-1`, `-2`…). Vitest runs files in parallel, so the same 17 checks over the same 406 notes take **about 2 minutes** (130 s measured on 10 cores). Every note is in exactly one shard of each part; the "found something" counts are asserted per shard, relative to its notes. Nothing a check does changed.
- **To keep it quick:** a new check goes in the gate as a new part with its own file; a part that grows past about a minute gets shards. `npm test` stays 7 s (the gate files are skipped without `LIVE_EDITOR_LIBRARY`).

## Every report of time is to the quarter hour (18 Oct 2026)

The user's request. Timers and typed time were already whole quarters; the gaps were a note's start and end and the lengths computed from them. `TimeInput` (meetings, training, the timer's start, a stale timer's end) snaps its minutes to 00/15/30/45 as they are typed, pasted or stepped (one digit is the tens: "3" is 30), and `durationMinutes` (`src/shared/time.ts`) rounds a session's length to the nearest quarter, halves up. This ends the one known difference between Hours and the training log (a 70-minute session now reads 75 in both). Times already stored in notes are left as they are; only the length they report changes.

## Training cards show training + self-study; summaries show the total (18 Oct 2026)

The user's choice from `docs/design/training-self-study-split-mockup.html` (a mix of its options). Summaries (year strip, per skill, PDF) stay one total that includes self-study, because self-study is first-class training. Series cards, "recent and upcoming" rows and the table's Duration column read "3 h + 1 h 15 min self-study" (nothing added when there is none). `entryParts` in `training/shared/rules.ts` splits an entry into `training` (the session plus the lecture's own task) and `selfStudy`; `entryMinutes` is their sum, so no total changed.

### Audit of where hours are shown (18 Oct 2026, by reading the code, the user's request)

Checked against the two decisions above: summaries are one total with self-study (Training landing and page strips, per skill, the Training card on Home or Hours, the PDF: all `trainingHours`); series cards, "recent and upcoming" rows and the table show training + self-study (`entryParts`); every length goes through the rounded `durationMinutes`. Kept as they are, by the user: a person's page lists a training row's session only (they were not present for the self-study), and the timer chip's and "Started at" running clocks show the live time to the minute, not a report. Fixed: the training delete dialog said "It has X of self-study" with X including time on the lecture's own task (training); it now counts the self-study task only. Left for later (`docs/ROADMAP.md`, beside the historical linking): start and end times already stored in notes are not snapped, only the length they report is rounded.

## Landings: "done", the 7-day window, and a flickering overlap warning (18 Oct 2026, the user's report from using the app)

- **"Done" is the one word for what has happened.** "4 entries" beside "2 upcoming" read as if the entries included the upcoming ones. Every count of what has happened now reads `N done`: the Training and Meetings series cards (`4 done · 2 upcoming · 7:00`, `9 done · last Sep 12 · next Oct 1`; a zero is left out, so a series with nothing done yet reads `2 upcoming` or `next Oct 1`), the Training year strip and list-page strip, the Meetings hours strip, and the Meetings card on a workspace's home. The series card gained `upcoming` (`SeriesSummary` in `training/shared/rules.ts`), a number of its own. **The PDF reports keep their sentences** ("… in 7 entries", "… in 3 meetings"): they already leave out anything that has not happened and say so in the subtitle.
- **"Recent and upcoming" is a window, not a count.** It showed the next 3 and the last 5, which hid the fourth upcoming entry (the user took the page to be stale). It now lists the last 7 days (today included, newest first) and the next 7 days (soonest first; undated planned entries last), with no cap, on both the Training and Meetings landings (`recentAndUpcoming`, `LANDING_DAYS` in `shared/year.ts`). The window is said beside "See all …" the way Tasks says "Next 7 days": a muted "Last 7 and next 7 days" (`SeeAllLink window`). An empty window says "Nothing in the last or next 7 days".
- **The overlap warning flickered while an entry was filled in.** Changing the date, title or series renames the file; the watcher sees the new file and the old one gone as two events, so for a moment the index holds the entry under both names and the page found the old name overlapping itself. The entry page now passes every name the entry has had since it opened (`renamedFrom`, from `known.ids`) and `notesOverlapping` ignores them all. Found by reading the code, **not reproduced** in the app; unit test in `note-clashes.test.ts`.
- **Not reproduced: the landing "never refreshing" after trainings were added.** Driven in the built app (scratch library): files written into the training folder while the landing was open appeared within a couple of seconds, and `useTrainingList` listens for changes. The likely cause was the 3-entry cap above. If it happens again, note how the entries were added and which part (card count, list, or both) was stale.

## Pickers: one keyboard model (18 Oct 2026, the user's report from using the app)

- **Reported:** the Skills "add" menu could not be walked with the arrows (every other picker could), and in the pickers that could, a highlighted item had to be taken with Enter before Tab.
- **The model, in every "pick a value" menu:** arrows highlight, Enter takes the highlighted item, **Tab takes it and moves on** (Shift+Tab never takes anything), Escape closes only the menu. Where the highlight is only a default (nothing chosen yet), Tab takes nothing: Skills and the group menu start with no highlight, People takes on Tab only after an arrow or typing, Combo fields only after an arrow, the task picker only with a highlighted row. A described select starts on its current value, so Tab changes nothing until the arrows move.
- **Where:** `SkillsField` (now a listbox with `aria-activedescendant`; it had no key handling), `DescribedSelect`, `ComboField`, `PeopleField`, `TaskPicker`, and the Notes `GroupField` (focus stays in its search box; the rows are `tabIndex=-1` options the arrows highlight).
- **Left on purpose:** native `<select>`s (arrows change the value when closed, so arrow then Tab already matches), and `TaskMenu`, a menu of actions (rename, delete…) where Tab closing without running anything is the convention and an accidental action would be worse than the mismatch.
- **Not driven in the app** at the time of writing; unit tests and the typecheck pass, and none of them press keys.

## Settings → Hours: contracts table, Year under Research, no Life block (18 Oct 2026, the user's review)

- **Reported:** the page was confusing: Life showed Hours per week it does not need, Work had loose fields (Hours per week, Contract starts / ends) with no way to tell which contract they belonged to, and Year is Research's, not everyone's.
- **Life** has no block (`PLAN_WORKSPACES` in `hours/shared/workspaces.ts` is Research and Work). Its saved plan is untouched in its files; it just cannot be edited. **Year** (`YearFields`) sits at the top of Research's block; the separate Year block is gone.
- **Work** has a Contracts table (`ContractsTable`), one row per contract, newest first: Name, Starts, Ends, Clients, Hours a week, Invoiced. It behaves like the Time off list (the user's rule: tables behave the same way): Edit turns the row into inputs (name, last day, hours a week, invoiced) with Save / Cancel, Enter saves, Escape cancels; Delete asks, then shows an Undo toast; a new row flashes once (`useNewRowKeys`). Starts and Clients are not edited in the row (clients keep their chips below the table, which rename a client everywhere). Work's own Hours per week and Contract starts / ends fields are gone; "New contract" stays below the table.
- **Delete only while a contract holds nothing** (no sessions, typed hours, days, notes or days off: `contractIsEmpty`), the user's choice, so no hours are ever lost. `removeContract` also refuses when a client only that contract has still has tasks, and sets the file aside as `<start>.json.removed-<time>` instead of deleting it. Undo makes the contract again with the same terms.
- **New store calls:** `setContractTerms` (name, invoice) and `removeContract`, with IPC, preload and `Api` entries; the end and hours use the existing `setContractEnd` and `setPlan`. Tests: `store.test.ts` (mutation-checked: without the guard, a contract with time is removed and the test fails) and `contracts-table.test.ts` (replaces `hours-settings-aim.test.ts`: "none" not 0:00, clearing back to none, nonsense refused, Delete only when empty).
- **Not driven in the app** at the time of writing.

### Hours settings, second pass (18 Oct 2026)

- **The card spilled out of the panel:** a grid item's minimum width is its content's, so the 860px table pushed the settings panel's grid wider than the panel. `HoursSettings.module.css` grids are now `minmax(0, 1fr)`; the table (minimum 840px) scrolls inside its own card.
- **A contract's clients are edited in its row** (comma separated, in `ContractsTable`); the separate Clients chips (`ClientFields`) are gone. One name replaced in place is a rename (`renameClient`: the Tasks list, tasks and hours follow it), any other change sets the list (`clientChange` in `plan-settings.ts`); a removal that leaves a client's tasks behind is refused with the same words as before.
- **New contract is a button under the table** that opens a row at the top (`NewContractRow`: name, first and last day, clients, hours, invoiced; Add stays disabled until it reads). `ContractFields` stays only for Hours' empty page, where there is no table.
- **Research's years are a table** (`YearsTable`, replacing `YearFields`): every listed year newest first, Edit only on the next one until it begins.
- Driven in the built app on a scratch copy of the library (layout, the new row, row edit); not in dev mode.

## Selection in a grid table (18 Oct 2026)

The user: selection "still seems to be confusing and broken" — a selection ending inside a wrapped cell filled the whole row's height up to the end's x, and the rest of the row from the left edge.

- **Cause:** a grid row is one line of the text but several lines on the screen (each cell wraps by itself), so the text-line bands `RectangleMarker.forRange` draws (first line to the right edge, last line from the left edge) ran through the cells.
- **Fix** (`live-selection.ts`, `tableRows`, `rowMarkers`): the part of a selection on a grid row is drawn by the row. A row that is selected from end to end is one band of its box; a partly selected one is the selected text of each cell, one band per wrapped line, as tall as the row's line height. Everything else still goes through `forRange`. A table the cursor is in is text, and keeps the text bands.
- Driven in the built app on a scratch library (a drag from a paragraph into a wrapped cell, then Shift-Down through the rest of the table), light mode. Layout only exists in a browser, so no unit test; not checked in dev mode or dark mode.

## Tasks landing: a task shows once (18 Oct 2026)

The user: each task on the Tasks main view shows up once only; one that is in progress and already under Today must not also be under In progress.

- **Rule** (`landingSections`, `views.ts`): a task appears under the first heading that fits, in the order Overdue, Due today, Due tomorrow, Soon (day 2 to 7), In progress. It fits by its own date or status, or because an open subtask has its own date that fits (then the subtask is nested under it). This reverts "a landing task shows under every section that fits" (13 Oct 2026, `bf03a73`) and keeps the section order set after it.
- So an overdue, in-progress task is only under Overdue, a due-today, in-progress task only under Due today, and In progress lists the in-progress tasks that fit nowhere above it. A parent whose subtask is under Due today is not repeated under Soon for its own later date.
- Tests: `views.test.ts`.

## Undo: Cmd-Z and the toast are one list (18 Oct 2026)

The user: everything that has a toast with Undo should also undo with Cmd-Z; other changes to tasks (mark as done and the rest) should be undoable too, without a toast. Toasts are for significant changes that are hard to take back (deletions).

- **One list** (`renderer/src/components/undo-store.ts`): `pushUndo` remembers a change silently; `pushUndoWithToast` also shows the toast, whose Undo runs the same entry. An entry runs once, whichever way it is asked; the list keeps the latest 50. It lives in the renderer and is lost on quit.
- **Cmd-Z** (`UNDO_SHORTCUT`, handled in `Shell.tsx`, listed in Settings under Everywhere): takes back the latest entry, unless the key press was already handled or focus is in an input, textarea, select or the editor, which undo their own typing.
- **Toasts moved onto it:** deleting a task (table and task page), Time off removal, Hours deletion, contract removal.
- **Silent entries for task changes** (`task-actions.ts`): status (`setTaskStatus`; undoing the finish of a recurring task also deletes the next occurrence it started), and `updateTaskUndoable` for priority, due, tags, list, rename in the table and the task page's non-text fields, plus the Tasks landing's "move overdue to today". `updateTaskUndoable` records the fields it overwrites (a move under a parent also records list and sublist).
- **Not undoable by Cmd-Z:** task title and description edits on the task page (typing; the editor has its own undo).
- Tests: `undo-store.test.ts`. Not yet driven in the built app.

## Weather beside the date, and Settings → Weather (18 Oct 2026)

The user: weather as a starter on the Research (and Work) heading, right after the date.

- **Heading** (`HomeWeather`, `useWeather`, `weather-model.ts` in `src/modules/home/renderer/`): an icon, the temperature and "Overcast · Egham" after the date in `WorkspaceLanding`. Nothing is drawn while weather is off, unset or unreachable (`home.weather()` returns null). Read again every 30 minutes and on focus; the service already reuses a reading for 30 minutes, so no extra requests. The tooltip gives "feels like". Fahrenheit shows "°F"; Celsius shows "°".
- **Settings → Weather** (`WeatherSettings`): the one way to turn it on. Type a town, Find, pick a candidate (that sets place, rounded position and `enabled`); Turn off; a °C / °F choice. Off by default, as before: nothing is sent until a place is chosen. The Home/Notifications tabs of stage 3 are still not built; this tab is only weather.
- **Fixed on the way:** the place search listed the same town twice when two results rounded to one position (`parsePlaces` now lists it once; a duplicate React key otherwise).
- Tests: `weather-model.test.ts`, `weather.test.ts` (mutation-checked: without the dedupe the new test fails). Driven in the built app on a scratch library (light and dark; chosen, switched to °F, turned off, survived a restart). The weather and place search did reach open-meteo.com during that drive (a town name, then its rounded position).
- Not built: the Weather card of the mockup (a three-day forecast), kept for later.

## Weather follows the Mac: its location and its temperature unit (18 Oct 2026)

The user: take the weather's place and °C/°F from the laptop, and do not keep the °C/°F choice in Settings. Real Location Services, not the time zone.

- **Settings → Weather is one Off / On switch** (`WeatherSettings`). `WeatherSettings` in `home-settings.ts` is now only `{ enabled }`; the typed place, the saved coordinates and the unit are gone, and an older settings file's copies of them are dropped on load. The place search (`findPlace`, Open-Meteo geocoding) is removed. Off by default.
- **Location** (`native/locate.swift`, `scripts/build-locate.sh`, `npm run build:locate`, also the first step of `build:mac`): a small Swift program asks CoreLocation once and prints the position **already rounded to one decimal** (a town). macOS only shows the permission question for an app bundle (a bare command-line helper silently waited and timed out), so it is built as the background app `resources/Locate.app` (`LSUIElement`, usage text in its Info.plist, ad-hoc signed), shipped in the app's Resources (`extraResources`) and launched by `LocationService` through `open -W -n --stdout <temp file>`; the file is deleted at once. The main app's Info.plist has the same usage text and the entitlements file has `personal-information.location`. The helper is built for this Mac's architecture only, as `electron-builder --mac` is. Not built on other platforms (Weather then says it cannot find the Mac).
- **Rules** (`location.ts`, tests): a position is reused 30 minutes, a failure 2; concurrent asks share one run; a failed read keeps the last good position unless the permission was taken away (`denied`); `parseLocation` rounds again and refuses anything unreadable (mutation-checked: without the rounding its test fails). Turning Weather On runs one read at once (`home.locate()`), so Settings can say "Allow it in System Settings → Privacy & Security → Location Services" or "Couldn't find where this Mac is".
- **Unit** (`temperature-unit.ts`): the Temperature unit in System Settings (`defaults read -g AppleTemperatureUnit`, which exists only once someone changed it) and otherwise the region (Fahrenheit for US, LR, MM, BS, BZ, KY, PW; this Mac is en_GB, so °C).
- **The town's name** (the user asked for it, then for it to be as precise as it can be, 18 Oct 2026): `Locate.app` asks Location Services for a position to about 100 m and gives Apple's own lookup (`CLGeocoder`) that **precise** position; the name comes back as `place` (no answer is no name). The precise position is never printed, stored or sent anywhere else: the helper prints only the rounded one, and the weather is still asked for the rounded one (a finer position buys no better forecast). So the one place a precise position leaves the Mac is Apple's own lookup, at the user's choice.
- Driven in a packaged build on a scratch library (`electron-builder --mac --dir`, ad-hoc signed): On, the read, the header, the temp file gone. **Not driven:** the denied case (only its parsing is tested) and a Developer-ID-signed or installed build.

## The heading's date and weather: a dot and one baseline (18 Oct 2026)

The user (from a screenshot): a middle dot must separate the date from the weather, and the two were misaligned.

- **Dot:** `HomeWeather` starts with a `·`, so it only appears when the weather does. The title row's gap is 8px (was 16px) and the heading has an 8px right margin, so "Research" keeps its space.
- **Alignment:** `.weather` was `align-items: center`, which gave the group a baseline of its icon and lifted its text off the date's. It is now `baseline`, and the icon (`.weatherIcon`) is nudged down 2px to sit level with the text. Not driven in the app: the user judges the look as they use it.

## Top bar in full screen: it grows below the revealed system strip (18 Oct 2026)

The user (from a screenshot): near the top edge of a full-screen window, just before the Mac's menu bar shows, a line ran through the Life / Research / Work tabs.

- **Cause:** the `.topSentinel` hover (the pointer at the very top edge) shifted `.lead` and `.actions` down 28px with `translateY`, to clear the opaque system strip. The bar kept its height and its `border-bottom`, so the shifted tabs sat on the border.
- **Fix** (`TopBar.module.css`): on that hover the bar itself grows by `--fullscreen-strip-shift` (`height` plus an equal `padding-top`, both transitioned with the padding-left that makes room for the dots), and the transforms are gone. The border stays below the tabs. The page below moves down by the same 28px while the strip shows.
- **Not driven in the app** (the hover state in full screen is hard to script): lint and typecheck pass. The user judges the look as they use it. The alternative, if the content shift bothers them, is to keep the content still and draw the border lower.

## Editor tables: space around the row dividers (18 Oct 2026)

The user (from a screenshot): the text of a table row sat tight against the divider lines, which was hard to read in a long, wrapped row.

- **Fix** (`LiveEditor.module.css`, `.live-table-row`): the grid rows have `padding: 6px 4px` (was inline padding only), so every row, the header included, has 6px above and below its text. The line of dashes under the header still takes no height.
- **Not matched in the text view:** a table the cursor is in shows as plain Markdown, which keeps its one-row-high lines. The user: tables look so different as text that the rows jumping when the cursor enters is fine.
- **Not driven in the app:** a CSS change only; the user judges the look as they use it.

## Dates, times and numbers follow the Mac's region (19 Oct 2026)

The user: "follow Mac" for every display format; APA references stay as they are.

- **Rule:** text the app shows is formatted with the default locale (`toLocaleDateString(undefined, …)`), never a named one (`'en-GB'`, `'en-US'`). The helpers are in `src/shared/locale-names.ts`: `localeDate` (a `YYYY-MM-DD` date, no time zone), `monthName`, `weekdayName` (1 Monday to 7 Sunday), `firstWeekday`, `formatClock`, `uses12HourClock`. `formatDate`, `formatShortDate`, `formatDay`, `formatRange`, `formatTimeRange`, Home's `whenLabel` and `detailText`, `formatHours`'s separator, the word count, the task time months, the Readings collator and the page's `lang` (set from `navigator.language`) all go through them. The date picker's month title, weekday letters and first column follow the region too.
- **Patterns start on the region's first weekday, not the contract's** (the user, 19 Oct 2026): the heat map's rows and the Days chart run from `firstWeekday()` (Monday for British English), whatever day the contract starts on. The heat map is a grid of calendar weeks (`heatGrid`): empty cells fill the first column before the contract's first day and the last after its last, and a day opens the contract week it is in. The **Weeks** chart and the Hours page's weeks still count from the contract's start (a Friday for Work), so a week's total there is the same everywhere (`docs/HOURS_CONSISTENCY_PLAN.md`).
- **Not display, so unchanged:** the notes' own text (times are stored as 24-hour `HH:MM`), APA month names (APA style), the import scripts' English month names (they read the user's old text), and the Hours page's weeks, which start on the day set in the app (Monday, Friday for Work).
- **Time field** (`TimeInput`): in a 12-hour region it has a third part, AM or PM (A, P, Up and Down set it; hours take 1 to 12); the value it reports is still 24-hour. Driven in the built app with `--lang=en-US` (typing, arrows, the end following the start) and `--lang=en-GB` (unchanged).
- **Tests run in US English** (`vitest.config.ts` sets `LC_ALL`), so expected text such as "Sep 24, 2026" and "2:00 PM" is the same on every machine. On the user's Mac (British English) the same text reads "24 Sept 2026" and "14:00".
- **Not driven:** the Hours pages, Home and the date picker's first column in the app; unit tests cover them. The user judges the look as they use it.

## Delete goes at once, with Undo (19 Oct 2026)

The user: "instead of showing a prompt to confirm, delete right away, but show a toast at the bottom with an undo, and allow undo with cmd z", for People and "elsewhere with similar behaviours". Built on the existing `pushUndoWithToast` (`undo-store.ts`, Cmd-Z outside a text field) and `Toast`.

- **No confirmation any more** for: a task (its page), a day off, an Hours row's time, a contract, a person nobody mentions, and the four notes that go to the Trash (meeting, training entry, note, reading list). `DeleteDialog` is gone. A page nothing was typed into is still removed without a toast, as before.
- **A person who notes mention** still gets the Archive / Merge dialog: that is a choice, not a confirmation (Archive is itself undone by Restore). Undo of a plain delete adds the person back with the same name, initials, `me` flag and links.
- **Undo of a deleted note file**: Electron's `shell.trashItem` does not say where in the Trash the file went, so Undo cannot move it back. `delete` now resolves with the file's exact content and `restore(ref, content)` (Meetings, Training, Notes, Reading lists) writes it back with `createNoteFileExclusive`: byte for byte, reindexed, and refused (nothing written) when a file is at that name by then, so it never overwrites. The trashed copy stays in the Trash. A meeting's own task and a training entry's lecture and self-study tasks, trashed with it, are restored by Undo too. Undo does not navigate: the item reappears in its list.
- Tests: one `restore` test per store (round trip, index row, never replaces). Driven in the built app on a scratch library: each of the four pages and People, toast shown, Undo button and Cmd-Z both bring the item back with its text. Not checked in dev mode.

### Undo, second round (19 Oct 2026)

The user's answers to "what else would be expected to undo": a toast **and** Cmd-Z only for losing things (Timer Discard, Archive a person); **Cmd-Z only, no toast** for edits and chip removals; Merge keeps its dialog.

- **Timer Discard** (`TimerChip.tsx`): toast; Undo starts the same task again and sets the start back to the discarded one's (`setStart`). Refused with a message when another timer runs by then; if `setStart` is refused the timer runs from now and says so.
- **Archive a person**: toast; Undo is `people.restore`.
- **Chips and links** (`PeopleField`, `SkillsField`, `TagsField`, `PersonLinks`) share `useUndoableRemoval`: Cmd-Z puts the item back at its old position into the list as it is by then (so later edits are kept). New `isStale` on an `UndoEntry`: `undoLast` drops entries whose field is unmounted, so Cmd-Z never edits a note that was left.
- **Cmd-Z only**: a contract's Save (each change that went through is reversed, newest first, including a client rename), a Time off day's edit, an Hours row's typed time, moving a note or meeting to the other workspace (it moves back and is shown there).
- **Readings rename suggestion, Dismiss**: Cmd-Z only (the user's "sure, why not"); `undismissRenameSuggestion` sets a dismissed one back to pending (the row was always kept). Unit-tested; not driven in the app (needs a Zotero rename to produce a suggestion).
- Not done: renaming an Hours task; adding things.
- Driven in the built app on a scratch library: Discard + Undo (same start second), attendee chip + Cmd-Z (saved to the note), Archive + Undo and Cmd-Z, meeting move to Work and Cmd-Z back. **Not driven**: the contract Save, Time off edit and Hours time edit undos (typecheck and lint only).

## One rule for undo (19 Oct 2026)

Reviewed after the first two rounds ("Delete goes at once, with Undo", "Undo, second round"): the user's answers already formed one pattern, so it is written down here and at the top of `undo-store.ts`, and Settings' shortcut help for Cmd-Z was brought up to date (it still said "Task changes, deletions and removals").

1. **A record goes away** (a row, page, person, contract, a discarded timer): at once, a toast with Undo, and Cmd-Z (`pushUndoWithToast`).
2. **A value changes in place** (an edit, a chip, a status, a move, a plan): at once, Cmd-Z only, silent (`pushUndo`).
3. **Something is added, or it is routine** (new, start, stop): no undo; deleting is the undo. A page nothing was typed into goes without a word.
4. **A dialog only where nothing could be undone**: Merge a person, and a name or initials change (it rewrites notes).

Cmd-Z now always says what it undid ("Undid the move to Work."), since a silent change may be off screen. Every entry's `label` is a noun phrase, used in both that message and "Couldn't undo the …"; before, a task change passed a verb phrase ("change the due date"), so a failure read "Couldn't undo the change the due date". Not shown when the toast's own Undo button is pressed (the result is in front of the person). The stack is still one list for the whole app: Cmd-Z takes back the latest change wherever it was made (entries of a page that was left are skipped, `isStale`).

### Undo, third round (19 Oct 2026)

The pending table the user agreed to (all Cmd-Z only, per "One rule for undo"), except Stop timer, Settings toggles, adds, and ending a forgotten timer (no undo there, by the user's decision). Add time first had no undo by their choice, then got one ("given your explanation I would prefer if 4 had an undo without a toast too").

- **Open TODOs, tick**: `tickTodo` now returns `{ previousBody, hash }`; Undo is `meetings.save(ref, { body: previousBody }, hash)`, so it only writes while the meeting is as the tick left it (otherwise "The meeting changed since"). A plain-text TODO that the tick made a checkbox goes back to plain text.
- **Add time**: `removeAdjust(id)` (new, `totals.ts`, IPC `tracking:remove-adjust`) takes back exactly the typed time just added (the last of `adjusts`). If the row's time was retyped since (which replaces the adjust), Undo says "The time was changed since".
- **Running timer's start** (`StartedAt`): Undo restores the start **and** any earlier entry the change trimmed, exactly (see `restoreEntries` below).
- **Hours settings** (hours a week, days worked, days off a year), **renaming an Hours row** (a task, or a day's label; a rename that merged two rows splits them again, see `restoreEntries`), **who is "me"** (Set as me clears the previous one; Undo sets them back). Name and initials keep their dialog and have no undo.
- **Meeting, training and note fields** (`EntrySession.setMetaUndoable`: date, time, mode, series, attendees, skills, group, pinned, folder, discussed topics): Cmd-Z puts the fields back while the page is open (`isStale: disposed`); the same fields changed again within a second stay one step (a date typed digit by digit).
- **Two fixes the round needed**: (1) `pushUndo` is ignored while an undo runs, so an undo that goes through the page's normal edit path does not record itself (without it Cmd-Z toggled a tag on and off); (2) the chip hook (`useUndoableRemoval`) stays only on a person's links: task tags (`updateTaskUndoable`) and the notes forms (`setMetaUndoable`) already record their own step, and two entries for one removal made the second Cmd-Z a no-op.
- Driven in the built app on a scratch library: attendee chip and mode with Cmd-Z (saved to the note), "me", TODO tick (byte for byte), Add time (one hour per Cmd-Z), Hours time edit, row rename, Hours settings (days worked), Time off edit, contract Save (name and weekly hours) with the "Undid …" message each time. **Not driven**: the running timer's start change (the start field steps by 15 minutes and every step overlapped an entry or the future on the scratch day) and the Readings Dismiss (needs a Zotero rename).

- **`restoreEntries`** (`totals.ts`, IPC `tracking:restore-entries`): the exact Undo for a change that edits entries in place. The renderer reads the year before and after (`entryDiff`, `hours/shared/entry-diff.ts`: entries with the same id that differ, meeting-drawn blocks left out) and Undo hands both back; nothing is written unless every entry is still exactly as the change left it (`changed-since`), and no entry is added or removed. Used for the timer's start (which trims earlier entries and reports their minutes again) and for a label rename (`renameTask`, which merges two rows of the same name: renaming back by name would have relabelled both). A task's own rename needed nothing: its entries follow the task by key. Tested in `timer.test.ts` and `entry-diff.test.ts`; driven in the built app (rename merge through the UI, trim restore through the IPC; the timer popover's start field steps by 15 minutes, so a trim could not be made through it on the scratch day).

### Undo: pushed and installed (19 Oct 2026)

All three rounds above, "One rule for undo" and `restoreEntries` were pushed (`e1ff859..34a4f9a`, 33 commits, tests, lint and typecheck green) and installed the same day (`npm run build:mac`; the old `/Applications/Central Command.app` went to the Trash, the new one was copied from `dist/mac-arm64`; the app was not running and was not launched from here). **Still to check by hand in the installed app:** undoing a timer's start change from the popover, and the Readings Dismiss undo (needs a Zotero rename). `docs/SEARCH_MODIFIERS_PLAN.md` was already untracked when this work started and was left alone.

## Meetings, trainings and the timer: one combined fix (19 Oct 2026, `docs/MEETING_TASKS_PLAN.md`, extends `docs/NEW_MEETING_PLAN.md`)

Built unattended in one session (the user's explicit exception to "stop at every stage"); nothing pushed, nothing applied to the real library, the repair script dry-run only. Eleven commits, each with test, lint and typecheck passing.

- **The cause of the leftover tasks (the user's screenshot of three "Supervision · 19 Oct 2026" in "Meetings"): no, the deletes did not trash the tasks.** `MeetingPage.removeNote` trashed a task only if `isOwnMeetingTask` said it was the meeting's own, and that wanted the US title (" · Oct 19, 2026"); since `6ddc65e` the titles are "19 Oct 2026", so every task was skipped.
- **A marker, not a title format.** Tasks migration `0003_own_kind` adds a nullable `own_kind` (`'meeting'`, `'training'`, `'self-study'`; the plan named the first and last, `'training'` is ours, so the timer can tell a training's own session task from a task the user chose for it; the user asked for "training", not "training", 19 Oct 2026). It is set when the app makes the task (`ownKind` on `CreateTaskInput`, carried by `Task`). A task with a marker is decided by it alone. **Until the repair script marks the old ones**, a subtask is a meeting's own if its title ends in " · " and a date as some region writes it (`LEGACY_TITLE` in `meeting-task.ts`: a year, a day, letters and punctuation, at most 32 characters; tested for en-US, en-GB, de-DE and ten more regions, with a mutation check back to the US-only pattern: 18 tests fail). A task a meeting's `task:` names that has neither is the user's, never touched. Tests run each region through `withLocale` (`src/shared/with-locale.testing.ts`), because Node reads the region once at start.
- **Checked for the same assumption:** training's training and self-study tasks recognise their own by structure (a subtask, or a top-level task in Training with nothing under it) and never by title, so they do not share it. `word-sources.ts:77` `DATE_LINE` reads the US dates written in the user's Word supervisor log, an outside document, not what `formatDate` writes, so it does not share it either.
- **Deleting is the main process's job** (`MeetingsStore.delete`, through an injected `trashTask`, with `restoreTask` for the Undo of `restore`). Every delete the app does, including the untouched one below, trashes the meeting's own task once, unless another meeting names the same task; a task the user chose is left. `removeNote` and its Undo no longer touch tasks. A file removed outside the app (Finder, the Trash) is not auto-trashed (never delete on a guess): the repair script lists the tasks it leaves as orphans.
- **A new meeting has only today's date** (replaces "a Supervision meeting for today"). No series: no `series:` line (`updateHead` drops an empty one), filed as `YYYY-MM-DD Untitled` (` 2` for repeats; `Planned Untitled` with no date), headed "Meeting · date", the series field says "Choose series", the landing shows "Meeting", the landing's series cards and the filter list only real series. The "Missing series" problem is gone. A save still refuses an empty series. Choosing a series renames the file; a meeting with no series is renamed after a date change only when its name is one the app gave (`isUntitledName`), so a hand-made file keeps its name. No task until a series is chosen: `planMeetingTask` already waits (`task: auto` and no series gives nothing), and the task is made when one is chosen (driven).
- **Leaving an untouched meeting removes it, with its task** (`MeetingSession.dispose`, so back, another page, a workspace switch and, through `settle()` on the before-close flush, quitting all do it). Untouched (`isUntouchedMeeting`): no series, times, mode, attendees, skills or topics, and a body that is the template's headings only (blank lines aside). **The date does not count as a change** (decision taken for the user): a new meeting is prefilled with today's, and changing the date alone is not writing a meeting. The main process re-reads the file and decides (`MeetingsStore.discardIfUntouched`), so a page that believes it is untouched can never remove a meeting that was changed outside. It goes the way every delete goes (macOS Trash, task to the Tasks trash). React Strict Mode (dev) cleans up and starts again at once: `dispose` checks after saving that the session was not revived, and a move uses `disposeKeeping` (the meeting is moving, not being left). Mutation checks: no discard call (a test fails), no revived check (the Strict Mode test fails).
- **The timer's interpretation (the user's words, "the hours tracker"; open question, see the roadmap).** The timer's pickers (top-bar suggestions, typed search) and the task page's Start and Add time stop offering a **session task**: a meeting's own task, a training's own task. `sessionTaskUids(workspace)` in the Tasks main module (`session-sweep.ts`; the training rule is the sweep's) behind `window.api.tasks.sessionTaskUids`, read by `useSessionTaskUids`, which replaces training's `useTrainingTaskUids` (one hook, both kinds, every workspace). A series task the user chose for a meeting, a self-study task and an ordinary task stay offered (tests, and driven: a meeting task due today is not suggested and not found by typing; the series task and an ordinary task due today are). **Not changed:** the hours the notes derive into the Hours totals (`useMeetingHours`, `derivedEntries`) and the read-only `MeetingRows` list, because Work's billable totals depend on them. If the user meant those too it is a one-line follow-up in `MeetingRows`. Time already tracked on session tasks stays in Hours.
- **A self-study task for every training entry, always** (the user's instruction, 19 Oct 2026). **This replaces three decisions of "Self-study tasks for trainings" above:** "nothing is made in advance", "no due date, status `doing`" and "a training never studied for has no self-study task". Everything else there stands. The app makes it, in the main process (`settleSelfStudyTasks`, `training/main/self-study-sweep.ts`, at launch and every minute): for each Research entry with a title (not "Untitled") and a date it makes the series' `<series> self-study` task if needed and the entry's subtask (a top-level task in Training for an entry with no series), marks it `self-study`, and writes `selfstudy:` into the note through `TrainingStore.save` (the guarded write; it re-reads the file and retries; if the note cannot be written the new tasks are trashed again, so nothing doubles). Idempotent (the uid is in the note; two runs make one task; two entries of a series share one parent). It also keeps an existing task in step: title, series task, **due on the entry's date, following it**. **Done one week after the entry's end** (`selfStudyTaskChanges`, `SELF_STUDY_DONE_AFTER_DAYS`, `END_OF_DAY`, in `tasks/shared/session-task.ts`): date plus 7 days at the entry's end, 23:59 with none; the minute before it is open, the minute at it is done. Mutation checks: six days (three tests fail), no link written into the note (ten fail: a second task on every run).
  - **Decisions taken for the user:** (1) a note edited in the last 30 seconds is left for the next run (`QUIET_MS`), so a write of ours never puts the page the user is typing in into conflict; a task takes up to a minute and a half to appear after a title and date are typed (driven: 55 s). (2) A task the note names that was deleted by the user is **not made again by the sweep** (only Start or Add time makes it again, silently, as before). (3) **Only for trainings made in the app, never the user's older ones** (the user, 19 Oct 2026: they map old trainings to tasks and hours by hand): the sweep makes the task only when the note's `task:` is `auto` or the task made for it carries the `training` marker (`madeInApp`). Every older entry is left alone, however recent; there is no backfill and no repair for trainings. A training made in the app with a date already past gets its task done at once. (4) The sweep closes an open task past its moment on every run, as `sessionTaskChanges` does for meetings: a task the user reopens by hand is closed again within a minute. **Answered 19 Oct 2026: if the user reopens it by hand it stays open, and starting a timer on it or adding time reopens it** (`auto_closed_at`, migration `tasks/0004_auto_closed`: the sweep closes a task once; `reopenSelfStudyTask`, called by the timer's start and by add time; other done tasks stay done).
  - The page keeps making it too (Start or Add time on an entry whose date is not set yet), and now passes the date.
- **`npm run repair:session-tasks [-- --apply]`** (`scripts/repair-session-tasks.mts`, `tasks/main/session-repair.ts`): meetings only, trainings are never touched (the user maps them by hand; changed 19 Oct 2026). Dry run by default, reading a throwaway copy of the database (`VACUUM INTO`, with the newest task migrations on it, so a library the app has not opened since still reads). `--apply` (app closed) backs the database up first, marks the meeting tasks, renames, dates and re-parents them, and puts the orphans with no time tracked in the Tasks trash (restorable; one with time is kept); the changes are one transaction that rolls back unless a second look finds nothing left to repair (tested with a trigger that undoes the renames). **Dry run on the real library, 19 Oct 2026:** 28 meetings name a task (5 own, 23 the user's own choice, mostly Work); 5 lack the marker; 3 would be renamed, among them "Other · 20 Oct 2026" from "Supervision · 19 Oct 2026" to "Meetings · 20 Oct 2026", dated 20 Oct and moved under "Meetings"; the three "Supervision · 19 Oct 2026" tasks in "Meetings" are orphans with no time. **Applied to the real library 19 Oct 2026, at the user's word** (see below).
- **Untouched items left behind by the other "New …" buttons (report, nothing changed):** New note: none (`useNoteSession` already discards an empty note on leaving). **New training entry leaves an "Untitled" entry per click, and New list leaves an "Untitled list" per click** (driven in the built app). Both only skip the Undo toast when Delete is pressed on an untouched page. Answered 19 Oct 2026: yes, remove them on leaving, as for meetings. Done: `discardIfUntouched` in the training and reading-list stores (judged from the file), the shared `EntrySession` does it on leaving and on quit (`isUntouchedTraining`, `isUntouchedList`; a training with a title, series, time, text or task is kept; the date does not count). Driven in the built app: New training entry and New list followed by Back leave nothing. The date-only decision for meetings was confirmed.

### Meetings, trainings and the timer: applied, pushed, installed (19 Oct 2026)

- **Applied to the real library at the user's word** (`npm run repair:session-tasks -- --apply`, app closed, backup `~/CentralCommand/backups/session-tasks-2026-10-19T12-00-08-998Z`): 5 meeting tasks marked, 3 renamed, dated or re-parented (among them "Other · 20 Oct 2026", now "Meetings · 20 Oct 2026", due 20 Oct, under Meetings), the 3 leftover "Supervision · 19 Oct 2026" tasks put in the Tasks trash (restorable). A dry run now finds nothing. Trainings were not touched. The tasks migrations `0003` and `0004` ran on the real database with it.
- **Pushed and installed the same day** (`npm run build:mac`; the old `/Applications/Central Command.app` went to the Trash, the new one was copied from `dist/mac-arm64`; not launched from here). The sweep, the untouched-removal and the timer rules are therefore live from the next launch; not driven in the installed copy, only in the built app and dev mode on a scratch library.

## Skills menu: type to filter (20 Oct 2026)

The skills menu (`SkillsField`, used by Training and Meetings) took arrow keys only, so reaching a skill meant walking about twenty rows. Now typing filters it: `skillMatches` (`src/shared/skills.ts`) keeps a skill whose name or Inkpath spelling contains the text, ignoring case and extra spaces. The first match is highlighted, so a few letters and Enter add it; arrows, Home/End and Tab work as before; Backspace edits the text, the first Escape clears it, the second closes the menu; Space is a character once typing has started. Empty groups disappear and "No match" shows when nothing fits.

The popover stays a `div` that captures keys (no input), so its look is unchanged: the typed text shows in a small row at the top only once there is some. Checked in the built app on a scratch library (type, Enter, no match, Escape); dev mode not checked. Unit test: `skills.test.ts`.

## Deleting a task takes its hours with it (20 Oct 2026)

The user deleted a task and its tracked time stayed in Hours, to be deleted by hand. Agreed with the user: the time goes with the task.

- **Rule (`TrackingStore.removeTaskTime` / `restoreTaskTime`, `tasks/main/time-hook.ts`, called from the `tasks:delete` and `tasks:restore` handlers):** deleting a task removes every ended session and typed entry that carries `cc://task/<uid>` (the task and its subtasks, every workspace and year, history linked to a task included) and resolves with the minutes removed; the toast says so ("Deleted “X” and 1 h 15 min of time."). Kept: a running session, derived blocks (meetings, trainings) and entries with no link (matched by label only).
- **Undo and Settings → Tasks → Restore bring it back.** What was removed is kept in `<time>/removed-with-task/<uid>.json` and put back (by id, never twice) when the task is restored; the file is then removed. It stays until the task is restored.
- **Meetings and trainings follow the same rule (user's request, 20 Oct 2026; this reverses "the time stays in Hours" for training lectures and meeting tasks, above).** Deleting a meeting trashes its own task in the main process and now also takes that task's time out of Hours (`removeTaskTime` in the meetings store's `trashTask`; `restoreTaskTime` in `restoreTask`); deleting a training entry takes the time of its training task and its self-study task out the same way (`tasks.delete` with no exception). The note's own hours (its start and end) are derived from the note, so they go with the file. The `keepTime` argument is gone.
- **Asks first when there is time to lose (user's request, 20 Oct 2026):** a task, meeting or training with time shows a Cancel-first dialog, "Delete “X”? 1 h 15 min of time will be removed from Hours with it." (`DeleteTimeDialog`, shared; for a meeting or training the figure is the note's own hours plus the time on its tasks, and it asks even when the body is still the template, since the time is what is lost; a task with none is deleted at once, as before; the minutes come from `tasks:time-on`, the same count `removeTaskTime` uses, so the note and the removal agree). A task with none is deleted at once, as before.
- Tests: `src/main/tracking/task-time.test.ts` (mutation-checked: without the put-back the restore test fails). **Driven** (scratch library, production build and dev mode, 30 checks each, no console errors; light, and the dialog in dark): the task page and a table row (the dialog does not open the row; Cancel; Delete; toast; Undo), a task with a subtask, a task with no time (no dialog), Settings → Tasks → Restore, a meeting with its own task (1 h note + 30 min), a training with a training task and a self-study task (1 h + 45 min + 30 min), each with Cancel, Delete, toast and Undo.

## Overlap warning on a meeting after its task was deleted (20 Oct 2026)

- **Not a bug.** The "Overlaps …" line on `2026-10-01 Rastle Lab` (14:00–17:45) was right: Research's time for 1 Oct held two prep sessions that overlapped the meeting (11:50–16:17 and 16:17–17:33), and sessions typed or timed earlier carry only a label, not a `task` link, so deleting a task does not take them out of Hours. The warning reads the time file live, so it goes when the sessions do.
- **Fixed in the real library by hand at the user's word** (app closed, backup `~/CentralCommand/backups/overlap-fix-2026-10-20/2026-27.json`): 1 Oct's four prep sessions, two Central Command sessions and four untimed adjustments (including a −165 prep correction, most likely an earlier fix for this overlap) became four timed sessions, laid out by the user: prep 09:30–14:00 (4:30), dinner 17:45–20:00 (2:15), Central Command 20:00–21:00 (1:00), Fix the R setup 21:00–21:15 (0:15). The day stays at 11:45, nothing overlaps the meeting. The exact times of the original timer runs are gone (the user's choice). No code changed; no script, so nothing to re-run.

## Research's imported daily totals for 22 and 23 Sep 2026 reduced (20 Oct 2026, the user's request; applied)

The user asked for 6:00 off Tue 22 Sep and 2:00 off Wed 23 Sep of the imported time. Both are the unlabelled daily totals in `~/CentralCommand/time/research/2026-27.json` (`days`): 22 Sep 7:45 (465) → 1:45 (105), 23 Sep 4:15 (255) → 2:15 (135). Edited by a one-off Python edit (asserted the old values first, wrote atomically; the app's other process was running, the file was re-read just before writing); backup `~/CentralCommand/backups/research-days-sep22-23-<timestamp>/2026-27.json`, and a diff against it shows only those two lines changed. Work has no entry on 22 Sep; its only 23 Sep row (the 2:15 "Document automation: Developer proposal review" adjustment) was left alone. Tasks' `earlier_minutes` were not touched. No code changed; no script, so nothing to re-run.

## Hours: one leading column for tasks, meetings and trainings (20 Oct 2026)

The user saw rows on Hours that were still editable and had no icon (1 Oct's four hand-laid sessions: a label and times, no `cc://task/<uid>` link, so they render as plain rows with an inline-editable name), and asked for the lists to be consistent.

- **No task icon in a tasks-only list.** Every row in `TaskList` is a task, so the `ListTodo` icon went; the title is the link when the row has a task. Meeting and training rows keep their calendar and cap icons, because they sit beside the tasks.
- **The first column is shared.** `TaskList` and `MeetingRows` both use a 32px lead column and a 14px gap: Today puts the Start button there, the week's day lists put the task's status circle (editable, `StatusButton`, now in `tasks/renderer/` and used by Home too), a row with no task leaves it empty, and a meeting or training puts its icon there, centred. Titles and the hours column line up.
- **Search draws no icons** (the status circles the user remembered are in the Tasks table and on Home). Left as it was: the `@` picker, hover card and "Mentioned in" still use the task list icon, since they mix kinds. Whether they should show a (read-only) status circle is the user's call, asked 20 Oct 2026.
- **Not changed, still open:** the four rows of 1 Oct have no task link; the one-script repair for every such migration leftover is in `docs/ROADMAP.md` ("one repair for every migration leftover"), not started.
- **Driven** in the production build on a scratch library (Today and a week's day list with a task of each status, a typed-label row and a meeting); dev mode, a running timer and Work's client menu not checked.

## Hours: the "Imported" row shares the task rows' columns (20 Oct 2026)

The user saw, on a week's day list, the day's imported time (1:45) sitting 32px to the right of the task and training times below it (6:00), with its label and time at different heights. Cause: the other rows keep 40px to the right of their time (a delete column of 24px, a gap of 8px and the time's own padding of 8px) and are grids with a 32px lead column; "Imported" was a flex row with 8px of padding and its label at the left edge.

- `.imported` in `WeekCard.module.css` is now the same grid (32px lead, name, time), centred vertically; the label sits in the name column and `.importedTime` has the same `2px 40px 2px 8px` padding as the meetings' time. Layout only; no logic changed.
- Checked: test, lint, typecheck. Not driven in the app (the user checks looks as they use it).

## Hours: the "Imported" row gets ClickUp's mark (20 Oct 2026)

The user asked for an icon on "Imported" that looks like ClickUp's, in the app's own style. Lucide has no brand icons, so `hours/renderer/ImportedIcon.tsx` draws the mark (an up chevron over a curve) as a 16px line icon with the same stroke (1.75, round caps) and muted colour as the meeting and training icons. It sits in the shared 32px lead column of the row (`WeekCard.tsx`). Checked: typecheck, lint, and the SVG rendered alone; not driven in the app.

## A panel's last action: its tooltip lines up with the card's right edge (20 Oct 2026)

The user saw "Change folder", the last icon button in the Files panel of a training, cut off at the right. `IconButton`'s tooltip is centred under its button, and the side column (`.side` in `DocSplit.module.css`, `overflow: auto`, so it can scroll) clips whatever leaves the card.

- `.actions > :last-child [role='tooltip']` in `Panel.module.css` sets `left: auto; right: 0; transform: none`, so the last action's tooltip grows leftwards inside the card. It applies to every panel's actions, not only Files. `IconButton` is unchanged; tooltips elsewhere stay centred.
- Checked: lint, Prettier. Not driven in the app (the user checks looks as they use it).

## Summer School trainings made, imported days lowered, old task deleted (20 Oct 2026, the user's request; applied)

Five Research trainings for the Tenth Summer School on Statistical Methods for Linguistics and Psychology (Potsdam, 24 to 28 Aug 2026, 2025-26 year): "Day 1" to "Day 5", 09:00 start, lengths 7:30, 8:15, 7:15, 8:15, 6:30 (ends 16:30, 17:15, 16:15, 17:15, 15:30), Research methods, in person, Quantitative skills (SS), leads João Veríssimo and Michael Vrazitulis. Made through `TrainingStore` and `TasksStore`, so the notes are what the app writes: a done series task in Training and one done `training` subtask per day (`task:` in each note, so the sessions count on Hours). The imported daily totals in `time/research/2025-26.json` were lowered by each session (24 Aug 615 → 165, 25 Aug 615 → 120, 26 Aug 660 → 225, 27 Aug 615 → 120, 28 Aug 990 → 600), so the days' sums are unchanged. The old ClickUp task, "Attend Tenth Summer School on Statistical Methods for Linguistics and Psychology" (its 2265 min of earlier time is exactly the five sessions; no "Complete …" task existed; nothing linked in Hours), went to the trash. Backup `~/CentralCommand/backups/summer-school-2026-10-20T17-58-10-031Z`. One-off script kept outside the repo; no code changed. The two leads are not in the people list (`npm run people:from-notes` lists them).

## Hours: the day's "Add" button shares the task rows' columns (20 Oct 2026)

The user saw the "Add" button under a day's rows out of line with the rows above it: its plus sat left of the row icons and its label left of the names. Cause: it was an inline-flex button with 10px side padding and a 6px gap, not on the 32px lead column, 14px gap and 12px padding the task and "Imported" rows use.

- `.quiet` in `AddTime.module.css` is now a grid (32px lead, name) with 12px padding and a 14px gap; the plus is centred in the lead column and the label starts where the names start. The button still spans the row, so its hover tint does too.
- Checked: test, lint, typecheck, Prettier. Not driven in the app (the user checks looks as they use it).

The user (23 Oct 2026): a Research training with no time (no start/end, no tracked time, so 0 hours) is kept so self-study can be done for it, but it is not "done", is not mentioned as a special case and is not in the PDF. The Training strip no longer says "N without times, counted as 0" nor "plus N of meetings, which Inkpath also counts", and the PDF drops both too.

- `trainingHours` counts only entries with some time (`entries`; `withoutTimes` is gone); `trainingReportHtml` lists only those and has no `meetingMinutes`. Tracked self-study time makes an entry count again. Supersedes "plus N h of meetings" above and in `docs/TRAINING_PLAN.md`.
- Checked: test, lint, typecheck, Prettier. Not driven in the app.

The same for meetings (23 Oct 2026, the user's request): a meeting with no time is not "done", is not mentioned in the Hours strip as "N without times, counted as 0" and is left out of the PDF's rows and count.

- `meetingHours` counts only meetings with some time (`meetings`; `withoutTimes` is gone); `meetingsReportHtml` lists only those.
- Checked: test, lint, typecheck, Prettier. Not driven in the app.

## Pickers: one type-to-search way to choose from a list (23 Oct 2026, `docs/PICKERS_PLAN.md`; the user's decisions, built in one run)

The user found four behaviours for one job (Skills' menu searched without showing a field, People, Group and the timer's task box showed one, the Training type and about 30 other selects could not search, `ComboField` was a text field with a drop-down). Option A of `docs/design/picker-options-mockup.html` was chosen: a search box inside the list.

- **One picker.** `components/Picker.tsx`: `PickerPopup` (the open list) and `Picker` (the closed control plus the popup). `Select` keeps its props and is a thin wrapper (`YearSelect`, `WorkspaceSelect` follow); `DescribedSelect`, `ComboField`, the Skills/People/Group menus and `Select.module.css` are gone. Plain modules: `picker-match.ts` (matching, ordering, highlight ranges, type-ahead, the default highlight, `usedValueOptions`; unit-tested) and `picker-input.ts` (what an open list remembers between keys, held in state so the React Compiler lint rules are met).
- **Search only past seven options** (`PICKER_SEARCH_MIN = 7`, decided from the count at run time) or when a field asks (`search` on `Select`, `alwaysSearch` on `Picker`). A shorter list is a plain list: arrows, Enter, and a typed letter jumps to the first option starting with it (letters typed within 700 ms add up). Typing on the focused closed control opens it with those letters entered (a short list: opens and jumps).
- **Keys, everywhere:** Down/Up, Home/End, Enter picks, Tab picks and moves on, Shift+Tab takes nothing, Escape closes only the list (stopped, so a dialog behind it stays) and puts focus back on the control, a click outside closes. Only a real pointer move highlights a row (`PickerInput.pointerMoved`, as the editor's mention list). The 18 Oct "one keyboard model" holds: Tab takes the highlighted row only after the arrows, the pointer or typing led to it.
- **Placement:** the list is `position: fixed`, placed once when it opens against the control: on the side with room (above when below is too short), left-aligned or right-aligned if it would pass the window's right edge, `max-height` from the room there is, and the width it opened with (it does not narrow as the search removes options). So a table's scroll box or a dialog cannot cut it off. It closes when anything outside it scrolls or the window resizes. A list inside a list (the group field's "Inside") works: the inner one handles its own keys, its Escape closes only itself.
- **The closed control** is the size of the native select it replaces: an invisible copy of every label (up to 60 options) sets its width to the widest option, so it does not jump when the value changes. `compact` (toolbars, 32px) and `plain` (table cells: plain text, box and arrow on hover, focus or open) are kept.
- **Adding a value (`add`):** the list ends with `Add “…”` while the text is not an exact match of an option (nested options do not count, they are sub-items). `Series` and `Institution` (training) and `Series` (meetings) are pickers with it, always searching, a `None` row clears (training only: a meeting always has a series), and a meeting's series is now set once when picked or added (the draft-and-blur code is gone: nothing is sent while typing). People keeps `Add “…”` and `onAddPerson` (a failure shows its message in the list and it stays open); the group field and the timer's task box keep `Create “…”` and their creation logic (the group field's Inside choice is the add row's `extra`).
- **Skills and People** "+ add" open the picker under the add chip, with chosen values left out (Skills still stops at three); the search also finds a skill by its Inkpath spelling and a person by their initials (`keywords`, never shown).
- **The timer's task box** keeps its own input (it creates tasks) but takes the shared look and keys (`TaskPicker`): rows highlight with `--hover-tint` on pointer move only, the letters typed show in bold, and the default highlight is visible.

**Which row starts highlighted** (the plan: "follow what `GroupField` does now, in all of them"). Nothing typed: the current value. Typed: the exact match, else (with an add row) the only match or the add row, else the first match. It shows, so Enter never surprises. That is `GroupField`'s old rule (Enter picked the only match, else created), now visible; it changes People (Enter used to take the first match; with several matches and no exact one it now offers to add the person) and the timer (Enter used to take the exact task or create; it now also takes the only match).

**Left open by the plan and decided here** (consistent with the rest of the app):

- The timer's Tab takes a row only after the arrows or the pointer moved the highlight, never after typing alone, because taking the default can make a task. Everywhere else Tab also takes after typing.
- Home/End move the caret in the search field while it has text, and jump to the first and last row when it is empty (and on a list with no field).
- Escape closes the list even with text in the field (Skills used to clear the text first).
- `Institution` (training) was moved with Series, as it was a `ComboField` too; there is no separate Location field.
- An empty list says "Nothing to choose", a search with no hit says "No match".
- `skillMatches` (`shared/skills.ts`) was dead and is removed; the shared matching replaced it.

**Which controls search:** Training entry Type, Skills and People add, Group/List, Series and Institution; the filters Tasks list and tag, Training type/skill/series/people, Meetings skill/series/people, Notes group; Hours Client (task row, timer), "For" (subtasks), Merge into (people); anything else with more than seven options. Year, Workspace, Meetings type, Tasks priority, Readings status and Sort by, Repeats, Time off Type, Invoiced, Theme and Terminal are short lists with no field.

**Checks.** Unit tests of the matching (threshold, folding, highlight ranges, type-ahead, default highlight) and component tests with real key events in jsdom (`Picker.test.ts`: walk and Enter, type-ahead, typing on the closed control, Tab with and without a moved highlight, Shift+Tab, Escape not reaching what is behind and returning focus, outside click, pointer-only highlight, filter, accents, description, add row, exact match, a failing add, `canAdd`). Mutation-checked: threshold 7 to 6, the exact-match test always false, Escape ignored, Escape not stopped: each fails a test. Found by a test: the letter typed on the closed control was not in the type-ahead buffer. Driven in the built app (light and dark) and dev mode on a scratch library: Training type (open, filtered, typed on the closed control), Series (add, reopen, Tab moves to the next control), Skills, People (add an existing and a new person), the group field in a table row and its Inside list inside it (nested Escape), the timer's task box, Year, Readings and Tasks and Training filters, Settings' Theme and Terminal, Time off, a select in a dialog (Merge into: Escape closes the list, then the dialog), a list near the right edge (opens leftwards), focus rings on a table cell and a filter (not clipped). Fixed while driving: the list narrowed while filtering; a table cell's picker was 16px too narrow for its text (negative margin with `width: 100%`).

- **Not driven:** Work's Client select in a task row and in the timer (no Work data in the scratch library), Notes' group filter and the Meetings filters (no notes or meetings made), Time off's row Type select, a narrow window, a screen reader, the installed app.

## Polish round (23 Oct 2026, `docs/POLISH_ROUND_PLAN.md`)

### Step 1: the toast (items 4, 7 and 12)

- **Longer (item 12).** `showToast`'s default is 9 s (`TOAST_MS`), 12 s when the toast has an action (`TOAST_ACTION_MS`), so there is time to reach Undo. No caller passes its own `ms`.
- **Redesign (item 4).** One component, `Toast.tsx`/`Toast.module.css`: a dark pill (`--tooltip-bg`), one flex row with a gap, the action as a small accent-tinted chip at the right edge (no underline), and a 2 px bar along the foot that shrinks over the toast's time (CSS animation, `toast.ms` long). The pointer over the toast pauses both the bar and the store's clock (`pauseToast`/`resumeToast` keep the time left). A new message re-keys the component, so its bar starts again. New token `--accent-on-tooltip` (the opposite pair of `--accent`, so the chip and bar read on the toast in both themes).
- **Never wraps (item 7).** The row is `white-space: nowrap`; the text is split at the first `“` and last `”` into the words before, the quoted title and what follows. Only the title shrinks (`min-width: 0`, `text-overflow: ellipsis`), so `Deleted “Attend and present at …” and 3:45 of time.` keeps its ending and the chip. A message with no quoted title is one ellipsisable run. Tests: `Toast.test.ts`, `toast-store.test.ts` (durations, pause/resume).
- Driven: dev mode (a 280-character title, short, plain, light and dark, hover pause and release) and the production build (a real note delete): 44 px high, one line, in both.

### Step 2: "Open" on the recurring-done toast (item 11)

- Marking a recurring task done shows `Done. The next one is due <date> (every week).` with an **Open** chip that goes to the new task's page (`taskRoute(next.workspace, next.uid)`, in `setTaskStatus`, `task-actions.ts`). The main process already returned the new task (`setStatus` resolves `{ task, next }`), so no IPC change was needed. The toast is the one toast with an action besides Undo, so it stays 12 s.
- The router is a `MemoryRouter`, so code outside React cannot navigate. `shell/navigate-store.ts` holds the router's `navigate` (`setNavigator`, set by `RouteOpener` and cleared on unmount) and `openRoute(route)`, which follows only in-app routes (starts with `/`, not `//`, the same rule as a clicked notification). `RouteOpener` uses it for the main process's open-route messages too.
- Tests: `task-actions.status.test.ts` (toast text, Open label, the route followed with an encoded uid; no toast without a next task).
- Driven in a scratch library, production build and dev mode, light and dark: a weekly task marked Done on its page shows the toast with the chip; Open lands on the new task, due 30 Oct, To do.

### Step 3: done with no date gets today (item 14)

- `TasksStore.setStatus` (the one place a status changes: the table, the page, the board, the timer and the sweep all go through it) gives a task with no due date today's date when it goes to done (`due: finishing && !task.due && !task.ownKind ? today : task.due`). Subtasks that a finished parent closes with it get today too when they have none. Reopening leaves the date. A recurring task always has a date, so nothing changes for it. The app's own session tasks (`ownKind` set) are never given one: their status is the sweep's.
- Undo of the status change (`setTaskStatus`, `task-actions.ts`) puts "no date" back when the task had none and was not done before (`tasks.update(uid, { due: null })` after the status goes back). Cmd-Z undoes the last status change only, so a task taken from To do to In progress to Done is back In progress with no date.
- Tests: `tasks-store.test.ts` (today on done, kept on reopening, a dated task untouched, a subtask, a finished parent's open subtasks, a session task stays without a date); `task-actions.status.test.ts` (undo restores no date, a dated task is left alone).
- Driven in a scratch library, production build and dev mode, light and dark: a dateless task marked Done through its status circle has due today and leaves the Open/Backlog lists; Cmd-Z brings it back with no date.

### Step 4: "New training", the button audit, the year/contract layout (item 3)

- **"New training entry" is "New training"** (button, palette `quick-actions.ts`, Dock menu, comments, tests). Older write-ups in this file keep the old words; they describe the time.
- **The button audit, one pattern: `New <thing>` in a page header, `Add <thing>` inside a list.** Changed: Reading lists' "New list" is **"New reading list"**, People's "Add person" is **"New person"** (it now has the same plus icon), Time off's header "Add" is **"New time off"**, and the footer of Work's contracts table, a list, went from "New contract" to **"Add contract"**. Unchanged and already right: New meeting, New note, New task (the dialog code, not mounted), New training; "Add" in an Hours week, "Add time", "Add subtask", "Add topic", "Add link" are inside lists or cards. The contract form's own label "New contract" is a form heading, not a button, and stays.
- **The year choice reads `Year [2026–27 ⌄]`** (`Contract [...]` for a workspace with contracts) wherever it appears: `YearSelect` draws its own small muted label directly before the dropdown (the select keeps `aria-label`; the drawn label is `aria-hidden`). The landings (Training, Meetings) used to put a "YEAR" section label at the left and the dropdown at the far right; `LandingSection` has a `labelHidden` prop (the heading stays for assistive technology, the aside starts at the left), so the label and dropdown are one group at the left. The filter rows ("All meetings", "All training") and the headers of Hours, Time off and the training plan get the label by the same component; in the headers the group still sits with the other actions at the right, as the title is at the left.
- Tests: `YearSelect.test.ts` (label directly before the dropdown; a landing section with a hidden label); the contracts table test uses "Add contract".
- Driven in a scratch library, production build (light and dark: Training and Meetings landings, All training, All meetings, Time off, People) and dev mode (Training): one-line `YEAR [2026–27]` group at the left, buttons as listed.

### Step 5: back to this week / this month (item 5)

- The Hours page is the one place the week or month can be stepped away from today (the page's week is in the URL, `useWeek`). Where it is away from today's week, a quiet **This week** button sits beside the arrows on the Week card; the Invoice card gets **This month** (a contract invoiced by month) or **This week** (invoiced by week) when its period is not today's. One component, `BackToToday.tsx`; both cards go to the same week (`defaultWeek`), so they stay in step. The button is not drawn at today's week, nor when today is outside the contract's year (there is no "this week" to return to).
- Not done, on purpose: the date picker's month arrows already have **Today** in the calendar; the shared year (`YearSelect`) is a dropdown, not a stepper. No shortcut was added: the Hours page has no arrow-key shortcuts for weeks (the chart and heat-map arrows are inside their own widgets), so Settings is unchanged.
- Tests: `back-to-today.test.ts` (absent at the current week and month, present away, calls back with today's week, "This month" vs "This week" by unit).
- Driven in a scratch library, production build (light and dark) and dev mode: Previous week shows the button on both cards, Enter on it returns both to the current week and it disappears.

### Step 6: clipped blue borders (item 8)

- What was cut: the Mod-K field's focus ring. It was an outline on the field's own edge (`outline-offset: -2px`), and the search window has rounded corners and `overflow: hidden`, so the corners and edges of the ring were shaved (most visible in dark). The highlighted result row, the completion list, the filter chips and the "See all" button were checked and are not clipped: the results list already has 4px padding and `scroll-padding`.
- Fix: the ring is a `::after` of the field, 3px inside it (`inset: 3px`, 2px border, control radius), so nothing on the window's edge can clip it. `ChipInput.module.css`.
- Measured in the production build (light and dark): every focusable element in the window, ring rectangle against each clipping ancestor, none clipped; screenshots in the palette, the modifier list and the "See all results" window. Dev mode checked the same.
- Test: `chip-input-css.test.ts` (the ring is the inset pseudo-element, not an outline on the field's edge; a real ring check needs the driven app).

### Step 7: the stray dot and list names (23 Oct 2026, item 9)

- Why "no list name": a subtask has no list of its own (it takes its parent's workspace and sits under its parent), and Home read `tasks.list` as it was, so a subtask's line was empty and Home's "coming up" row then wrote ` · due in 3 days`. Fix at the source: Home's query gives a subtask its parent's list and sublist (`Thesis › Methods`), `collect.ts`.
- One line-builder, `taskLine(...parts)` in `tasks/shared/query.ts`: joins with " · " and leaves out any empty part, so nothing at all (no dot) shows where there is no list or no date. Used by Home (today and coming-up rows), the task search results, the `@` task picker and a person's open tasks. The tasks table keeps its list column (a subtask's cell stays empty there by design: it sits under its parent) and the landing shows list names only, with no second line, so neither has a dot to lose.
- Tests: `taskLine` (empty parts), Home collect (a subtask gets its parent's list and sublist; mutation check: dropping the join fails it). Driven in the scratch library, production and dev: a subtask reads "Thesis › Methods · due in 2 days", a task with no list "due in 3 days".

### Step 8: the Next meeting card is removed (23 Oct 2026, item 13)

- The user called the "Next meeting / None booked" card unnecessary: meetings are in Today / Coming up. `NextMeetingCard`, `NextMeeting` and the `HomeView` fields only it used (`nextMeeting`, `openTodos`) are gone; the Home page's right column is the Hours card alone.
- Its "Open TODOs" count (Research only) went with it. The count is still in the summary (`meetings.openTodos`) and `meetings.next` still feeds the notifications and the widget file, which are untouched.
- Test: `homeView` has only `tasks` and `comingUp`. Driven in a scratch library, production and dev: the card is gone and nothing else moved.

### Step 9: Home, Today holds events (23 Oct 2026, item 10)

- **Today** lists, in this order: today's meetings and trainings (timed ones in time order, then untimed ones such as a day off), then the overdue tasks (with their "N days late" chip), then the tasks due today. **Coming up** starts tomorrow (`homeView`: `todayEvents` and `comingUp` split on `inDays`). The summary keeps every event dated today and caps only the days ahead (`SHOWN_UPCOMING`).
- **Rows.** A meeting: title = series, "Untitled meeting" when it has none (never "Other"); second line `Meeting · with <initials>` (the Meetings table's initials, the user themselves left out; `Meeting` alone with no attendees). A training: title ("Untitled training" if empty); `Training · <In person | Online>` (its format is `mode`). The workspace is not shown (the row is already in that workspace's Home). The time is a range, `13:45–15:00` (`timeRange`; only the start when the end is unknown or the same), shown alone for today and as `Tomorrow 9:00–10:00` after. A meeting or training that is over today drops out (trainings now carry `end_time` like meetings did).
- **Review of the page.** One `Row` component for task and event rows (lead mark, title, quiet line, trailing part); the event icon is as wide as a task's status circle so titles line up down the list (a 4px offset was found in the screenshots). The same empty texts: "Nothing today." / "Nothing in the next 7 days." The Today count says "3 events · 2 due · 1 overdue" and "Clear" only when nothing is there; "See all" shows only when there are tasks (or the list was cut).
- Tests: `summary` (end, attendees and format carried, no workspace name, a finished training drops out and one under way stays), `home-model` (`whenLabel`, `timeRange`, `eventDetail`, Today/Coming up split and order). Driven in a scratch library, production and dev, light and dark.

### Step 10: self-study labels (23 Oct 2026, item 6)

- A display rule, no data change (the user's, 23 Oct 2026): a self-study subtask (`own_kind = 'self-study'`) shows its series as a muted prefix, "Simulating Social Worlds › Day 2 self-study". The series is the parent's title without its " self-study" (or the first version's " · self-study") ending; a task that is not a self-study subtask, or has no parent, is shown as it is. The data keeps its titles, so renaming, the sweep and the note's own sync are untouched.
- One rule: `studySeries` / `studyLabel` / `parentIn` (`tasks/shared/study-label.ts`) and one component for the muted prefix, `TaskName` (`tasks/renderer`). Used by the tasks table's subtask rows (also the subtask list on a task's page, which is the same table), the search results (plain text, "Series › title"), the timer's task picker (options and "Suggested"), the timer popover's head (`popoverHead` gives `series`), and Hours' task rows (the row's own label for the day, with the prefix).
- **A subtask has no page of its own** (`TaskPage` redirects it to its parent), so there is no page header to label; the parent's subtask list carries the prefix. A first attempt at a page-header prefix was dead code and was reverted. Not changed, on purpose: the top-bar chip keeps the session's own label, and typing a series name in the picker does not match its subtasks (the picker matches titles, as before).
- Tests: `study-label.test.ts`, `popoverHead` (carries the series), `taskHits` (search title). Driven in a scratch library (two trainings with `task: auto` make the tasks), production and dev, light and dark: table, search, picker, popover and Hours rows.

### Step 11: locked session tasks (23 Oct 2026, item 2)

- **Two locks, one rule** (`tasks/shared/session-lock.ts`, pure). A **session** task is one with an `own_kind` (a meeting's or training's own task, a self-study task): title, list, due date, status, repeat and delete are the note's and the sweep's. A **series** task is a top-level task with at least one session subtask ("Supervision", "<series> · self-study"): title, list, repeat and delete are locked and it has **no due date** (the user's choice: a series' end is unknown, its subtasks carry the dates); its **status stays the user's** (the app never marks a parent done). Priority, tags, notes and time (Start, Add time) stay free for both. Recognised by `own_kind` and by having session children, never by a title.
- **Enforced in the main process** (`tasks/main/session-lock.ts`, called by the IPC handlers; the store is untouched, so the sweep's own writes go straight through). `update` refuses a locked field whose value would change (a value equal to the current one passes, so a no-op save is harmless); `setStatus` refuses a session task; `delete` refuses both locks; `setDue` leaves locked tasks out of a bulk change; the message is "This task is kept by its meeting or training. Change it in the note."
- **The notes' own sync has its own calls.** `useMeetingTask`, `useTrainingTask` and the training's delete rewrite a session task's title, date, series task and trash it, which `update`/`delete` now refuse, so they go through `updateForSession` / `deleteForSession` (narrower than `update`: title, due, list, parent only). `sessionSource(uid)` finds the meeting or training that names a task, for the "Made by" line. Hours' rename of a row that is a session task is refused with the message (no special UI).
- **The sweep takes a date off a series task** (`settleSessionTasks`, at launch and every minute). The plan asked for a dry-run report line first; the repair script (`npm run repair:session-tasks`) was not extended, so a series task that already has a date loses it at the next launch (`passDown` could have given one). Say so if that should be a dry run first.
- **UI.** The tasks table and a parent's subtask list show a locked row's title, list and date as plain text (a series reads "No date"), the status circle is inert (Space, the menu and click do nothing), and there is no delete button. A locked task's page has a read-only title, plain Status (session), Due, Repeats and List, no "Delete task", and a quiet line: "Made by the meeting <title>" (a link to the note) or "Made by the training …", and "Meetings and trainings keep the tasks under this one." for a series. Home's event rows show an inert status circle. Other status circles (Home's task rows, Hours' list) still work as before and rely on the main process's refusal (a toast).
- Tests: `session-lock.test.ts` (shared: the lock, the fields, a series can lose but never gain a date; main: every refusal, priority/tags/notes and no-op values pass, the sweep still dates and closes a session task, the sweep clears a series date, a series' status changes, bulk date skips locked, `sessionSource`). Driven in a scratch library (a meeting task by API plus note, a training with `task: auto`), production (light and dark) and dev: refusals and screenshots of the table, the series pages and the subtask lists.

### Step 12: the `new:` modifier (23 Oct 2026, item 1)

- **`new:` joins the modifier table** (`search-query.ts`, `search-help.ts`, so the completion list, the chip, ghost-text Tab, the help row and Settings → Search all show it). Values: `note`, `task`, `meeting`, `training`, `reading-list`. It is not a filter: `parseSearch` puts it in `create`, never in `filters`, so it is not a search (no "No results.") and `-new:` is refused with a notice. No plain-words "New task" row: `new-task` and `new-reading-list` are left out of the palette's command rows.
- **Enter on a `new:<kind>` makes the empty thing and opens it** (`shell/new-kind.ts`, called from `GlobalSearch`), through the same `QUICK_ACTIONS` the buttons use. The workspace is the page's (`quickActionWorkspace`), or the one a `workspace:` word names (`workspaceFilter`); each kind then takes the nearest workspace it has (meeting: Research or Work, training: Life or Research, task: Research or Work, reading list: Research).
- **`new-task`**: an ordinary task (never an `ownKind`), no title, due today, in the list used last (`tasks-last-list-<workspace>`, else the busiest, in Work a client), and the page opens with the title focused. Left with nothing written in it, the page removes it (`discardIfEmpty`, after a tick so StrictMode's cleanup-and-setup does not remove it while it is still open). The old New task dialog stays switched off.
- Tests: the parser, chips, help table, `runNewKind`, and both new quick actions. Driven in a scratch library (production and dev, light and dark): completion list, chip, Enter for each kind, `workspace:work`, an untouched task gone and a titled one kept, `new:person` gives its notice.

### After the check (23 Oct 2026, the user's first look at the installed round)

- **Toast** stays dark in both themes (`--toast-bg`, a raised dark surface in dark mode; the tooltip keeps its inverted pair). Cmd-Z's toast names the task and the change ("Undid the status change of “X” from To do to Done.") and has an **Open** chip (`UndoEntry.open`).
- **The training note's Task row** shows a self-study task's series in front ("Series › Day 2 self-study"), also before the task exists.
- **Selects:** the task page's List field is 260px, not the row's rest; the Year list is as wide as its options (`Select minWidth`). Time off passes its workspace to `YearSelect`, so Work reads "Contract".
- **"This week" / "This month"** is a small button at the far end of the card header; the label's minimum width is 20ch.
- Open (the user decides): Work's Meetings pages still use academic years, not contracts; the older training and meeting tasks (e.g. PS5210's 24 subtasks) have no `own_kind`, so they are not locked; `new:` carries only `workspace:`.

## Polish round 2 (23 Oct 2026, `docs/POLISH_ROUND_2_PLAN.md`; one session, the user's rule for this plan)

- **Select width.** `Select` took `minWidth` but never passed it to `Picker` (which reads `listMinWidth`), so the open list was always 200px wide at least, and the search input's own default width made a list of more than seven options wider still. Now `minWidth` reaches the picker, the default is the field's width (120px at least when there is a search field), and the search input has no width of its own (`width: 0; min-width: 100%`). Measured in the built app: the Year list is exactly as wide as its field (109px).
- **Work's period is the contract** on the Meetings landing and list (`usePeriod`, `state/use-period.ts`: Research and Life the academic year; Work the contract from `useTrackingYear`, its length in `weeks`, label `Luminos · 1 May 2026 – 29 Oct 2026`). `meetingsInYear`, `meetingsInYearOrPlanned` and `meetingHours` take the length (`weeks`, default 52); "Hours of meetings, <contract>", "No meetings in <contract>", the export toast, tooltip, file name and the PDF carry the contract (`exportPdf(workspace, year, contract?)`, validated in the main process). The page shows nothing until the contract's file is read. Time off and Hours already did this; Training, Home and Tasks have no Work year.
- **`new:` carries more.** `parseSearch().create` is `{ kind, title, list, sublist, due, priority, tags }`: with `new:` present the plain words (and phrases) are the title, `list:` (`list/sublist`), `due:` (`today`, `tomorrow`, `week` = six days on; `overdue` is a notice), `priority:` (P1-P3) and `tag:` fill the thing in instead of filtering, and `isSearch` is false. `runQuickAction(id, navigate, workspace, fields)`; Work's rule about lists comes back as the main process's refusal and is shown as "Couldn’t make it: …". The help row and Settings → Search say so.
- **Series tasks follow their subtasks** (replaces step 11's "no due date, status the user's"): due = latest subtask date, Done once all subtasks are done, In progress again when one is added or reopened (`seriesChanges`, `TasksStore.settleSeries`, called after every change to a subtask and by the sweep). A series with no subtask stays as it is. `fieldLocked('series', …)` locks status and due; the table and page show them as plain text. The explanatory line is gone; the lock line is "Made by the series <name>" linking to the series page (Meetings or Training list filtered to it) or, with no series, to the meeting or training (`sessionSource` returns `series` for a series task).
- **Introduction's time.** The 2:00 on PS5210's "Introduction" is a typed entry marked `earlier` by `link:ps5210` ("ClickUp's time already holds it"), but the task was made after the import so its `earlierMinutes` is 0: the page counted none of it while Hours did. `trackedByTask(years, earlierMinutes)` now also counts the part of earlier-marked history that the task's own ClickUp time does not hold; only the task page and table pass it (`useTaskTime`), the training log's sum does not (the note's session time is counted once there).
- **Task page:** Tags are a labelled field in the Status/Priority row. **Training note's Task row:** the series prefix links to the series task once it exists.
- **Toast** is lighter (13px, slimmer chip and 1px time bar, hairline border, softer shadow). **Cmd-Z's toast** says what happened: "Changed status of “X” back to To do.", "Changed due date of “X” back to Oct 30, 2026." (or "no date"), list, priority ("P2"), "Brought back “X”."; `UndoEntry.message`, other entries keep "Undid the …".
- **`repair:session-tasks` extended:** marks the tasks Research training notes name (`training`; `selfstudy:` ones `self-study`) when the sweep takes them to be the training's own (a subtask, or the Training list's task with nothing under it); a task two notes name, one that is a series or in another list, one in the trash or missing is listed and left alone; notes naming no task are listed; series tasks out of step are listed and set. Dry run on the real library (23 Oct 2026): 31 would be marked (24 PS5210 subtasks, AI Agents, Simulating Social Worlds, SENSS, CastlesFest, Response Surface Analysis Workshop), 10 already marked, 124 notes name no task (old ones, never backfilled), 8 series tasks change (dates, and Done where all subtasks are). Applied to a copy of the real library: marked 31, second run changes nothing. Not applied to the real library yet (the user quits the app first).

## Self-study names and dates (23 Oct 2026, `docs/SELF_STUDY_NAMES_PLAN.md`)

The user's decisions after looking at the installed app: a self-study subtask is named after its training only ("Introduction"; the parent says `<series> self-study`; a training with no series keeps `<title> self-study`); it is due a week after its training ended (date + 7 days at the end time) and the sweep closes it at that moment (the due date used to be the training's date); the "Series ›" prefix stays only where a subtask is shown without its parent (picker, search, Hours rows); a locked task's title is plain text, not a read-only input; links to tasks, meetings, trainings and series use the app's icon-and-chip look, not underlines. Built, driven (scratch library, production build and dev mode, light and dark), applied, pushed, installed.

- **Locked title**: a session task's title is an `<h1>` (`TaskPage.module.css` `.lockedTitle`), not a read-only textarea; the other locked values (status, due, repeats, list) were already plain text; priority and tags are free.
- **`EntityLink`** (`renderer/src/components/EntityLink.tsx`): the editor's mention-chip look (selected tint, kind icon: `ListChecks` task, `CalendarDays` meeting, `GraduationCap` training), no underline. Bare underlined `<Link>`s found by grep and moved: `LockLine` in `TaskPage.tsx` (the series, the meeting or training) and `TrainingTask.tsx` (the self-study task; the series link there went away with the prefix). Not changed, because they are not underlined links: row titles in Hours (`TaskList`, `MeetingRows`) and the people table, which underline on hover only, and `MeetingTask`, which shows a title with no link.
- **Names**: `selfStudyTaskTitle(title, series)`: a subtask is `<title>`, a series-less top-level task `<title> self-study`; the series task stays `<series> self-study`. `studyStem` reads both endings; `planSelfStudyTask(…, keepForm)` lets the sweep leave a title that differs only in its ending alone (the note's sync and the repair rename). `plain` is unchanged (it finds the parent series task, where a looser match would take a top-level task named like the series).
- **Due**: `selfStudyDue(date)` = date + `SELF_STUDY_DONE_AFTER_DAYS`; `selfStudyTaskChanges` sets it and marks done at that day's end time (23:59 with none), the series task follows by `seriesChanges`.
- **Prefix**: gone from the tasks table (nested rows and the parent's subtask list) and the training note's Task panel; kept in search, the timer's picker and Hours rows (`studyLabel`, `TaskName`). The training's own session task and its self-study subtask now share a name, so those places show the prefix on the subtask only.
- **Repair**: `StudyLine`, `planSelfStudy` in `session-repair.ts`; collisions (a sibling with the new name, or two renames meeting) listed and left alone.
- Subtasks have no task page (they redirect to the parent's, existing behaviour), so "the locked page" is the series task's or a series-less training's.

## Self-study stays To do until it is started (23 Oct 2026)

The user's rule: a self-study task is not put In progress by the clock. The sweep makes it **To do** (it used to make it In progress); it becomes In progress when a timer is started on it (`putStartedTaskInProgress`, unchanged) or the user sets it, and **the app never moves it back to To do**. It is still closed automatically a week after the training ends, from To do or In progress (`selfStudyTaskChanges`, unchanged). A first attempt, In progress when the training's start time arrives, was dropped: a task set back to To do by hand would have been started again on the next sweep, and the user preferred the timer as the signal. Existing In progress tasks keep their status; no repair or migration. Tests: `self-study-sweep.test.ts`, "stays To do until the user starts it".

## Task links: icons, not chips

23 Oct 2026, the user's call after seeing `EntityLink` in use (mockup: `docs/design/entity-link-alignment-mockup.html`). The chip sat out of line with its text (an inline-flex box whose first child is an icon hangs by the icon's bottom edge), long names would be worse, and an icon button was already the app's way to open something.

- **No chips and no hyperlinks for linking** in details and panels: a plain name and a ghost `IconButton` with a tooltip. `EntityLink` is deleted.
- **A locked task** shows what made it as a field in the details row after List: `Series` (or `Meeting`, `Training`), the name as plain text and an "Open series" icon button (`MadeByField`, `TaskPage.tsx`). The "Made by …" sentence is gone.
- **A training note** has no Task panel. The training's own task (the session) is an icon-only "Open task" button in the details row (`TrainingMetaFields`), after Duration, with no label drawn. The self-study tracking is a one-line "Self-study" card (`TrainingTask`) with the total, Start, Add time and, once the self-study task exists, an "Open self-study task" icon. The task's name and list are no longer shown there.
- A subtask's page still redirects to its parent (`TaskPage.tsx`), so "Open self-study task" lands on the series task with the training's subtask listed.

## Move to Today moves only what is overdue (24 Oct 2026)

- **Bug (the user, 24 Oct 2026):** a task listed in Overdue only because of an overdue subtask was moved to today itself (its date was a month away), while the subtask stayed overdue.
- **Decision:** Overdue's "Move to Today" sets the date of the overdue things only: a task whose own date is before today, and the overdue subtasks nested under a row. A parent's later date is never touched; Undo puts back the same dates (`TasksLanding.tsx`, `moveOverdueToToday`).
- **Not tested in the app:** the handler lives in the component; typecheck, lint and unit tests pass.

## Subtasks, trainings and Home (24 Oct 2026, `docs/SUBTASK_DISPLAY_PLAN.md`)

The user's decisions after the mockups (`docs/design/subtask-parent-mockup.html`, `docs/design/training-display-mockup.html`), built in one session, one commit per part. Nothing here changes the real library's data.

- **"See all" opened Done (bug):** `tasksAllRoute` with no `view` falls back to the remembered query. Home's "See all" and the Tasks landing's "All tasks" now pass `{ view: 'open' }`; a list card keeps its list filter. Driven with `done` remembered: both land on Open. **Coming up is the next 3 days** (`COMING_UP_DAYS`, the card's label, the empty text). The Home summary (`TASKS_AHEAD_DAYS` 14, meetings 21, trainings 45) and the widget snapshot are their own windows, not Coming up's, and are unchanged.
- **One `LateChip`** (`tasks/renderer/LateChip.tsx`, `daysLate`/`lateLabel` in `tasks/shared/late.ts`, shared with Home's summary): the outlined danger pill "N days late". Shown in: Home's Today, the Tasks table's Due column (a fixed 100px slot between the date and the trash, so the trash never moves; the red date text, `.due_overdue`, is gone), the task page's Due field, Mod-K's task hits (`SearchHit.late`). Not shown (they show no due date): Hours' rows, the timer's picker and popover. The landing's overdue group is a `TasksTable`, so it has the chip. The landing's "N overdue" card text and Home's "N overdue" count are counts, not an overdue task, and stay text. Not done is the rule: a done task never shows it.
- **`SubtaskLine`** (`tasks/renderer/SubtaskLine.tsx`): `↳ <parent> · <list>` (+ the due text where that place shows one), the parent cut by an ellipsis before the list is, the parent never a link. A task with no parent keeps `<list> · <rest>`. Used in Home (Today and Coming up; `HomeTask.parent` / `HomeEvent.task.parent` come from the SQL join), Mod-K (`SearchHit.subtask`; a subtask now keeps its parent's list, "Subtask of X" is gone), the timer's picker (two lines for every task; the right-hand column is gone), the timer popover (`PopoverHead.parent`; 420px wide), and Hours' rows (a second line on every task row). `subtaskParent` gives null for a self-study task (its series is in its name). Not in the Tasks table or a person's page. The popover's and Home's grid tracks are `minmax(0, 1fr)`, or the unshrinkable list pushed Home's two columns over each other (found by driving it).
- **Hidden tasks** (`hiddenTaskUids`/`visibleTasks`, `tasks/shared/session-lock.ts`): a task with `ownKind` `meeting` or `training`, and a top-level plain task whose every subtask is one of those (the series container; a series with even one subtask the user made stays). A childless task is never hidden; self-study tasks and their `<series> self-study` parent stay visible. Storage, hours, sync, deletion and the note-to-task links are untouched. Consumers, each decided: `useTasksList(workspace)` hides by default (Tasks page, landing, `TasksCard` counts and chips, the new-task dialog's lists) and `useTasksList(workspace, true)` keeps them for the pages that must find one (`TaskPage`, Hours' `TaskList` and `TimerChip`, `useTrainingTask`, `useMeetingTask`, `MeetingTask`); `useOpenTasks` (the pickers); `searchTasks` (Mod-K, so `status:`, `list:` … see visible tasks only); `search-values` (completion lists and tags); the `new-task` quick action; the `@` picker (`taskEntities.search`, but `resolve` still finds a hidden task, so a link in a note works); Home's `collect.ts` (it already skipped tasks named by `meetings.task`/`training.task`; the filter is added after that query, so the summary, the widget snapshot and the notifications never see them, while the meeting or training stays an event). Left unfiltered on purpose: `useMeetingEntries` (the hours the notes derive), `snapshot.ts` (the task backup), `session-repair`, the self-study sweep. Test: `shown-year.test.ts` ("counts the same …") and `session-lock.test.ts`.
- **Self-study as a training** (`studyName`/`studyNameOf`/`taskLabel`/`STUDY_LINE`, `tasks/shared/study-label.ts`; `TaskName`, `StudyIcon`): the display name is `trainingLabel(series, title)`, "Series: Title" (just "Title" with no series or when it already starts with the series); the stored title stays `Day 2`. A Lucide `GraduationCap` (14px, muted) in front of the name in the Tasks table's title cell, Home, search (`SearchHit.mark`), the picker, the popover and Hours; the second line is `Training · self-study` (+ the due date where shown), from `detailOfTask`. The task stays tickable and its locks are unchanged. The picker and Mod-K also find it by its training name. `studySeries`, `studyLabel` and the "Series ›" prefix are gone. The top bar's timer chip shows the same name as the popover (`Chip` in `TimerChip.tsx`). Not added to the Training module's list.
- **Not driven:** the Hours rows of a Work task, the Tasks landing in dark, a second window size. Dev mode and the production build were driven on a scratch copy of the library (light and dark; assertions and screenshots). `NoteOutline.test.ts` reports an unhandled `window is not defined` teardown error in some full runs (not touched here, tests pass).

- **The running timer chip is as wide as its popover (24 Oct 2026):** `.root` in `TimerChip.module.css` is `min(420px, 90vw)`, the name takes the room and is cut by an ellipsis (it was a fixed 26 characters), so the chip and the popover under it line up. The "timer left running" notification and the widget snapshot name a self-study timer as its training too (`homeTimer`, `collect.ts`).

- **"+ Tag" never wraps (24 Oct 2026, bug from use):** in a row with a long title the title line is a flex container and squeezed the hover-only "+ Tag" button, so its text wrapped onto two lines and the pill border became a circle. `.tags [data-tag-add]` in `TasksTable.module.css` is `flex-shrink: 0; white-space: nowrap`, so the title's ellipsis gives up the room instead. Not driven in the app (CSS only).

## Contracts table in Hours settings (24 Oct 2026, the user's list)

- **New contract row (`NewContractRow`, `ContractsTable.tsx`):** the first day starts as today (it was the day after the latest contract). The last day follows the first until one is chosen, and is first day + 6: a contract is whole weeks (`contractWeeks`), so the user's "same date as start" would fail the check and leave Add disabled; the user confirmed it (24 Oct 2026). A chosen last day that no longer makes whole weeks is dropped back to the default.
- **Clients are chosen, not typed as a comma-separated list:** `ClientsField` (chips with "add", the Skills pattern, `PickerPopup` with `alwaysSearch`). It offers the clients the workspace's other contracts have, and a new name is an `add` row (`addClient` rules). Editing a contract uses the same field; `clientChange` still turns one name replaced by another into a rename. `parseClientList` is no longer used by the table.
- **Hours a week is `DurationField`** (the hours:minutes field of Add time), in both rows; 0:00 is "none" (`parseContractHours` is no longer used by the table). Blank is no longer a thing to type.
- **Layout:** fixed-width Starts/Ends (148px), Hours (120px), Invoiced (120px) and Actions (160px) columns, table min-width 980px; the Invoiced `Select` has `minWidth` 120 so "Month" does not wrap. The Add/Cancel buttons were past the card's edge. A narrow window scrolls the table sideways, as before.
- **"Days worked" is "Working days"** (Settings → Hours, the mockup).
- Not changed: `ContractFields` (the new-contract form on the Hours page). Driven in the production build on a scratch library (new row, picker add, Invoiced list); not dev mode, not dark.

## Contracts of any length (24 Oct 2026, `docs/CONTRACT_SPAN_PLAN.md`)

The user's request: "contracts to be allowed to span any time, but the weeks are only relevant for reporting". The plan was agreed; the user asked for all three stages in one session.

- **The model.** A Work contract file has an optional `end` (ISO, its real last day). `weeks` stays and is the reporting grid, rounded up from the first day (a 10-day contract has 2 report weeks, the second with 3 days). No migration: a file without `end` reads as before, its end being `yearEnd(start, weeks)`. `parseYear` accepts `end` only when it is a date on or after `start` and `weeks` equals its rounded-up grid (else the file is refused, never repaired); the real `~/CentralCommand/time/work/*.json` (4 files, none with `end`) parse to exactly their own contents and `contractEnd` equals the old `yearEnd` for each (checked read-only on a copy in the scratchpad; the real files' checksums were never touched; the user's brief said `data/time/work`, the real folder is `time/work`).
- **Any end on or after the start** is allowed, up to 156 report weeks (`MAX_CONTRACT_WEEKS`); `contractWeeks` returns the rounded-up weeks and still refuses (`bad-end`) an end before the start or past the maximum. `createContract` and `setContractEnd` always write `end` with `weeks`, so a real last day is never derived again. `setContractEnd` works on an old file (tested; mutation: refusing a file with no `end` fails 3 tests). Shortening is refused when a session, typed time or a day's typed total lies after the new end (`has-time-after`, by day, not by report week); lengthening is refused when it reaches another contract's client (`client-overlap`, measured to the other's real end).
- **Days after `end` in the last report week belong to no contract** (`inContract`): no timer, no Add time, no note, no derived meeting time there; another contract may start on such a day; the Week card shows them dimmed, not openable, with "—". Mutation: dropping `date <= contractEnd` from `inContract` fails two tests.
- **The weekly aim is not prorated** for a partial last week (the user's answer): it counts whole, as before; the Week card adds "3 days · 1:00 a day" under its summary only when the week has fewer than 7 days.
- **Each `yearEnd`/`inYear`/`.weeks` site, decided** (date = uses the real end; grid = keeps `weeks`):
  - _Date, now `inContract` / `contractEnd`_: `derived.ts` (`withDerived`), `totals.ts` (`dayRows`, `minutesByDate`, `minutesByClient`, `setTaskMinutes`, `addTime`, `setDayNote`), `contracts.ts` (`holding`, so the timer's and the pickers' "contracts that hold a date"), `timer.ts` (`startSession`, `renameTask`, `setClient`), `timeoff.ts` (Research only; the same function, no behaviour change), `plan.ts` (`dailyAim`, `lastDay`, which is when the allowance credit lands), `store.ts` (`holdingToday`, `sharesClient`, `createContract`, `setContractEnd`), `hours/shared/week.ts` (`defaultWeek`: a finished contract opens on its first week, by the real end), `HoursPage`, `HoursCard`, `InvoiceCard`, `WeekCard` ("away" from this week), `Home` (`HomeHours`, `collect.ts`), `useTaskTime` (`yearFor`), Meetings' period (`inPeriod` in `meetings/shared/hours.ts`, with `Period.end` and the PDF export's `contract.end`), `hours/shared/years.ts` (a row's `end`), `ContractsTable` (the Ends column and the undo of a removal), `ContractFields` (`dayAfterContract` is the day after the real end), `contractLabel` (the real last day, given `end`), `YearSelect` and `use-period`.
  - _Grid, `weeks` kept_: `weeksOf` in `totals.weeklyMinutes` and `plan.yearTotals`/`weekTotals` (the report weeks; the last week's `to` is clamped to the real end, so invoice periods, the weeks chart's tips and `inProgress` stop there), `weekNumberOf` and the week arrows (the next report week exists when it starts on or before the real end), `resolveWeek`/`useWeek` (a week asked for is a report-week start), `heat.ts`'s week count in `monthColumns` and `heatGrid` (the grid pads the last column with empty cells, as it always did; `heatDays` itself now holds only real days), `typical.ts` (the average weekday counts real days only), the 156 and `weeks` validation in `register.ts` and `parse.ts`, and everything about the 52-week year: `training/shared/rules.ts`, `TimeOffCard`, `AddTimeOff`, `YearsTable`, `YearSelect`'s research label.
  - _History imports_ (`hours-import.ts`, `work-import.ts`): untouched; they write whole-week contracts without `end` and check the whole-week last day.
- **UI.** The new-contract row (Settings) and the Hours form default both dates to today; a Last day is disabled only before the first day or past 156 weeks; the edit row's Ends likewise. No new text beyond the Week card's "N days · h:mm a day" line. Heat map and typical week hold only real days.
- **Tests.** `workspace-weeks`, `parse`, `store` ("any length": one-day and 10-day contracts, last day trackable and the day after refused, a later contract on a day after the end, an old file read unchanged byte for byte, `setContractEnd` on an old file, shortening past time by day), and `hours-partial-week.test.ts` (grid clamp, aim not prorated, heat/typical/periods, Week card days). The form test no longer asserts a whole-weeks refusal.
- **Driven** on a scratch library (`CENTRAL_COMMAND_HOME`), in the production build and in dev mode, light and dark: a one-day contract (today), a 10-day contract with today a day after its end (no Today card; the Sat after the end dimmed and not openable; Next week disabled on the last), an old file (26 weeks, no `end`) whose end was edited to 27 Oct in Settings (file now `weeks: 26, end: 2026-10-27`, Week 26 shows "23 Oct – 27 Oct", 5 days), and the new-contract row. Not driven in the UI: the timer's refusal on a day after the end (unit-tested); the Weeks chart tips and the Home figures with a partial week (covered by the unit tests only).
- **Seen, not mine:** the Week card's bar column runs past the card's right edge at a 1300px window with an aimed contract (the same on an old file); left as is.

## Contracts table: clients as chips (24 Oct 2026)

The user's review of Settings → Hours → Work: the edit row's clients stacked one chip per line (ugly), and the read-only row printed them as plain text.

- `ClientChips` (`hours/renderer/ClientsField.tsx`) draws the read-only clients as the same chips the edit row uses, without the ✕; the Clients column is 34% wide (was 22%) and the table's minimum 1120px (was 980px), so chips sit side by side and only "+ add" may wrap. The cell wraps (`white-space: normal`), so a row grows to hold its chips; the earlier "rows keep their height" note no longer holds for a long client list.
- Driven in the production build on a scratch library, dark mode (read-only and edit rows); dev mode and light mode not driven.

## Time card: no Stop, a cancellable Add time (24 Oct 2026, the user's review)

The task page's Time card (`TaskTimeActions`, also on a training note) read badly: a "Stop" button beside "Add time", a date field and a time field of different heights, and an "Add time" button above a form whose button said "Add", with no way out.

- **Start only.** The card offers Start when no timer is running and nothing when one is: the timer stops from the timer itself (top bar), so a second Stop here was noise.
- **One opener.** "Add time" opens the form and hides while it is open; the form has Add and Cancel (Escape also closes it).
- **One height.** The date field and `DurationField` are both 32px with 14px text (`TaskPage.module.css` `.dateInput`, `DurationField.module.css`); `DurationField` is shared, so Hours' forms get the same height.
- Typecheck, lint and tests pass; not driven in the app.

## SENSS Experimental Methods linked (25 Oct 2026, the user's request; applied 25 Oct 2026)

The ClickUp task "Complete SENSS Experimental Methods in the Social Sciences" and its four "Complete <training>" subtasks were connected to the series' four training notes (29 Jun, 2 Jul, 6 Jul, 9 Jul). An exercise in connecting and splitting, **never in changing the hours tracked** (the user's words).

- **The ClickUp tasks become the app's own training tasks:** same uids and ClickUp ids, renamed to the note's title (no "Complete "), dated on the note's date, marked `training`, linked by `task:`. The series task loses "Complete ". The five other subtasks were already in the trash and are left alone.
- **Self-study:** a `<series> self-study` task with one self-study subtask per training (named after it, due a week later, done), linked by `selfstudy:`.
- **Rules the user set:** the notes hold the right total, including self-study; no entry counts more than 3 hours; a training task holds its session; the rest is self-study. Only Field Experiments (15:00-19:00) had more: its note now ends at 18:00 and the hour is typed on its self-study task, so the training log stays 13:00 (3:00 each, plus 1:00 self-study on Field).
- **What ClickUp held** (read from ClickUp's own entries): Intro 3h on the day; Economic Games 0:45 on 2 Jul and 0:15 on 8 Jul; Field 2:45 on 9 Jul and 1:00 on 10 Jul; Randomisation 2:45 on 13 Jul. Mostly it was logged on later days, not the session day (6 Jul is leave, and Hours held nothing for it).
- **Hours:** each session is typed on its own day marked `earlier` (so `withDerived` does not add the note again), and the same minutes come off the days ClickUp logged them. Where ClickUp held less than the note (2:00 Economic Games, 0:15 Field, 0:15 Randomisation, 2:30 in all) the rest comes off the day's total named in `CLICKUP_TIME` (an estimate). Per day: 2 Jul +0:15, 6 Jul +4:00, 8 Jul -0:15, 10 Jul -1:00, 13 Jul -3:00; the Research total is 1533:00 before and after (the script refuses to run if it would change). Each training task's ClickUp figure (`earlier_minutes`, display only) was set to its session (3:00).
- `npm run link:senss-experimental [-- --apply]` (`src/modules/training/main/import/senss-experimental-link.ts`): dry run by default; backs up the database, the training notes and Research's hours, reads every file back, refuses a note that already has a task link. Dry run read line by line, `--apply` tried on a copy of the real library first. No unit tests (a one-off).
- **Applied to the real library on 25 Oct 2026** (backup `~/CentralCommand/backups/senss-experimental-2026-10-25T10-15-24-431Z`). A dry run now finds the notes already linked and refuses.

## A task's list is its client: no client pickers on task rows (25 Oct 2026, the user's review)

The user asked why a client dropdown sat beside a task already under that client's list (the running row in Today, the day rows in the Week card), and what the timer popover's picker and the task page's "Which client?" buttons were for. Work's top-level lists are exactly its clients (`docs/CLIENT_LISTS_PLAN.md`, enforced in the tasks store), so a task's list already says the client and a second control could only disagree with it.

- **Hours rows** (`TaskList`): the client select shows only for a row with no task (an older entry with a name). A row with a task shows its list on its second line and nothing to change.
- **Timer popover** (`TimerChip`): the client select is gone. A timer started without a task cannot stop until a task is picked, and the task decides the client.
- **"Which client?" buttons** (task page Start, the timer's task picker): gone. `clientForTask` (`hours/shared/start-picker.ts`) returns the task's list as the client where contracts have clients (none in Research), whether or not that client's contract is open today; it never falls back to another client (it used to take the only open client, or ask). The user: logging work in a list is allowed even when its contract has ended.
- **Not driven in the app**; typecheck, lint and tests pass. **Open:** Start puts the timer in a contract that holds today, so a list whose client belongs only to an ended contract is probably refused with "couldn't start" (`bad-client`); Add time, which picks the contract by date, is unaffected. Allowing Start there needs the timer store to accept it (which file the hours go in is the user's call).

## Time card: a dated hour shows under its month, not as "Earlier" (25 Oct 2026, the user's review)

A task with 2:15 of ClickUp time, all of it linked to October hours, showed "Earlier 2:15" and "Oct 2026 2:15" under a total of 2:15. The total was right (ClickUp's time already holds the linked hours, so `trackedByTask` counts them once), but the two lines read as a sum. The user: show the most specific time there is; "Earlier" only when the day is not known.

- `undatedEarlier` (`tasks/shared/tracked.ts`) is the task's `earlierMinutes` less the history marked `earlier` that Hours dates (ended sessions and typed time, the task's own, never below 0). The card's "Earlier" line shows that; `hoursByMonth` already listed the dated hours under their months. Earlier + months still equals the total.
- The total, `trackedByTask` and every other view of time are unchanged. Tests in `tracked.test.ts`; tests, lint and typecheck pass. **Not driven in the app.**

## Hours rows, picker and popover: the whole place and the due date (25 Oct 2026, the user's review)

A running task in Today showed "Impact" under its title, though it sits in the sublist "Historical Data Analysis"; search and Home already said `Impact › Historical Data Analysis`. The user: the second line is parent, list and due date.

- `detailOfTask` (`hours/shared/start-picker.ts`) returns `listLabel(list, sublist)` (a subtask: its parent's); a self-study task still says "Training · self-study". It feeds Hours' rows, the timer's picker and the popover, so all three name the whole place. `listOfTask` (the list alone, used to decide the client) is unchanged.
- **Hours' rows** (`TaskList`) also show the due date after the list (`formatDue`, as search: "Today", "28 Oct"), with the `↳ parent` first for a subtask. The picker and popover stay without a due date (`docs/SUBTASK_DISPLAY_PLAN.md`, section 1).
- Test in `start-picker.test.ts`; tests, lint and typecheck pass. **Not driven in the app.**

## Task lines (25 Oct 2026, `docs/TASK_LINE_PLAN.md`)

A consistency check of the second line of a task row found five differences; all agreed with the user and built in one go, one commit per stage.

- **One due wording** (`dueText`, `tasks/shared/query.ts`): `due today`, `due tomorrow`, `due 12 Nov` (the Mac's own day order; the year only when it is not this year). Hours rows, the timer picker and popover, Mod-K and Home's "Coming up" all use it; Home's "due in 2 days" is now the date.
- **One place decides whether a line shows a date** (`lineDue`, same file; `SubtaskLine`'s `due` prop replaces `rest`): none for a task with no date, a done one, or an **overdue** one. Rows with no chip of their own (Hours rows, picker, popover, search) show it; Home's Today (a section that says it) and the Tasks table do not.
- **Overdue shows `LateChip`, never a past date** (`TaskSecondLine`, `tasks/renderer/`, with `lateDays` in `late.ts`): now also in Hours rows, the picker and the popover (`PopoverHead.task`).
- **The `@` picker** (`detailOf`, `tasks/renderer/entities.ts`): `↳ Parent · list › sublist · Workspace` for a subtask, `list › sublist · Workspace` for any other task, a self-study task `Training · self-study`. The workspace stays because the picker always lists both workspaces. "Subtask of X" is gone.
- **One `detailOfTask`** (`tasks/shared/task-place.ts`; `hours/shared/start-picker.ts` re-exports it): search calls it instead of re-deriving; the task page uses `listLabel`. Home's SQL still builds its text with `listLabel`.
- Not changed: the `·` in `Subtasks · 2 of 5 done` and tooltips.
- Tests: `query.test.ts`, `SubtaskLine.test.ts`, `TaskSecondLine.test.ts`, `entities.test.ts`, `timer-popover.test.ts`. Mutation checks: dropping the overdue rule, changing "due today" and moving "tomorrow" each fail tests.
- **Driven** (scratch library, production build light and dark, dev mode light and dark): Home, Hours rows (today, tomorrow, future, overdue, subtask, overdue subtask, other year, done), the timer picker typed, Mod-K, the `@` picker. **Not seen:** the popover with a late chip — starting a task gives it today's date (the polish round's rule), so a running task is never overdue; the popover shares `TaskSecondLine` with the rows.

## Training and Meetings lists: fewer columns (25 Oct 2026, the user's review)

- **Training list** (`TrainingTable`): Format, Type and the summary are gone; the columns are Date, Time, Duration, Series, Title, Skills, Leads (Life's log: no Skills) and Title takes 45% of the width. **Meetings list** (`MeetingsTable`): Format is gone. The format and type are still set on the note.
- **Applied to the real library on 25 Oct 2026 (the user's request, by hand, app closed):** `meetings/research/2026-10-13 Other.md` now ends at 13:15 (was 13:05), and 10 minutes came off the stored time of "Help coordinate and run CastlesFest" on 13 Oct in `time/research/2026-27.json` (session `b2dec229`, 15 to 5 minutes; times of day untouched).

## One-line tables and one tooltip (25 Oct 2026, `docs/ONE_LINE_TABLES_PLAN.md`)

The Training and Meetings tables had grown second lines (the "Upcoming" pill under the date, long titles wrapping, stacked skills), and tooltips were a mix of the native `title` attribute and `IconButton`'s own CSS tip. All agreed with the user after mockups (`docs/design/one-line-tables-mockup.html`: A1 group headers, C1 icons after the title) and built in one unattended run, one commit per stage.

- **One `Tooltip`** (`components/Tooltip.tsx`, geometry in `tooltip-place.ts`): wraps one element with a `display: contents` span (no box, so layout is untouched), draws the tip in a fixed layer on `document.body` (no `overflow` ancestor clips it, which the tables' scroll container would have), shows it 350 ms after hover or on keyboard focus (`:focus-visible` only, so not after a click), hides on leaving, mouse-down, scroll, Escape and blur, flips above when there is no room below and is kept 8px inside the window, and sets `aria-describedby` on the wrapped element while shown. `whenCut` shows it only when the wrapped element's `scrollWidth > clientWidth`; empty text or `disabled` shows nothing. Chromium (Electron) fires `mouseover` on disabled buttons, so a tip explaining why a button is disabled (Stop with no task, a locked task's status) works; checked in the built app.
- **`IconButton` uses it**; its own CSS tip is deleted. `CutText` (one line, ellipsis, tooltip when cut) is the cell text for the two tables.
- **Every native `title=` tooltip in `src/` became `Tooltip`** (about 45 elements, a script wrapped the DOM ones, the rest by hand; one commit for the shared components and one per module folder). Kept as they are: `title` props that are headings (`LandingHeader`, `Dialog`, `DeleteTimeDialog`, `HoursStrip`, `Landing` cards), `ExportButton`'s and `Picker`'s `title` props (their own names for the tip text, now handed to `Tooltip`). **ESLint `no-restricted-syntax`** rejects a `title` attribute on a DOM element and on `Button`, so a new native tooltip fails the lint. Tips that only repeat visible text and can be cut (Readings' title and tags cells, the picker's "Create …" row, a card's extra line, a picker's add row) use `whenCut`; the timer chip's task name does not (its button is not the clipped element).
- **"Upcoming" is the only word; "No date yet" is "No date"** everywhere (both tables, the landings' cards, search, the person page, headings, `meetingHeading`).
- **Group headers** (`shared/upcoming-groups.ts`: `groupByUpcoming`, and `layoutRows` for the table's order and offsets; `components/GroupRow.tsx`): an "Upcoming" header (undated first, then the rest in the list's order), then "Earlier"; a group with no rows has no header. A header is a `<th scope="rowgroup">` in the same `<tbody>`, not a keyboard row (`useRowNavigation` is given the flattened data rows only, so arrows, Home and End skip it). The tables take `grouped` (default true): there is no sort control on either list yet, so they always show newest first, and the headers must go under any other sort (the separate ROADMAP item "Sorting consistency").
- **One line per row**: `ListTable.module.css` is the one stylesheet for both (the Meetings one is deleted; Training keeps only its title line). Fixed table layout with a `<colgroup>`: Date 128, Time 124, Duration 130 (100 in Meetings), Series 200, Skills 190, Leads/Attendees 188, the title or summary takes the rest; `min-width: 1100px`, scrolling sideways when narrower. Every data cell is 48px high and `nowrap` with an ellipsis, so every row is the same height whatever it holds. Series is capped by its column (200px, about 24 characters; the plan said about 28ch, but a fixed layout needs a width that leaves the title room), with a tooltip when cut.
- **Icons after the title** (C1): the title text ellipsises and the folder and notes icons (`flex: none`) follow it, each with a tooltip ("Linked folder", "Has notes"). **Skills: one chip and a muted `+N`** (`SkillChips limit`, replaces `stacked`; the chip ellipsises with a tooltip, the `+N` tooltip lists the rest). **Leads and attendees** are `InitialsChips`: three initials (full name as the tip) and a `+N` whose tip lists the others.
- Tests: `Tooltip.test.ts` (hover, focus-visible, Escape, scroll, disabled, whenCut, placement), `SkillChips.test.ts`, `upcoming-groups.test.ts`. Mutation checks: `whenCut` removed, Escape's key changed (each fails a Tooltip test), undated-first removed, the `earlier` filter inverted (each fails a grouping test).
- **Driven** (scratch library of copied notes plus a very long title and series, four skills, four leads, an undated and an upcoming row; production build light, dev mode dark, Research training, Research meetings, Work meetings): every data row 48px; tips on the cut title, series and summary, the initials chips, a leads `+N`, a skills `+N`, the folder icon, an `IconButton` (hover and Tab); a tip near the right and left window edges and over the table's scroll container; a tip hides on scroll and on the table's own sideways scroll; arrows, Home and Up skip the headers; a 900px window scrolls sideways with the same row height. Spot-checked Tasks (status, delete, priority tips), Readings (cut title tip, none on an uncut cell) and Hours. **Not driven in the app:** the flip above at the bottom edge (unit test of `placeTip` only), light mode in dev, and the Life training table (same component, no Skills column).

## Filter row: selects capped, row on one line (25 Oct 2026, the user's review)

The Training filter row broke onto two lines because the "All series" select was as wide as the longest series name. `FilterRow` sets `--field-max: 200px`, which `Picker`'s root reads as its `max-width` (a `Picker` outside a filter row keeps `100%`), and the row is `nowrap` with each child `flex: 0 1 auto; min-width: 0`: a select is as wide as its value, at most 200px, and shrinks (ellipsis) before the row wraps. The search box is left alone (it grows to 240px on focus). Applies to every list that uses `FilterRow` (Training, Meetings, Tasks, Notes, Reading lists). Not driven in the app; typecheck and Prettier only.

## Tooltips for every cut text (25 Oct 2026, the user's review)

Home's task rows ellipsised a long title with no tip. Audit: every class with `text-overflow: ellipsis` was checked for a `Tooltip` (`whenCut`) or `CutText` around it. Added to: Home's `Row` titles (`titleText`), `SubtaskLine` (parent and plain line), a locked task's title in the Tasks table, Tasks settings' deleted list, Mod-K titles and details, the `@` picker, "Mentioned in", Readings' short citation and the board's title and tags, Landing's card line and row note. `isCut` also counts a vertical cut (`scrollHeight > clientHeight + 1`), for the board's two-line clamped title. **Left without a tip:** Contracts' and Years' row-header cells (the ellipsis is on the `th` itself), `ModifierChip` and `CompletionList` labels, `Picker`'s value, the toast, and the editable task title (a tip would sit over the field being typed in). Typecheck, lint and tests pass; not driven in the app.

## Add a subtask on a task page (25 Oct 2026, the user's review)

The "+ Add a subtask" row looked wrong on a task page: a rounded box inside the panel, a hover tint that stopped short, and the text pushed in. Two causes. `.tableFlat` (no border, radius or background) was declared before `.table` in `TasksTable.module.css`, so `.table` overrode it; it now comes after. And the flat table has 4 columns while the add row spanned 3 (`span` was 3, not 4). On a task page the row is now one cell across all 4 columns, flush left (the user's call); in the main Tasks table it keeps its empty first cell so the text lines up under the parent's title. A CSS rule meant to override another must come after it.

## Outline as a rail (25 Oct 2026, the user's review; `docs/OUTLINE_RAIL_PLAN.md`; stages 1 and 2 built)

The outline card beside Files on the Training entry page was squished (170px, wrapped headings) and idle with few headings. Mockup `docs/design/outline-options-mockup.html`, six options; the user chose **E**: a hairline rail (no card) **above** Files in the one 260px side column, listing the top headings only, with the `###`s of the section being read unfolded and an accent line on the current heading. Not chosen: A (as it was), B/C (full rail, hidden below four headings), D (chips above the text), F (a VS Code-style breadcrumb bar over the text; the user liked the idea, but E first). `roomySide` goes. Applies to every page that uses `NoteOutline` (Training entry and plan, Notes, Readings). Two stages, in the plan.

**Stage 1 built (25 Oct 2026).** `NoteOutline` is a rail: `Panel` has a `bare` variant (no card, same small-caps label), the headings sit under a 2px `--border-soft` line on the left, and the heading being read has an `--accent` line, `--ink` and bold (no filled background). All headings are still listed. `roomySide` is removed from `DocSplit` (prop, CSS, test, the one use); the Training entry's side column is one 260px column, outline above Files. A rail item must not be pulled outside its box (a `margin-left: -2px` let the focus ring spill past the side column's 4px padding and it was cut). Driven in a scratch library (production build and dev mode, light and dark, 1500px and 1000px; Training entries with 1, 3 and 9 headings, typing a new `##`, Notes, Readings); the Training plan page was not driven (no plan in the scratch library; same component and column).

**Stage 2 built (25 Oct 2026).** `visibleOutline(outline, current)` in `src/shared/markdown-outline.ts` (pure, unit-tested) returns the indexes to draw, each with `holdsCurrent`. Top headings are `#`/`##` (and a `###` with no `#`/`##` above it); a `###` is drawn only while the heading being read is its section's top heading or one of that section's `###`s. The indexes are into the full outline, so `current` (from `currentIndex`, unchanged: no new scroll tracking) still resolves against it. The top heading holding the one being read is `--ink` with a `--border-strong` rule (`.holds`); the current heading keeps its accent line and `aria-current="location"`; a `###` is muted. A folded `###` is not rendered, so it is neither a tab stop nor a button in the DOM. Mutation check: drawing every section makes 8 tests fail. Driven in a scratch library (now with a Training plan): production build and dev mode, light and dark, 1500px and 1000px; Training entries with 1, 3 and 9 headings (scrolling follows and unfolds, click a heading, a typed `##`/`###` appears live), the Training plan (its numbered `###`s unfold under "Priority N"), Notes, and Readings (empty outline); the Tab ring on a rail entry is not clipped. A heading far below the reading line stays the "current" one until scrolled to, as in stage 1.

**No empty state (25 Oct 2026, the user: "this is unnecessary").** A note with no headings shows no outline at all: `NoteOutline` returns `null` (no label, no "Headings you write appear here."), and the panel appears with the first heading typed. Unit-tested (no `<nav>`, no text); lint, typecheck and the suite pass; not driven in the app.

## Note text fills its column (25 Oct 2026, the user's review)

On a wide window the text card stopped at 780px and the outline sat at the far right, leaving a wide empty band between them. The user chose to let the text grow (over moving the outline against the card, or a wider cap of about 1000px). `DocSplit` no longer caps the document and its `fullWidth` prop is gone (the Training entry and plan, the only users, passed it already); Notes, Meetings, Readings and Work notes now fill the column too, with the side column at the right edge. This replaces the 780px line length recorded for `DocSplit` above, and closes the ROADMAP item "Plan text width". Typecheck, lint and the suite pass; not driven in the app.

## Luminos meetings: times, topics and their own tasks (25 Oct 2026, the user's request; applied to the real library)

The 14 Impact meetings of the oldest Work contract (Luminos, 1 Oct 2025 – 31 Mar 2026, 208 h) pointed at broader imported tasks ("Meeting with Matthew, synthesizing notes, …"), not meeting tasks: no marker, no times in the notes, so their hours lived only as `earlier` adjusts in `time/work/2025-10-01.json` and in the tasks' `earlier_minutes`. `npm run luminos:meetings [-- --apply]` (`scripts/luminos-meetings.mts`; dry run on a throwaway copy, `--out <dir>` writes the proposed notes, refuses to write unless the contract total is unchanged, backs up notes, database and contract file to `backups/luminos-meetings-<time>/`) did, from the user's per-meeting start and end times:

- **Notes:** `start`, `end`, `mode: online`, `discussed` (every topic) and `task:` set; bold titles (5 notes) and top-level bullets (7 notes, the user's yes) became `###` topics, sub-points moved up one level; 12 Mar keeps its one `## Topic` (its bullets are decisions); 19 TODO full stops removed (6 Oct, 17 Nov, 1 Dec, 19 Dec).
- **Tasks:** one "Impact meetings" series task (list Impact; Done, due 12 Mar 2026, the last meeting) with 14 `own_kind = meeting` subtasks "Impact meetings · <date>", Done. The old tasks are renamed "Meeting preparation and follow-up". They are the user's, not locked.
- **Time:** the meeting's minutes left the old task's adjust on that date and its `earlier_minutes`; the note's times now derive the meeting's hours. Contract total 12,480 min before and after. 3 Nov (45 min meeting, 30 min logged) took the other 15 min from the 4 Nov 09:00 meeting's broader task (the user chose it). 9 Feb and 19 Feb left their old tasks with no time that day. Prep time on other days stayed.

The 2026-05-01 contract's Impact meetings were not touched. A later meeting marked `task: auto` joins the open "Impact meetings" series task only while it is open (it is Done now).

## Series tasks are named "<series> meetings" everywhere (25 Oct 2026, the user's rule)

The user asked why "Impact meetings" had "meetings" and "Document Automation – Vecten" did not: the old rule (`proposeMeetingTask`) added it only for a Work series that is a client. **One rule now, in every workspace: the series task is "`<series>` meetings"** ("Supervision meetings", "Rastle Lab meetings", "Document Automation – Vecten meetings"); the catch-all "Other" is "Other meetings" (was "Meetings"); a name that already ends in "meetings" is kept. Only the list differs (Research: "Meetings"; Work: the client's list, or Teaching & Learning for a series that is no client). The meeting subtask follows ("Supervision meetings · 12 Oct 2026"). Commit `abb0409`. This supersedes the naming in "tasks are generic and named by series" above.

## Luminos meetings, second contract (25 Oct 2026, the user's request; applied to the real library)

The 8 meetings of the second Work contract (Luminos, 1 May – 31 Oct 2026) got the same treatment as the first (`npm run luminos:meetings-2 [-- --apply]`, `scripts/luminos-meetings-2.mts`, a copy of the first script; backups in `backups/luminos-meetings-2-<time>/`). Do not re-run either.

- **Series tasks: new, never reopened (the user's rule: do not reopen tasks of old contracts), one per note series.** "Impact meetings" (Impact › Admin & Logistics; 21 May, 4 Jun, 18 Jun, 9 Jul; due 9 Jul), "Document Automation – Luminos meetings" (3 Jul, 5 Oct), "– Vecten meetings" (29 Sep), "– Other meetings" (30 Sep), the last three in Teaching & Learning (no sublist). All Done; each meeting has an `own_kind = meeting` subtask, Done, due on its date. The first contract's "Impact meetings" (14 subtasks, due 12 Mar 2026) is untouched, so two tasks share that title; only the new one is in Admin & Logistics.
- **Times (the user's):** 21 May 11:00–12:00, 4 Jun 11:00–11:45, 18 Jun 12:30–13:00, 3 Jul 10:00–11:00, 9 Jul 11:00–11:30. 29 Sep, 30 Sep and 5 Oct already had times; they got meeting tasks too, and their minutes (60, 75, 60) moved off the broader tasks so nothing counts twice (`withDerived` skips a note's time only while an `earlier` adjust of the same task and day holds it, so a note linked to a new task must give its minutes up).
- **Topics:** 21 May and 4 Jun have `##` topics (nothing to convert); the others already had `###`. All ticked, format Online, no TODO ended in a full stop. 29 Sep's `discussed` list is now in heading order.
- **Time:** every meeting fit its task's minutes that day (4 Jun was first given 11:00–12:00 and was 15 min short; the user shortened it). 3 Jul took its 60 min from the 105-min "Meeting with Neha" adjust (45 stay). Contract total 7,035 min before and after.
- **Renamed:** the broader tasks to "Meeting preparation and follow-up", except `bvq7fmsz` (the prep of the 29 and 30 Sep interviews), "Document automation: developer interview follow-ups". Research's three series tasks and their six subtasks were renamed to the rule above in the same run.
- **After applying:** the app's meetings index still lacks the new `task:` links until the app opens and re-reads the notes, so `repair:session-tasks` lists the 8 new subtasks as orphans in the meantime (it only trashes with `--apply`): open the app before running it.

## Home's Today: a subtask sits under its task, drawn as in the Tasks table (26 Oct 2026, the user's review)

A subtask in Home's "Today" read `↳ parent · list` under its own title and sorted by urgency, so it could come before its parent. It now looks like the Tasks table (the user's rule: reuse the existing design, no new look): **the task is a normal Home row, its due subtasks hang under it** on the table's darker band (`color-mix(in srgb, var(--bg) 35%, var(--surface))`), off a 2px `--border-strong` rail from the parent's status circle with an elbow into each (`.kid`, `.end`, `.hasKids` in `Home.module.css`, copied from `TasksTable.module.css`), 13px, title only (the list is the parent's). `groupTasks` (`home-model.ts`) groups them; a group sits where its task is. **A parent that is not due is the same row as any other** (its own status circle, list and priority, read by `collect.ts` as `parentStatus`/`parentPriority`; no muted heading, no second look). `HomeTask` gained `parentUid`, `parentStatus`, `parentPriority` (null for a self-study task, which shows as its training). Only the Today card changed: Coming up and search keep the `↳` line. Unit-tested (`groupTasks`); driven in the built app on a scratch library (light mode; dark mode and dev mode not looked at). The first version (muted heading, indent only) was installed and rejected the same day.

## Home's Coming up: grouped like Today, parents name their date, the day moves to the second line (26 Oct 2026, the user's review)

Three changes, reusing what Today already has (the user's rule: no new look). **(1)** Coming up groups tasks as Today does: a task is a normal row with its due subtasks hung under it, and a parent not due in the window is a normal row of its own. `HomeEvent.task` gained `parentUid`, `parentStatus`, `parentPriority`, `parentDue` (`collect.ts` reads `parentDue`; null for a self-study task); `comingUpItems` (`home-model.ts`) turns a task's event into a `HomeTask` and calls the same `groupTasks` (which now takes today's date), `TaskGroupRows` draws both cards; a group sits where its first task is, meetings, trainings and days off stay as they are. **(2)** A parent row that is not itself due in its section says its date through `lineDue`/`dueText` ("Thesis · due 20 Nov"; no date when it has none; an overdue parent has `daysLate` and shows `LateChip`, never a past date). A head in Coming up says its date as before; a head in Today none. Subtasks show title only. **(3)** An event's day moved from the right to the end of the second line: "Training · In person · in 2 days", "Meeting · with AB · tomorrow", time range alone at the right (`whenLabel(time, end)`, `dayLabel(inDays)`, `eventDetail`); an all-day item with no other detail reads "In 3 days". This was the user's request read as "relative day on the second line, time at the right", applied without asking. Unit-tested; driven in the built app on a scratch library (light and dark). Dev mode not driven.

## A duplicate "AI Agents for Research self-study" series task merged (26 Oct 2026)

The real library had two series tasks of that name (made 5 ms apart on 23 Oct 2026, one holding Day 1, the other Day 2; the self-study sweep refuses to overlap itself in one process, so the likeliest cause is two app instances on the library at once). Applied by hand with SQL, app closed, after a copy on the scratchpad (backup `~/CentralCommand/backups/ai-agents-series-2026-10-26T09-20-*`): Day 2 (`vhhsvjgb`) moved under the first series task (`wu9afraf`), whose due date became Day 2's (30 Sep, the rule for series tasks); the emptied duplicate (`x8d2p58c`) is in the trash (Settings → Tasks → Restore). No hours or notes named it. A check of every series self-study title found no other duplicate. `repair:session-tasks` does not look for duplicate series tasks.

## Home shows a self-study task as its training, never under its series task (26 Oct 2026, the user's choice)

Two options were put to the user: (A) always show the parent, so a self-study task is "Day 2" under its series task, or (B) show only the subtask, named as its training ("Series: Day 2", cap icon), and never the series task. **B.** Home's task lists (Today, Coming up, Overdue) leave out the series task over self-study tasks (`studySeriesUids`, `tasks/shared/session-lock.ts`, used by `collectHomeSummary`); the self-study tasks keep having no parent in the summary, so they are single rows. Every other task view, search and the timer still show the series task (`hiddenTaskUids` is unchanged: time can be put on it). A first attempt at A (parent kept in the summary) was never committed. The series task already closes by itself: `seriesChanges` gives it the latest subtask's date and marks it Done once all its subtasks are, and a self-study subtask closes at its own due moment, so the container closes on the date of the last subtask (no change made). Unit-tested and mutation-checked (without the exclusion the collect test fails); not yet driven in the app.

## Watch: the page, the sources and what they replace (26 Oct 2026, the user's plan `docs/WATCH_UI_PLAN.md`; built unattended in one run, stages 1 to 5)

The user's decisions (the plan) were followed as written; what was decided on the way is below. Code: `src/modules/watch/` (`index.ts` manifest, `renderer/`, `shared/rows.ts`, `shared/query.ts`).

- **Two kinds.** `shownKind` maps `summer-school` to training; `journal`, `listing`, `other` are in neither section (kept in the data, not shown). Migration `watch/0002_two_kinds` turns stored summer schools into trainings (the CHECK in 0001 still lists the old kinds; it was not edited). `kindOfReminder` (the import) now says `training` for a summer school.
- **Items.** `listItems` takes `state: 'undismissed'` (all but dismissed) and a shown `kind` takes in its stored kinds. Order: unseen first, then the day found, then the day published (the keyword score no longer orders: keywords are not in the UI). `items.open(id)` (IPC `watch:items-open`) is the first look: a new item becomes seen; saved and dismissed ones are left alone. The Watch page calls it when a row is opened in the browser.
- **Saved-only rule.** `upcoming()` (repository) reads only `saved` items, and `buildHomeSummary` keeps only `saved` ones again, so an unsaved item never reaches Coming up or a notification. Mutation-checked: loosening either filter fails a test (`checker.test.ts` "lists only SAVED items…", `summary.test.ts` "…(unsaved items never)"); `collect.test.ts` checks it through the database.
- **A source can change address** (`updateSource` takes `url`): validated and unique; a new address forgets the old hash, validators and failures so its first good check is a fresh baseline. The dialog's "method" is not asked: a feed-looking address (`.xml`, `.rss`, `/feed`, `/rss`) is a feed, anything else a page (`guessMethod`). Editing keeps the source's method.
- **The page** (`/research/watch`, Research only; a card on Research's landing): header (`Sources` link, `Check now`), Saved (only when something is saved; sorted by deadline; "Their deadlines show in Home's Coming up"), Trainings, Conferences (the newest 8 unsaved items each; "See all trainings →"). Rows are the landing's recent rows widened to five columns (`WatchList.module.css` composes `Landing.module.css`); the title link is stretched over the row and the two icon buttons (bookmark, X) sit above it. Dismiss shows the app's toast with Undo. No sources: "Nothing watched yet" and an `Add source` link to Settings → Watch. `Sources` opens Settings on the Watch tab through router state (`state={{ settingsTab: 'watch' }}`, read by `SettingsPage` for that visit only).
- **See all trainings / conferences** (`/research/watch/trainings`, `/conferences`): `FilterRow` with search, source and state (`Not dismissed` / New / Saved / Dismissed), the Training table's shape (`ListTable.module.css`, one 48px line, one tab stop), `New` above `Earlier` in the default view only. A dismissed item has a Restore button (it becomes seen). Search and filters are remembered per kind (`useModuleState('watch-training')`).
- **Settings → Watch**: a plain table (Source with its address under it, Kind, Last checked), a row opens the dialog (name, address, kind; Remove with a confirmation that says how many items go). Only a failing source says so ("Can't open: 3 tries", danger colour, the error as a tooltip). Suggestions are only LINGUIST List's three feeds (conferences, calls, summer schools); the journal and Crossref suggestions moved to `JOURNAL_SUGGESTIONS` (not offered) until the journals question is answered. A new source is checked at once (it exists, so a request is allowed). The **by-hand lines** (Royal Holloway intranet, Essex Box folder: cannot be opened; Researcher Development Programme, SEDarc (Inkpath): no address) are the fixed list `shared/by-hand.ts`.
- **Notifications** have their own switches in Settings → Watch, because the master `home.notifications.enabled` has no screen and switching it on would also turn on the 08:30 digest and meeting reminders: `watchNew` (new items, one grouped notification) and `watchSavedDays` (a saved item's deadline N days before: off, 1, 3, 7, 14). Both are off by default and work without the master; the digest, meeting and timer rules still need it. The old `watchRelevant` and `watchDeadlineDays` are gone: the real settings file held `watchDeadlineDays: 7` as a default, which would have switched the new reminders on, so the new key `watchSavedDays` starts at 0. `HomeSummary.watch.relevant` is now `fresh` (every new item, 50 at most); the widget's `watchNew` counts all new items.
- **Settings → Watch is the sources only (26 Oct 2026, the user's call after seeing the page).** The suggestions (LINGUIST List's feeds), the "By hand" list and the two notification switches are removed: the user adds data themselves ("I said don't add any data"), makes a task for what is checked by hand, and notifications are not built yet. Deleted: `shared/suggestions.ts` (with `JOURNAL_SUGGESTIONS`), `shared/by-hand.ts`, the `watch:sources-suggestions` channel and `window.api.watch.sources.suggestions`. Kept: the `watchNew`/`watchSavedDays` settings values (off, no screen; the notifier reads them) and the `WatchSuggestion` type (`watch:from-tasks` uses it). Supersedes the Suggestions and Notifications lines above.
- **Home**: a saved item with a date within Coming up's 3 days is a row (bookmark icon, "Conference · LINGUIST List: conferences · in 2 days") that opens the Watch page (`homeView` maps its route; the notification still opens the item's own address). Only Research's Home shows it.
- **Not done, by plan**: keywords UI, journals list, `in:watch` search, the Swift widget, quiet hours, a monthly reminder. `watch:from-tasks` was only dry-run on the real library (16 addresses, in the report of 26 Oct 2026); `--apply` waits for the user.
- **Watch polish (26 Oct 2026, the user's screenshots).** An empty section is one muted line ("Nothing new in trainings"), not a centred heading and message. A row's title is shown by `displayTitle` (`shared/rows.ts`): no closing full stop and no "Local Organiser: <one or two capitalised words>" in front of an all-caps acronym (a display rule; stored titles are unchanged). No "Every" choice: the dialog and the sources table lost it, every source is checked once a day (`intervalHours: 24`, also written when an old source is saved); `EVERY_OPTIONS` and `everyLabel` are deleted. The sources table lost the wrapper's 4px inset so it lines up with its label. Open: the gap to the right of "Add source" in the card was seen but its cause not found.

- **Watch: the event's date in its own column (26 Oct 2026, the user's request).** Titles such as "EPS Meeting: Cardiff University. 7th – 9th April 2027" ended with the event's date, which made rows hard to scan. `splitTrailingDate` (`shared/dates.ts`) and `titleParts` (`shared/rows.ts`) take a date at the very end of the title off it and give it as a short phrase ("7–9 April 2027", ordinals dropped); the landing list and the "See all" table show it in a **When** column between the title and the source. A title with no date at the end is shown whole and its When cell is empty. Display only: the stored title and `date`/`dateKind` (the deadline logic) are unchanged. Not driven in the app (unit-tested).

## Watch: a listing's cards carry their own dates (26 Oct 2026)

The National Literacy Trust's events page showed items with no date and "fake" ones. Cause: a page source stored each link bare, and `datedSentences` cut sentences from the whole page text, which run across cards ("View details about X Event Y 16 Nov 2026"). Now `parsePage` gives a link the text of its own `<li>`/`<article>` card (when the card holds one link), so its date is found and the page's sentences are not used when any card is dated; stale `text:` items of such a source (not saved) are removed on the next check, and bare items are completed in place. A course on a conference listing (CPD, masterclass, webinar, workshop, briefing, course, training) is a training: `watch_items.item_kind` (migration `watch/0003_item_kind`, null = the source's kind), `itemKind` in `shared/types.ts`. Takes effect on the next check of the source; the real library was not touched.

## Watch: no note beside Saved (26 Oct 2026, the user's screenshot: "completely unnecessary")

The Saved section no longer says "Their deadlines show in Home's Coming up" (`WatchPage.tsx`; the `aside` and the `landing` import are gone). The rule itself is unchanged: only saved items' deadlines reach Coming up and notifications. Supersedes that sentence in "Watch: the page, the sources and what they replace".

## People pickers reload the list when they open (26 Oct 2026, a bug the user found)

A person made with `@` while writing a training note was missing from the Leads picker (it offered "Add …" instead): the Training and Meeting pages read the people list once, on opening. `PeopleField` now takes `onOpen`, and both pages reload the list each time the picker opens (`onOpenPeople` on `MetaFields` and `TrainingMetaFields`). No event channel for people changes was added; reloading on open is enough because the list is only read there. Not driven in a scratch library.

## Training details: Series, Type and Institution share the first line (26 Oct 2026, the user's screenshot)

With Series stretched to about 700px the Skills field jumped to a new line at full width. The details row now runs Date, Start, End, Duration, Series, Type, Institution, then Format, Leads and Skills; Series, Type and Institution are a fixed 220px each (`TrainingMetaFields.module.css`), so the first line holds them at 1500px and the row wraps between fields, never inside one. Driven in a scratch library (production build, 1500px and 1000px); dev mode not driven.

Follow-up the same day (the user's screenshot): fixed 220px left the first line short of the card's right edge. Series, Type and Institution now grow (`flex: 1 1 220px`, `min-width: 220px`, the picker `width: 100%`), so the line ends at the same margin as it starts; the second line (Format, Leads, Skills) keeps its own widths. Not driven in a scratch library.

## Training details: the Open task icon sits inside the Duration box (26 Oct 2026, the user's screenshot)

The icon that opens the training's own task was a flex item of its own beside Duration, so it floated wherever the row wrapped and spaced it. It is now inside the Duration box at the right edge (`TrainingMetaFields.tsx`, `.calc` is a flex row; the button is 24px with a negative margin so the box keeps its height), because the task is the session and the session is what has that duration. Options weighed with HTML mockups: on the Duration label, beside the title, a labelled Task field like Meetings'; the user chose inside the box. Typecheck, lint and tests pass; not driven in a scratch library.

## Training files: any folder, no Trainings folder setting (26 Oct 2026, the user's call)

The Files panel refused a folder outside the Trainings folder setting ("Choose a folder inside the Trainings folder"), and that folder is for Uni only. The setting is gone from Settings → Training and the panel asks for nothing before "Link a folder…".

- **A link is an absolute path** (`folder: /Users/…/Slides/Day 1`). `isSafeFolder` refuses `..`, control characters and `~`; `folderPath`, `resolveInside` and `listFolder` (`training/main/files.ts`) take the linked folder as the root of what is listed, opened or shown in Finder, so `..`, a link leading out of the linked folder and a sub-path outside it are still refused (mutation-checked). Files that run code are still never opened. The `filesToRelative` channel and `relativeToRoot` are removed: the picked path is the link.
- **Old links were rewritten the same day** (`npm run repair:training-folders [-- --apply]`, applied 26 Oct 2026: 69 notes, only the `folder:` line, each backed up to `~/CentralCommand/backups/repair-training-folders-<time>/`; all 69 folders were on disk; a dry run now finds nothing, do not re-run). `trainingsFolder` is removed from `Settings`, the code and `settings.json`; a relative `folder:` now reads as "not there". `import:training` writes absolute paths too (not re-run).
- **Following a move** keeps working, but only near the old place: the search is in the folder that held the link (3 levels, 5,000 folders), by remembered identity or a unique name, and the new absolute path is saved as the link. The old `training_folder_memory` rows (keyed by the relative path) are never read again; the table fills with absolute paths as folders are listed.
- Not driven in the app: the folder dialog is native. Unit tests cover listing, opening, escapes and following moves.

## Segmented: the end corners are found through the Tooltip's wrapper (26 Oct 2026, the user's screenshot: "the highlight looks all weird")

Each segment sits in `Tooltip`'s wrapper, so `:first-child` and `:last-child` matched every button and the last-child corners won everywhere: the selected pill had the wrong corners. The rules are now `.group > :first-child > .segment` and `.group > :last-child > .segment`.

## Self-study tasks for Life trainings (26 Oct 2026)

The self-study sweep (`settleSelfStudyTasks`) was hard-coded to Research, so a Life training (Urdu lessons) never got its task and showed nothing in Home. It now visits Research and Life, each in its own workspace's tasks, and reports the workspaces that changed. The "made in the app" rule is unchanged: a Life entry whose `task:` is not `auto` (or a `training`-marked task) is still left for the user to map by hand.

Backfill (26 Oct 2026, the user's word that Lesson 1 was made in the app): `npm run backfill:life-self-study -- --apply` made "Urdu Beginners 1 self-study" and its "Lesson 1" subtask (due 22 Oct) and wrote `selfstudy:` into the note; backup in `backups/life-self-study-*`. A dry run now finds nothing. The sweep's rule for new entries is unchanged (`adopt` is used only by this script).

## Life trainings show the Self-study card (26 Oct 2026, the user's screenshot: "still doesn't have the self study bit")

The backfill had made Lesson 1's self-study task and linked it in the note, but the entry page drew the Self-study card (`TrainingTask`, `TrainingHours`: hours, Start, Add time, open-task icon) only for `research && meta.task`, and Life entries have no session task. The card, its tasks list, `useSelfStudy`, `useTaskTime`, `makeSelfStudyTask`, `syncSelfStudyTask` and `draftSelfStudyTask` all read `'research'`.

- The entry's workspace is passed through (each takes `workspace`, default `'research'`, so Research is unchanged). `TrainingTask` has `sessionTask` (false for Life): no "Making the task…" or "The task was deleted." states, only the Self-study card. `TrainingHours` for Life has no `own` check and no hours line.
- Driven (production build, scratch library, Life entry with no `selfstudy:`): the card shows, Add time makes the Life self-study task, writes `selfstudy:` into the note, and the time lands in Life's year file against it. Dev mode and dark mode not driven.

## Panel icon actions are 28px, so the card does not grow (26 Oct 2026, the user's screenshot: "the height of the component changed visibly")

The Self-study card's open-task icon only exists once the self-study task is made (first Start or Add time). `IconButton` defaults to 36px, but a `Panel` head is `min-height: 28px`, so the icon's arrival made the card taller. `Panel`'s `.actions` now sets `--icon-button-size: 28px` (the height the head's comment already named), so an icon in any panel's head fits the head. Every Panel with icon actions shrinks from 36px to 28px with it; a module that sets its own size on the button's element still wins. Not driven in the app (CSS only; tests, lint and typecheck run).

## Pickers: the arrows wrap at the ends (26 Oct 2026, the user's report: "tried to go down with arrows and that didn't seem to be working")

In the attendees' "+ add" list, typing a search leaves the highlight on the "Add “…”" row, the last one (with several matches the Add row is the default, as the group field has always done). Arrow Down stopped at the last row, so it did nothing, and the list looked as if the arrows were dead. Driven first (production build, scratch library): the arrows did move the highlight, from the Add row up and back; only Down from the last row was a dead key.

- `PickerPopup` (`Picker.tsx`, so every picker, `PeopleField`, `SkillsField`, `ClientsField` and `Select` included): Down on the last row goes to the first, Up on the first goes to the last. Up from no highlight went to the last row already.
- The default stays the Add row: starting on the first match would let Enter take a similar existing name instead of adding the typed one. The user can ask for that instead.
- Test: `Picker.test.ts`, "the arrows wrap at the ends". Not driven again in the app after the change.

## Urdu and Arabic text always uses Geeza Pro (26 Oct 2026, the user's screenshot: "fonts differ; I want Urdu to be in that lower font always")

One note showed Urdu in two looks, both outside any table. The app's fonts have no Arabic-script glyphs, so macOS picks a fallback per run, and it picks by character: plain letters (`ی` U+06CC and the rest of U+0600 to U+06FF) get Noto Nastaliq Urdu; Arabic presentation forms (U+FB50 to U+FEFF, what copying from a PDF or website gives) get Geeza Pro. Found with `CTFontCreateForString`, not guessed. The user wanted the Geeza Pro look.

- `base.css` defines `@font-face 'Arabic Script'` as `local('Geeza Pro')` with a `unicode-range` of the Arabic blocks (U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF), so Latin text never uses it. `tokens.css` puts it first in `--font-display`, `--font-body` and `--font-mono`. Without Geeza Pro (not a Mac) it falls through to the old fallback.
- Notes keep their characters; the pasted presentation forms are not converted to plain letters (they will not match a search typed with plain letters). Offered, not done.
- A table needs a header row and the `| --- |` separator in GFM; the user's line had neither, so it showed as plain text. Not a bug.
- Not changed: a Markdown note stores no font. Driven in the installed build only (see the final report).

## Right-to-left text (26 Oct 2026, the user's screenshot: "selecting for right to left is so broken; do a sweep across the editor and search")

The editor treated every line as left to right: an Arabic or Urdu paragraph was left-aligned with its punctuation on the wrong side, bullets, quote bars and checkboxes sat on the left, and CodeMirror drew a selection from the editor's direction only.

- **A line has the direction of its first strong letter** (`live-direction.ts`, `textDirection` in `src/shared/text-direction.ts`): a `dir` attribute on each visible line plus `EditorView.perLineTextDirection`, so the caret, arrows and selection follow it. `unicode-bidi: plaintext` would not do: it leaves the computed `direction` CodeMirror reads untouched. A line with no letter (blank, `---`) stays left to right. A table is one unit: every row takes its header row's direction (or the columns would run opposite ways row to row), and each cell is `dir="auto"` for its own text.
- **Selection** (`live-selection.ts`, `rtlEdges`): CodeMirror extends a band to the line's edge from the _editor's_ direction, so a right-to-left line in a left-to-right note got bands stopping at the text on both sides. A selection that continues past such a line's end (its left) or comes into it from above (its right) now gets the missing piece. Table rows are drawn by `rowMarkers` as before.
- **CSS** (`LiveEditor.module.css`): padding, border, bullet, checkbox and chip-icon sides are logical (`padding-inline-start`, `border-inline-start`, `inset-inline-start`, `margin-inline-end`), so lists, quotes and checkboxes mirror. A `---:` column stays right-aligned (the Markdown says "right", not "end").
- **Everywhere else**: every text input and textarea is `dir="auto"` from its first focus (`lib/auto-direction.ts`: Mod-K, Find, title and picker fields); Mod-K's result titles and snippets are `dir="auto"`. The rest of the chrome stays left to right: the app is in English.
- Driven in the production build (scratch library, a note with Urdu paragraphs, a list, a quote, tasks and two tables; selection by keyboard in a paragraph, across lines, select all, inside a revealed table; Mod-K with Arabic). Not driven in dev mode, not driven with a mouse drag. Open: Home/End and Cmd-Left/Right in a right-to-left line follow the default commands (visual left/right); not changed.
- **Cells as text** (same day, the user: Shift+arrow selection in a table row was still odd, and each cell should follow its own direction): a row shown as text marks each cell `dir="auto"` with `unicode-bidi: isolate` (`live-tables.ts`, `.live-cell-text`), so an Arabic cell no longer reorders the pipes and cells beside it. The columns' order still follows the header row's first letter (English names: left to right).

## Right-to-left typing: the caret after a space, and no spell check (27 Oct 2026, the user: "when I finish a word and press space suddenly my cursor is on the right"; "why is this underlined now???")

- **Caret**: a table row shown as text marked only each cell's letters (`from`..`to`) as its own isolated `dir="auto"` run. A space typed after an Urdu word sits between the word and the pipe, outside the run, in the table's left-to-right context, so the caret jumped to the word's right. The run now covers the whole gap between the pipes (`gapFrom`..`gapTo`, `live-tables.ts`). Not driven in the app; the user is to check it.
- **Underline**: the editor has always had `spellcheck="true"`, and macOS has no Urdu dictionary, so every Urdu word got the red dotted line (why it showed only now is not known). Right-to-left lines (`live-direction.ts`) and right-to-left table cells shown as text (`textCellRtl`) are `spellcheck="false"`; a cell is chosen by its first strong letter, so English is still checked. A cell in a grid (cursor outside the table) is not marked: its text is not editable there.

## Editor tables are as wide as their text (26 Oct 2026, the user: "this table is waaaay too wide")

A table shown as a grid sized its columns as shares of the page (`fr`), so a two-column table of short phrases still spread across the whole line, with the right-aligned Urdu cells far from their English column.

- `columns()` (`live-tables.ts`) now gives each column `minmax(<longest word>ch, <longest cell, 6 to 48>ch)` and the row is `width: fit-content; max-width: 100%` (the first attempt, `justify-content: start`, left each row's bottom rule at the full page width, which still looked wide): a column is as wide as its longest text (at most 48 characters), a table that needs more than the page shrinks its columns toward the longest word, and one that needs more still scrolls as before. The row's bottom rule still runs the full width.
- Not changed: the header's alignment (a left-aligned "Urdu" over right-aligned Urdu cells). Driven in the production build (scratch library, dark, English/Urdu table): rows and rules end at the table. Editor unit tests pass, the real-library gate was not run.

## Year heat map: shade by rank, the same in every workspace (27 Oct 2026)

- **Why:** shading against the day's aim (or an average day) capped at "all of the aim", so a 1 h and a 9 h day in Work (a weekly aim only) looked alike. The user's call: consistency and visible differences, whatever the aim.
- **Now:** `heatLevel(minutes, worked)` (`hours/shared/heat.ts`): no time is level 0; a day with time takes its place in the ranking of the year's worked days (equal days share the middle of their place), cut into four equal bands (levels 1 to 4, accent at 25, 50, 75, 100%). No aim, average or busiest-day reference is used, so Research, Work and Life are shaded alike. Tooltip and the grid are unchanged. Not driven in the app yet.

## Tasks: a "New list" button (27 Oct 2026, the user: "I can't find a way to create a list or a sublist")

- **Why:** a list or sublist could only be made from a task's List menu (type a new name, "Create"), which nobody found. A list has no row of its own (it is text on its tasks), so an empty list cannot exist.
- **Now:** Research's Tasks landing has a **New list** header button (`NewListDialog`): the name, "Inside" (nothing, or an existing list, which makes a sublist) and the first task (due today). It refuses a name that exists already (same folding as notes' groups) or has `/` or `›`, then opens the new list's page.
- **Work:** no button; its top-level lists are clients (`docs/CLIENT_LISTS_PLAN.md`) and a new name can only be a sublist, made from the List menu. Open: a "New sublist" button in Work, if wanted.
- **Not driven in the app yet** (typecheck, lint and tests pass).

## Task tags: the shared picker, "+N" in rows, stay open (27 Oct 2026, the user: "tags in tasks are SO broken")

- **Why:** a row showed every tag and pushed the task name out; the native `<datalist>` arrow was misaligned and the field looked unlike People and Skills; after adding a tag the field closed, so adding several meant starting again each time.
- **Now:** `TagsField` (`tasks/renderer/`) is chips (alphabetical) plus a `+ Tag` button opening `PickerPopup` (search, the tags in use, an `Add “tag”` row; a tag is one lower-case word, `normaliseTag`). The list reopens afresh after each pick or add (the tag just added is gone from it), with the search field focused, so several tags go in a row; Escape closes it and puts focus back on `+ Tag`. With `limit` (the tasks table: 2) the rest are a muted `+N` whose `Tooltip` lists them; removing a hidden tag is done on the task page.
- **Not driven in the app** (typecheck, lint and tests pass): not checked yet that the list is not clipped in a table row or that Enter in it does not open the task. People's own field closes after a pick (not changed).

## "+N" after the tags, "Inside" as an arrow, Stop on the self-study card (27 Oct 2026, the user's three screenshots)

- **"+N" in a task row:** it showed before the tags. `Tooltip` wraps its child in a `display: contents` span, which took the row's `order: 1` and left the `+N` inside at `order: 0`. `TagsField` marks it `data-tag-more` and `TasksTable.module.css` orders it with the tags (after them, like Skills and People).
- **"Inside":** `Inside <name>` before every option was unreadable, and the app already marks a list inside a list with `↳` (`SubtaskLine`). The options in the New list dialog and in the group picker's "Create" row are now plain names with "None" for top level; the Create row puts a `CornerDownRight` icon before the choice (`GroupField.module.css`), the dialog keeps its "Inside" label.
- **Self-study timer:** a running timer showed only a missing Start, and the total (real year files only) stood still. `TaskTimeActions` shows **Stop** (`stopTimer`, the timer chip's) in place of Start while the task's timer runs, on the task page's Time card too; `TrainingHours` takes the total from `useTaskTime` so the running minutes count.
- **Not driven in the app** (typecheck, lint and tests pass).

## The "Inside" choice fills its row (27 Oct 2026, the user: "the parent list dropdown should fill its parent element not be weirdly centered")

- **Why:** the Create row's "Inside" select sat at the width of "None" beside the `↳`, not lined up with the search field above. `Picker`'s root is `display: inline-block`, so it shrinks to its content.
- **Now:** `GroupField.module.css` makes the select the flex item that takes what the arrow leaves (`.inside > :last-child`), so its right edge matches the search field and the Create row.
- **Not driven in the app** (a CSS-only change).

## Picker rows line up with the search field (27 Oct 2026, the user: every row highlight misaligned; the Inside select wider than the dropdown; the search wider than the highlighted rows)

- **Why:** the popup's search field ran the full content width, but `.list` had 2px side padding and `.extra` 4px, so highlighted rows were 2px narrower than the search and the "Inside" select 4px.
- **Now:** `Picker.module.css` gives `.list` and `.extra` no side padding, so search, rows, Create row and Inside select share one left and right edge.
- **Not driven in the app** (lint, typecheck and tests pass); the screenshot the user meant was not in the message.

## Picker: hovering does not scroll, the list is as wide as its field (27 Oct 2026, the user's two screenshots)

- **Jump on hover:** opening a long list scrolls the selected row into view, leaving the first row partly under the search field. A pointer resting there highlighted that row, and the highlight effect's `scrollIntoView` scrolled the list to it, so the list jumped. A highlight set by the pointer no longer scrolls (`PickerInput.highlightedByPointer`/`takePointerHighlight`, held in state like the rest of the input memory); arrow keys and typing still do.
- **Width:** the popup was `max-content`, so it came out wider than the closed field. A field at least 160px wide now gets a list exactly its width (`max-width` = the field's), long names ellipsised with the tooltip; a narrower field keeps the width its options need. `listMinWidth` yields for a field that wide (the group field's 280 made its list 20px wider than the 259px field).
- **Not driven in the app** (lint, typecheck and tests pass).

## The timer popover opens what is running (27 Oct 2026)

- **Decision (the user, 27 Oct 2026, mockup option A):** the popover's title row has a ghost icon button, `useOpenTarget` in `TimerChip.tsx`. A task (a subtask and a self-study task included) gets "Open task" (`ListChecks`, the task's page); a running meeting's or training's own task gets "Open meeting" / "Open training" (`CalendarDays` / `GraduationCap`), the note that made it (`tasks.sessionSource`, the "Made by" lookup). Nothing shows until the note is found; a session whose note is missing falls back to the task's page. No button while the timer has no task. Pressing it closes the popover.
- **Driven:** production build, scratch library, light only: an ordinary task (lands on its page) and a meeting task (button found, opens the note). Not driven: a training, dark mode, dev mode.

## A subtask line never runs past its row (27 Oct 2026, the user's screenshot of the timer's task picker)

- **Stray "·":** a parent whose title was blank or only spaces drew an empty span after the "↳", so the "·" sat against the arrow. `SubtaskLine` trims the parent's title and says "Untitled" when nothing is left.
- **Overflow:** the tail (list path and "due today") was `flex: none`, so a long list path ran past the row once the parent was short or empty. The tail now shrinks and ellipsises too, but only after the parent has (`.parent` shrinks 100000 times as fast as `.tail`).
- **Not driven in the app** (lint, typecheck and tests pass); the parent's real title was not looked up.

## Subtask order (27 Oct 2026)

A subtask list is in the user's own order: `position` (new ones last, drag on the task page changes it through `moveSubtask`, which renumbers the siblings 1, 2, 3 …), then when it was added. Done subtasks are shown after the open ones, each keeping its own position, so reopening one puts it back in its place. The subtasks a meeting or training note makes (`ownKind`) keep their date order and cannot be dragged. Dragging is limited to the open group or the done group, so a drop never looks like a no-op. Replaces the old "by date, then position" order, which scrambled a pipeline whose subtasks all share a date. Built, tested, driven in the production build (drag in a scratch library); dev mode and dark mode not driven; no undo for a move.

## Subtasks: drag from a handle (27 Oct 2026, the user)

A subtask row on the task page is dragged only from a grip (`GripVertical`) at the row's left edge, shown on hover; the rest of the row stays a plain click target. The row is `draggable` only between a press on the grip and the drag's end (`armed` in `TaskRow`). Rows that cannot be dragged (a meeting's or training's) have no grip. The grip sits outside the row's highlight, at the left of the rows (`left: -18px`, in 20px of room `.wrapFlat` leaves by padding and a negative margin, because the scroll container clips anything outside it). "Very left" meant outside the highlight, not just at its inside edge; a first try at the right edge and a second at `left: -3px` (inside the highlight) were misreadings. Driven in the production build (light). Not driven in the app (lint and typecheck pass).

## Home: subtasks are 13px (27 Oct 2026, the user: the font looks bigger than in Tasks)

Home's `.title` sets its own 15px, so the 13px given to a subtask's `li` never reached the title text, and Home's subtasks read larger than the Tasks table's. `.kid .title` is now `--text-13` and `.kid .row` has 6px top and bottom padding, as the table's subtask rows. Top-level titles stay 15px on Home (14px in the table, left as it was). Not driven in the app (CSS only; lint and Prettier pass).

## Home: a subtask shows no priority (27 Oct 2026, the user: be consistent)

A subtask shows no priority in the Tasks table (`isKid`; it keeps the one it stores, `docs/DECISIONS.md` above), but Home's `TaskRow` drew the badge for every task. It now draws it only when `task.parent` is null, so a subtask hung under its parent and a subtask standing alone are both without one. Not driven in the app (lint, typecheck and the Home tests pass).

## Home: a subtask's late chip lines up with its parent's (28 Oct 2026, the user: the alignment is off, ugly)

With no priority badge on a subtask (above), its "N days late" chip moved to the row's far right, out of line with the parent's chip, which sits left of the P2. A subtask row now keeps an empty `badgeGap` (44px, the badge's 30px minimum plus 7px padding each side) where the badge would be, so the chips share a right edge. Not driven in the app (lint, typecheck and Prettier pass).

## Add a subtask with a button; highlights run edge to edge (28 Oct 2026, the user)

- **Add subtask:** the add row's "Return" chip is a primary small **Add** button, like the Tasks page's add bar (Enter and Escape still work; disabled while the title is empty; `onMouseDown` is prevented so the field's blur does not close the row before the click). The field fills the row (`.addInput` is `display: flex`, no minimum width).
- **Edge to edge:** a row's hover, selection and focus highlight runs from its container's edge to its edge wherever tasks are listed, as the Tasks table's always did. The subtasks card on the task page (`.wrapFlat`, `margin: 0 -20px`), Home's lists (`.list`, `-16px`) and Hours' day task list (`.list`, `-24px`) take back the container's side padding and give it to the rows (square corners, `padding-inline` raised by the same amount), so content stays where it was. The drag grip now sits inside the row's first cell (`left: 2px`), replacing "outside the highlight" (above), because the card's edge is now the highlight's edge.
- **Not driven in the app** (lint, typecheck and tests pass). The Week card's expanded days share Hours' list and were not checked.

## Home: the badge gap is 30px, not 44px (28 Oct 2026, the user: still not aligned)

The `badgeGap` above was 44px, counting the badge's 7px side padding on top of its 30px `min-width`. The base CSS sets `box-sizing: border-box`, so the padding is already inside the 30px, and a subtask's late chip stood about 14px left of its parent's (the row's flex gap came on top). `badgeGap` is now 30px. The Tasks table was already aligned (the user checked). Not driven in the app: the dev app was started on the real library and exited before the user could look (the user's own check is pending); lint, typecheck and Prettier were not re-run for a one-number change.

## Subtasks: the add row is an input from the start (28 Oct 2026, the user: make it like adding a task)

The subtasks' add row was a "+ Add a subtask" line that turned into a field on click, unlike the Tasks page's add bar, whose input is always there. It is now the field from the start (`AddSubtaskRow` in `TasksTable.tsx`): a `+` in the status-icon column (so it sits under the subtasks' circles), then a full-width box with the placeholder "Add a subtask" and an **Add** button, disabled while the title is empty. The box has the neutral strong border and the accent one only on focus, as the add bar does. Focus is taken only when asked for (the pill, the context menu, Enter on the row: `adding`), through a ref and effect, since the field is always mounted; Escape clears the field and returns focus to the row; clicks in the field and on Add do not reach the row's click. Driven in the production build (scratch library, light and dark: alignment, typing, Enter adds and leaves the field empty); dev mode not driven.

## Subtasks: the add input's place, and one status column (28 Oct 2026, the user)

Follow-up to the entry above, after the user used it. (1) The status column of a subtask on the task page is the same with one subtask or many: the room for the drag grip (`.handleCell`, 28px left padding) is on every subtask row of the flat table, not only when the grip is shown (it used to move the circles when a second subtask appeared). The status button is `vertical-align: middle`, so the circle sits on the title's centre line. (2) The add row is one cell across the table (`addFlat` on the task page, `addNested` under a parent in the Tasks table), not a `+` cell and a field cell: the `+` is inside the input, under the status circles, and the placeholder starts where a subtask's title starts (the `+` slot's width and margin are those distances: 22px/15px flat, 18px/7px nested). (3) On the task page the input starts at the row's 12px left padding (the `+` stays under the circles); on both pages its right border lines up with the delete button's 24px hover box (8px from the cell's edge; the icon sits 12px in). The Tasks table's input keeps its left edge at the status icon, since the thread's rail runs left of it. Driven in the production build (scratch library, light; dark and dev mode not driven); the user checked the final alignment in dev mode.
