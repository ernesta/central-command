# Watch: the page, the sources and what they replace (plan)

Agreed with the user on 26 Oct 2026 after three rounds of mockups (`docs/design/watch-mockup.html`, the current one; the 15 Oct mockup it replaces was made in an unattended run and invented its own chips and cards). **Stop at the end of each stage and ask.** Backend: `docs/WATCH_HOME_PLAN.md`, `src/modules/watch/`. **Since 28 Oct 2026 Watch is per workspace (Research's and Life's, each with its own sources): `docs/LIFE_HOME_PLAN.md`, stage 4, and `docs/DECISIONS.md`, "Watch: sources per workspace". Where this plan says Research's, read "a workspace's".**

## What Watch is

Watch checks public pages and feeds the user lists (training providers, conference sites, LINGUIST List) so they stop checking by hand, and says what is new. It replaces the monthly "Check upcoming …" reminders: there is no monthly rhythm, sources are checked daily by default (settable per source) and the user only hears about what changed.

## Decisions (the user's, 26 Oct 2026; do not re-ask)

- **Reuse the app's own parts, no new design language.** The page is shaped like the Training landing: `LandingPage`, `LandingHeader`, `LandingSection`, `SeeAllLink`, the recent-list rows, the "New" pill the "Upcoming" badge uses, icon buttons with `Tooltip`. The list page ("See all trainings →") is shaped like All training (`FilterRow`, `SearchInput`, `Select`, `ListTable`, `GroupRow` "New" / "Earlier"). No chips of our own, no status words ("Working", "Deadline").
- **Trainings and Conferences are separate** sections and separate lists. Kinds are just those two for now (a journals list may come later; summer schools count as trainings).
- **No keywords in the first build.** Nothing in the UI mentions them (the backend keeps them; the "relevant" notification rule stays off).
- **No source cards.** (The mockup's first version had a card per source; the user found them unnecessary.) The page is: header, Saved, Trainings, Conferences.
- **Header:** "Watch", a `Sources` link (opens Settings → Watch) and `Check now`.
- **Items:** a row is the day found, title (+ "New" pill while unseen), source, a note ("Apply by 5 Nov" only when the text names a deadline; nothing otherwise), and two icon buttons: save (bookmark) and dismiss. A row opens the item's page in the browser.
- **Saved** is a section shown only when something is saved. **Only saved items' deadlines appear in Home's "Coming up"** (and in a notification N days before); unsaved items never do.
- **Sources live in Settings → Watch**: a plain table (Source and address, Kind, Every, Last checked). A working source just shows when it was checked; only a failing one says so ("Can't open: 3 tries", in the danger colour). A row opens a dialog to edit (name, address, kind, how often) or remove. `Add source` there.
- **No monthly reminder.** `watch:from-tasks` stays only as a one-time import of the 16 addresses in the four reminders (3 summer schools and 8 external trainings become Trainings, 5 conferences become Conferences); run `--apply` only when the user says so, app closed. The reminders and the `taskUid`/`groupLabel` link are then unused; do not tick or create tasks from Watch. **Partly reversed 30 Oct 2026 (`docs/WATCH_TASKS_PLAN.md`, the user's go-ahead): a row has a "Task" button that opens the New task dialog filled in from the item. This is still not a monthly reminder and Watch still never creates a task by itself; the button is the user's own act.**
- **By hand, listed once under Sources:** the Royal Holloway intranet and the Essex Box folder (cannot be opened), and Researcher Development Programme and SEDarc (Inkpath) (no address).

## Stages

**Stages 1 to 5 built 26 Oct 2026 in one unattended run (the user's override of "stop at every stage"); stage 6 waits for the user's go-ahead.** See `docs/DECISIONS.md`, "Watch: the page, the sources and what they replace".

1. ✅ **Backend adjustments.** Two kinds in the UI (map `summer-school` to training; migration only if needed, a new numbered one); items list by kind and by state (`new`, `seen`, `saved`, `dismissed`); a first view of an item marks it seen; the daily default interval; deadlines reach Home's Coming up and the notification only for `saved` items (`home/shared/summary.ts`: `watch.upcoming` now takes any item). Tests, including a mutation check on the saved-only rule. Nothing visible.
2. ✅ **The Watch page** (`/research/watch`, module manifest, landing card): header, Saved, Trainings, Conferences, empty and "nothing yet" states (no sources: a message and `Add source`; nothing is requested while there are none). Drive it in a scratch library, production build and dev mode, light and dark.
3. ✅ **See all trainings / See all conferences**: the list page (search, source, "Not dismissed" / New / Saved / Dismissed), `GroupRow`s.
4. ✅ **Settings → Watch**: the sources table and the add/edit dialog (suggestions, the by-hand lines and the notification switches were removed 26 Oct 2026); `shortcuts` unchanged.
5. ✅ **Home and notifications**: saved items' deadlines in Coming up; the notification switch (off by default) for new items and for a saved deadline. Quiet hours stay an open question (`docs/WATCH_HOME_PLAN.md`).
6. **Import** (user's go-ahead only): `npm run watch:from-tasks -- --apply`.

Not in this plan: keywords, journals, `in:watch` search, the Swift widget.

## Open questions (asked later, the user's order)

Journals: which to keep. Quiet hours. Addresses for the two places without one.
