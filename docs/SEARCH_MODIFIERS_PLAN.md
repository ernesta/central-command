# Search modifiers: plan

Status: **designed with the user on 19 Oct 2026, nothing built.** Read with `CLAUDE.md` and `docs/DECISIONS.md`, "Global search". Code today:
`src/shared/search.ts` (`parseSearchQuery`, `SOURCE_ALIASES`, `SEARCH_GROUP_ORDER`), `src/renderer/src/shell/run-search.ts` (`searchEverywhere`),
`GlobalSearch.tsx` (Mod-K) and `SearchResultsPage.tsx` (`/search`); each module's `search` is in its manifest.

## Why

The user searched `experiments in:task` and got "No results." Tasks is a registered source but has no `in:` alias and is not in `SEARCH_GROUP_ORDER`, so
`in:task` stayed in the text and the search looked for the literal words "experiments" and "in:task". The aim is Slack-style search: structured
modifiers that narrow the result, with a visible warning for anything unrecognised instead of a silent miss.

## Decisions (the user's, 19 Oct 2026: do not re-ask)

- **AND only.** Different modifiers AND (as in Slack, whose help documents `marketing report in:#team-marketing from:@Sara`), and so does a repeated
  modifier. No commas, no OR. A repeated modifier an item can only have one value of (`in:`, `status:`, `priority:`, `series:`) can never match, so the
  search shows "No item has two <name>s." instead of an empty list. This replaces today's `in:meetings in:notes` (both sources); update `DECISIONS.md`.
- **Only the listed values.** No hidden aliases, abbreviations, prefixes or numeric shorthand (`priority:1` is not accepted). Case and accents are
  ignored (the existing `fold`), and that is the only leniency.
- **`people-aliases.json` is going away** (the user is reviewing it). `with:` and `by:` match a person's full name or initials from the people list only.
- **Dropped:** `is:`, `title:`, `type:`, `mode:`, commas, `from:`/`@`, prefixes such as `in:tr`, academic years and contracts in dates.
- **Workspaces.** `workspace:` limits to scoped items of that workspace **and also shows everything not scoped to a workspace**, in any workspace's
  search. Scoped today: tasks, notes, meetings, training, reading lists (Research). Not scoped: people and readings (readings get a workspace later, see
  the TODO). `workspace:` therefore never narrows to "sources that have it": it keeps unscoped sources in.
- **`-` before any modifier excludes**, dates and `due:` included (`-due:overdue`, `-on:2026-10-05`). A negated modifier is NOT(positive match): it never
  narrows to the sources that have the field (`-tag:x` keeps meetings, which have no tags), and a task with no due date matches `-due:today`.

## General rules

| Rule | Behaviour |
|---|---|
| Syntax | `name:value`; a value with spaces is quoted: `status:"in progress"`. |
| Exact phrase | `"effect size"` (double quotes, no modifier). |
| Plain words | Matched against title and text as today, every word required. |
| Only modifiers | Lists everything that matches (as `in:meetings` does today). |
| A modifier a source does not have | Narrows the search to the sources that have it: `status:done` leaves out meetings, notes and people. Exceptions: `workspace:` and negated modifiers (above). |
| Unknown `name:value` | Searched as plain text, with a visible notice "Not a filter". |
| A known modifier with a value it does not accept | A visible notice naming the accepted values, and nothing is searched for that modifier's text. |
| Repeated single-valued modifier | Notice "No item has two <name>s." |

## The modifiers (complete)

| Modifier | Accepted values | Applies to | What it does |
|---|---|---|---|
| `in:` | `tasks` `task` · `notes` `note` · `meetings` `meeting` · `training` `trainings` · `readings` `reading` · `lists` `list` · `people` `person` | all | Limits to one source (singular and plural are the only forms). |
| `workspace:` | `research` `work` `life` | scoped sources; unscoped ones always kept | Limits to one workspace. |
| `with:` | a person's full name or initials | meetings (attendees), training (leads), notes (people chipped in), readings (authors) | Items involving that person. |
| `by:` | a person's full name or initials | readings (authors), training (leads) | Items made or led by them; a subset of `with:`. |
| `status:` | tasks: `"not started"` `"in progress"` `done` `open` · readings: `read` `"to read"` | tasks, readings | Task state as labelled (`open` = not started + in progress); a reading's read state. |
| `priority:` | `P1` `P2` `P3` | tasks | Priority as shown (high, normal, low). |
| `due:` | `today` `tomorrow` `overdue` `week` | tasks | `week` = today plus the next six days. No due date matches none (`-has:due` finds them). |
| `list:` | a list name, or `list/sublist` | tasks | Top-level list (a client in Work; free text in Research and Life). |
| `tag:` | a tag name | tasks, readings (Zotero tags) | Items with that tag. |
| `skill:` | a skill name from the Settings list | training, meetings (Research) | Items tagged with that skill. |
| `series:` | a series name | meetings, training | Meeting or training series. |
| `has:` | `due` `description` (tasks) · `notes` (readings) · `todos` `summary` (meetings) | tasks, readings, meetings | The item has it (`todos` = open TODOs). |
| `before:` | a date | notes, meetings, training, tasks (due date), readings (year) | Strictly before; for a month or year, before its first day. |
| `after:` | a date | same | Strictly after; for a month or year, after its last day. |
| `on:` | a date | same | That day (a month or year: any day in it). |
| `during:` | `YYYY-MM` · `YYYY` · `today` `yesterday` · `"this week"` `"last week"` · `"this month"` `"last month"` · `"this year"` `"last year"` | same | Inside that period; weeks run Monday to Sunday. |

Date values for `before:`, `after:` and `on:`: `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, `today`, `yesterday`. Nothing else (no `Oct 3`). A reading's date is its
year only. A task with no due date never matches a positive date modifier.

To confirm while building (not decided): a reading's UI label for its read state (stored `read` / `to_read` / `unset`), and the exact skill, series and
list names come from the user's own data, so the values are read from it, never hard-coded. Hours, Time off and Watch have no search and no `in:` value.

## Examples

| Typed | Meaning |
|---|---|
| `experiments in:task` | Tasks mentioning "experiments" (the failed search) |
| `in:tasks status:"in progress" priority:P1` | In-progress P1 tasks |
| `luminos with:Chris after:2026-05` | Luminos mentions involving Chris, after May 2026 |
| `in:tasks due:overdue list:Luminos` | Overdue tasks of one list |
| `-in:readings sample` | "sample", readings left out |
| `workspace:work report` | Work items, plus people and readings, mentioning "report" |

## Stages (stop after each and ask; the user clears context between them)

1. **`in:` and the rules.** A modifier registry (name, accepted values, which sources have it) replaces `SOURCE_ALIASES`; tasks becomes a source in
   `SEARCH_GROUP_ORDER`; tokenizer returns `{ text, phrases, filters[], notices[] }` (filters `{ name, value, negated }`); `-` exclusion;
   `workspace:`; repeat and unknown-modifier notices shown in the Mod-K window and on `/search`. Update the "Global search" decision and the unit tests.
2. **Task filters:** `status:` (tasks), `priority:`, `due:`, `list:`, `tag:` (tasks), `has:due`, `has:description`.
3. **Other sources:** `with:`, `by:`, `series:`, `skill:`, `tag:` and `status:` (readings), `has:notes`, `has:todos`, `has:summary`, quoted phrases.
4. **Dates:** `before:`, `after:`, `on:`, `during:`.
5. **Completion list** while typing a modifier (a popover listing names, then the values that exist in the user's data; picking inserts the text).

Every stage: tests, lint and typecheck pass; drive the built app on a scratch library (`CLAUDE.md`, "Testing the app for real") and look at screenshots;
one commit per standalone part; record decisions in `docs/DECISIONS.md`.

## TODO for the user (add to `docs/ROADMAP.md`, "For the user")

- Tag readings with a workspace so readings can be scoped to one too. Until then readings are unscoped and appear in a search of any workspace.
