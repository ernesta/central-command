# Readings sync: don't keep what Zotero never gave you, and don't lose a rename (plan, 9 Oct 2026)

Raised by the user after finding an orphaned `Untitled (n.d.)` row with a "Not in Zotero" badge in the
Readings table. It traced to a blank "Report"-type item they'd created by hand in Zotero (meaning to add a
reference manually and regenerate its citekey), which synced once with no title/author/year, then
disappeared from the next export and got flagged `missing_from_source` under Better BibLaTeX's
auto-generated fallback citekey. The row had no notes and nothing referred to it. The user's decision: the
reading list should always track Zotero, and keeping a flagged row around should be rare — only when there
is something of the user's that would otherwise be orphaned. Read `CLAUDE.md` (the Readings "Never" lines)
and `docs/DECISIONS.md` ("Notes are Markdown files guarded by content hashes", "Sync strictness") first.

## What's true today

- `src/modules/readings/main/parse-bib.ts` turns every `.bib` entry into a `SyncedFields` row, even one with
  no title, author/editor or year — nothing is skipped.
- `formatShortCitation` (`src/modules/readings/main/citation.ts`) falls back to the literal `"Untitled"` /
  `"(n.d.)"` when those fields are blank, which is what rendered for this row.
- `applySync` (`src/modules/readings/main/repository.ts:111-173`) matches only on `citekey`. A citekey
  absent from the new export is always flagged `missing_from_source = 1` on the existing row and never
  deleted (comment at line 107, restated in `CLAUDE.md`'s "Never" section). A citekey rename in Zotero is
  indistinguishable from a real deletion — both just mean "old key gone" — so the flag exists to avoid
  orphaning a renamed reading's notes or mentions.
- `has_notes` / `notes_excerpt` are plain columns on `readings`, kept in sync separately by
  `NotesStore.updateCache` (`src/modules/readings/main/notes-store.ts:90-99`) — cheap to read, no I/O.
- `reading_list_mentions` (`src/modules/reading-lists/main/repository.ts`, migration
  `reading-lists/0001_reading_lists.sql`) is a table keyed and indexed by `citekey`: one row per Reading
  Lists entry that names a reading. `SELECT 1 FROM reading_list_mentions WHERE citekey = ?` is an indexed,
  no-I/O lookup — a reading can be referenced here with no notes at all.
- `@` mentions (`[label](cc://reading/<citekey>)`) are found by `findBacklinks`
  (`src/main/entities/backlinks.ts:51-79`), which `readdir`s and `readFile`s every note/meeting/training
  folder across all workspaces on every call ("a few hundred small files: quicker than keeping an index").
  Fine once per on-demand "Mentioned in" panel; too slow to call per citekey inside a sync.
- DOI and URL are already parsed per entry (`reference-details.ts`, `buildReferenceDetails`) into the
  `reference` JSON blob, but are not indexed or used for matching anywhere. No stable Zotero item ID is
  exported by Better BibLaTeX's default `.bib` output, so DOI/URL are the best cross-rename identifiers
  available. `full_title`, `authors` and `year` are real columns and are the fallback for a fuzzy match when
  neither side has a DOI or URL.

## The rule (agreed with the user)

1. **Never insert a blank entry.** A `.bib` entry with no title, no author/editor and no year is not a
   reading — `parse-bib.ts` leaves it out of what it hands to `applySync`, so it's never stored at all.
2. **A citekey missing from the export is kept (flagged) only if something is attached to it**: notes
   (`has_notes = 1`), a Reading Lists entry (`reading_list_mentions`), or an `@` mention anywhere. Otherwise
   it is deleted outright, in the same sync transaction, the first time it's found missing (no grace sync).
   The expensive part — `@` mentions — is checked with **one shared scan per sync run** (build a set of every
   `cc://reading/<citekey>` found across all folders once, then test membership for each missing citekey),
   never per-reading.
3. **A rename in the same sync is reconciled, not duplicated**, in two confidence tiers:
   - **High (automatic):** the vanished citekey and a newly-appeared citekey share a DOI, or failing that a
     URL. Treated as the same work renamed: the existing row is updated in place (new citekey and synced
     fields) — keeping its `id`, notes, `reading_list_mentions` rows, `@` mentions and user fields (`status`,
     `tags`) intact. No flag, no second insert.
   - **Low (suggested, not automatic):** no DOI/URL on either side, but title + authors + year match. Not
     merged silently — a coincidental match would splice notes onto the wrong work. Surfaced for the user to
     confirm or dismiss (see open question 2).
4. Update `CLAUDE.md`'s "Never" line once rule 2 ships, to state the real rule instead of "never delete a
   readings row."

## Open questions

1. Should a non-default `status` (`read`/`to_read`) or non-empty `tags` also count as "something attached" —
   protecting a row from deletion even with no notes, no Reading Lists entry and no mention? These are
   user-set, not Zotero-synced, so losing them silently seems like the same mistake as losing notes.
2. Where should a suggested (low-confidence) rename surface — an extension of the existing "no longer in
   your Zotero export" banner (a row reading "X looks like it may now be Y — link them?" with Link/Dismiss),
   or somewhere else?
3. Should a deletion under rule 2 leave a short trace (citekey, short citation, entry type, when) somewhere
   such as `sync_runs`, so a surprise loss is traceable even though the row itself is gone? Recommend yes —
   cheap, and the whole point of this plan is that deletions should now be common enough to want a paper
   trail.

## Stages (stop after each and ask; the user clears context between them)

1. **Skip blank entries at parse time.** `parse-bib.ts` leaves out any entry with no title, no author/editor
   and no year. Add the real-library gate fixture or a synthetic one covering a blank "Report"-type entry
   like the one that prompted this. Mutation check: remove the skip and confirm a test fails.
2. **Delete-if-unattached when missing.** Extend `applySync`'s missing branch: for a citekey not present in
   the new export, check `has_notes`, `reading_list_mentions` (indexed lookup) and the shared `@`-mention set
   (one pass per sync, not per citekey); delete the row if all three are empty, flag as today otherwise.
   Resolve open questions 1 and 3 first (they change what "unattached" checks and whether a trace is kept).
   Update `CLAUDE.md`'s "Never" line. Mutation check both directions (a notes-bearing row never deleted; a
   bare row never left flagged forever).
3. **Automatic rename matching by DOI/URL.** Within one sync's transaction, before falling back to plain
   insert/flag: if a vanished citekey and a newly-seen citekey share a non-empty DOI (or, absent that, a
   non-empty URL), update the existing row in place to the new citekey and fields instead of flag+insert. No
   UI. Test with a fixture pair sharing a DOI under two different citekeys.
4. **Suggested rename matching by title/authors/year.** Resolve open question 2 first. When no DOI/URL match
   is found but title+authors+year do, record a suggestion (new table or a column, implementer's choice) and
   surface it per the answer to question 2; confirming applies the same in-place update as stage 3, dismissing
   clears it without touching either row.

Drive each stage against a copy of the real library (`CENTRAL_COMMAND_HOME` scratch, per `CLAUDE.md`
"Testing the app for real"), not just unit tests — the original bug here was only visible by looking at the
running app.
