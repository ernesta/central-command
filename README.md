# Central Command

A local-first desktop app that brings research, work and personal life into
one place, with Claude at its centre. Built with Electron, React and TypeScript.
Everything lives on your machine in open formats (SQLite and Markdown); nothing
is sent anywhere.

Phase 1 covers the app shell and **Readings**, synced one-way from Zotero, with a
Markdown notes editor. **Meetings** (notes for every meeting, with TODOs carried over from one meeting
to the next) is built on top of it. See `central-command-mvp-phase1-brief.md` for the full brief,
`docs/MEETINGS_PLAN.md` for the Meetings plan and `docs/ROADMAP.md` for what comes next.

## Requirements

- Node.js 22 or later (developed on 24) and npm

## Install and run

```sh
npm install
npm run dev        # start the app with hot reload
```

## Test, lint, type-check

```sh
npm test           # unit tests (Vitest, plain Node)
npm run lint
npm run typecheck
npm run format     # Prettier
```

## Where your data lives

Everything is stored under `~/CentralCommand/`:

```
~/CentralCommand/
├── data/central-command.sqlite      # metadata
├── data/zotero-export.bib          # default Zotero export target
├── data/people.json                # the people you meet with (name, initials, which one is you)
├── notes/readings/<citekey>.md     # your reading notes, one Markdown file each
├── notes/meetings/research/YYYY-MM-DD <Series>.md   # your meeting notes, one Markdown file each
└── settings.json
```

## Setting up Zotero sync

1. Install the [Better BibTeX](https://retorque.re/zotero-better-bibtex/) plugin
   for Zotero.
2. In Zotero, right-click your library and choose **Export Library…**.
3. Pick the **Better BibTeX** (or **Better BibLaTeX**) format.
4. Tick **Keep updated**.
5. Save the file to `~/CentralCommand/data/zotero-export.bib`, or to any path you
   then enter under **Settings → Zotero export path** in the app.

The app only ever reads this file. It never writes to Zotero or to the export.

To mark readings, tag them in Zotero with `read` or `to-read`. Every other tag
appears as a tag in the app.

## Copying an APA reference

Every reading page shows its APA 7 reference with a **Copy** button. It copies both plain text and
formatted text, so pasting into Word or Google Docs keeps the italics. Titles are put in sentence
case using Better BibTeX's case protection.

## Importing notes from Obsidian

If you kept reading notes in Obsidian with the Citation plugin:

```sh
npm run import:obsidian -- --vault ~/path/to/vault            # dry run: shows what would happen
npm run import:obsidian -- --vault ~/path/to/vault --apply    # writes the new note files
```

Notes are matched to your Zotero library by title and year, converted (wikilinks become plain
text, the plugin's header is dropped) and written as new files in `~/CentralCommand/notes/readings/`.
Your vault is never modified and existing notes are never overwritten.

## Meetings

Meetings live under **Research → Meetings**. Each meeting is one Markdown file
(`notes/meetings/research/2026-09-24 Supervision.md`) with a small header (series, date, start, end, type,
attendees) and three sections: **Summary**, **Previous TODOs** and **Notes**. The files are the source of
truth: Claude Code or Obsidian can edit them, and the app notices. The database only keeps a rebuildable index.

- **Landing page:** the open TODOs (Everyone or Mine), a card per series, and the recent and upcoming meetings.
- **All meetings:** newest first, searchable, with series, attendee and type filters. Choosing the Supervision
  series gives your supervision log. Upcoming meetings are shown and marked.
- **A meeting:** the details above the note, a Topics panel beside it (built from the `###` headings under
  Notes; tick one when it has been discussed), and Delete (the file goes to the macOS Trash after you confirm).
- **TODOs:** write `**TODO(EO)**: something` anywhere in your notes (also `TODO (EO):`, `TODO(KR & AC):` and
  `TODO:`), or type `/todo` (or press Cmd/Ctrl+Shift+T) and pick an owner. When you create or open a meeting, the
  open TODOs of the previous meeting in the same series are added to its **Previous TODOs**; only ever added,
  never removed, and ticks are yours.
- **People:** Settings → People. Initials are unique. Marking yourself as "me" turns on the Mine view.
- **File names** follow the date and series; changing either in the app renames the file.

### Importing your existing meeting notes (macOS)

```sh
npm run import:meetings -- --vault ~/path/to/vault --meeting-notes ~/path/to/"Meeting Notes"            # dry run
npm run import:meetings -- --vault ~/path/to/vault --meeting-notes ~/path/to/"Meeting Notes" --apply --add-people
```

It reads the Obsidian meeting notes, the Word supervisor log and the Word notes (for start and end times), prints
every mapping and anything that did not line up, and lists what to check yourself (wrong dates in Obsidian, durations that
differ between the log and the notes, meetings with no times). Nothing is guessed, your sources are never modified,
existing meetings are never overwritten, and running it again writes nothing.
