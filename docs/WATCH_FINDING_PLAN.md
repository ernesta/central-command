# Watch: finding an item again (29 Oct 2026)

**Status: PLANNED, agreed with the user (29 Oct 2026); nothing built.** Three stages; stop and ask at the end of each.

## The user's report

Opening a Watch item marks it read at once. On the landing (New items only) the row vanishes; in "All" it drops into the Read group,
ordered by day found, so it is lost in the middle. Search finds a Watch item, but opening the hit goes to the section's list
(`watchListRoute(section)` in `search.ts`), which says nothing about which item was meant, so it is useless.

## Prior art (looked up 29 Oct 2026)

- Gmail, Outlook, Apple Mail: opening marks read but the row stays where it is, dimmed; the list only reshuffles when you leave and
  return. Feedly and NetNewsWire keep an opened article visible in an unread-only view until you navigate away.
- A timer before marking read is disliked (Asana users complained of 5 to 10 seconds); opening is already a deliberate act.
- Undo that restores the flag but not the row's place is a known gap (MailMate).
- A search hit should land on the thing itself, scrolled into view and highlighted; a deep link that leaves the item off-screen is a
  known complaint (Coda).

## Decisions (the user's, 29 Oct 2026: "yes")

Opening still marks read (the Watch review rule stays), but:

1. **Stage 1, the row stays put.** Opening an item sets `seen` as now, but the row keeps its place and shows dimmed until the page is left
   (landing and "All"). Cmd-Z (`item-state-undo.ts`) and Mark new put it back where it was. The landing keeps listing New only after the
   visit; the held row is a view-state of the page, not a stored value.
2. **Stage 2, Read is most recently read first.** Needs a numbered migration (`watch/0006_…`, never edit a shipped one) adding a nullable
   `read_at` to `watch_items`, set when the state becomes `seen` (open, Mark read, un-save) and cleared on Mark new; existing `seen` rows
   have none and sort after those with one, then by day found as now. Undo restores the previous `read_at` too. Check `snapshot.json`,
   Home counts and `watch:reparse` are unaffected.
3. **Stage 3, a search hit lands on the item.** The hit opens the section's "All" page with the state filter on All, scrolls to that row
   (`scrollIntoView`, block `center`) and highlights it briefly (`--hover-tint`, no blue, no animation beyond a short fade; respect
   reduced motion). Other rows stay visible. Needs the item's id in the route (state or query), `WatchAllPage` reading it, and a group
   that is cut ("Show N more") opened if the item is in its hidden part. A saved or read item must work as well as a new one. The
   page's filters stay unremembered. Moves with the page's Workspace (`useWatchWorkspace`), Life as well as Research.

## How to finish each stage

Tests, lint, typecheck pass; mutation check for the rule the stage adds (stage 1: the row leaving at once; stage 2: the ordering and
undo of `read_at`; stage 3: the hidden-group case). Drive the app in a scratch library (production build and dev mode, light and dark,
screenshots looked at): open an item and watch it stay; Cmd-Z; reopen the page and find it first in Read; search, press a hit, land on
the highlighted row, including one in a cut group. Update `docs/DECISIONS.md`, `docs/ROADMAP.md`, tick this plan; one commit per
stage; push only when told.
