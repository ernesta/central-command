# Central Command

A local-first desktop app that brings research, work and personal life into
one place, with Claude at its centre. Built with Electron, React and TypeScript.
Everything lives on your machine in open formats (SQLite and Markdown); nothing
is sent anywhere.

Phase 1 covers the app shell and **Readings**, synced one-way from Zotero, with a
Markdown notes editor. See `central-command-mvp-phase1-brief.md` for the full
brief and `docs/ROADMAP.md` for what comes next.

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
├── notes/readings/<citekey>.md     # your notes, one Markdown file each
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
