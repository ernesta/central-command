# Research: one academic year filter for the whole workspace (plan, 3 Nov 2026)

> **Status, 3 Nov 2026: all six stages BUILT and driven in a scratch library (production build and dev mode, light only); pushed and installed.** Choices the plan left open, and what driving found: `docs/DECISIONS.md`, "Research: one academic year filter". Originally: Agreed with the user on 3 Nov 2026 (do not re-ask): the same idea as Work's contract filter
> (`docs/WORK_CONTRACT_FILTER_PLAN.md`, `docs/DECISIONS.md`, "Work: one contract filter"), for Research and its academic years. Read both,
> `docs/DECISIONS.md` ("Hours and Time off": the shared 52-week year) and `CLAUDE.md` first.

## What exists (reviewed 3 Nov 2026)

- Research pages that pick a year do it each on their own: `useYear` (`state/use-year.ts`: URL `?year=`, not remembered, opens on the current
  year) through `usePeriod` (Meetings page, landing, card), directly in Training (`TrainingPage`, `TrainingLanding`, `TrainingPlanPage`), and
  `useTrackingYear` (Hours, Time off). The dropdown is `YearSelect` (via `PeriodSelect` on Hours and Meetings), in each page's header.
- Work's filter is in the top bar beside the workspace tabs: `shell/WorkContractFilter.tsx`, the pages that follow it listed in
  `shell/contract-filter-pages.ts`, one shared remembered value in `state/use-contract-filter.ts` (`useSyncExternalStore`, saved in
  `ui.moduleState['work-contract']`), the control `components/ContractFilter.tsx`.
- Research years are the Settings list `yearStarts` (52 weeks from a Monday), named `2026–27` (`yearLabel`, `yearsPresent`, `currentYear` in
  `src/shared/year.ts`).

## The model

- **One scope per workspace: `'all'` or an academic year's start date.** Remembered like Work's (key `research-year`), shared by the top bar and
  the page under it, falls back to All when the remembered year no longer exists. Opens on **All years** the first time.
- **One selector in the top bar beside the workspace tabs, while Research is active and on a page that follows it**, built on `Select`, no
  visible label (as Work's after its second pass; the selector's accessible label says "Academic year"). Options: `All years`, then each year
  newest first (`2026–27`). Reuse `ContractFilter`'s shape where it fits; do not copy-paste a second component if one can take both.
- **`?year=<start>` (or `all`) in a link still works** and sets the scope for that visit, as in Work.
- **Replace the per-page selectors in Research** (Meetings page, landing and card; Training page, landing and plan; Hours; Time off) with the
  one filter. Life keeps its per-page selectors, untouched. `PeriodSelect` already returns nothing for Work; it must also return nothing for
  Research.
- **Under All years**: lists show every item of every year. A page that can only mean one year (the Training plan, the Hours/Time off grids, the
  Meetings PDF export) uses the current year under All, and says so in the least wordy way (no new explanatory sentences; ask if unsure).
  Write each such choice down in `docs/DECISIONS.md`.
- **Under one year**: every page looks as it does today for that year.

## Pages (decide the unclear rows by reading the code; write the choice down)

| Page                         | One year                                                                                                            | All years                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Meetings page, landing, card | that year's meetings                                                                                                | every Research meeting; Export PDF uses the current year  |
| Training page, landing       | that year's entries                                                                                                 | every entry                                               |
| Training plan                | that year's plan                                                                                                    | current year's plan                                       |
| Hours, Time off (Research)   | as today for that year                                                                                              | current year (they are grids of one year; no merged view) |
| Home (Research)              | cards and lists of that year only                                                                                   | as today                                                  |
| Tasks (lists, cards, Home)   | tasks whose due date is in that year; **no due date: always shown; open and late from an earlier year: also shown** | all tasks                                                 |
| Notes, Readings, People      | no year notion: **not filtered**                                                                                    | same                                                      |

## Stages (the user asked for all of them in one run, so the stop-at-every-stage rule does not apply; commit each stage separately, test + lint + typecheck before each commit)

1. **Rules.** Pure functions in `src/shared/`: the scope type (reuse or generalise `ContractScope`'s `all` value; do not duplicate
   `validScope`), `scopeYearStarts` (which years a scope covers, and `inScopeYear(date)`), the current-year fallback under All. Tests, with
   mutation checks (drop a year, count a date at a year's boundary in both years, accept a removed year).
2. **State and selector.** `useYearFilter('research')`, remembered and shared like `useContractFilter`; the top-bar component and the page list
   (`research-year-pages.ts`, with a test like `contract-filter-pages.test.ts`); remove `YearSelect` from the Research pages above. Component tests for options, order,
   no visible label, remembered choice, `?year=`, and a removed year falling back to All. Check `components/clickables.test.ts` and the `Select`
   rule in `CLAUDE.md`.
3. **Meetings** (page, landing, card, `usePeriod`) and **Training** (page, landing, plan) follow the scope.
4. **Hours and Time off** under both scopes as in the table.
5. **Tasks** (lists, cards, the add bar's list menu left alone as in Work's first pass) by the due-date rule in the table, with tests for undated, late-from-earlier and a due date on a year's first and last day. **Home** (Research): lists and cards under one year. Then the main-process summary if it depends on a page's chosen year
   (`home/main/collect.ts`); it must not.
6. **Drive it and write up.** Drive on a scratch library (`CENTRAL_COMMAND_HOME`; never the real one), production build and dev mode, light and
   dark, with items in two different years: Home, Meetings, Training, Hours and Time off under All and under each year; real keystrokes to open
   the selector, pick, and check the choice survives a restart and navigation, and that Work and Life are unchanged. Read the screenshots; fix
   what they show. Then `docs/DECISIONS.md` ("Research: one academic year filter", with every All-years choice and anything driving found),
   `docs/ROADMAP.md` (what is built; a "For you" list of what to look at in the installed app; list what was not driven), `docs/CLAUDE_ARCHIVE.md`,
   `CLAUDE.md` ("What is built" only if it changes) and this plan's status line.

## Out of scope

Life; Work; changing how years are defined or edited in Settings; filtering Notes, Readings or People by year;
redesigning cards; OS notifications.
