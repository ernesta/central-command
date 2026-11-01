import { escapeHtml } from '@shared/report-page'
import { localeDate } from '@shared/locale-names'
import { derivedRows, type DerivedRow } from '@shared/tracking/derived'
import { dayRows } from '@shared/tracking/totals'
import { sameLabel } from '@shared/tracking/timer'
import { contractEnd } from '@shared/tracking/workspace-weeks'
import { invoiceOf, type Moment, type TrackingYear } from '@shared/tracking/types'
import { addDays } from '@shared/year'
import type { ContractPeriod } from './periods'

/** One activity: a task's name and everything spent on it in the period. */
export interface ActivityRow {
  label: string
  minutes: number
}

/** The activities of one client (none for a contract without clients), in the order they were first worked on. */
export interface ActivityGroup {
  client: string | null
  minutes: number
  rows: ActivityRow[]
}

export interface ActivityLog {
  title: string
  /** The span the log covers, for example "2 Oct 2026 – 5 Nov 2026". */
  covered: string
  groups: ActivityGroup[]
  minutes: number
  /** The name the PDF is suggested to be saved as, for example "2026 09 Activity Log.pdf". */
  fileName: string
}

const shortDate = (date: string): string =>
  localeDate(date, { month: 'short', day: 'numeric', year: 'numeric' })

/** Hours the way the log writes them: 2.25, 14, 0.25. */
export function logHours(minutes: number): string {
  return String(Number((minutes / 60).toFixed(2)))
}

/**
 * What a line is called in the log. A meeting or training counted from a note is named for its series with "meetings" or
 * "trainings" after it ("Supervision meetings"), so every meeting of a series is one entry; a typed or timed task keeps its
 * own name.
 */
export function activityName(label: string, kind?: DerivedRow['kind']): string {
  return kind === undefined ? label : `${label} ${kind === 'training' ? 'trainings' : 'meetings'}`
}

/**
 * The activity log of one invoice period: every task worked on, summed over the period and grouped under its client,
 * in the order first worked on, the way the consulting logs are written by hand. A task is told by its name and client;
 * a task named with different capitals counts once. Pure: the same input gives the same log.
 */
export function activityLog(year: TrackingYear, period: ContractPeriod, now?: Moment): ActivityLog {
  const to = [period.to, contractEnd(year)].sort()[0]
  const groups: ActivityGroup[] = []
  for (let date = period.from; date <= to; date = addDays(date, 1)) {
    // Meetings and trainings are derived from their notes and counted in the totals, so they are activities too.
    const rows = [
      ...dayRows(year, date, now).map((r) => ({ ...r, kind: undefined })),
      ...derivedRows(year, date)
    ]
    for (const row of rows) {
      const client = row.client ?? null
      const label = activityName(row.label, row.kind)
      let group = groups.find((g) => g.client === client)
      if (!group) groups.push((group = { client, minutes: 0, rows: [] }))
      let activity = group.rows.find((r) => sameLabel(r.label, label))
      if (!activity) group.rows.push((activity = { label, minutes: 0 }))
      activity.minutes += row.minutes
      group.minutes += row.minutes
    }
  }
  const order = year.plan.clients ?? []
  // The plan's order; any other name after it, and time with no client last.
  const rank = (client: string | null): number =>
    client === null
      ? order.length + 1
      : order.includes(client)
        ? order.indexOf(client)
        : order.length
  groups.sort((a, b) => rank(a.client) - rank(b.client))
  const byWeek = invoiceOf(year) === 'week'
  const what = byWeek ? period.name : `${period.name} ${period.id.slice(0, 4)}`
  const month = period.id.slice(0, 7).replace('-', ' ')
  return {
    title: `${what} Activity Log`,
    covered: `${shortDate(period.from)} – ${shortDate(to)}`,
    groups,
    minutes: groups.reduce((sum, g) => sum + g.minutes, 0),
    fileName: `${byWeek ? period.from.replace(/-/g, ' ') : month} Activity Log.pdf`
  }
}

/**
 * The printable page, styled like the invoice it goes with: a title block with the name and period, a
 * black table header, pale banded rows and a black Total row. Everything is escaped. `name` is the user's own (the person
 * flagged `me`); without it the line shows the period alone. `fontCss` is the `@font-face` rules for DM Sans
 * (`renderer/activity-log-font.ts`; the shared code stays free of bundler imports); without it the page uses Helvetica.
 */
export function activityLogHtml(log: ActivityLog, name?: string, fontCss = ''): string {
  const cell = (text: string, className = ''): string =>
    `<td${className ? ` class="${className}"` : ''}>${escapeHtml(text)}</td>`
  // Activity rows alternate pale and white; the subtotal rows do not count.
  let band = 0
  const rows = log.groups
    .map((g) => {
      const head =
        g.client === null
          ? ''
          : `<tr class="client">${cell(`${g.client} – Subtotal`)}${cell(logHours(g.minutes), 'r')}</tr>`
      const body = g.rows
        .map(
          (r) =>
            `<tr${band++ % 2 === 0 ? ' class="band"' : ''}>${cell(r.label)}${cell(logHours(r.minutes), 'r')}</tr>`
        )
        .join('\n')
      return `${head}\n${body}`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(log.title)}</title>
<style>
${fontCss}
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
@page { size: A4 portrait; margin: 0; }
body { margin: 0; font-family: 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; }
.page { padding: 10mm 12mm 10mm; }
.head { padding-top: 4mm; }
h1 { margin: 0 0 2mm; font-size: 17pt; line-height: 1.2; font-weight: 700; }
.by { margin: 0 0 8mm; font-size: 10.5pt; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { padding: 3.2mm 5mm; background: #000; color: #fff; font-size: 8pt; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; text-align: left; }
th:first-child { border-radius: 8px 0 0 0; }
th:last-child { border-radius: 0 8px 0 0; }
td { padding: 2mm 5mm; vertical-align: top; }
td.r, th.r { width: 28mm; text-align: right; }
tr { break-inside: avoid; }
tr.band td { background: #f7f7f7; }
tr.client td { padding-top: 3mm; padding-bottom: 3mm; background: #dcdcdc; font-weight: 700; }
tbody tr:not(.client):not(.total) td:first-child { padding-left: 9mm; }
tr.total td { padding-top: 3.5mm; padding-bottom: 3.5mm; background: #000; color: #fff; font-weight: 700; }
</style>
</head>
<body>
<div class="page">
<div class="head">
<h1>${escapeHtml(log.title)}</h1>
<p class="by">${escapeHtml([name, log.covered].filter(Boolean).join(' | '))}</p>
</div>
<table>
<thead><tr><th>Activity</th><th class="r">Time (h)</th></tr></thead>
<tbody>
${rows}
<tr class="total">${cell('Total')}${cell(logHours(log.minutes), 'r')}</tr>
</tbody>
</table>
</div>
</body>
</html>
`
}
