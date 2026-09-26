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
- [ ] Review the keyboard shortcuts listed in Settings (still open from Meetings).
- [ ] **Try the Training plan** (Training → Training plan). Your draft was copied in as the 2026–27 plan; edit it there.
- [ ] After the user's review: fix what they raise, then push, write up the state, clear context and move on to the next part.
- [ ] A "decision log" for training types (see above): design it with the user when they start mapping; then suggest types automatically.
- [x] **People page built** (see `docs/DECISIONS.md` "People page"). Waiting for the user's review.
- [ ] **Decide what Studies should be** (it stays "Coming soon"); and later what Ideas becomes.
- [x] **Notes built** (all nine stages of `docs/NOTES_PLAN.md`; see `docs/DECISIONS.md`, "Notes"), pushed. Waiting for the user's review.
- [ ] **Review Notes** against the mockup (`docs/design/notes-mockup.html`): the landing, All notes, a note (Group and Pin beside the
      title; the editor card with Created, Edited and word count under the text) and quick capture (Mod-Shift-n). The editor card is now
      on every editor (Meetings, Training, the plan, Readings notes). Say what to change, and whether Created should also be recorded for
      Meetings, Training and Readings notes (see `docs/DECISIONS.md`, "Editor card").
- [x] **Notes import applied** on 25 Sep 2026: 12 notes from Data Sources, Ideas, Thesis and Placement are in
      `~/CentralCommand/notes/notes/research/`, all ungrouped, wiki links stripped. Group them in the app.
- [ ] **Group the 12 imported notes** (Notes → Ungrouped). The user wants Data Sources to become a single note eventually; the six
      came across separately.
- [ ] **Later, Notes**: a system-wide quick-capture shortcut (works when the app is in the background); Thesis extras (chapter progress,
      word counts per chapter).
- [ ] **Try the People page** (Research → People) and say what to change.
- [ ] Re-check the changed screens in dev mode (StrictMode) and the built app after any further change to lists, landings or entry pages
      (last done for the editor card on 26 Sep 2026).
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
- **Imported notes with bold pseudo-headings** (`**Topic**`): converted (`npm run convert:topics`, applied 25 Sep 2026; a dry run now finds nothing).
- **Imported previous items with a status word** (`(Cancelled) **TODO(EO)**: …`) are ownerless Previous TODOs and carry
  over while unticked; the user may want to tick or delete them in the newest notes.
- **Backspace at the start of a first-line bullet**: checked by hand in the built app on 26 Sep 2026 (typed `- first item`, Cmd+Left,
  Backspace): the bullet lifts to a paragraph at once. Resolved.

## Training (built; awaiting the user's review)

All ten stages of `docs/TRAINING_PLAN.md` are done, plus the Meetings additions (academic year selector, skills, hours counter).
`docs/DECISIONS.md` (Training) records what was decided and found. The importers have been dry-run on the user's real files;
both have been applied to the real library.

### Training follow-ups (not started; the user decides when)

- **Imports and conversions are all applied** (checked on 26 Sep 2026: every dry run reports nothing left to write: training 129 already
  there, 35 meeting files agree with the log, 12 notes, 17 reading notes, topics converted, people added). What is left is for you to
  decide: 10 Obsidian training notes found no matching activity (Psychology/Peer Review, Starting Your PhD, Annual Reviews and Upgrade;
  SEDarc Induction and five SEDarc method sessions and Data Management and Security; University/Central Induction), so their text is
  not in the app; the four differing meeting times and the two Rastle Lab meetings without a file (both above).
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

## Ideas (suggested 26 Sep 2026; each needs a mockup and a plan, then the user's approval, before building)

Grounded in what the app already stores. Numbers are the ones used in the conversation.

**People, extended** (the list, rewrites and archive are built)

1. A page per person: their meetings and trainings (newest first), the open TODOs they own, when you last met, the next meeting.
2. A "prepare for the meeting" view from an upcoming meeting: what you owe them, what they owe you, the last meeting's topics.
3. Optional links per person (Scholar, GitHub, website), stored only. Pulling in their papers needs the network: later.
4. A "haven't met in a while" line for chosen people, with a threshold in Settings.

**A Home page before Life, Research and Work** (the brief's global dashboard; cards reuse the landing components) 5. Greeting, date and a small week strip (meetings and trainings as dots). 6. Weather (city and forecast only). Needs a decision: `CLAUDE.md` says never send user data over the network; weather would be an opt-in
(off by default, the city typed in Settings, nothing else sent) and the rule amended to say exactly that. 7. Today: meetings, your open TODOs, trainings. 8. Progress: training hours against the aim, meeting hours, reading counts. 9. Pinned notes and recent edits (the Notes landing components). 10. A "resume" card back to the last note or reading.

**Writing and focus** 11. A daily writing tally from the word counts (days written, a streak, a weekly total; no target to set). 12. A thesis chapters view: a Notes group per chapter with words and a target (already noted under Notes, later). 13. A distraction-free writing mode for any note.

**Small additions** 14. Global search: **built** (Mod-K; `docs/DECISIONS.md`, "Global search"), including whole-note text and the Training plans. Later:
people as results (with the People pages) and recent items when the field is empty. 15. A weekly review page (meetings, trainings, notes edited, words written), exportable as a PDF with the existing export. 16. Gentle prompts ("no supervision meeting booked this month", "training hours are behind pace").

## Home (the overall landing page): ideas and open questions (26 Sep 2026; nothing designed yet)

Decided so far: cross-workspace page (not Research-first). **Wanted:** greeting, date and a week strip (5 above); weather (6, network
allowed for it: the `CLAUDE.md` rule must be amended to say exactly what is sent); Today (7: meetings, your open TODOs, trainings).
**Not wanted on Home:** Research progress (8), pinned notes and recent edits (9) and a resume card (10); they belong on Research.

More ideas, to choose from before any design (default pick: 1, 2, 3, 4, 9, 14, 15):

- Things to act on: 1 priorities (up to three lines typed for today, unfinished ones carry over); 2 "Needs attention" (a note whose front
  matter has a problem, a reading missing from Zotero, a TODO past its date, a file changed outside the app; "All clear" when empty);
  3 "Dates ahead" (your own deadlines and milestones with days to go, edited on the card); 4 a capture bar (a line that becomes a note)
  with New meeting, New note and New training links.
- Time and place: 5 a calendar agenda from a local calendar file plus meetings and trainings; 6 other clocks (time zones you choose);
  7 sun times and when rain starts beside the weather; 8 unread email count (needs a mail connection; parked with the network features).
- Reflection and rhythm (automatic): 9 "Today so far" / "Yesterday" from what the app knows (notes edited, words written, meetings and
  trainings), with a planning tone in the morning and a wrap-up in the evening; 10 a one-line day log saved as a note per day (feeds the
  weekly review); 11 habit ticks with streaks that count days, not amounts; 12 "Changed while you were away" (files another tool, such
  as Claude Code, edited).
- Around people: 13 birthdays and anniversaries this week, from an optional date on each person (with the People pages).
- The page itself: 14 workspace tiles (Life, Research, Work, each with one line of status, so Home is also how you get around);
  15 choose, show or hide and reorder the cards in Settings (the brief names visual customisability as the main reason for leaving
  Notion and ClickUp, so build it in from the start); 16 an Ask box for the Claude integration; 17 a focus session (a 25-minute timer
  attached to a note that logs time and feeds the writing tally).

Open questions for the design: single-column "morning briefing" or a grid of small cards; whether Home opens at launch and sits in the
top bar before Life, Research and Work, or replaces the workspace pills. Sources for the ideas: personal-dashboard and habit-tracker
templates (Notion, Asana), Athenify, and the daily-dashboard projects on GitHub.

## Before a public release: what needs the user's decision

Nothing here is started; each is a choice, not just work. Already in place: packaging config (`electron-builder.yml`, icons in
`build/`), a light and dark theme, local-only data, no telemetry, and a right-click menu and link opening in the editor.

- **Licence** for the code (none chosen yet) and whether the source is public. The Build button assumes a source checkout, see the
  product vision above.
- **Signing and notarising** the macOS app (needs an Apple Developer account; `notarize` is off) and, for Windows, a certificate.
- **Updates:** where releases are hosted and whether the app checks for them (an update check is a network request).
- **Name and icon:** the app name is one constant (`src/shared/app-info.ts`); the icon is a placeholder to replace.
- **First-run experience:** what a new user sees with no Zotero export, no repo path and no data (Settings explains each field now).
- **A privacy line** in the README and Settings: what stays on the computer, and what the future network features (weather, Claude)
  would send.
- **Other platforms:** the Build button and the trash move are macOS-first; Windows and Linux need checking.

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
- Dark mode: **built** (Settings → Theme). Packaging and public release
