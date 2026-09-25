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

- **TODO for the user: review the keyboard shortcuts** listed in Settings and say which to change or drop. Nothing has been
  reviewed yet; the list was grouped so the short ones come first and the long editor list last.
- **Say when a filter is applied.** Opening a series card (for example Supervision) shows the page titled "All meetings" with
  only that series in it, which is easy to miss. Make the page say so (a different title or a visible "Showing Supervision
  only" line with a way to clear it). Not started.
- **The Readings list has no back arrow** to the Research landing page (Meetings now has one). Same small fix if wanted.
- **A People page** of its own: the list will get too long for Settings. Later it could hold links per person (GitHub,
  Google Scholar, LinkedIn) and even pull their recent papers, posts or tweets. Training leads and meeting attendees both use it.
- **Export the supervision log as a PDF** (oldest first, Supervision series, upcoming meetings left out). The disabled
  Export control in the list is its place; Training's PDF export (`training/main/register.ts`, `shared/report.ts`) is the pattern.
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

## Training (built; awaiting the user's review)

All ten stages of `docs/TRAINING_PLAN.md` are done, plus the Meetings additions (academic year selector, skills, hours counter).
`docs/DECISIONS.md` (Training) records what was decided and found. The importers have been dry-run on the user's real files;
neither has been applied to the real library.

### Training follow-ups (not started; the user decides when)

- **Apply the imports** to the real library when the user says so: `npm run import:training -- --inkpath <xlsx> --obsidian
<notes> --trainings <folder> --apply` (129 entries, 10 notes matched, 38 folders linked) and `npm run reconcile:meetings --
--inkpath <xlsx> --apply` (35 meeting files get skills and missing times; 4 times differ and are only reported).
- **Choose a type for each imported entry** (all start without one) and **the review list** (one entry had five skills).
- **A decision log for types Inkpath has no type for** (seminars, inductions, lab meetings, self-guided learning): the user maps
  them by hand and records why, so categorising can be automated later.
- **Show meetings in the Training PDF?** Only a line with the hours is included; the meetings are not listed.
- **Inkpath's Organisation, Points and Date Completed** are kept in the front matter (Organisation and Points are read) but
  not shown or used.
- **Long titles** are cut at 80 characters in file names (the front matter title is complete).

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

- Real Claude wiring for the Ask panel; embedded terminal for Build
- Shared task engine (tasks, dates, time tracking, lists, subtasks, table/board/calendar views) and a one-time ClickUp import
- **Training** (the formal training log, a notes page per entry, linked files, PDF export): the plan and mockup are drafted in
  `docs/TRAINING_PLAN.md` and `docs/design/training-mockup.html`; built; see the Training section above.
- Studies, Thesis, Ideas, Data Sources, Inbox
- Global dashboard (priorities, calendar, weather, unread email count)
- World news tab, Research Digest, Focus/Writing space
- Life and Work workspaces
- Books module (following the Readings pattern)
- Dark mode and theme switching, packaging and public release
