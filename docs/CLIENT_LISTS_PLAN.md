# Work: one top-level list per client, and no other (plan, 7 Oct 2026)

Raised by the user while discussing the Start picker's "Which client?" question (`docs/DECISIONS.md`, "Timer and tasks, stage 2"):
a Work task's client is read from its list's name (`clientForTask`, `clientOfList`, `clientForList`), so a list that is not a client
leaves the client unknown. The user decided: **create a top-level list automatically for every client, and do not allow new
top-level lists in Work.** Read `CLAUDE.md`, `docs/TASKS_PLAN.md`, `docs/CONTRACTS_PLAN.md` and the stage 2 write-up first.

## What the real library holds (read-only check on a copy, 7 Oct 2026)

- Work has exactly three top-level lists and every one is a client: Impact (79 tasks), Teaching & Learning (28), Royal Holloway (1).
  Contracts: Luminos twice (clients Impact, Teaching & Learning), Royal Holloway once. **Nothing needs moving**; the rule can be
  enforced without a data migration. Re-check before enforcing (a task may have been added since).
- Research's lists are topical (Admin & Logistics, Reading, Writing, ...) and have no clients. **Research is not affected.**

## The rules (proposed; confirm the open questions below)

1. **Work's top-level lists are exactly its clients** (every client of every contract, past and present). A client with no list gets
   one, empty, as soon as it exists (a new contract, or a client added to a plan), and a list is never created in any other way.
2. **A Work task's list can only be one of those.** New task, Add bar, the task page's list field, the Start picker's Create and a move
   all offer the client lists and nothing else; no "new list" row. A sublist stays free text (it is not a client).
3. **The store refuses it too** (not only the UI): `create` and `update` in Work reject a top-level list that is not a client. The
   check needs the clients, which live in the tracking store; give the tasks store a small provider injected in `register.ts`
   (keep the handlers thin and the rule a plain, unit-tested module).
4. **A client is renamed or removed with care**: renaming a client renames its list and every task in it (and the hours' client
   label if the plan renames it, see `ClientFields`); removing a client whose list still holds tasks is refused or must say what
   happens to them (open question 2).
5. With this, the Start picker's "Which client?" question can only appear for a task made before the rule or by an importer; keep it
   as a safety net. The task page's Start should then ask the same question instead of falling back to the client used last.

## Open questions (ask the user at the start of stage 1)

1. Are empty client lists shown anywhere (the Tasks page lists and filters) or only once they hold a task?
2. Removing a client that still has tasks: refuse, or move its tasks to another client's list (which one)? Past contracts keep their
   clients, so a client of a finished contract probably keeps its list.
3. A client name that appears in two contracts (Luminos twice) has one list. Confirm.
4. Sublists: keep them free text, as now?

## Stages (stop after each and ask; the user clears context between them)

1. **The rule and its store check.** A plain module `work-lists` (the lists a workspace may have, from the clients; `canUseList`),
   the provider in `register.ts`, `create` and `update` refusing a Work top-level list that is not a client, with tests (mutation
   check: remove the refusal and a test fails). A dry-run-first script `npm run check:work-lists` that only reports tasks outside
   the rule (expected: none). Research untouched.
2. **Lists follow clients.** Creating a contract or adding a client makes its list; renaming a client renames the list and its
   tasks; the removal rule from question 2. The two Hours settings screens (`ContractFields`, `ClientFields`) are where this starts.
3. **The UI offers only client lists in Work.** `ListField`/`GroupField` use in `NewTaskDialog`, `AddBar`, `TaskPage` and the
   picker's Create (`listForNew`) drop "new list" in Work; the Tasks page shows what question 1 decided; the task page's Start asks
   for the client when the list names none. Drive the app in Work and Research, dev and the built app, on a scratch library.

Update `CLAUDE.md`, `docs/DECISIONS.md` and `docs/ROADMAP.md` at the end of each stage. Do not push until the user says so.
