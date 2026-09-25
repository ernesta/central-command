# Roadmap

## TODOs

### For the user (review and decisions)

- [ ] **Review the exports** once there is data to look at: Training's **Export** (a PDF of an academic year, oldest first, no upcoming
      or planned entries) and Meetings' **Export** (the Supervision log as a PDF, same page layout as Training's). Say what to change in the
      layout and content of both.
- [ ] **Choose a type for each imported training** (all 129 start without one; the list says "No type yet"). Seminars, inductions, lab
      meetings and self-guided learning have no Inkpath type: map them by hand and keep a decision log of why, so categorising can
      be automated later.
- [ ] **One imported training broke the rules**: _Making your research transparent and reproducible (Live)_ (28 Jan 2026) has five skills in
      Inkpath and the app allows three. The first three were kept; left out: Digital and bibliographic skills (GS), Intellectual property
      rights (GS). Decide which three to keep. (Review this together with the other training TODOs.)
- [ ] **Review the initials of the 18 people added from your notes** (People page): a few got numbered initials because of clashes
      (Cilla Harries CH2, Kathryn Redway KR2, Robyn Muir RM2). `npm run people:from-notes` was applied on 25 Sep 2026; the previous list
      is `people.json.backup-<time>` in `~/CentralCommand/data/`. Restart the app before using the People page.
- [ ] **Four supervision meetings have times that differ from the Inkpath log** (the files were left as they are): 11 Nov 2025 (file
      15:30–16:00, log 15:30–16:30), 16 Oct 2025 (14:00–14:30 against 14:00–14:15), 26 Jun 2026 (10:00–11:45 against 10:00–11:15), 29 May 2026
      (11:00–12:00 against 11:00–11:45). Say which is right.
- [ ] **Two Rastle Lab meetings in the log have no meeting file** (1 Jun 2026 13:00–14:00 and 22 Jun 2026 15:00–16:00; create the meeting files if wanted).
- [ ] **Twelve trainings have typed hours that differ from the times** (for example Rapid Reading typed 0 h, times give 3 h). The app
      uses the times; check the times are right. `npm run import:training` lists them.
- [ ] **The 61 entries only in the older Word training log** (no twin in the Inkpath log) were not imported. Say if any should be.
- [ ] **Set the Trainings folder** in Settings → Training (`/Users/ernesta/RHUL/Trainings`) if not done, so the Files panels work.
- [ ] Review the keyboard shortcuts listed in Settings (still open from Meetings).
- [ ] **Try the Training plan** (Training → Training plan). Your draft was copied in as the 2026–27 plan; edit it there.
- [ ] After the user's review: fix what they raise, then push, write up the state, clear context and move on to the next part.
- [ ] A "decision log" for training types (see above): design it with the user when they start mapping; then suggest types automatically.
- [x] **People page built** (see `docs/DECISIONS.md` "People page"). Waiting for the user's review.
- [ ] **Decide what Studies should be** (it stays "Coming soon"); and later what Ideas becomes.
- [x] **Notes built** (all nine stages of `docs/NOTES_PLAN.md`; see `docs/DECISIONS.md`, "Notes"). Waiting for the user's review.
- [ ] **Review Notes** against the mockup (`docs/design/notes-mockup.html`): the landing, All notes, a note (Group field, pin, dates, word
      count) and quick capture (Mod-Shift-n). Say what to change.
- [ ] **Read the Notes import dry run and say when to apply it**: `npm run import:notes -- --vault ~/RHUL/Scribbles/RHUL` lists the 12
      notes and the front matter each would get (all ungrouped). It has not been run on the real library; apply only when the user says so.
- [ ] **Decide about `[[wiki links]]` in imported notes**: the import copies them untouched, but the editor rewrites them as `\[\[Link]]`
      the first time a note is edited (the editor escapes bare `[`, a known choice in `docs/DECISIONS.md`). An un-escape for `[[` and
      `![[` in the shared editor would fix it for every module; it changes Readings and Meetings too, so it is the user's call.
- [ ] **Later, Notes**: a system-wide quick-capture shortcut (works when the app is in the background); Thesis extras (chapter progress,
      word counts per chapter).
- [ ] **Claude, later**: Meetings' and Training's tables still carry their own copy of the row-key handling that Notes gets from
      `useRowNavigation`; switch them over once there is real data to check them against.
- [ ] **Empty notes pile up**: "New note" and the shortcut create the file at once, so a note started and never typed in stays as an empty
      `Untitled`. Say if untouched empty notes should be removed when you leave them.
- [ ] **Try the People page** (Research → People) and say what to change.
- [ ] Re-check the changed screens in dev mode (StrictMode) and the built app after any further change to lists, landings or entry pages.
- [ ] **Say when a filter is applied** (later, the user's call when): opening the Supervision series card shows "All meetings" with only that
      series in it. See the Meetings follow-ups.
- [ ] The Readings follow-ups below are still open.

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
- **People page**: built. Later it could hold links per person (GitHub,
  Google Scholar, LinkedIn) and even pull their recent papers, posts or tweets. Training leads and meeting attendees both use it.
- **Export the supervision log as a PDF**: built (`meetings/shared/report.ts`; printing in `src/main/export-pdf.ts` and the page
  shell in `src/shared/report-page.ts` are shared with Training). Awaiting the user's review of the layout.
- **Meetings in Work**: the code takes a workspace everywhere (`notes/meetings/<workspace>/`); Work needs a folder,
  a route and a landing page from the same components. `ACTIVE_WORKSPACES` in `meetings/main/register.ts` is the switch.
- **Imported notes with bold pseudo-headings** (`**Topic**`): the converter is built (`npm run convert:topics`, dry run by
  default). Its dry run on the real notes finds 14 lines in 5 notes; applying it is the user's call.
- **Imported previous items with a status word** (`(Cancelled) **TODO(EO)**: …`) are ownerless Previous TODOs and carry
  over while unticked; the user may want to tick or delete them in the newest notes.
- **Backspace at the start of a first-line bullet** did not lift the bullet in a scripted run of the real app (unit
  test passes); unconfirmed, check by hand.

## Training (built; awaiting the user's review)

All ten stages of `docs/TRAINING_PLAN.md` are done, plus the Meetings additions (academic year selector, skills, hours counter).
`docs/DECISIONS.md` (Training) records what was decided and found. The importers have been dry-run on the user's real files;
neither has been applied to the real library.

### Training follow-ups (not started; the user decides when)

- **Apply the imports** to the real library when the user says so: `npm run import:training -- --inkpath <xlsx> --obsidian
<notes> --trainings <folder> --apply` (129 entries, 10 notes matched, 38 folders linked) and `npm run reconcile:meetings --
--inkpath <xlsx> --apply` (35 meeting files get skills and missing times; 4 times differ and are only reported).
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
- **Notes** (one module for free notes with a group per note, pinned notes, quick capture; replaces Thesis, Data Sources and Inbox): plan
  `docs/NOTES_PLAN.md` and mockup `docs/design/notes-mockup.html` are approved; built (nine stages), see the Notes section above and `docs/DECISIONS.md`. Studies stays "Coming soon".
- Global dashboard (priorities, calendar, weather, unread email count)
- World news tab, Research Digest, Focus/Writing space
- Life and Work workspaces
- Books module (following the Readings pattern)
- Dark mode and theme switching, packaging and public release
