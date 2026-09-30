# Notes editor: live markup (plan)

Requested 30 Sep 2026. Mockup: `docs/design/editor-markup-mockup.html` (option 3, with option 1 as its first stage).
Awaiting build; nothing here is started. Applies to every editor (Notes, Meetings, Training, Reading lists, Readings notes)
because they all use the shared `NotesEditor` (`src/renderer/src/notes/`).

## Why

- No way to see the markup, so editing headings, bold and links is guesswork.
- Typing `###`, a space, then Backspace jumps the cursor up: Milkdown converts `### ` into an empty heading and the
  `###` text is gone, so Backspace merges that empty block into the line above.

## What the user gets

Everything looks rendered except the block or word the cursor is in, which shows its markup, like Obsidian's Live
Preview: `### ` before a heading, `> ` before a quote, `**`, `*`, `~~`, `` ` `` around marked text, `[` … `](url)` around a
link. Move away and it becomes formatting again. No mode to switch.

## Approach (read before building)

- **Decorations, not document changes.** A ProseMirror plugin (`$prose`, like `notesChangePlugin`) adds _widget
  decorations_ for the markers at the cursor's block and marks. The document, and so the saved Markdown, is untouched:
  no new round-trip risk, and opening a note still never reformats it.
- Widgets have no document positions, so arrow keys pass over them and the cursor never gets stuck in a marker.
  Consequence: the markers are display, not text. Editing them needs explicit commands (stage 2).
- Markers use one new colour token with both `light-dark()` values (`tokens.css`); no raw hex.
- Do not show markers for `cc://` mention links (they are drawn as chips), the task checkbox, or bullets (already visible).

## Stages (commit each; unit tests plus the built app and dev mode on a scratch library, as CLAUDE.md says)

1. **Fix the jump (stands alone, also useful without the rest).** Backspace right after an input rule undoes it
   (`undoInputRule` from `prose/inputrules`: `### ` + Backspace gives `###` back); keep it first in the keymap.
   Backspace at the very start of a heading lowers its level, or makes a paragraph at level 1, and at the start of a
   quote unwraps it, never merging upward (same shape as `liftListItemAtStart` in `notes-list-keymap.ts`). Tests for each,
   plus a mutation check.
2. **Block markers.** Heading (`#` × level), blockquote, fenced code (the fence lines) shown while the cursor is inside.
   Typing `#` at the start of a heading raises its level; Backspace lowers it (stage 1), so the visible `###` behaves as
   if it were text. Click on a marker puts the cursor at the block's start.
3. **Inline markers.** Bold, italic, strike, inline code and link, shown when the selection is inside or touching the
   mark. Backspace or Delete next to a marker removes that mark (a marker is one unit); typing the marker character
   again toggles it. A link's `](url)` is display only in this stage; editing the address stays with the existing link
   editing (see open questions).
4. **Interactions.** Find bar and replace (Cmd-F) still match the visible text only; the outline and word count are
   unchanged; IME composition and selection across several blocks (show markers for none, or for the block holding the
   head of the selection: pick one and record why); undo/redo never records a decoration.
5. **Polish and QA.** Dark mode; focus and caret visible against the marker colour; no layout jump when markers appear
   (reserve nothing, but check the line does not reflow badly: markers appear inline, so text shifts right by their
   width; if that is jarring, try fading them in without a size change and record what was chosen). Drive it with
   Playwright: type, arrow across markers, delete, undo, quit right after typing, Meetings and Training editors too.
   Write it up in `docs/DECISIONS.md` and update this file and `docs/ROADMAP.md`.

## Open questions for the user (ask, do not guess)

- Editing a link's address: keep the current way, or make `](url)` editable in place? (In place means turning that
  link into raw text while the cursor is inside it: riskier.)
- Lists: keep bullets and checkboxes as they are (proposed), or show `- ` too?
- A selection across several blocks: markers for none, or for the block the selection ends in?

## Not in scope

Source mode (option 2 in the mockup) is separate and can come later; nothing here prevents it.
