# Every line the same space (plan, 17 Oct 2026)

The user chose "Option C" from `docs/design/editor-blank-lines-mockup.html` after the hidden-first-blank-line model kept producing a cramped
cursor and jumps (`docs/DECISIONS.md`, "The cursor's blank line is drawn as the paragraph typed there"; "Research: other editors"). They said
"I think I want C?" (tentative), and earlier: "Fix old notes for C".

**The rule.** Every line of a note is one unit, a blank line included: a line of text carries the 16px block gap above it, so a unit is 45px
(a wrapped line adds 29px per extra row). One Enter makes a new paragraph; a blank line is only for extra space, and n blank lines are n
units. No hidden first blank line, no stand-in for the gap, no cursor-dependent layout. Enter at the start of a paragraph pushes the text
down and the cursor goes with it. The gap rules that were already there stay: none next to a heading, 4px between list items, a quote's own,
none inside code, tables and quotes.

## Stage 1: the editor (done 17 Oct 2026)

`live-spacing.ts` rewritten (every line, blank or not, carries the gap its text would; a blank line gets the gap a typed paragraph there
would get, so typing moves nothing); the `live-void` and `live-gap-cursor` CSS removed; Enter at the start of a paragraph no longer keeps
the cursor on the new empty line (`live-lists.ts`); a selection ends on blank lines like on any line (`live-selection.ts`). Driven in the
built app on a scratch library. Until stage 2, notes with a blank line between paragraphs look loose (90px between the text).

## Stage 2: the old notes (applied 17 Oct 2026)

`npm run tidy:paragraph-blanks [-- --apply]`: remove a single blank line between two blocks where that does not change how this app reads the
note. Counted read-only on a copy of the library: 287 single blank lines in 50 of 263 notes (98 between paragraphs, 90 between a list and a
paragraph, 41 around headings, 38 around tables, 20 other). Like `tidy:blank-runs`: dry run by default, backs each note up, apply with the app
closed, refuses a note where any non-blank line would change, never touches code. Open questions for the user: which of those pairs to
remove (outside this app, two paragraph lines with no blank line between them are one paragraph, and a paragraph under a list item joins
that item).

**Built (17 Oct 2026):** `scripts/tidy-paragraph-blanks.mts` with the planner in `src/renderer/src/editor/paragraph-blanks.ts`. It removes only a single
blank line between two paragraph lines (the editor's own block kind of both neighbours), outside code fences and the front matter, and only when the editor
reads the note the same afterwards (see `docs/DECISIONS.md`, "tidy:paragraph-blanks"). Every other single blank line is listed by kind, untouched.
Dry run on a library copy, 17 Oct: 371 single blank lines in 51 of 263 notes; 133 paragraph + paragraph in 18 notes would go. Not applied.

**Applied 17 Oct 2026** (the user: "Remove all, of course, so it is all consistent. … Apply"): scope widened from paragraph + paragraph to every single blank line between two lines of text,
each still checked with the editor's parse. 294 removed in 40 of 263 notes, 77 kept, backup `backups/tidy-paragraph-blanks-2026-10-17T13-50-51-402Z/`, a second dry run removes nothing. The kept ones are
blank lines that end a block (a list, table or quote above a line that would otherwise join it, or a rule under a table row). The user also asked that spacing be consistent regardless of block type
after the cleanup; that is an editor change and is not started (see the ROADMAP).
