# Roadmap

## Phase 1 (complete; awaiting final review and push)

App shell plus Readings (Zotero one-way sync, notes editor). See
`central-command-mvp-phase1-brief.md`.

- [x] Foundations: scaffold, secure IPC, SQLite migrations, settings, fonts, tokens, base components, docs
- [x] Shell: workspaces, Settings screen, Build button, Ask launcher, module manifests
- [x] Readings data and sync
- [x] Readings UI and Research landing page
- [x] Reading detail and Markdown notes editor
- [x] Polish pass

## Meetings (complete; awaiting the user's review and the push)

All nine stages of `docs/MEETINGS_PLAN.md` are done (shared notes machinery, main-process core, TODO and topic rules,
the meeting page, the list, the landing page, People settings and remembered list state, the import, polish).
`docs/DECISIONS.md` records what was decided and found along the way. The import has been run on the user's real notes.

### Meetings follow-ups (not started; the user decides when)

- **Export the supervision log as a PDF** (oldest first, Supervision series, upcoming meetings left out). The disabled
  Export control in the list is its place.
- **Meetings in Work**: the code takes a workspace everywhere (`notes/meetings/<workspace>/`); Work needs a folder,
  a route and a landing page from the same components. `ACTIVE_WORKSPACES` in `meetings/main/register.ts` is the switch.
- **Imported notes with bold pseudo-headings** (`**Topic**`): the converter is built (`npm run convert:topics`, dry run by
  default). Its dry run on the real notes finds 14 lines in 5 notes; applying it is the user's call.
- **Imported previous items with a status word** (`(Cancelled) **TODO(EO)**: …`) are ownerless Previous TODOs and carry
  over while unticked; the user may want to tick or delete them in the newest notes.
- **Backspace at the start of a first-line bullet** did not lift the bullet in a scripted run of the real app (unit
  test passes); unconfirmed, check by hand.
- **Renaming a person** does not rewrite meeting files (by design); a "rewrite this name in all meetings" action could be
  offered explicitly if wanted.

## Product vision: Build is a headline feature

If Central Command is ever released, the Build button ("change your software to
work for you") is its most distinctive feature, not a developer-only tool. A
released app would need to make that work for people who install it: a
source checkout the app can edit (or a sandboxed equivalent), a way to hot-reload
or rebuild after changes, and safety nets for bad edits (git history, easy
rollback). Keep this in mind when making structural choices: modules stay
self-contained and data stays outside the code so users' changes can't lose their
data.

## Later, roughly in order (not for Phase 1)

- **A list of keyboard shortcuts**, probably in Settings (asked for during Meetings: Cmd/Ctrl+[ back, Cmd/Ctrl+Shift+T and
  `/todo` for the TODO helper, the shortcuts of the notes editor, and so on). Add each new shortcut to it as it is built.
- Real Claude wiring for the Ask panel; embedded terminal for Build
- Shared task engine (tasks, dates, time tracking, lists, subtasks, table/board/calendar views) and a one-time ClickUp import
- Studies, Thesis, Training (notes, log, PDF export), Ideas, Data Sources, Inbox
- Global dashboard (priorities, calendar, weather, unread email count)
- World news tab, Research Digest, Focus/Writing space
- Life and Work workspaces
- Books module (following the Readings pattern)
- Dark mode and theme switching, packaging and public release
