# Search refinements: plan

Status: **built 19 Oct 2026 in one unattended run, all five steps, pushed and installed.** What differed from the plan: (1) the chip field is a plain `<input>` after the chips (not a
contentEditable), so chips always sit before the text and the modifier order is not kept; (2) a `with:`/`by:` word is a chip only for a person in the list; (3) Tab also turns a
modifier typed in full into a chip, and each chip has a × (outside the Tab order); (4) the grown window's empty state lists the modifiers' names as chips; (5) `/search?q=` stays as a
redirect that opens the window (`SearchRedirect`) instead of being removed; (6) the Settings tab is "Search" and reads `search-help.ts`. Details: `docs/DECISIONS.md`, "Search modifiers", "Refinements". Original plan follows. The user's review of the search modifiers (`docs/SEARCH_MODIFIERS_PLAN.md`), collected in conversation while using the
built feature. Every point below is the user's decision ("agreed with the user": do not re-ask). Read with `CLAUDE.md`, `docs/DECISIONS.md` ("Global search",
"Search modifiers") and `docs/SEARCH_MODIFIERS_PLAN.md`. Code today: `src/shared/search-query.ts` (tokenizer, notices), `src/renderer/src/shell/GlobalSearch.tsx`
(Mod-K), `SearchResultsPage.tsx` (`/search`), `CompletionList.tsx`, `SearchNotices.tsx`, `search-values.ts`, `search-sources.ts`, `run-search.ts`.

## What the user found

1. The help line ("before: accepts YYYY-MM-DD, …") sits under the results; it belongs at the top, with the completion list.
2. There is no place that describes the modifiers.
3. "No results." shows when no search has run: with `in:` (nothing after the colon), with an unknown modifier (`person:`) and with a value the modifier does not
   accept (`in:home`).
4. The completion list opens over a value that is already complete (`with:"Ernesta Orlovaitė"`, `in:meetings` with the cursor after it).
5. The full results page (`/search`, reached by "See all results") is ugly and unlike the rest of the app: a 300px input that clips the query, one long line per
   result running off the screen, no row kind, no count. Clearing the query leaves an empty page that cannot be reached any other way.
6. A complete modifier should be a chip in the input, not typed text with quotes.
7. The one remaining completion could show as grey text in the input, accepted with Tab.
8. The help line's accepted values should be chips.

## Decisions (the user's, 19 Oct 2026)

- **The input, the help and the notices live at the top.** Order, top to bottom: input, then one help row (for the modifier being typed), then the notice (if any),
  then the completion list (only while a value is empty or partly typed), then the results. The help row never sits below the results.
- **What counts as a search.** A search runs when the query has text or at least one modifier with an accepted, complete value. These are **not** searches and
  never show "No results.": a modifier with no value yet (`in:`, `before:`), an unknown modifier (`person:`, "Not a filter"), a known modifier with a value it does
  not accept (`in:home`). They show their help row or notice instead. `in:meetings workspace:work` (modifiers with values, no text) **is** a search and lists what
  matches; "No results." shows only when a real search finds nothing.
- **No suggestion for the unknown modifier** ("Did you mean with:?" was declined: the user will learn the modifiers).
- **No suggestions over a finished value.** The completion list opens only while the value is empty or a prefix being typed (`with:`, `with:Ern`). A complete value
  (a quoted value, an exact match, a finished date) closes it.
- **Chips, in every search input** (Mod-K, the expanded overlay: one shared component). A complete `name:value` becomes a chip; Backspace removes a whole chip (as
  in the editor's `live-entities.ts`); a person or any value with spaces is picked from the list, so the user never types quotes. A chip is a finished value, so
  no list opens until a new modifier is started. A negated modifier (`-tag:x`) is a chip with the minus visible. Pasting `by:"Kathy Rastle"` makes a chip too.
  Text typed as a modifier stays plain text until it is complete and valid.
- **Ghost text.** When exactly one completion matches what is typed (`workspace:re` leaves `research`) and the caret is at the end, the rest (`search`) shows in
  muted text after the caret; Tab accepts it (the same action as picking the one list item). Typing a matching character continues it, a non-matching one clears
  it, Escape or moving the caret hides it. With two or more matches nothing is greyed out. The list stays visible while the ghost shows.
- **Help row with chips.** For modifiers with a fixed set of values (`in:`, `workspace:`, `status:`, `priority:`, `has:`) the accepted values are chips in the
  shared chip style; clicking one fills it in (the same as picking it from the list). Free-form values (`before:` and the other dates, `with:`, `by:`, `tag:`,
  `list:`, `skill:`, `series:`) show one muted line of the accepted forms (for dates: "YYYY-MM-DD, YYYY-MM, YYYY, today, yesterday"), and `with:` / `by:` may offer
  a few people as chips.
- **A Settings page describes the modifiers.** A new Settings tab (the one-word name is the implementer's to pick from the existing tabs' style, e.g. "Search"),
  built from the same table the tokenizer and help row read (one source of truth, so the page cannot drift), using the same chips. One sentence of help at most,
  per `concise-ui-copy`; one row per modifier: name, what it filters, accepted values. Add it to `settings-tabs.ts` and its test.
- **The full page becomes an overlay** (decided: the second option, the page exists only as "See all results", and it should feel temporary). "See all results"
  grows the Mod-K panel (wider and taller, same input and help at the top, same row style: a title line and a quieter second line with the source and date,
  grouped by source, long summaries truncated, a count of results). Escape, a click outside and the × close it and the user lands exactly where they were.
  Clearing the query keeps it open and shows the help and completion list (an empty query is a state of the overlay, not an empty page). `/search <query>` and
  any link that used the route open the overlay with the query filled in; the `/search` route and `SearchResultsPage` are removed (or redirect to the overlay if
  something still links to them). Keep keyboard parity with Mod-K (arrows, Enter, Tab). Check a long result set (cap or virtualise, and say how many matched).
- Everything is keyboard-reachable with visible focus rings that are not clipped (the overlay scroll container needs the 4px padding and `scroll-padding`).

## Rules for the build

- Reuse: the chip style (Entity chips / the existing tag chip), `CompletionList`, `SearchNotices`, the Mod-K row. No new patterns, no raw hex, no gradients, no
  emoji; Lucide icons. Short UI text, one-word buttons. Dark and light (`light-dark()` pairs for any new colour).
- Keep `src/shared/search-query.ts` the single parser. The "is this a search" rule is a pure function with unit tests (the cases in "What counts as a search"),
  the help-row and Settings-page content come from one table, and the ghost-text and completion-open rules are pure functions with tests too.
- The chip input is a small editable component with its own tests (typing, Backspace over a chip, paste, Tab, caret movement, IME composition must not break).
  If a contentEditable is used, check the caret and selection in the real app; if a plain input with an overlay is simpler and holds up, say why in the write-up.
- Mod-K shortcuts stay as listed in Settings; add or change an entry if a shortcut changes (Escape and Tab are already documented there: check).
- Drive the real app, not just tests (`CLAUDE.md`, "Testing the app for real"): scratch library, dev mode and the production build, real keystrokes, look at
  screenshots of each state: empty `in:`, unknown `person:`, invalid `in:home`, partial `with:Ern`, a finished chip, ghost text with one and with several matches,
  the help row with chips, the overlay with many results, clearing the query, Escape, click outside, light and dark.
- Mutation-check the "is this a search" rule and the finished-value rule (break each, confirm a test fails).
- All of test, lint and typecheck pass. Update `docs/DECISIONS.md` ("Search modifiers": add "Refinements", and the places that mention `/search` as a page and
  "See all results"), the `docs/SEARCH_MODIFIERS_PLAN.md` header (a pointer to this plan), `docs/ROADMAP.md` and `CLAUDE.md` ("What is built": the search-modifiers
  bullet and the architecture notes that name `SearchResultsPage`).

## Suggested order (one unattended run: no stop between steps, one small commit per step)

1. The "is this a search" rule and the finished-value rule in `search-query.ts`, with tests; hide "No results." and the open list accordingly (items 3 and 4).
2. The modifier table as one source of truth, the help row at the top with its chips (items 1 and 8), and the Settings page (item 2).
3. The shared chip input: chips, Backspace, paste, picking from the list (item 6), then ghost text (item 7).
4. The overlay replaces the full page (item 5): rows, count, close behaviour, the empty state, removing the route.
5. Drive everything in the real app, fix what shows, then the write-up.
