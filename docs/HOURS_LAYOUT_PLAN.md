# Work Hours layout plan (13 Oct 2026, agreed with the user in a design conversation)

Mockup: `docs/design/hours-layout-mockup.html` (open it in a browser; it uses the app's tokens and the user's real figures for Tue 13 Oct 2026).

## Why

The user opens Work → Hours to answer one thing: **am I on track this week and this month?** The page showed eight numbers over three spans (week, invoice month, whole contract) and nothing said which number belonged to which span. The right-hand Balance card (balance -72:55, hours so far, planned, average week) is the whole contract, which reads as if it belonged to the cards beside it.

## The design (the user chose "option A" and refined it; do not re-ask these)

- **Same shape for the Week card and the invoice-period card** ("do not do different things for the two cards; I need to understand it at a glance"):
  1. arrows and the name/dates, as now;
  2. one summary row: the hours worked large, with `of <aim>` in small muted text, and the signed balance on the right in the warning tone when behind (`-7:10`, `-1:55`). No sentences and no headlines;
  3. one bar (the same bar in both; no pace marker);
  4. the table: days in the Week card, weeks in the period card. Columns Hours and the bar; **the Plan column goes** (it is 8:00 on every row and the aim is already in the summary).
- **The whole contract moves out of the right column** into one quiet line under the cards: hours of planned, balance, average week, and the "Charts and weeks" button. The right column goes, so the two cards sit side by side (stack on a narrow window). Today stays full width above them, unchanged.
- **Marking the current row: the accent stripe, no chip.** The invoice card's current week is bold, with the stripe on the very left edge of the row (the card's edge, not indented; the table bleeds to the card's padding edge). The "this week" chip is not used. Tasks already does this for a running task (`.running td:first-child { box-shadow: inset 4px 0 0 var(--accent) }` in `tasks/renderer/TasksTable.module.css`); reuse that, do not invent a variant. **Decided on the user's question "if the stripe is on the right card, should the left have one too?": yes, today's row in the Week card gets the same stripe**, so both cards mark "now" the same way. The existing "today" chip next to the date stays as it is; it is already in the app.
- **An open day is not redesigned.** It keeps what the app draws today (`TaskList`: task name, client chip, bold time, trash icon, "+ Add", meeting rows). The mockup was corrected to match; there is **no play button and no "Add time" in the week's day rows** (they do not exist; only Today starts tasks). Its highlight (the shaded open row) stays as it is.

## Decided on 13 Oct 2026

- Both balances are measured against the **whole aim** (full week, full month), not against what is expected so far.
- **Research follows the same layout as Work** (stage 3 changes Research's Balance card too).
- Each stage is written up, committed and pushed without stopping to ask; install at the end of the last stage (the user's instruction for this plan, not a change to CLAUDE.md).

## Open question (answered above; kept for the record)

The two balances do not mean the same thing today: the week's `-7:10` is against the **whole 8:00 aim** (it shrinks as you log), the month's `-1:55` is against the **16:00 expected so far**. In one summary row they will read as the same kind of number. Ask the user: should both be against the aim, or both against what is expected by today? One question only.

Also ask once before stage 1 whether **Research's Hours page** (which has no invoice card and uses the shared year) should follow, or whether this is Work only. Assume Work only until told otherwise.

## Stages (stop after each and ask; the user clears context between stages)

1. **Week card summary.** `WeekCard.tsx`: the header summary row (worked of aim, balance) and one bar replace the current "0:50 of 8:00 so far · -7:10" text; today's row gets the stripe; the table bleeds to the card edge so the stripe is at the very left. Reuse the existing Hours tokens and CSS modules; no new colours (the warning tone is `--chart-under`).
2. **Invoice card.** `InvoiceCard.tsx`: the same summary row and bar, the Plan column removed, the current week bold with the stripe. Same component pieces as stage 1 where they can be shared (a small shared summary row, not two copies).
3. **Contract line and layout.** `HoursPage.tsx`, `BalanceCard.tsx`: the contract figures become one quiet line under the cards with "Charts and weeks"; the right column goes; the two cards sit side by side and stack on a narrow window. Keep whatever the Balance card does for Research unchanged unless the user says otherwise.

## Checks for every stage

Tests, lint and typecheck pass. Drive the app in a scratch library (CLAUDE.md, "Testing the app for real"), dev and production build, light and dark, and look at screenshots: the stripe at the very left of the row, no clipped focus rings, the two cards at the same height rhythm, a narrow window. Record the stage in `docs/DECISIONS.md` and the top of `docs/ROADMAP.md`. Commit per stage; do not push.
