# Start a timer from the top bar (plan, 1 Oct 2026)

Status: **done 1 Oct 2026.** Stage 5b of `docs/TIME_PLAN.md`. Read "Hours page, first usable cut" and "Dock and palette timer items" in `docs/DECISIONS.md` first.
Assumed from the request: "star a timer" means **start** one. If the user meant something else (a favourite task), ask before building.

## Goal

The top bar's timer chip shows only while a timer runs. When none runs there is nothing to start one from except the Hours page or the palette. Make the same spot in the top bar offer **Start** at all times, so a timer is one click away from every page.

## Design

- **Idle chip** (`TimerChip.tsx`, same top-bar slot): a quiet "Start" button with the Play icon, shaped like the running chip so the bar does not jump. A click opens a popover (same component and styling as the running one) holding:
  - the task field (`TaskField`, label "What are you working on?", earlier names suggested only while typing) and a primary **Start** button; Enter also starts;
  - below it, **Recent**: up to five task names from today and the last few days (new pure function `recentLabels(data, today, n)` in `src/modules/hours/shared/tasks.ts`, unique by `sameLabel`, newest first), each a one-click start.
- **Which workspace:** Research (the only one with Hours). The module's `globals` is already Research-only.
- **Running chip:** unchanged. Starting from the idle popover switches the chip to the running one (the page already reloads on `tracking:changed`); the popover closes on start.
- **Stale session** (a timer left from an earlier day): the chip already shows then, so the idle popover never sees it; starts stay blocked as now.
- **Keyboard:** Escape closes and returns focus to the button (as the running popover does). No new global shortcut; if the user wants one (for example Mod-Shift-T), add it to the manifest `shortcuts` and Settings and match it with `matchesShortcut`. Ask first.
- **Palette "Start timer"** keeps opening Hours (the page also shows today's rows); do not change it.
- **Copy:** only "Start", the field label and "Recent". No help text.

## Steps (one commit each)

1. `recentLabels` in `shared/tasks.ts` with tests (unique, case-insensitive, newest first, limit, empty year).
2. Idle state of the chip: button plus popover with the field, using `useTrackingYear`-free reads (`useYearFile` for the current year of Research); start through `window.api.tracking.start`.
3. Recent list in the popover.
4. Docs: `docs/DECISIONS.md` ("Start from the top bar"), mark 5b done in `docs/TIME_PLAN.md`, `CLAUDE.md` status line.

## Testing for real

Scratch library (`CENTRAL_COMMAND_HOME`), built app and dev mode, Playwright with real keystrokes: open the popover, type, pick a suggestion with arrows, Enter starts; click a Recent name; Escape closes with focus back; start on the Settings and Work pages; start then quit at once and reopen (still running); start while the Hours page is open (Today updates); a very long task name; no Recent on an empty year. Screenshots in light and dark, focus ring not clipped by the top bar. test, lint and typecheck pass.
