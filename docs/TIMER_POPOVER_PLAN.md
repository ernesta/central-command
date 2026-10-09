# Timer popover and task picker: redesign plan

Agreed with the user on 9 Oct 2026. Do not re-ask these decisions. Mockup (the five states, layout A):
`docs/design/timer-popover-mockup.html` (left column of each state is the chosen layout; the right column, B, was rejected).

## Why

The popover was confusing: the task never showed its list; "Create task" silently chose a list (last used, else first,
else Inbox), so tasks landed in the wrong list unseen; Stop, Switch and Discard were far from the task and the clock; the
"Switch to another task" search box looked like part of the current task.

## Decisions

- **Layout A.** Top block is always the current timer: task title, its list under it, then one line with
  `Started [hh : mm] · 0:01` on the left and `Stop` (primary) and a text `Discard` on the right. The picker, when shown, is below a divider.
  Discard stays text (not an icon).
- **No Switch**, and no "change the task of a running timer" either. To do something else: Stop, then Start.
- **Client select removed** from the popover (in Work the list is the client). It stays only for old entries that have no task.
- **Every task row in the picker shows its list** (right-aligned), Recent included.
- **Create row** is always last, once something is typed, and names the list: `+ Create "X" in [List ▾]`. The list is changeable before
  anything is made, using the same list field as the New task dialog (`ListField`). Default list: Work = a client list; Research = where a
  task was last added (as `useTaskDefaults` already tracks). The default is shown, never silent.
- **Start keeps "start now, ask later"**: the clock runs at once, the popover opens on the picker (state 2). Started stays editable.
- **Stop on a timer with no task** (popover or top-bar chip): the popover opens in state 5, title "Which task was this?", hint line
  "Pick a task to stop the timer.", both Stop buttons greyed out (tooltip: same text). Picking a task assigns it and stops the timer. Discard still works.
- Keep UI text short; reuse shared components.

## The five states (all with the same top block)

1. Running on a task. 2. Just started, no task ("No task yet", "Pick one below", picker with Recent). 3. Typing a name that matches
(matches, then the Create row). 4. Typing a new name (Create row only). 5. Stop pressed with no task (as above).

## Stages (stop after each and ask the user)

1. **Picker (done 9 Oct 2026, `docs/DECISIONS.md`, "Timer popover, stage 1")**: list on every row; the Create row with a visible, changeable list (`TaskPicker.tsx`, `start-picker.ts`: `listForNew`
   becomes the shown default). Used by the popover, Today, Add time and the meeting Task field, so check all four. Tests for the rules.
2. **Popover (done 9 Oct 2026)**: the layout, the five states, no Switch, no Client select (except taskless legacy entries), Stop disabled with the hint in
   state 5 in the popover and the chip (`TimerChip.tsx`, `TimerChip.module.css`, `start-request.ts` keeps `stopAfter`). Remove dead code
   (the switch picker, `switchTo`).
3. **Check and docs (done 9 Oct 2026, `docs/DECISIONS.md`, "Timer popover, stages 2 and 3")**: drive the real app in a scratch library (CLAUDE.md, "Testing the app for real"; dev mode and production build, dark mode,
   screenshots of all five states), lint, typecheck, tests; add a "Timer popover" section to `docs/DECISIONS.md`; update `docs/ROADMAP.md`.

Commits small, one per standalone part. Nothing is pushed unless the user says so.
