# Watch, Home, notifications and the widget: plan

Built backend-only on 15 Oct 2026 (an unattended run; `docs/DECISIONS.md`, "Watch, Home, notifications and the widget file"). Mockups: `docs/design/home-mockup.html`, `watch-mockup.html`, `notifications-mockup.html`, `widgets-mockup.html`. Stop at the end of each stage and ask.

## Status at a glance (15 Oct 2026; keep this table current)

| Piece                                                                    | Backend                                                | Tests | Driven in built app                               | Mockup                      | UI in the app                                                  | Needs the user                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------ | ----- | ------------------------------------------------- | --------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Watch: sources, items, keywords, checker, scheduler, IPC                 | done                                                   | yes   | yes (feed, page, Crossref)                        | `watch-mockup.html`         | **not started**                                                | feedback on the mockup; `watch:from-tasks --apply` |
| Home summary (tasks, meetings, hours, timer, coming up, Watch brief)     | done                                                   | yes   | yes                                               | `home-mockup.html`          | **built** (Research and Work; no weather or Watch card)        | the backend gaps below                             |
| Weather (Open-Meteo, opt-in)                                             | done                                                   | yes   | yes (London as a test place)                      | in `home-mockup.html`       | **not started**                                                | whether to have it; the place                      |
| Notifications (rules, notifier, click opens a page)                      | done                                                   | yes   | yes (digest recorded; the banner itself not seen) | `notifications-mockup.html` | settings tab **not started**; click handler `RouteOpener` done | quiet hours?                                       |
| Widget file (`data/widget/snapshot.json`)                                | done                                                   | yes   | yes                                               | `widgets-mockup.html`       | switch **not started**                                         | decide on the native Swift widget and signing      |
| Swift / WidgetKit widget                                                 | not started                                            |       |                                                   | `widgets-mockup.html`       |                                                                | Xcode, signing, App Group                          |
| Settings `home` slice                                                    | done                                                   | yes   | yes                                               | in the mockups              | tabs **not started**                                           |                                                    |
| `in:watch` search                                                        | not started                                            |       |                                                   | mentioned only              |                                                                | optional                                           |
| Meeting-derived hours in the summary and widget file (the page has them) | **done 17 Oct 2026**: `docs/HOURS_CONSISTENCY_PLAN.md` |       |                                                   |                             |                                                                | backend consistency only; no widget is wanted yet  |

Not applied to the real library: `npm run watch:from-tasks -- --apply`. Not pushed, not installed. Commits `fa4f849` to `9282845`.

## What to work on next (ranked; the user picks)

1. Feedback on the Watch, notifications and widgets mockups (Home's is applied: one "Next meeting" card in both workspaces, "Coming up" is the next 7 days, no running timer in This week/This month).
2. ~~Home page~~ built 15 Oct 2026 (`src/modules/home/renderer/`), on Research's and Work's landing above the module cards; Life has none. Not installed, not pushed. Weather and Watch cards still to add (stages 1 and 3).
3. **Watch page** (stage 1), after `watch:from-tasks -- --apply` on the real library (app closed).
4. **Settings → Home and Notifications** (stage 3), so weather, notifications and the widget switch can be turned on.
5. `in:watch` search (stage 4, optional).
6. The Swift widget (stage 5), only after the user's decision.

## Stages (all UI; the backends exist and are tested)

1. **Watch page** (`/research/watch`): the inbox (filters, bookmark, dismiss, mark all seen), Sources (grouped by reminder, status, check now, add, suggestions, "by hand" list), Keywords. Add `watch` to the module manifest, a landing card, Settings section. Run `npm run watch:from-tasks` first (dry run, then `--apply` with the app closed) so the sources exist.
2. **Home page**: the cards of the mockup from `window.api.home.summary()`; the workspace landing pages open on it. Weather and Watch cards appear only when set up.
3. **Settings → Home and Notifications**: weather (place search, unit), widget switch, the notification switches; shortcuts list stays in step.
4. **Search**: `in:watch` over collected items (optional).
5. **Widget**: a WidgetKit extension reading `data/widget/snapshot.json`. Needs the user's decision (below).

## Open questions for the user

- Quiet hours for notifications?
- Should Watch tick the monthly "Check upcoming …" reminder when every source in its group has been looked at?
- Which places named without an address should be given one (Researcher Development Programme, SEDarc / Inkpath)?
- Widget: build the native extension, and sign the app with an Apple developer account?
- Weather: the place (Egham?), and whether it should exist at all (it is the one thing that tells a service roughly where you are).
- Journals: which of the suggested ones to keep (14 are offered: LINGUIST List's four feeds and ten journals).

## Home page: what the summary does not carry (a backend change, the user's call)

- The summary's `hours` is now per workspace (`{ research, work }`) and counts the shown year, meetings' and lectures' derived hours included (17 Oct 2026, `docs/HOURS_CONSISTENCY_PLAN.md`); the page still reads the tracking files in the renderer for "This week" and Work's "This month" and gives the same figures (one shared `periodFigures`).
- `meetings.next` is the next meeting of either workspace and `openTodos` counts Research's only. The page takes Work's next meeting from `upcoming` (21 days, shared 12-item cap), and shows no Open TODOs count in Work.
- `upcoming` is capped at 12 before the page keeps one workspace's 7 days, and Watch items count towards the cap; a very full week in one workspace could hide the other's items.
- The "N more" count of Today is not known per workspace when the summary cut a list at 8; the header count is then left out and "See all" stays.

## Known limits

- Sites that need a login or a browser (a campus intranet, Box, Google Docs) cannot be watched.
- A page that rebuilds all its links (a redesign) adds up to 60 "new" items once.
- The widget file's `week` and `work` hours are the Hours page's (derived hours included); a Work client on two contracts that both hold today is picked by the last client used, not by the contract the page remembers.
