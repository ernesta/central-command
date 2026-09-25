# Notes module: plan

Status: **proposed** (the user has approved the direction and is reviewing the mockup, `docs/design/notes-mockup.html`; open it in a
browser). Nothing is built. Read it with `CLAUDE.md`, `docs/DECISIONS.md` and the Meetings and Training plans; Meetings is the pattern to
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
- New notes are created at once and opened (no pop-up), as with meetings and training entries.

## Data model

One Markdown file per note in `~/CentralCommand/notes/notes/<workspace>/` (only `research` for now; the code takes a workspace, as
Meetings does). Front matter, read leniently and written only for the keys the app owns (as in Meetings):

```yaml
---
title: Methods: participants   # optional; a note without one shows its first line
group: Thesis / Methods         # optional; "A" or "A / B", never deeper
created: 2026-09-03
---
```

- **File name** follows the title (`Methods participants.md`, ` 2` if taken); an untitled note is `Untitled.md`, `Untitled 2.md`… and is
  renamed (never replacing a file) when it gets a title, as Meetings renames on a date change.
- **Groups are derived**: the list of groups is whatever the notes use. Making a group means typing a name in the Group field; a group
  disappears with its last note. Choosing a group in a filter includes its subgroups. Names compare ignoring case and spacing, and the
  first spelling found wins, so "thesis" does not become a second group.
- **Edited** comes from the file's modified time, kept in the index, so edits made in another tool show too. **Created** is written once.
- **Index** (SQLite, migration `notes/0001_notes`): workspace, id, title, group, created, edited, plain-text excerpt for search, content hash.
  The files stay the source of truth.
- Safety as elsewhere: guarded saves (content hash), a new file never replaces one, delete goes to the macOS Trash after a confirmation.

## Screens (see the mockup)

1. **Landing** (`/research/notes`): header with **New note**; Groups as cards (name, count, last edited, subgroups), with **Ungrouped**
   as a dashed card; **Recent** with a "See all notes" link. Same landing components as Meetings and Training.
2. **All notes** (`/research/notes/all`): search, a group selector (grouped, with subgroups), and a table (title, group, preview, edited).
   The page is titled with the group when one is chosen, so a filter is never hidden. The remembered list state uses `useModuleState`.
3. **A note** (`/research/notes/n/:id`): the title as a heading, a meta box (Group field, created, edited), the shared notes editor,
   Delete. The Group field is a menu of the existing groups (nested two levels) with a "new group" input.
4. **Quick capture**: `Mod-Shift-n` anywhere in the app makes an ungrouped note (in the current group when on a group page) and opens it
   with the cursor in the body. Registered in the module manifest's `shortcuts`, so it is listed in Settings, and matched with
   `matchesShortcut`.

## Reuse

The notes session, editor and watcher (`src/main/notes/`, `src/renderer/src/notes/`), `LandingPage`/`LandingHeader`/`SeriesCards`/`SeeAllLink`,
`FilterRow`, `SearchInput`, `Select`, `DeleteDialog`, `Dialog`, `useModuleState`, the table and list-key handling of the Meetings list.
The Group field is the one new component (a small menu; built like the people field so it looks alike).

## Stages (one or more small commits each; test, lint, typecheck pass at every checkpoint)

1. **Pure rules** in `shared/`: front matter read and write, group paths (two levels, comparison, subgroup filter), list query, tests.
2. **Main core**: `notes-store` (create, read, guarded save, rename to match the title, delete to the Trash), index migration and
   repository, tests with a mutation check on the guards.
3. **IPC and API**: `Api` and `IPC` entries, `register.ts`, the folder watcher and change events.
4. **A note**: page, title, Group field, editor, delete.
5. **All notes**: list, filters, remembered state, keyboard rows.
6. **Landing and card**, the module manifest and route; Ideas removed from the planned modules.
7. **Quick capture**: the shortcut, its Settings entry, and the "start in this group" behaviour.
8. **Real-app pass**: scratch library, production build and dev mode, screenshots; then docs.

## Ask

1. **Pinned notes** on the landing (the mockup shows one for your Data sources note), or is Ungrouped/a group enough?
2. **System-wide shortcut**: should quick capture also work when Central Command is in the background? Left out of the first version.
3. **Import**: do you have loose notes (Obsidian, Word) to bring in, as with readings and meetings? Not planned unless you say so.
4. **Thesis extras**: chapter progress or word counts per chapter would be a later feature on top of the group; not planned now.
5. **Studies**: what should it be? It may turn out to be a group too (`Studies / Study 1`).
