# Contracts of any length: plan (24 Oct 2026)

The user's request: "contracts to be allowed to span any time, but the weeks are only relevant for reporting". Agreed with the
user on 24 Oct 2026 (not to be re-asked); the user said to build all stages in one session ("implement all stages at once"), which
overrides CLAUDE.md's stop-at-every-stage rule for this plan. Read `docs/CONTRACTS_PLAN.md` and `docs/DECISIONS.md`
("Contracts table in Hours settings", "Overlapping contracts") first.

## The model

- A contract file keeps `weeks` and gets an optional `end` (ISO date, the real last day). **No migration**: a file without `end`
  reads as before (its end is `start + weeks × 7 − 1`).
- `weeks` is the **reporting grid**: the weeks counted from the first day, rounded up (a 10-day contract has 2 report weeks, the
  second partial). It stays what the cards, charts, heat map and "week N" labels use.
- **The real end** (`contractEnd(contract)`: `end` if present, else `yearEnd(start, weeks)`) is what dates, "holds today"
  (`contractsOn` in `shared/tracking/contracts.ts`, which uses `inYear` with `weeks` today), the contracts table, entry and timer
  checks and the invoice periods use. Days after `end` inside the last report week belong to no contract: no time can be tracked
  or added there; they show as outside the contract, like a gap between contracts.
- **The weekly aim is not prorated** for a partial last week (the user's answer). The last week is simply shorter.
- Any `end` on or after `start` is allowed (one day included), up to `MAX_CONTRACT_WEEKS` (156) report weeks. `contractWeeks`
  (`shared/tracking/workspace-weeks.ts`) stops refusing `days % 7 !== 0` and `days < 7`; it returns the rounded-up weeks and the
  end. Keep `bad-end` for an end before the start or past the maximum.
- Existing contracts are unchanged. The user will edit the end dates of their existing contracts in the app afterwards, so
  **`setContractEnd` must work on an old file (no `end`)**: it writes `end` and `weeks` together. Shortening a contract is refused
  when it holds time after the new end (`has-time-after`, as today); lengthening is refused when it overlaps another contract's
  client (as today).
- Research is not touched (its years stay 52 weeks).

## Stages (the user asked for all in one session; commit each stage separately)

1. **Model and rules.** `end` in `TrackingYear`/`parseYear` (ISO, not before `start`, consistent with `weeks`: `weeks` must equal the
   rounded-up count, or the file is refused as today); `contractEnd`; `contractWeeks`; `createContract`/`setContractEnd` in
   `src/main/tracking/store.ts` (write `end` only when the span is not whole weeks? **No: always write `end` for a contract
   created or edited from now on**, so the real last day is never derived); `contractsOn`; the timer, `addTime` and entry checks
   that call `inYear`; `dayAfterContract`; `yearEnd` callers that mean a contract's last day (grep `yearEnd`, `inYear`, `.weeks`:
   about 117 sites, each decided: reporting grid keeps `weeks`, anything about a date uses `contractEnd`). Tests, including a
   mutation check on "a day after `end` in the last week belongs to no contract" and on "an old file without `end` reads
   unchanged"; the real-library check: run the parse over `~/CentralCommand/data/time/work/*.json` read-only (copy first) and
   show nothing changes.
2. **Hours UI.** Week card, Invoice card, Balance card, charts, heat map, typical week, the weeks list: a partial last week (days
   after the end dimmed and not addable, the week's total and average per day it has), the contract label
   (`contractLabel`: first and real last day), Home's hours figures and the widget snapshot (`periodFigures`). Screenshots, light
   and dark.
3. **Settings and write-up.** `ContractsTable`: the new row's last day defaults to the first day (today), any date on or after it
   can be picked (`isDisabled` only for dates before the start or past 156 weeks), the edit row's end likewise; the "whole weeks"
   help text, if any, goes. `ContractFields` (the Hours page's form) likewise. `docs/DECISIONS.md` (one section, "Contracts of any
   length"), `docs/ROADMAP.md`, `CLAUDE.md` (one line under what is built), `docs/CONTRACTS_PLAN.md` ("whole weeks" is superseded: a
   note, not a rewrite). Drive the built app and dev mode on a scratch library: a one-day contract, a 10-day contract, a contract
   whose end is edited on an old file, a day after the end in the last week (cannot add or track), the Hours page in light and dark.
   Update the existing tests that assert whole-weeks refusals (`contracts-table.test.ts`, `hours-contract-form.test.ts`,
   `workspace-weeks` tests).

## Done when

test, lint and typecheck pass; the real-library read-only check shows no change; driven in the built app and dev mode; written up;
committed (small commits, one per stage at least); pushed; installed (`npm run build:mac`, app quit first, replace
`/Applications/Central Command.app`).
