# Extra blank lines (plan, 17 Oct 2026)

The user: could not add more empty lines in a note; Enter looked dead. Cause: since 15 Oct 2026 every blank line is drawn with no height (`live-spacing.ts`)
and the gap between blocks comes from the block types. The user wants 0 and 1 blank line to look the same (some Markdown uses one for a new paragraph,
some does not) and **each blank line after the first to be visible space**. They also want every existing note cleaned so no run is longer than one,
so nothing already written changes look.

## Decisions already made (do not re-ask)

- 0 or 1 blank line between two blocks: the same gap as today. Run of `n` ≥ 2: that gap plus `n - 1` lines of height.
- The end of a note stays drawn with no height (the empty last line, `live-endbreak`); only blank lines before text count.
- The cursor's own blank line keeps its height, as now. Blank lines inside code stay code and are not touched.
- Nothing the editor does edits the text; the rule is drawing only.
- Existing notes: no run of blank lines longer than one, in every note folder (Readings included, same reasoning as `tidy:blank-lines`: only blank
  lines go, backup first, content-hash guard).

## What a dry run of the count found (17 Oct 2026, real library, read-only)

8 notes, 58 extra blank lines: training 3, notes 4, meetings 1. Nothing in readings.

## Stage 1: the rule in the editor

1. `live-spacing.ts`: for a run of `n` ≥ 2 blank lines outside code, each blank line after the first gets a class with one line of height (not the
   cursor's line, which already has it). The line after the run carries the usual gap. A run at the end of the note is unchanged (no height).
2. Tests in `live-spacing.test.ts`: 0, 1 and 2 blanks, 3 blanks, cursor on a blank in a run, run in code, run at the end, spaces-only lines, CRLF. Mutation check.
3. Real-library gate (`LIVE_EDITOR_LIBRARY`, see CLAUDE.md) and the app driven for real (scratch library, dev and production build, real Enter keystrokes
   at the end of a note and between paragraphs, screenshots).
4. Update `docs/DECISIONS.md` ("Spacing between blocks": blank lines no longer all height-free) and the ROADMAP review item for block spacing.
5. `npm test`, `npm run lint`, `npm run typecheck`. Commit. Stop and ask for next steps.

## Stage 2: clean the existing notes

1. `tidyBlankLines` in `src/shared/heading-spacing.ts` (or a sibling `collapseBlankRuns`): collapse runs of blank lines to one (the first line of the run
   is kept), outside code fences, LF and CRLF kept. Tests and a mutation check as for `tidyBlankLines`.
2. Script `scripts/tidy-blank-runs.mts`, `npm run tidy:blank-runs [-- --apply]`, copied from `scripts/tidy-blank-lines.mts`: dry run by default, backups
   to `~/CentralCommand/backups/`, refuses a note where any non-blank line would change, a second run finds nothing. Add to CLAUDE.md's Commands.
3. Test on a fixture library in the scratchpad. Commit. Stop: the user runs the dry run with the app closed, reads it, and says when to `--apply`.
4. Order: stage 2 should be applied before, or together with, installing stage 1, so no note shows the extra space.

## Done

- **Stage 2 applied 17 Oct 2026** (the user's request, before stage 1): `npm run tidy:blank-runs -- --apply`, 8 of 261 notes, 58 blank lines (meetings/work 1, notes/research 3, notes/work 1, training/research 3). Backup `backups/tidy-blank-runs-2026-10-17T09-19-14-649Z/`. A second dry run finds nothing. Two of the notes had their run between the front matter and the first heading (one of 12 lines), which `splitNote` keeps in the head, so the script collapses the head's trailing blanks too.
- Stage 1 (the editor) is not built yet.
