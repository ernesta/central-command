# Outline as a rail (plan, 25 Oct 2026)

The user's decision of 25 Oct 2026, after the mockup `docs/design/outline-options-mockup.html` (options A to F, made-up titles; option **E** chosen).
Stage 1 built and driven 25 Oct 2026 (see `docs/DECISIONS.md`, "Outline as a rail"); stage 2 is not started.

## Why

On the Training entry page the outline was its own 170px card beside the Files card (`DocSplit roomySide`, 1400px and wider). Headings wrapped in it,
and with one or two headings it was a mostly empty box. Researched for prior art: Notion, Google Docs and GitHub all keep a live, clickable outline
from the headings; Stripe and MDN ("On this page") draw it as a hairline rail with the current heading marked. Nothing authoritative says what to do
with a short document; the choice below is the user's.

## The decision (E)

- **The outline is a rail, not a card**: a small-caps label ("On this page"? keep "Outline", the existing label, unless the user says otherwise),
  and the headings under it with a 2px hairline down their left edge. The heading being read has an **accent line** (not a filled background) and is
  `aria-current="location"` as now.
- **Above Files**, in one side column of the usual width (260px). The two-column "roomy" side is dropped: `roomySide` and its CSS in
  `DocSplit.module.css` go, with its test and the one use in `TrainingEntryPage`.
- **Top headings only; the section you are in unfolds.** The rail lists the `#`/`##` headings. The `###` headings under a heading show only while
  the heading being read is that heading or one of its `###`s; the others stay folded. The heading that holds the one being read is drawn in `--ink`
  with a stronger rule; a `###` is muted as now. "Being read" is `currentIndex` in `NoteOutline.tsx` (already built); no new scroll tracking. With
  no `##` above a `###` (a note that starts with `###`), the `###` is a top heading.
- Shown whatever the number of headings (the "hide below four" option, C, was not chosen). Empty note: unchanged ("Headings you write appear here.").
- **Everywhere `NoteOutline` is used**: Training entry (above `FilesPanel`), Training plan, Notes, Readings. The Training plan and the Notes page have no
  Files panel, so there it is simply the column's first (and only) panel. It stays a `<nav>` landmark; it is no longer a `Panel` card, so it
  needs its own heading element styled like `Panel`'s label (or a `Panel` variant: prefer a variant so the label stays one style).

## Stages (stop after each and ask)

1. **The rail, above Files.** Restyle `NoteOutline` as the rail (all headings still listed, as now); order Files below it in `TrainingEntryPage`;
   remove `roomySide`. Tests: `NoteOutline.test.ts`, `DocSplit.test.ts` updated; drive in a scratch library (the checks below).
2. **Unfold only the open section.** Top headings only; the `###`s of the current section show. Pure function in `src/shared/markdown-outline.ts` or
   next to `NoteOutline` (`visibleOutline(outline, current)`), unit-tested: nothing current (before the first heading), a top heading current,
   a `###` current, a `###` before any `##`, one heading, a heading level 1 mixed with 2s. Mutation check: unfold every section, and it must fail.

## Drive in the app (scratch library; production build and dev mode, light and dark; look at the screenshots)

- Training entry with 1, 3 and 9 headings (including `###`s); scroll through the note and watch the rail follow and unfold; click a heading in the rail;
  type a new `##` and see it appear live; a 1400px and a 1000px window; Notes, Readings and the Training plan pages; keyboard Tab ring on a rail entry is
  not clipped by the column (`.side` has 4px padding, check it).
- Hairline and accent line in both themes use existing tokens (`--border-soft`, `--accent`, `--ink`, `--text-muted`); no raw colours.

## Write-up when built

`docs/DECISIONS.md` ("Notes outline" entry gets a dated addendum), `docs/ROADMAP.md`, `CLAUDE.md` "What is built". Commits: one per stage.
