# Clickable things: one logic (28 Oct 2026)

**All six stages built, driven (production build and dev mode, light and dark) and committed 28 Oct 2026; written up in `docs/DECISIONS.md`, "Clickable things: one logic".**

From the user's request to audit how "something you can click" looks and behaves, then to apply one set of rules to the whole app. The audit drove the production build on a scratch copy of the library (62 clickable things, light and dark, idle / hover / keyboard focus; contact sheets in the session scratchpad). The user agreed the rules below in chat (mock: https://claude.ai/artifact/1pP2JW1A1DioS3rCKWeGZx) and confirmed both before/after mocks (edit in place; blue only for selected). **The user asked for all six stages in one run, without stopping** (28 Oct 2026; this overrides the CLAUDE.md stop-at-each-stage rule for this plan only). One commit per stage or per standalone part.

## The rules (agreed)

1. **Text link** (a title or name that goes somewhere, "See all", an external link): ink at rest, `--accent` on hover, never underlined. A muted one (a Read Watch item) is `--text-muted` at rest and also `--accent` on hover.
2. **External link**: the same, with a small arrow icon (Lucide `ArrowUpRight`, 13px, muted, accent on hover) in front of the text.
3. **Surface** (row, card, button, icon button, tab, segment, menu or list item): `--hover-tint` behind on hover; a primary button darkens (`--accent-hover`).
4. **Blue means selected.** `--selected-bg` is for a selected or active _state_, never for hover and never for the keyboard highlight of a list.
5. **(done) Edit in place**: one look on hover for every text that is edited where it stands (see stage 5, pending the user's confirmation of the mock).
6. **Focus**: one 2px `--accent` ring everywhere, written once as tokens; an inset variant where an ancestor clips it.

Already decided and kept: no underline anywhere on links (DECISIONS, "Links: a colour change on hover, never an underline"); links to tasks, meetings and series are a plain name plus an icon button (DECISIONS, "Task links: icons, not chips"); `MeetingTask`'s underlined action buttons ("Change") and the live editor's own link styling stay as they are (a separate question: see "Open").

## What the audit found (why)

- **Text links** hover to accent in about ten separate copies (`ListTable.module.css:85`, `NotesTable.module.css:78`, `ReadingListsTable.module.css:73`, `PeopleTable.module.css:49`, `ReadingListMentions.module.css:12`, `WatchAllPage.module.css:20`, `TaskList.module.css:179`, `MeetingRows.module.css:14`, `TopicsPanel.module.css:30`).
- **Accent-at-rest links** ("See all", `Home.module.css:107`; the person links, `PersonLinks.module.css:28`; the landing section link, `Landing.module.css:88`) hover to `--accent-hover`, a step too small to see. The landing one has no `text-decoration: none` and no hover, so it renders browser-underlined ("See all trainings →").
- **Blue as hover.** `StatusButton.module.css:13`, `TasksTable.module.css:213` (icon buttons), `TagsField.module.css:27` (×), `TaskMenu.module.css:33` (menu item hover) use `--selected-bg` for hover; `EntityPicker.module.css:33` and `TodoMenu.module.css:21` use it for the keyboard highlight, while `Picker.module.css:169` and `GlobalSearch.module.css:60` use `--hover-tint` for the same thing.
- **Chips.** "+ add": accent border (`TagsField.module.css:43`, `TasksTable.module.css:278,302`) against a tint (`PeopleField.module.css:58`, `SkillsField.module.css:56`, `ClientsField.module.css:54`). "×" has four hovers (`PeopleField:42`, `SkillsField:40`, `ClientsField:39` grey; `TagsField:27` blue; `PersonLinks:45` danger; `ModifierChip:36` ink).
- **Edit in place** has four looks: the Tasks table title underlines (`TasksTable.module.css:422`); the Notes, Task, Reading list and Training page titles show a soft border (`NotePage.module.css:29`, `TaskPage.module.css:47`, `ReadingListPage.module.css:29`, `TrainingEntryPage.module.css:29`); an Hours row's name gets a tint (`TaskList.module.css:52`); a details field (`Picker plain`, `DatePicker plain`) gets tint, `--border-strong` and a chevron (`Picker.module.css:82`, `DatePicker.module.css:36`). The Meeting page title is a computed heading (series and date), not editable, so it is correct as it is.
- **Focus** is the same look written five ways, with copies: the table-row `box-shadow` blocks (`ListTable.module.css:57-69`, `NotesTable.module.css:47-59`, `ReadingListsTable.module.css:45-57`, `TasksTable.module.css:129-151`), the card `:has()` ring (`Landing.module.css:117`, copied into eight `*Card.module.css`: Hours, Meetings, Notes, Readings, Tasks, Time off, Training, Watch, lines 10-35), `WatchList.module.css:30`.
- **External links** (Watch titles `WatchList.tsx:35`, `WatchTable.tsx:88`, person links `PersonLinks.tsx:43`) have no sign that they leave the app.

## Stages

Each stage: drive the production build and dev mode on a scratch library (light and dark), tab through the touched screens, look at screenshots (the Playwright harness used for the audit, `audit.mjs` and `sheet.mjs`, makes a before/after contact sheet; rerun it), and `npm test`, `npm run lint`, `npm run typecheck` must pass.

1. **(done) Foundation (no visible change).** `tokens.css`: `--focus-ring` (2px solid `--accent`) and `--focus-offset` (2px); `base.css` uses them. New `components/Link.module.css` with `.link` (ink, no underline, accent on hover, `--transition-fast`), `.muted` (muted at rest, accent on hover) and `.external` (inline-flex, gap, the icon's colour follows hover); `components/ExternalIcon.tsx`. New `components/Focus.module.css` with `.rowFocus` (the table-row inset ring), `.cardFocus` (the stretched-link card ring) and `.insetFocus`. Other modules take them with `composes: … from '@renderer/components/…'` (already used by `WatchList.module.css`). Diff the eight `*Card.module.css` against `Landing.module.css` first; if identical they compose the landing's `.card`/`.cardLink`.
2. **(done) Text links.** Move every copy in "What the audit found" to `Link.module.css`. "See all" (`Home.module.css:107`, `Landing.module.css:88`), `PersonLinks`' link: ink at rest, accent on hover, no underline. Remove the stray underline of the landing link. Mind the card-header "See all", which sits next to a muted "+N more".
3. **(done) External links.** `.external` with the arrow icon on `WatchList`, `WatchTable` (a Read title: `.muted` + `.external`) and `PersonLinks`. For `WatchList`, the title link is stretched over the row: the icon goes in the title cell in front of the text and the row keeps its tint.
4. **(done) Surfaces and blue.** `StatusButton`, `TasksTable` `.iconButton`, `TagsField` ×, `TaskMenu` item hover: `--hover-tint`. `EntityPicker` and `TodoMenu` `.active` (keyboard highlight): `--hover-tint`; `aria-checked`/selected stay `--selected-bg`. One "+ add" (accent border and text) and one "×" (tint, ink), shared by `TagsField`, `PeopleField`, `SkillsField`, `ClientsField`, `ModifierChip`, `PersonLinks`. Replace the table-row and card focus copies with `Focus.module.css`. `cursor: pointer` comes with the shared row and card classes (remove the per-module `cursor: pointer` on `tr`s).
5. **Edit in place (the user confirmed the mock, 28 Oct 2026).** One hover for: the four page titles, the Tasks table title, a subtask title on the task page, an Hours row's name, and the details fields (`Picker plain`, `DatePicker plain`, which keep their chevron). Proposed: a soft box (`--hover-tint` fill, `--border-soft` border, 1px transparent border at rest and a matching negative margin so nothing shifts), cursor `text`; no underline anywhere. Focus while editing stays the thin accent border (`base.css`).
6. **(done) Guard and docs.** A test in the style of `hours/renderer/row-grid.test.ts` that reads the CSS: no `text-decoration: underline` on `:hover` (allow-list: `MeetingTask`, the live editor), no `--selected-bg` in a `:hover` rule, no `cursor: pointer` on a `tr` outside the shared classes; mutation-check each. `docs/DECISIONS.md` "Clickable things: one logic" (the rules, the table of kinds), the `CLAUDE.md` Conventions line ("a link is `components/Link.module.css`, focus is the `--focus-ring` tokens") and "What is built", `docs/ROADMAP.md`.

## Open (ask when the stage comes)

- The live editor's links, mention chips and checkbox (`LiveEditor.module.css:202`, `:380`, `:441`) were not driven in the audit (the meeting note opened had none). Keep as they are unless the user wants the same hover and icon rules; check in a note that has them.
- `MeetingTask.propose` (dashed to solid border on hover) and its underlined "Change" buttons (documented as deliberate): keep.
- `--hover-tint` is very pale in light mode (#f4f6f8 on white). Not part of this plan; look at it after stage 4 and ask.
- Hours' row buttons, the Segmented in Settings and the Mod-K result row (cursor `auto`, no hover) were not reached in the audit; include them in the stage 4 driving.
- Dev mode was not driven in the audit.

## Not changed

Data, behaviour, keyboard shortcuts and layout. Colours of text at rest change only for "See all" and the person links (accent to ink).
