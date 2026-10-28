# Polish round 3 (28 Oct 2026)

Seven fixes from the user's review of 28 Oct 2026. Agreed with the user: the summary icon shows only when the summary has text; the end-before-start mark is a red field only (no tooltip, no new text).

## Steps (one commit each, in this order)

1. **Remove the Export tooltip.** Drop the `title={…}` text on the Export buttons (`training/renderer/TrainingPage.tsx`, `meetings/renderer/MeetingsPage.tsx`). The button says "Export".
2. **A session dated today is upcoming until it has ended.** `isUpcoming` (`meetings/shared/query.ts`, `training/shared/rules.ts`) is `date === '' || date > today`, so a meeting at 11:00 today (or a training at 9:00–11:00 before it ends) shows as earlier/done. New rule: dated today with an end time → upcoming until the end has passed; with a start only → until the start; with no times → the day-level rule. `isUpcoming` takes the current date and clock time. Update every caller: table grouping (`layoutRows`), landing upcoming/recent lists, the hours count (`!isUpcoming` in `rules.ts`), the Export filter, the "Upcoming" chip. Today's finished sessions must still count in hours; an unfinished one must not. Tests: before start, in progress, after end, no times, start only.
3. **Remove the "No hours until…" lines.** Delete `HoursLine` and both messages in `meetings/renderer/MeetingHoursNote.tsx` and every place that renders it (training entry included). The overlap warning stays.
4. **End before start is red.** An `invalid` state on the End time input (`aria-invalid`, `--danger` border/text; both colours as `light-dark()` tokens if one is missing), in the meeting and training details. Check what `durationMinutes` returns for an end earlier than the start (it must not read as valid or wrap past midnight silently); Duration keeps its "—". No tooltip, no new text.
5. **Summary icon on Training and Meetings rows.** After the title's existing icons (folder, document), a Lucide icon (e.g. `TextAlignStart`) when the note's `## Summary` section has non-whitespace text; nothing otherwise. Needs a `hasSummary` flag on the index row, computed where notes are indexed (first check whether the summary text is already stored; if the index is cached, a reindex, not a SQL migration). Show it in `TrainingTable` and `MeetingsTable` with a `Tooltip` ("Summary"). Tests: empty, whitespace-only, filled; summary only counted under `## Summary`, not other sections.
6. **Hours rows share one grid.** Task rows (`TaskList.module.css`: lead 32px, `padding: 10px 36px`), meeting rows (`MeetingRows.module.css`: `padding: 10px 12px`, `.time` padding-right 40px), the Add row and form (`AddTime.module.css`) and the Today card's start form each define their own padding and columns, so the lead icon, name and time sit at different x positions (the entry, the Add row, Today vs This week). Steps:
   - Measure first in a scratch library (Playwright, production build): x of lead icon, name and time for Today and Week cards, task row, meeting row, Add row, open add form. Write the numbers into this file.
   - One shared row grid (lead, name, time, delete slot) and one horizontal padding, in one CSS module used by task rows, meeting rows and the Add row; the card's side padding and the list's negative margin come from one value so Today and Week agree.
   - Form row (Add and the Today card's "What are you working on?"): task input, time input and button get one shared control height and `align-items: center` (the input is `padding: 8px 12px` + 1px border, the time field and `Button` have their own metrics; `.form` is `align-items: flex-start`).
   - `git log` the `hours/renderer` CSS to see which change broke the earlier alignment, and note it here.
7. **Alignment guard.** A test (jsdom or Playwright) comparing the x of lead, name and time across Today and Week rows (tasks and meetings) and the form controls' heights, so the alignment cannot drift again.

## Done when

`npm test`, `npm run lint`, `npm run typecheck` pass; each step driven in the real app on a scratch library (production build and dev mode, light and dark), screenshots looked at, especially step 6; docs updated (`docs/DECISIONS.md` "Polish round 3", `docs/ROADMAP.md`, `CLAUDE.md` "What is built").

## Step 6: measurements (28 Oct 2026, production build, scratch library, 1300px window; x in px from the window's left)

Today and a week's day (Wed 28 Oct) agreed with each other; the rows did not agree with each other. A card is x 49–639, its padding 24.

|                              | before: lead icon (centre) | name (left)       | time (right)                             | controls                                                                  |
| ---------------------------- | -------------------------- | ----------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| Task row                     | 101                        | 131               | 571 (then the 24px delete slot, to 603)  |                                                                           |
| Meeting / training row       | **77**                     | **107**           | **627** (`padding-right: 40px`, no slot) |                                                                           |
| Add row                      | 101                        | 131               |                                          |                                                                           |
| Add form, Today's start form |                            | input left **73** | button right 615                         | input **39**, time field **32**, button **35**, `align-items: flex-start` |

After: task, meeting and training rows all have lead 101, name 131, time 546 (box 521–571, delete slot to 603), in Today and in a day's detail, light and dark, production build and dev mode (Work's client rows too); the forms start at 85 and end at 603 (the rows' content edges), and the input, the time field and the button are 34px, centred.

What broke it: `git log` of `hours/renderer` CSS: `9478bfe1` ("task rows' highlights run edge to edge", 28 Oct) gave the task rows `padding: 10px 36px` and the list `margin-inline: -24px`, but `MeetingRows.module.css` kept its own `padding: 10px 12px` (and a time padded 40px on the right as a stand-in for the delete slot), so meeting rows moved 24px left of the task rows; the forms, never inset, had their own `align-items: flex-start` and three different control heights (`TaskPicker`'s padding, `DurationField`'s 32px, `Button`'s padding).

What was done: the meeting row uses `TaskList.module.css`'s `row`, `lead`, `end`, `time` and `delete` classes (one grid), the inset is `--hours-pad` (24px, `tokens.css`) plus 12px everywhere (card padding, the list's negative margin, the row, the Week card's detail), the Add and start forms are one module (`HoursForm.module.css`: inset 12px, `align-items: center`, `--field-h` = `--hours-control-h`, 34px, read by `TaskPicker`'s input, `DurationField` and the button). Step 7's guard is `hours/renderer/row-grid.test.ts` (jsdom has no layout, so it checks that every row and form takes its grid, inset and height from those two modules; the measured numbers above are the reference).
