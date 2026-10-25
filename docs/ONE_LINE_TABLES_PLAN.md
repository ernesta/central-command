# One-line tables and one tooltip plan (25 Oct 2026)

**Status: BUILT 25 Oct 2026 (all six stages in one unattended run, driven in the built app and dev mode; `docs/DECISIONS.md`, "One-line tables and one tooltip"). Agreed with the user the same day after mockups (`docs/design/one-line-tables-mockup.html`).**

The Training and Meetings tables grew second lines (the "Upcoming" pill under the date, a long title wrapping, stacked skills).
A row is now one line, set by the CSS. Tooltips become one custom component everywhere.

## Decisions (all the user's)

1. **A row is one line, in both the Training and the Meetings table.** Every text cell is `white-space: nowrap` with an ellipsis; the
   full text is in a tooltip. The table keeps its `min-width` and scrolls sideways when narrow; it never wraps.
2. **"Upcoming" is the only word** (never "Planned"). It is not a pill in the row any more. The list is grouped: an **Upcoming**
   header row, then an **Earlier** header row (mockup A1). Undated entries ("No date") are upcoming, as `isUpcoming` already says, and
   sort first in the Upcoming group. Group headers show only while the list is sorted by date (newest first, as now); under another
   sort they go. Header rows are not keyboard rows (`useRowNavigation` skips them) and read as a row group to assistive technology.
   Hide a header whose group is empty.
3. **"No date yet" becomes "No date"** everywhere it appears (both tables, the landings, search, the person page, headings:
   `src/shared/time.ts` `meetingHeading`, `training/renderer/search.ts`, `TrainingEntryPage`, `TrainingLanding`, `MeetingsLanding`,
   `PersonPage`, and their tests).
4. **Folder and notes icons come after the title (mockup C1):** the title text ellipsises, the icons (`flex: none`) follow it, so a long
   title keeps both icons visible and all titles are flush left. Each icon has a tooltip ("Linked folder", "Has notes").
5. **Skills: one chip plus a muted `+N`** (same pattern as the leads' `+N`); `SkillChips` gets a `limit` prop replacing `stacked` in
   both tables; the `+N` tooltip lists the others. The chip itself ellipsises with a tooltip when cut.
6. **Series** is capped at about 28ch with an ellipsis and a tooltip.
7. **Custom tooltips everywhere.** One shared `Tooltip` component (`src/renderer/src/components/Tooltip.tsx`) with the look of
   `IconButton`'s tip (`--tooltip-bg`, `--tooltip-text`, 12px, `--shadow-float`), drawn in a fixed-position layer so no `overflow`
   ancestor clips it, flipped to stay inside the window, shown on hover and keyboard focus after a short delay, hidden on scroll,
   Escape and blur, `aria-describedby` for assistive technology. `IconButton` uses it (shortcut text kept). **Every native `title=`
   attribute in `src/` that is a tooltip (about 59) becomes it**; a `title` that is something else (an SVG `<title>`, a dialog or
   iframe title) stays. Truncated text shows its full text only when it is actually cut (measure `scrollWidth > clientWidth`).
   Record the rule in CLAUDE.md "Conventions": no native `title=` for tooltips.
8. **Not decided here:** nothing else. Sorting is a separate item (ROADMAP: "Sorting consistency"); do not build it in this plan,
   except that the group headers must key off the current sort.

## Stages (one commit each; do all in one go, no stop between stages: the user asked for an unattended run)

1. `Tooltip` component + tests (shows on hover/focus, not when disabled, flips at the edge, text-only-when-cut helper, Escape hides);
   `IconButton` moves onto it. Drive it in the app.
2. Migrate every `title=` tooltip in `src/` to `Tooltip` in small batches (one commit per module folder). A test or lint rule (ESLint
   `no-restricted-syntax` on a JSX `title` attribute of a DOM element) keeps new native tooltips out.
3. "Upcoming" only, "No date" everywhere, `isUpcoming` label in both tables and the landings' cards (they use the same words; check
   `TrainingCard`, `MeetingsCard`); tests updated.
4. Group headers (Upcoming / Earlier) in both tables, a shared helper for the grouping (`groupByUpcoming` in a shared place, used by
   both modules, unit tested, including undated rows and an empty group).
5. One-line cells in both tables (CSS + `SkillChips limit`, icons after the title, series cap, ellipsis tooltips); both tables'
   CSS share what they can.
6. Write up: `docs/DECISIONS.md` ("One-line tables and one tooltip"), this plan's status, the ROADMAP, the CLAUDE.md "What is built" line
   and the Conventions rule.

## Checks

`npm test`, `npm run lint`, `npm run typecheck` pass. Drive the production build **and** dev mode on a scratch library (light and
dark, screenshots looked at): Training and Meetings (Research and Work) tables with a very long title, a long series, four skills, four
leads, no date, upcoming and past rows; every row one line (compare row heights); hover and keyboard-focus tooltips on the ellipsised
title, the icons, `+N`, initials chips, and an `IconButton`; a tooltip near the window's right and bottom edge and inside the table's
scroll container; arrow-key row navigation skips the group headers; the narrow window scrolls sideways. Also spot-check three other
screens whose `title=` moved (Hours, Tasks, Readings).
