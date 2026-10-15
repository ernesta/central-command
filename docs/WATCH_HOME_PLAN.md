# Watch, Home, notifications and the widget: plan

Built backend-only on 15 Oct 2026 (an unattended run; `docs/DECISIONS.md`, "Watch, Home, notifications and the widget file"). Mockups: `docs/design/home-mockup.html`, `watch-mockup.html`, `notifications-mockup.html`, `widgets-mockup.html`. Stop at the end of each stage and ask.

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

## Known limits

- Sites that need a login or a browser (a campus intranet, Box, Google Docs) cannot be watched.
- A page that rebuilds all its links (a redesign) adds up to 60 "new" items once.
- Meeting-derived hours are not in Home's hours (they are derived in the renderer).
