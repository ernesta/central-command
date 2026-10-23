# Editor: Backspace on an empty bullet, and paste-a-URL-over-a-selection (plan, 23 Oct 2026)

Two things the user found by using the app (screenshot: a Research note "Fellowships", a bullet list of four links and an empty fifth bullet).

## Decisions already made (do not re-ask)

- Backspace on an empty last bullet removes the bullet and leaves the cursor on that same line (an empty line directly under the list), not one line lower.
- The paste feature is not changed until it can be reproduced.

## 1. Backspace on an empty bullet jumps the cursor one line down (fix)

Cause (read from the code, not yet driven): `backspaceInItem` in `src/renderer/src/editor/live-lists.ts` (the `runsIntoAbove` branch) inserts a blank
line before a top-level item that loses its marker, when the line above is a paragraph, so the text does not run into it. A list item's text is also a
`Paragraph` in the parse, so `enclosing(above.to, ['Paragraph'])` is true when the line above is another bullet. The blank line goes in, the emptied line
moves down one, and the cursor lands on it.

### Stage 1

1. Reproduce first: a `live-lists.test.ts` case with `- a\n- b\n- |` and Backspace; expect `- a\n- b\n|` (cursor on the emptied line, no inserted line).
2. Fix: no blank line when the item has no text (an empty line already separates). Check the other case, a non-empty item under another item (`- a\n- |b`
   Backspace): the text must not become a lazy continuation of `a`, so a blank line stays there; confirm in a test what the editor does today and keep it.
3. Tests: empty item under an item, under a paragraph (`text\n- |`, expect the blank line rule unchanged or not needed: decide from the parse), nested
   empty item (outdent still wins), numbered and checkbox items, in a quote, CRLF. Mutation check: put the condition back and see the first test fail.
4. Real-library gate (`LIVE_EDITOR_LIBRARY`, see CLAUDE.md) and the app driven for real (scratch library, dev and production build, real Backspace
   keystrokes, screenshot of where the cursor is). Check `docs/DECISIONS.md` for a recorded rule on leaving a list and add a line there.
5. `npm test`, `npm run lint`, `npm run typecheck`. Commit. Stop and ask for next steps.

## 2. Pasting a URL over selected text did not make a link (cannot reproduce; no change planned)

The code is intact (`live-paste.ts`, registered in `live-state.ts`; its 16 tests pass) and has nothing that depends on lists. The user saw it fail once, on
text in the first item of a bullet list, then could not repeat it. Possible causes: Cmd-Shift-V (plain on purpose, never links), a selection spanning
lines, or a selection inside text that is already a link. Untested gap: no test pastes over a selection inside a list item.

### Optional stage 2 (only if wanted)

Add a `live-paste.test.ts` case for a selection in the first item of a bullet list and in a nested item, and drive the real app once with a real Cmd-V.
If it fails, fix; if it passes, stop. If the user reports it again, ask which shortcut they used and what the selection was.
