# Notes module: plan

Status: **approved, not built** (the user approved the design and the mockup, `docs/design/notes-mockup.html`; open it in a
browser). Nothing is built yet. Read it with `CLAUDE.md`, `docs/DECISIONS.md` and the Meetings and Training plans; Meetings is the pattern to
copy. "Ask" marks an open question at the end.

## What the user needs

A note-taking mechanism and one place where the various notes live, in Research. It replaces several modules the brief listed:

- **Data Sources** is not a module: it is a single note.
- **Inbox** is not a module: a quickly captured note that is never filed is simply an ungrouped note.
- **Thesis** is probably a group of notes (a subgroup per chapter), not a module.
- **Ideas** is undecided; the user will think about it later, so it is removed from the "Coming soon" row for now. **Studies** stays on
  it while its purpose is worked out.
- **Quick capture**: a shortcut that starts a note from anywhere in the app.

## Decisions (from the user)

- One **group** per note is enough, and **two levels** of nesting are enough (`Thesis / Methods`).
- Grouping is by a field on the note, not by folders (see Data model), so moving a note between groups never moves a file.
- **Pinned notes**: up to four, shown at the top of the landing page.
- **No slashes** anywhere. Nesting is shown with an arrow (`Thesis › Methods`) and stored as two keys, so nobody types a separator.
- **Quick capture works inside the app only** for now; a system-wide shortcut is a TODO for later.
- **Import from Obsidian** is wanted (see Stages).
- **Word count** in the editor, quiet, is nice to have but not required at first. **Created and updated dates** are shown on the note.
- New notes are created at once and opened (no pop-up), as with meetings and training entries.

## Data model

One Markdown file per note in `~/CentralCommand/notes/notes/<workspace>/` (only `research` for now; the code takes a workspace, as
Meetings does). Front matter, read leniently and written only for the keys the app owns (as in Meetings):

```yaml
---
title: Methods: participants   # optional; a note without one shows its first line
group: Thesis                   # optional
subgroup: Methods               # optional, only with a group; there are never more than two levels
pinned: true                    # optional; at most four notes are pinned
created: 2026-09-03
---
```

- **File name** follows the title (`Methods participants.md`, ` 2` if taken); an untitled note is `Untitled.md`, `Untitled 2.md`… and is
  renamed (never replacing a file) when it gets a title, as Meetings renames on a date change.
- **Groups are derived**: the list of groups is whatever the notes use. Making a group means typing a name in the Group field and
  saying what it sits inside (nothing, or an existing group); a group disappears with its last note. Choosing a group in a filter includes its subgroups. Names compare ignoring case and spacing, and the
  first spelling found wins, so "thesis" does not become a second group.
- **Edited** comes from the file's modified time, kept in the index, so edits made in another tool show too. **Created** is written once.
- **Index** (SQLite, migration `notes/0001_notes`): workspace, id, title, group, created, edited, plain-text excerpt for search, content hash.
  The files stay the source of truth.
- Safety as elsewhere: guarded saves (content hash), a new file never replaces one, delete goes to the macOS Trash after a confirmation.

## Screens (see the mockup)

1. **Landing** (`/research/notes`): header with **New note**; **Pinned** (up to four cards; pin from the note's page, disabled at four);
   Groups as cards (name, count, last edited, subgroups as a line), with **Ungrouped** as a dashed card; **Recent** with a "See all
   notes" link. Same landing components as Meetings and Training. **Many groups**: the landing shows the six most recently edited as
   cards (Ungrouped always among them) and "Show all" opens the rest as a compact row of names and counts below the cards, so the page
   stays short. Subgroups never get cards. The group selector on All notes scrolls and can be typed into.
2. **All notes** (`/research/notes/all`): search, a group selector (grouped, with subgroups), and a table (title, group, preview, edited).
   The page is titled with the group when one is chosen, so a filter is never hidden. The remembered list state uses `useModuleState`.
3. **A note** (`/research/notes/n/:id`): the title as a heading, a meta box (Group field, Created, Updated, Pin), the shared notes
   editor, Delete. The Group field is a menu of the existing groups (nested two levels, type to narrow it) with a "new group" input and an
   "Inside" selector. A quiet word count sits under the editor (last stage, optional).
4. **Quick capture**: `Mod-Shift-n` anywhere in the app makes an ungrouped note (in the current group when on a group page) and opens it
   with the cursor in the body. Registered in the module manifest's `shortcuts`, so it is listed in Settings, and matched with
   `matchesShortcut`.

## Reuse

The notes session, editor and watcher (`src/main/notes/`, `src/renderer/src/notes/`), `LandingPage`/`LandingHeader`/`SeriesCards`/`SeeAllLink`,
`FilterRow`, `SearchInput`, `Select`, `DeleteDialog`, `Dialog`, `useModuleState`, the table and list-key handling of the Meetings list.
The Group field is the one new component (a small menu; built like the people field so it looks alike).

## Stages (one or more small commits each; test, lint, typecheck pass at every checkpoint)

1. **Pure rules** in `shared/`: front matter read and write, groups (two levels, comparison, subgroup filter, the six-most-recent rule),
   pinning (at most four), list query, tests.
2. **Main core**: `notes-store` (create, read, guarded save, rename to match the title, delete to the Trash), index migration and
   repository, tests with a mutation check on the guards.
3. **IPC and API**: `Api` and `IPC` entries, `register.ts`, the folder watcher and change events.
4. **A note**: page, title, Group field, pin, editor, delete.
5. **All notes**: list, filters, remembered state, keyboard rows.
6. **Landing and card**, the module manifest and route; Ideas is already gone from the planned modules.
7. **Quick capture**: the shortcut, its Settings entry, and the "start in this group" behaviour.
8. **Import from Obsidian**: `npm run import:notes -- --vault <path> [--apply]`, a dry run by default like the other importers, with a
   safety check comparing each converted note to its source, and a backup and guarded write on apply. Needs the answers below first.
9. **Real-app pass** (scratch library, production build and dev mode, screenshots), then the word count, then docs.

## Later (on the TODO list)

- A **system-wide** quick-capture shortcut (works when Central Command is in the background).
- **Thesis extras**: chapter progress or word counts per chapter, on top of the Thesis group.
- The word count, if it is not done in stage 9.

## The Obsidian import (decided with the user)

The vault is `~/RHUL/Scribbles/RHUL` (the `.obsidian` folder is there). Its Readings, Meetings and Training folders were already imported
into their own modules and are skipped, as is `Assets` (a `.bib` export). The rest are "just notes", 12 in all, copied over as they
are (the user will clean them up afterwards):

| Vault folder | Notes                                                                                   |
| ------------ | --------------------------------------------------------------------------------------- |
| Data Sources | 6 (ASER, PIRLS, PISA, UK National Pupil Database, US Learning Achievement, Young Lives) |
| Ideas        | 3                                                                                       |
| Thesis       | 2 (Journals, Thesis Format)                                                             |
| Placement    | 1                                                                                       |

- The app has **no folders**, and **every imported note arrives ungrouped** (the user's decision); they group them afterwards. The vault
  folder is kept only as the note's `imported-from` path, so nothing is lost. The importer lists any deeper folders instead of guessing.
- The user wants Data Sources to be a single note eventually; the six come across separately and can be merged by hand.
- Body text is copied untouched (`[[wiki links]]` and `![[images]]` stay as written; the app does not follow them yet). Front matter gets
  `title` (the file name), `created` (the file's creation date) and `imported-from` (the vault path); any front matter the note
  already had is kept.
- Like the other importers: a dry run by default that lists every note and what it would get, a check that the converted note equals the
  source apart from the front matter, a backup and guarded write on `--apply`, and never a file replaced. It is run on the real vault
  only after a dry run has been read, and applied only when the user says so.

## Still open

- **Studies** stays on "Coming soon" until the user decides what it is (perhaps a group, with a subgroup per study).
- **Ideas**: the user will decide later whether it becomes something of its own.
