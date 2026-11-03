# Work: one contract filter for the whole workspace (plan, 3 Nov 2026)

> **Status, 3 Nov 2026: all six stages BUILT and driven in a scratch library (production build and dev mode, light and dark); pushed, not installed.** Choices the plan left open, and what driving found: `docs/DECISIONS.md`, "Work: one contract filter". Changes from the plan's wording (the user, 3 Nov 2026): the week under All is Monday to Sunday, and the Charts card is shown under All over one merged read-only year.

> **Second pass, 3 Nov 2026:** the filter now also reaches Home's lists and cards, Meetings' TODOs and Tasks' lists, and the selector has no label; see `docs/DECISIONS.md`.

> **Moved, 3 Nov 2026 (the user):** the selector is not in each page's header but in the **top bar, beside the workspace tabs**, while Work is active and the page follows it (`shell/WorkContractFilter.tsx`, pages in `shell/contract-filter-pages.ts`). The pages no longer carry one (Home's panel, Tasks, Hours, Meetings, Time off). The remembered scope is one shared value (`use-contract-filter.ts`), so the bar and the page agree.

The user found Work confusing: Home's hours showed 0 for a day they had worked (for Luminos, not Royal Holloway), some pages had a contract
dropdown and some did not, and the dropdowns sat in different places and filtered different things. Agreed with the user on 3 Nov 2026
(do not re-ask): **proposal A, one filter for the whole workspace**, with "All" showing no aim and no export. Read `docs/CONTRACTS_PLAN.md`,
`docs/CONTRACT_SPAN_PLAN.md`, `docs/HOURS_CONSISTENCY_PLAN.md`, `docs/DECISIONS.md` ("Overlapping contracts", "Contracts of any length",
"Hours counted the same way everywhere") and `CLAUDE.md` first.

## What exists (reviewed 3 Nov 2026)

- Each page picks its own contract through `useTrackingYear` (`state/use-tracking-year.ts`: URL `?year=`, else `yearToShow` / `contractToShow`, the
  one that holds today and was shown or used last) and `usePeriod` (`state/use-period.ts`, Meetings). Both show **one** contract.
- `YearSelect` is the dropdown. It sits in the header `actions` of Hours, Meetings, Meetings' landing, Time off, and Training (by year);
  Tasks and Home have none. Home's hours (`HomeHours.tsx`) reads the one chosen contract, so a day worked on another contract reads 0:00.
- Meetings filters by the chosen contract's clients (`ofContractClients`), and its PDF export takes the contract.
- Tasks have no contract notion except the list name matching a client.

## The model

- **One scope per workspace: `'all'` or a contract's first day.** It opens on **All contracts**. Remembered with `useModuleState`
  (replacing the `hours-contract` "shown" memory for Work). Research and Life keep their year selector and are not touched.
- **One selector, `ContractFilter`**, in the header `actions` of every Work page that has contract content, always in the same place (the
  right end, where `YearSelect` is on Hours). Label: `Contract`; options: `All contracts`, then each contract as `Luminos · 1 May 2026 – 29 Oct 2026`
  (`contractLabel`). Built on `Select`. Replaces `YearSelect` for Work only.
- **A link with `?year=<start>` still works**: it sets the scope for that visit.
- **Under All**: Today and the week add up every contract (and every client) that holds the date, grouped by contract then client. **No aim, balance,
  "to go", invoice card or Export** anywhere (the user's decision). Where a card cannot mean anything across contracts it is left out, not replaced by a prompt.
- **Under one contract**: every page looks as it does today for that contract.
- The Settings contracts table is the place contracts are edited; unchanged.

## Pages under each scope

| Page                     | One contract                           | All contracts                                                                                                                                                                                       |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hours                    | as today                               | Today card and Week card summed over contracts (hours only, per contract and client); Charts card only if it works unchanged on a merged read-only view, else left out; no Balance, Invoice, Export |
| Home (Work)              | as today                               | Today summed (per client); the period so far per contract, hours only                                                                                                                               |
| Meetings and its landing | that contract's clients (as today)     | every Work meeting; Export PDF hidden                                                                                                                                                               |
| Tasks                    | tasks whose list is one of its clients | all tasks                                                                                                                                                                                           |
| Time off (Work)          | that contract's days                   | follows the same rule: left as is if it has no sensible "all" (decide when reading it; write the choice down)                                                                                       |
| Training                 | by year, not a contract: no selector   | same                                                                                                                                                                                                |

"This week" under All uses Work's week (Friday to Thursday, `weekStartDay`), not any one contract's own grid, since contracts may start on any weekday. Check
`docs/DECISIONS.md`, "Work's Hours: weeks, contracts and months", and write down what you chose.

## Stages (the user asked for all in one session, so the stop-at-every-stage rule does not apply; commit each stage separately, test + lint + typecheck before each commit)

1. **Rules.** Pure functions in `src/shared/tracking/` (and `src/modules/hours/shared/`): the scope type, `scopeYears` (which contracts a scope covers on a date),
   `allDay` / `allWeek` figures summed over the contracts that hold the date, using the shown year (`withDerived`, `docs/HOURS_CONSISTENCY_PLAN.md`) so meeting hours
   count. Tests, including: one contract holding today, two overlapping, none; a day worked on the non-shown contract is counted (the bug that started this).
   Mutation checks: drop a contract from the sum, count a client twice, count a day outside a contract's end.
2. **State and selector.** `useContractFilter(workspace)`, `ContractFilter`, the remembered scope, `?year=`. Put it on every Work page in the same place; remove
   `YearSelect` from Work pages. A component test for the options, the label, and the choice being remembered. Check `components/clickables.test.ts` and the Select rules in `CLAUDE.md`.
3. **Hours under All** as in the table; hide the aim, balance, invoice and export. Component tests for both scopes.
4. **Meetings and Tasks follow the scope** (Meetings page and landing, the PDF export hidden under All; Tasks by client lists), plus Time off as decided above.
5. **Home** (`HomeHours.tsx`) under both scopes. Then the main-process Home summary (`home/main/collect.ts`, `HomeSummary.hours.work`): it must not depend on any page's
   chosen contract; Work's today must sum every open contract. Tests with a scratch database.
6. **Drive it and write up.** Drive on a scratch library (`CENTRAL_COMMAND_HOME`; never the real one), production build and dev mode, light and dark, with two overlapping
   contracts (one with a client worked today, one without): Home, Hours, Meetings, Tasks and Time off under All and under each contract; real keystrokes to open the selector, pick,
   and check the choice survives a restart and navigation. Read the screenshots; fix what they show. Then `docs/DECISIONS.md` ("Work: one contract filter", with the week rule
   and Charts choice and anything driving found), `docs/ROADMAP.md` (what is built; a "For you" list: what to look at in the installed app), `docs/CLAUDE_ARCHIVE.md`,
   `CLAUDE.md` ("What is built" only if it changes), and this plan's status line.

## Out of scope

Research and Life; redesigning cards; a prompt card for "choose a contract"; changing how contracts are created or edited; Training by contract.
