# Notes editor: live markup, the Typora way (plan, revised 30 Sep 2026)

Requested 30 Sep 2026. Mockups: `docs/design/editor-live-markup-mockup.html` (today against proposed, scenario by scenario) and, for the original options,
`docs/design/editor-markup-mockup.html`. Applies to every editor (Notes,
Meetings, Training, Reading lists, Readings notes), because they all share `NotesEditor` (`src/renderer/src/notes/`).
Stage 1 (Backspace no longer jumps) is built on the old editor (`docs/DECISIONS.md`, "Live markup … stage 1").

## The idea, in one rule

**The note in the editor is its Markdown text, character for character.** Everything is drawn as formatted (headings big, bold bold,
links as links) except the block or span the cursor is in, which shows its markers (`### `, `**`, `[` … `](url)`). Markers are real
characters, so every action is ordinary text editing: select and copy a URL, delete `##` with Backspace, type a `#` to raise a
heading, type `**` to start bold. There are no special cases to learn, which is the point (Typora, Obsidian's Live Preview and Bear
all work this way). Decisions taken with the user:

| Question                             | Answer                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Selection across several blocks      | No markers shown anywhere (Copy still gives the Markdown source)                                     |
| Fenced code                          | Fence lines and language shown while the cursor is in the block, hidden otherwise                    |
| Nested quotes                        | One `>` per level, as typed (`> > text`)                                                             |
| Typing `#` at the start of a heading | Raises the level (it is just a character)                                                            |
| Deleting a marker                    | Just Backspace/Delete: it is text                                                                    |
| Editing a link's address             | In place, as text, while the cursor is in the link; select and copy works                            |
| Lists                                | Bullets and checkboxes stay as drawn (a bullet or checkbox is one unit for Backspace); no `- ` shown |

## Why the library changes

The editor today is Milkdown (ProseMirror): the document is a tree of rendered nodes, and Markdown is produced by serialising it.
Markers are not text in that model. Two ways to get the Typora behaviour were weighed:

- **Keep Milkdown and swap the block under the cursor into a raw-text node, parsing it back when the cursor leaves.** Rejected. Two
  representations of one block; every entry and exit is a document change that undo history, the change reporter, Find, word count and
  IME composition all have to treat specially; and a parse on leaving can change what you typed (Milkdown's known normalisations,
  escapes such as `\*`, `<https://…>` autolinks). For notes that matter, "the editor may rewrite what you typed when you click away"
  is the wrong foundation.
- **Replace Milkdown with CodeMirror 6, with Markdown as the document.** Chosen. This is how Obsidian does it. The document _is_ the
  file's text, so:
  - Opening never reformats, saving writes exactly what is in the editor, and a note with `*` bullets or hand-written spacing stays
    untouched (the normalisation list in `docs/DECISIONS.md`, "Notes editor: Milkdown", stops applying). Round trip is an identity, which
    a test can assert over the whole real library.
  - Undo is plain text undo; nothing swaps in and out.
  - The formatting is a layer of decorations over the text (hide markers away from the cursor, style the rest). A bug there can make a
    note look wrong, never change its content.
  - CodeMirror packages (`@codemirror/view`, `state`, `commands`, `language`, `lang-markdown`, `search`) are already in `node_modules` as
    dependencies of Milkdown; they become direct dependencies. `@lezer/markdown` parses GFM (tables, task lists, strikethrough,
    autolinks). No other new dependency is expected (HTML paste conversion is the one possible addition; see stage 3).

**What the real library needs** (checked read-only, 30 Sep 2026): 406 Markdown files; 3 use tables; none use images, raw HTML, fenced
code or footnotes. So tables are the only hard rendering case and are small; images and HTML are not needed at first (they show as
their text).

## Shortcuts (designed 30 Sep 2026; every key in Settings → Shortcuts → Notes editor keeps its chord and visible result)

CodeMirror has no ready-made Markdown formatting keys, so `live-keymap.ts` writes them, and `notes-shortcuts.test.ts` keeps the Settings list
honest (its Milkdown-source check is replaced by a test per shortcut that presses the key and checks the resulting text).

- **Inline (`Mod-b`, `Mod-i`, `Mod-Alt-x`, `Mod-e`):** wrap or unwrap `**`, `*`, `~~`, `` ` `` around the selection. Selection already marked:
  remove the markers. No selection, cursor in a word: mark the word (or unmark it). Empty spot: insert the pair with the cursor between.
  Typing the markers by hand gives the same result.
- **Block (`Mod-Alt-1` to `6`, `Mod-Alt-0`, `Mod-Shift-b`, `Mod-Alt-8`, `Mod-Alt-7`, `Mod-Alt-c`):** set, change or remove the line's prefix
  (`#` × level, `> `, `- `, `1. `) or wrap the lines in a fence.
- **Lists:** Tab, Shift-Tab, `Mod-]`, `Mod-[` indent and outdent; Enter continues, and on an empty item ends the list; Backspace at the start
  of an item's content removes the bullet or checkbox as one step (outdent first, then a plain paragraph). The user confirmed this.
- **Unchanged:** undo/redo, Find and replace keys, `@`, Cmd-click, paste-over-selection, `Mod-Shift-v` (existing IPC), `Shift-Enter` (inserts a
  backslash line break, as the editor writes today).
- **Until stage 6:** Tab in a table row indents as plain text; table-cell navigation comes with tables.

## Architecture

- `src/renderer/src/editor/` (new): `LiveEditor.tsx` with the same props contract as `NotesEditor` (initial, onChange, onBlur,
  placeholder, autoFocus, entitySelf), so consumers change one import. Plain modules that the tests can drive without React:
  - `live-decorations.ts`: one `ViewPlugin` that walks the visible syntax tree and builds decorations; "reveal" is a pure function of
    (node range, selection): a span's markers show when a selection range touches it, a block's markers show when the cursor is in the
    block, nothing shows for a multi-block selection. Markers are hidden with `Decoration.replace`/`mark` classes, never deleted.
  - `live-keymap.ts`: Enter continues a list, quote or task (`insertNewlineContinueMarkup` from `lang-markdown`), Tab/Shift-Tab indent
    and outdent items, Backspace at the start of an item's content removes the bullet or checkbox unit (outdent first, then plain
    paragraph), same shape as `liftListItemAtStart` today.
  - `live-links.ts`: paste a web address over a selection makes `[sel](url)`; Cmd-click opens (same rule as today: web addresses in the
    browser, `cc://` inside the app); a bare `https://…` is drawn as a link.
  - Entities: `[label](cc://kind/key)` is drawn as a chip (an atomic replace widget, so the cursor jumps over it and Backspace removes it
    whole); `@` opens the existing picker (`picker-controller.ts` is UI-agnostic apart from the editor view type, which is adapted); the
    hover card and Cmd-click stay. The file format is unchanged.
  - Find (`useNotesFind`, `NotesFindBar`), the outline (`NoteOutline`), word count and Meetings' TODO helper are ported. They already
    work on text or on a small bridge object; each is re-pointed at the CodeMirror view.
- **Data safety rules carried over:** the change reporter is synchronous (`EditorView.updateListener` on every doc change, no debounce;
  the session does its own), `onBlur` unchanged, the main process's flush-on-quit unchanged, the file is never touched until the user
  edits.
- Colours for markers: one new token with both `light-dark()` values in `tokens.css`. No raw hex.

## Stages (one commit per stage or part; each: unit tests, lint, typecheck, then drive the built app and dev mode on a scratch library

with real keystrokes, look at screenshots, quit right after typing)

1. **DONE. Stop Backspace jumping in the old editor.** Superseded in behaviour by this plan, kept until the switch (stage 8).
2. **Spike, behind a switch.** `LiveEditor` with the Markdown language, load/save as identity, synchronous change reporting, history,
   theme, and the reveal rules for headings, emphasis, strong, strike, inline code, links, quotes, rules. A hidden switch chooses the old
   or new editor per app (`localStorage`, not shown in Settings), so nothing changes for the user until parity. Gate: an identity test
   over every file of a copy of the real library (open, no edit: zero changes reported; simulated edit elsewhere: the rest of the text
   byte-identical). Screenshots to the user before continuing. If the look or feel is wrong, this is where we stop or adjust.
3. **Lists, tasks, quotes and paste.** Bullets and numbers drawn as units, checkbox toggle (click writes `[x]`), continue/indent/outdent
   keys and the Backspace rule, nested quotes, Cmd-Shift-V (the existing IPC), paste as plain text. Formatted paste (web, Word) is
   pasted as plain text (the user's call, 30 Sep 2026); converting HTML to Markdown is a possible later addition (adds a small dependency; ask first).
4. **Entities.** Chips, atomic behaviour, `@` picker, hover card, Cmd-click, "Mentioned in" unaffected (it reads files). Includes a
   mutation check on the "Backspace removes the whole chip" logic.
5. **Find and replace, outline, word count, Meetings TODO helper.** Find matches source text, so a word inside `**bold**` is found; a
   query of only marker characters matches markers (acceptable, recorded). Word count strips markers.
6. **Tables and fenced code.** Tables: styled monospace pipes while the cursor is in the table, a rendered grid otherwise (three notes
   use them, so this can be the plainest thing that reads well). Fenced code: fence lines while the cursor is in.
7. **Interactions.** IME composition (no reveal changes mid-composition), selection across blocks, undo/redo never surprising, very long
   note performance (a 20,000-word note types without lag), dark mode, caret and focus ring against the marker colour, no layout jump
   when markers appear (markers fade in without changing size if the shift is jarring; record what was chosen).
8. **Switch and remove Milkdown.** All consumers use `LiveEditor`; delete the old editor, its plugins and tests, the `@milkdown/*`
   dependencies, `externalizeDeps` notes if any; port or retire each test with a note in `docs/DECISIONS.md`. Full Playwright pass on
   Notes, Meetings, Training, Reading lists, Readings notes and Work, both built app and dev mode.
9. **Write-up.** `docs/DECISIONS.md` (replace the "Milkdown" decision with the new one, keep the old text marked superseded),
   `docs/ROADMAP.md`, `CLAUDE.md` (architecture and pitfalls: Milkdown lines removed, CodeMirror ones added).

## Risks

- Real work: this replaces about 3,000 lines of editor code (`src/renderer/src/notes/`, `entities/`, the Meetings TODO helper), stages 2
  to 8, and behaviours that were fixed by using the app (link paste, plain paste, list spacing, focus, quit-right-after-typing) have to
  be re-verified. The switch in stage 2 keeps the current editor usable throughout, and nothing is deleted before stage 8.
- Decorations that hide text must never break caret movement or selection: hidden ranges use `Decoration.replace` with atomic ranges only
  for units (bullet, chip); marker text is otherwise real and reachable. Covered in stage 7 with real keystrokes.
- Pasting formatted content loses formatting until HTML conversion exists (stage 3 note).

## Progress (30 Sep 2026)

- Stage 1 done, commit `bd26898`, not pushed.
- Design revised to the CodeMirror model above after the user chose the Typora way. The user approved the mockup
  (`docs/design/editor-live-markup-mockup.html`), the list/checkbox behaviour and the shortcut design. Design is complete; nothing else started.
- **Stage 2 done (30 Sep 2026), not pushed:** `src/renderer/src/editor/` (`LiveEditor`, `live-reveal`, `live-decorations`, `live-links`,
  `live-state`, `live-switch`), commits `2b484d0` (packages) and `b0b8038`. Switch: run
  `localStorage.setItem('central-command.liveEditor', '1')` in the developer tools and reload; `NotesEditor` then renders `LiveEditor`
  (every consumer, one import). The identity gate passed over all 406 files of a copy of the real library (see `docs/DECISIONS.md`).
  Not in the spike, by design: lists drawn as units, task checkboxes, Enter/Tab/Backspace list rules (stage 3), `@` chips and picker
  (4), Cmd-F, outline-by-click, the Meetings TODO helper (5), tables and fences (6), IME/perf/dark-mode checks (7). Waiting for the
  user's decision to continue.
- Checking recipe: scratch library under the session scratchpad with `CENTRAL_COMMAND_HOME`, `playwright-core` installed there,
  Cmd-Shift-N to make a note, real keystrokes, `app.close()` straight after typing; dev mode via `electron-vite dev` with
  `--remote-debugging-port=9333` and `connectOverCDP`.

## Not in scope

A whole-note source mode (option 2 in the mockup) is separate; with this design it is nearly free (turn the decorations off), so it can
come later.
