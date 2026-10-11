# Blank lines in imported notes (plan, 11 Oct 2026)

The user: imported notes show empty lines that should not be there. Two screenshots:

1. A blank line between the end of a list and a heading ("Thoughts"), and another between the heading and the list under it.
2. An empty line after the last bullet at the very end of a note.

## Why they are there

- **Around headings.** The Readings importer (`src/modules/readings/main/obsidian-import.ts`, the `spaced` step) still puts a blank line
  before and after every heading, from when the old editor did the same. Since 2 Oct 2026 notes keep no blank lines around headings and the editor
  draws the gap (`docs/DECISIONS.md`, "No blank lines around headings"). `npm run tidy:headings` fixed every other note but **skips `readings/`**,
  so every imported Readings note still has them. Other notes imported or written since 2 Oct may have them too.
- **At the end.** Either the file ends with more than one line break (a blank line after the text), or it ends with exactly one line break, which
  CodeMirror draws as an empty last line. Every note the app writes ends with one line break (`NEW_MEETING_BODY`, `NEW_TRAINING_BODY`), so the second
  case would show on every note, not just imported ones. The dry run tells the two apart (see stage 2).

## Decisions already made (do not re-ask)

- Only blank lines go. Every non-blank line stays byte for byte and in order; a note that would change otherwise is left alone and reported.
- Blank lines between paragraphs, between a paragraph and a list, around tables and inside code fences stay. Front matter is never touched.
- Blank lines at the very start of the body go (they draw as an empty first line, the same complaint).
- A run of blank lines at the end of the body becomes nothing: the body ends with exactly one line break in the note's own style (LF or CRLF). An
  empty body stays empty.
- A blank line is one that is empty or only whitespace (spaces, tabs, non-breaking spaces).
- Readings notes are included. CLAUDE.md's "never overwrite a Readings note file" is about sync and imports replacing what the user wrote; this rewrite
  removes only blank lines, backs each file up first and writes through the content-hash guard, the same as a save in the app. Stated in the
  write-up so the user can see it.

## Stage 1: the rule, the importer and the script

1. `src/shared/heading-spacing.ts`: add `tidyBlankLines(body)`: `tightenHeadings`, then remove leading blank lines and collapse trailing blank lines
   as above. Keep line-break style. Tests in `heading-spacing.test.ts`: headings (already covered), leading run, trailing run of one and of several,
   whitespace-only lines, CRLF, a code fence at the end (blank lines inside it stay; only those after the closing fence go), an empty body, a body
   with no final line break (gets none added; only remove, never add). Mutation check: break each rule and confirm a test fails.
2. `obsidian-import.ts`: stop adding blank lines around headings; run the result through `tidyBlankLines`. Update the comment and the two tests
   that say "puts a blank line … as the editor does" to the new behaviour. Check `scripts/import-notes.mts`, the Meetings, Work meetings and Training
   importers for the same habit and fix any that add blank lines around headings or at the ends.
3. New script `scripts/tidy-blank-lines.mts` and `npm run tidy:blank-lines [-- --apply]`, copied from `scripts/tidy-headings.mts` (same guard,
   backups to `~/CentralCommand/backups/tidy-blank-lines-<time>/`, same "every non-blank line identical" check), but over **every** note folder
   including `readings/`. The dry run prints per note how many lines go and where (start, around headings, end), and at the bottom a count by folder
   and **a count of notes whose body ends with exactly one line break and nothing else would change** (needed for stage 2). A second run after
   `--apply` finds nothing.
4. Add the command to CLAUDE.md's Commands list ("not yet applied") and a write-up to `docs/DECISIONS.md` ("Blank lines in imported notes").
5. Test on a fixture library in the scratchpad (`CENTRAL_COMMAND_HOME=<scratch>`): readings note with spaced headings, a CRLF note, a note with
   trailing blank lines, a note with a code fence; dry run, apply, second dry run finds nothing, backups exist. `npm test`, `npm run lint`,
   `npm run typecheck` pass. Commit (one for the rule + importer, one for the script). Push only when the user says.

Stop. The real library is on the user's Mac, not in a cloud session: ask the user to run `npm run tidy:blank-lines` (dry run) with the app
closed and paste the summary. Never `--apply` until they say so.

## Stage 2 (only if the user still sees the empty last line after applying)

If the dry run shows the screenshot's note ends with exactly one line break, the empty line is how the editor draws the final line break. Options for
the user: hide a final empty line in `LiveEditor` (cursor can still go there; nothing in the file changes), or leave it. Do not change what the app
writes. Do not start this without the user's answer.
