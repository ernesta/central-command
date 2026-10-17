# Hours counted the same way everywhere (plan, 17 Oct 2026)

The user wants every place that shows or reports hours to give the same number for the same period, now and for whatever is built on the data later (a widget
is wanted some day, but **no widget, Settings switch or page is part of this**). **Built and driven 17 Oct 2026** (`docs/DECISIONS.md`, "Hours counted the same way everywhere"; the audit below was confirmed against the code, with the corrections marked). Standing rules apply (CLAUDE.md): small commits,
test/lint/typecheck before each commit, scratch library only; push and install only when the prompt for the run says so.

## What "the hours" are

Hours on a day = the stored year file (timers and typed entries) **plus the hours that notes derive** (a meeting's or lecture's own session: `meetingEntries`,
`lectureEntries`), merged by `withDerived` (`@shared/tracking/derived`), which also drops a derived entry that a stored one covers. Call this the _shown year_.

## Audit (17 Oct 2026, by reading the code; confirm each line when starting)

| Place                                                                                      | Counts the shown year?                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hours page, its cards and charts (`HoursPage`, `HoursCard`, `useWeek`, ...)                | yes (`useShownYear(s)`)                                                                                                                                                                                                                                                                                   |
| Home page's hours (`HomeHours.tsx`)                                                        | yes                                                                                                                                                                                                                                                                                                       |
| A task's Time (`useTaskTime`)                                                              | yes (`withDerived`)                                                                                                                                                                                                                                                                                       |
| Training totals (`entryMinutes`: landing, table, series cards, per-skill, PDF `report.ts`) | its own path: the note's session (exact minutes) + time tracked on its tasks. Same intent; compared in `parity.test.ts`: it agrees with the Hours page except that Hours reports a derived session to the quarter hour and the training log keeps the exact minutes (recorded decision; left to the user) |
| **Home summary `hours` (`home/main/collect.ts`) -> widget file, notifications**            | **no: raw Research year only, no derived hours, no Work, the newest file (not the year holding today) without checking that today is in it, and the plan's whole `hoursPerWeek` as the aim (the page's week aim takes leave days off).** Fixed. (Notifications do not read `hours`.)                      |
| Meeting clash warnings (`useMeetingClashes`)                                               | raw on purpose (it looks for overlaps with stored entries)                                                                                                                                                                                                                                                |
| Time off (`TimeOffCard`, page)                                                             | not hours worked; stored on purpose                                                                                                                                                                                                                                                                       |

So the renderer already agrees with itself; the gaps are (1) the main-process Home summary and (2) no test that the training figures and the Hours page agree.

## Design

- **One pure function builds the shown year, for the renderer and the main process.** Today the renderer assembles it in `useMeetingEntries`/`useShownYear`
  (rows over IPC, `taskOf` from the tasks, Work's clients). Extract the assembly into a pure `shared` function, for example
  `shownYear(year, { meetings, lectures, tasks, clients, today })` (built as `derivedEntries` + `shownYear`) in `src/modules/hours/shared/`, that does the `taskOf` mapping (a subtask takes its parent's list),
  `meetingEntries`, `lectureEntries` and `withDerived`. `useMeetingEntries` calls it, and so does the main process. Behaviour of the renderer does not change.
- **One function decides the Home figures**, used by `HomeHours.tsx` and the main process: from a shown year and `now`, the label (`This week` / `This month`),
  period minutes, aim, today's minutes and hours per client (the arithmetic `HomeHours.tsx` does inline today, with `thisWeek`, `thisPeriod`, `weekFigures`).
- **Main process.** `collect.ts` reads, per workspace, the current year (as the page picks it: `currentYear` of the settings' starts for Research, `contractToShow` for Work, now `yearToShow`), the meeting rows (Research and
  Work), the training rows (Research), the tasks and Work's clients (`workClients`, as `tasks/main/register.ts` does), builds the shown year with the shared
  function, and gives the figures to the summary. Read only; no file or table is changed.
- **`HomeSummary.hours` becomes per workspace**: `{ research: HomeHours | null; work: HomeHours | null }`, `HomeHours` gaining `label`, the period's minutes and aim.
  Update `buildHomeSummary`, types, notifications that read it and their tests. `data/widget/snapshot.json` (version 1, nothing reads it yet) keeps `week`
  (Research, now with derived hours) and gains `work`; no version bump while no reader exists (say so in the write-up). The Home page keeps reading the
  tracking files itself and must look exactly as before.
- **Training figures.** Do not rewrite `entryMinutes`. Add a parity test: for a fixture library (a lecture with a session and tracked self-study, a meeting, a
  typed entry), the training total for a series, the Hours page's "Meetings and training" rows and the task's Time agree. If they differ, find which is
  wrong, fix it, and write the cause down. If `docs/SELF_STUDY_PLAN.md` has been built, include the self-study subtask in the fixture.

## Stages

1. **The two shared functions**, `useMeetingEntries` and `HomeHours.tsx` using them. Pure, tested; the pages unchanged to look at (compare screenshots on a scratch
   library before and after). Mutation checks: drop `withDerived`, change the label rule, drop the period branch, pass the wrong `today`; a test must fail each.
2. **The main-process side**: `collect.ts` as above, summary and widget types, writer, tests with a scratch database (a meeting and a lecture whose tasks exist:
   counted; one with no task, a future one, one with no end time: not), Work's meeting landing under its client, a typed entry and a meeting on the same task and
   day counted once.
3. **The parity tests** across Hours page, Home page, summary, task Time and training totals (Research and Work fixtures), then **driving it** on a scratch library in dev mode and the production build: Research meeting
   with times and a task, a Work meeting, a lecture; compare Hours, Home, a task's page, the Training page and `data/widget/snapshot.json`; read the screenshots.
4. **Write-up.** `docs/DECISIONS.md` ("Hours counted the same way everywhere") with the audit as found and what driving the app showed; `docs/WATCH_HOME_PLAN.md`
   (the status row, "Known limits", "what the summary does not carry"); `docs/ROADMAP.md`.

## Out of scope

The Swift widget, a widget switch in Settings, any Home redesign, and moving the Hours page's own reading of the files into the main process.
