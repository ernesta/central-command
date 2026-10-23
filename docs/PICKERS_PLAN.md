# Pickers: one type-to-search way to choose from a list (plan)

Status: **planned 23 Oct 2026, not started.** Every point below is the user's decision ("agreed with the user": do not re-ask). Mockup: `docs/design/picker-options-mockup.html`
(option A was chosen; B is kept for the record). Read with `CLAUDE.md` and `docs/DECISIONS.md`.

## What the user found

Skills' "+ add" menu searches as you type but shows no field, so nobody knows. People, Group and the timer's task box show a field. The Training type and about 30
other selects cannot search at all (native `Select`, or `DescribedSelect`). `ComboField` (Series, Location) is a text field with a drop-down. Four behaviours for one job.
The user wants: the same look and behaviour everywhere, intuitive, as few clicks and key presses as possible.

## Decisions (the user's)

- **Option A: a search box inside the list.** One click opens the list with a focused search field on top; the closed control looks as it does now (value and chevron;
  the `compact` and `plain` table-cell looks stay). Pick = one click, the letters, Enter.
- **Search appears only when there are more than 7 options** (`PICKER_SEARCH_MIN = 7`, one constant, decided at run time from the count so a growing list gets it
  by itself). Shorter lists open as a plain list: arrows, Enter, and typing a letter jumps to the first option starting with it (type-ahead), no field.
- **One shared picker** (`src/renderer/src/components/Picker.tsx` and a small plain module for matching and ordering, unit-tested) replaces `DescribedSelect`, the
  menus of `SkillsField`, `PeopleField` and `GroupField`, `ComboField`, and the native `Select`. Keep `Select`'s props (`value`, `options`, `onChange`, `label`,
  `compact`, `className`, `disabled`) so the ~30 call sites do not change; `Select` becomes a thin wrapper, `YearSelect` and `WorkspaceSelect` follow by themselves.
  `DescribedSelect` is deleted (an option's `description` is a field of `SelectOption`).
- **Behaviour, the same everywhere:**
  - Options keep their group headings (ungrouped first, then each group, as now) and an optional quiet second line (description).
  - Matching ignores case and diacritics (`fold` in `@shared/text`) and looks in the label and the description; the matching letters in the label are highlighted.
  - Keys: Down/Up move, Home/End jump, Enter or Tab pick (Tab moves on), Escape closes only the list (stop propagation: not the dialog or page behind) and returns focus to the control.
    Typing on the focused closed control opens it with those letters already entered (short lists: opens and jumps). Click outside closes.
  - Only a real pointer move highlights a row (as the editor's mention list; see DECISIONS "Picker fixes").
  - Search placeholder: "Search" plus the plural noun when the field has one (a `noun` prop, e.g. "Search types"). No match: "No match".
  - The list opens on the side with room and never widens the page (the placement code in `DescribedSelect` and `GroupField` is the pattern; a list inside a table or a
    scroll container must not be clipped).
  - The current value is shown as selected (`--selected-bg`); the highlighted row uses `--hover-tint`. Both colours exist as `light-dark()` tokens.
  - ARIA: the control is `aria-haspopup="listbox"`; the search field is the combobox (`aria-controls`, `aria-activedescendant`); options are `role="option"`.
- **Adding a new value (`allowNew`).** A picker may allow a value that is not in the list: the list then ends with a row `Add "…"` while the text is not an exact
  match of an option. `ComboField` (Series and Location on meetings and trainings) becomes this: closed it looks like every picker, it stores free text, and
  opening it with no text shows every value already used. People, Group/List and the timer's task box keep their own wording, `Create "…"` (a new record), and
  their own creation logic (`onAddPerson`; `GroupField`'s "inside" choice for a new sublist): they take the shared look, list and keys only. Which row is highlighted
  by default when there is an add row: follow what `GroupField` does now, and do the same in all of them.
- **Multi-value fields** (Skills, People): the chips stay as they are; "+ add" opens the shared picker, anchored under the chip, with the search field (Skills has
  about 25 options, People usually more than 7). Already chosen values are left out of the list; Skills still stops at three.
- **Not changed:** the editor's `@` mention picker (it is anchored to the text caret and has its own plan), Mod-K search, `DatePicker`, `TimeInput`, `Segmented`, `FilterRow`.

## Which controls get what

Always search (long or open-ended lists): Training entry Type; Skills and People "+ add"; Group/List on notes and tasks; Tasks filters list and tag; Training filters type,
skill, series, people; Meetings filters skill, series, people; Notes filter group; Hours Client (task row, timer) and "For" (subtasks); Meetings "Merge into"; the timer's task box
(already searches: take the shared look and keys). Search once past 7 (short today): any filter whose entries are few. Always short, no field: Year, Workspace, Meetings filter type,
Tasks filter priority, Readings status and Sort by, Repeats and Repeat unit, Time off Type, Invoiced, Theme, Terminal. `ComboField` users: Series and Location, with `allowNew`.

## Stages (the user's instruction of 23 Oct 2026: build all of them in one run, without stopping between stages; push at the end)

1. **The shared picker.** The matching module and `Picker` (single value, groups, descriptions, search above 7, type-ahead, `allowNew`, placement), unit and component tests, `Select` as a wrapper, `DescribedSelect` removed
   (Training entry Type moves to `Picker` via `Select`). Drive it first.
2. **Fields that make or add things.** `ComboField` onto `Picker` with `allowNew`; Skills and People "+ add" menus; `GroupField` (notes and tasks lists, including its table `plain` look); the timer's task box.
3. **Everything else.** Every remaining native select and filter row through the `Select` wrapper; look at each in the app, in light and dark; remove dead CSS (`Select.module.css`, `DescribedSelect.module.css`, the old menu styles).
4. **Write-up.** `docs/DECISIONS.md` ("Pickers"), this file's status line, `docs/ROADMAP.md`, the "What is built" line and a Conventions line in `CLAUDE.md` ("choose from a list with `Picker`/`Select`, never a native select or a new menu").

## How to check

- `npm test`, `npm run lint`, `npm run typecheck` pass before each commit that ends a stage. Unit-test the matching, ordering, threshold and type-ahead as plain functions; component-test the
  keys with real key presses (not `preventDefault` flags). Mutation checks: break the threshold (7), the exact-match test for `Add "…"`, and the Escape handling, and confirm a test fails.
- Drive the app for real (CLAUDE.md, "Testing the app for real"; scratch library, never the real one; dev mode and the production build; Playwright from a scratch folder): Training type (screenshot of the
  list, open and filtered), Skills, People, Group, the timer, Series and Location (type a new one), Year, a filter row, a select inside a table row, a select near the right edge of the window and one inside a dialog (Escape
  closes only the list). Type with `page.keyboard`; tab through every screen and check focus rings are not clipped; look at screenshots in light and dark.
- Commits are small: one per standalone part (the module, the component, each field moved, the clean-up, the docs). Each commit compiles.
