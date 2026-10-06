# Work contracts that overlap: plan (6 Oct 2026)

Written with the user after they said: a new paid position (Research Assistant) is starting, to be tracked in Work, separately from
Luminos. Read `docs/DECISIONS.md`, "Work's Hours: weeks, contracts and months" and "Work history import", and `CLAUDE.md`, before starting.

## What the user wants (their answers, not to be re-asked)

- The Research Assistant job is **a contract of its own**, fixed term, with its own dates and its own **invoice**, **invoiced weekly**.
- **No fixed hours per week**: the user reports what they worked each week. There is no aim, no balance, no "to go".
- It **shares the Work workspace** (no fourth workspace).
- It **overlaps** Luminos for a short while, and the user will also get a **new Luminos contract**, so overlap is the normal case from now on.
- A **client is required on every entry**, even when a contract has only one client. Luminos is one contract with two clients (Impact,
  Teaching & Learning); Research Assistant is one contract with one client.
- **Contracts have names** (Luminos, Research Assistant), shown in the contract selector with the dates.
- Keep it simple: no new concepts beyond the ones below.

## The model (three words, nothing else)

- **Contract**: a period you are paid for: a name, first and last day (whole weeks), how it is invoiced (`week` or `month`), an optional weekly aim, and its clients.
- **Client**: the label on each hours entry, required. A client name belongs to one contract at a time; it is how the app knows which contract an entry is for.
- **List**: where tasks live. A list named like a client is that client's list (Luminos was split into `Impact` and `Teaching & Learning` on 6 Oct 2026 for this reason). Research Assistant gets a list of its own.

## Decisions

1. **Identity stays the first day** (`time/work/<start>.json`). Two contracts may not start on the same day (refused); otherwise they may overlap. The overlap refusal in `store.overlaps` goes for Work (keep the same-start check). Does `setContractEnd` need it? No.
2. **The file gets `name` and `invoice`** (`name?: string`, `invoice?: 'week' | 'month'`, default `month` so the two existing files read as before). `parseYear` accepts both. Existing contracts are named "Luminos" by a one-off script (dry run first, backup, app closed), not by a migration.
3. **No aim = `hoursPerWeek: 0`** with `weekAim: true` (rules unchanged, plan is 0). The UI hides plan, balance and "to go" for a contract whose aim is 0 (the Week card shows hours only, the balance card shows total hours and the weekly average, charts have no aim line). Check `setPlan` and `parseYear` accept 0. Do not invent a separate "optional aim" flag.
4. **A new contract does not copy the previous contract's plan** (`fresh` does today, which would give Research Assistant Luminos's 8:00 and clients). `createContract` takes name, first day, last day, clients, weekly aim (blank = none) and invoice. The previous contract's carry is not passed on either (a new contract starts at 0). Check that `carrySeconds` is only the rounding carry and say what you chose.
5. **The timer finds its contract from the client.** `start(workspace, label, task, client)` today uses `currentStart` (the one file holding today). With overlap: the contract is the one holding today whose plan lists that client; if no client is given, the contract of the client last used; a task started from Tasks uses its list name as the client when it matches a client, else the last one. Never two contracts for one client on one day (refuse at creation: a client name already used by a contract overlapping the new dates). The idle Start chip, the palette's Start timer and the Today card offer every client of every contract that holds today (grouped by contract when there is more than one).
6. **Hours page**: the contract selector shows `Luminos · 1 May 2026 – 29 Oct 2026`. It opens on the contract that holds today and was used last (remembered with `useModuleState`), else the newest start. Add time on the Week card offers only the shown contract's clients (as now).
7. **Invoice card replaces the Month card's assumption.** A contract invoiced by `month` shows the Month card as now (weeks numbered from 1 in each month). A contract invoiced by `week` shows the same card with one week per period: hours per client for the week, no plan, arrows between weeks. Build it as one card over "periods" (`periodsOf(year)` returns months or single weeks), not two cards.
8. **Settings → Hours**: new contract form gets Name, Clients (one or more, comma separated), Weekly hours (blank = no fixed hours), Invoiced (Week / Month). The latest-contract-end editing stays. Keep text short (see `CLAUDE.md`, reuse patterns).
9. **Tasks**: nothing structural. The new list is made the usual way (a task's List field, new name). Check that making an hours entry from a task takes the client from the task's list when it matches. Stage 8's linking stays untouched.

## Stages (stop after each and ask; the user clears context between them)

1. **Rules and files.** `name`, `invoice`, zero aim; overlap allowed; `createContract` with its own plan; `parseYear`; tests (include a mutation check on the overlap and same-start refusals, and on "never two contracts for one client on one day").
2. **Timer and entries find the contract by client.** Store `start`, the Start chip, palette, Today card, task start; `running()` unchanged. Tests; then drive the built app on a scratch library (CLAUDE.md, "Testing the app for real"): two overlapping contracts, start each client's timer, stop, add time, switch contract.
3. **Hours UI.** Selector label, Settings form, the periods card (week and month), no-aim display everywhere (Week card, Balance card, charts and weeks, heat map, typical week). Screenshots in light and dark.
4. **The user's data.** A script `npm run name:contracts`: names both existing contracts "Luminos" (dry run, backup, `--apply` only when the user says so, app closed). Then the user adds Research Assistant and the new Luminos contract in the app. Update `CLAUDE.md`, `docs/DECISIONS.md` (one section, "Overlapping contracts") and `docs/ROADMAP.md`.

## Questions left for the user (ask at stage 3 or 4, not before)

- The Research Assistant contract's name for the client (same as the contract?) and its first and last day.
- Whether the new Luminos contract keeps the two clients and 8:00 a week aim.
