import { escapeHtml } from '@shared/report-page'
import { localeDate } from '@shared/locale-names'
import { derivedRows } from '@shared/tracking/derived'
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
 * The activity log of one invoice period: every task worked on, summed over the period and grouped under its client,
 * in the order first worked on, the way the consulting logs are written by hand. A task is told by its name and client;
 * a task named with different capitals counts once. Pure: the same input gives the same log.
 */
export function activityLog(year: TrackingYear, period: ContractPeriod, now?: Moment): ActivityLog {
  const to = [period.to, contractEnd(year)].sort()[0]
  const groups: ActivityGroup[] = []
  for (let date = period.from; date <= to; date = addDays(date, 1)) {
    // Meetings and trainings are derived from their notes and counted in the totals, so they are activities too.
    const rows = [...dayRows(year, date, now), ...derivedRows(year, date)]
    for (const row of rows) {
      const client = row.client ?? null
      let group = groups.find((g) => g.client === client)
      if (!group) groups.push((group = { client, minutes: 0, rows: [] }))
      let activity = group.rows.find((r) => sameLabel(r.label, row.label))
      if (!activity) group.rows.push((activity = { label: row.label, minutes: 0 }))
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
 * The printable page, styled like the invoice it goes with: a black bar, the author's name top right, a ruled title block,
 * a black table header and pale rows. Everything is escaped. `name` is the user's own (the person flagged `me`); without it
 * the name block is left out.
 */
export function activityLogHtml(log: ActivityLog, name?: string): string {
  const cell = (text: string, className = ''): string =>
    `<td${className ? ` class="${className}"` : ''}>${escapeHtml(text)}</td>`
  const rows = log.groups
    .map((g) => {
      const head =
        g.client === null
          ? ''
          : `<tr class="client">${cell(`${g.client} – Total`)}${cell(logHours(g.minutes), 'r')}</tr>`
      const body = g.rows
        .map((r) => `<tr>${cell(r.label)}${cell(logHours(r.minutes), 'r')}</tr>`)
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
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
@page { size: A4 portrait; margin: 0; }
body { margin: 0; font-family: 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; }
.bar { height: 4px; background: #000; }
.page { padding: 12mm 12mm 14mm; }
.author { text-align: right; min-height: 22mm; font-weight: 700; font-size: 10.5pt; }
.head { border-top: 1.5px solid #000; margin-top: 4mm; padding-top: 5mm; }
h1 { margin: 0 0 3mm; font-size: 17pt; line-height: 1.2; font-weight: 700; text-transform: uppercase; }
.date { margin: 0 0 8mm; font-size: 11pt; font-weight: 700; }
table { width: 100%; border-collapse: separate; border-spacing: 0; }
th { padding: 4mm 5mm; background: #000; color: #fff; font-size: 8pt; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; text-align: left; }
th:first-child { border-radius: 8px 0 0 8px; }
th:last-child { border-radius: 0 8px 8px 0; }
td { padding: 3.2mm 5mm; vertical-align: top; }
tbody tr:nth-child(odd) td { background: #f7f7f7; }
td.r, th.r { width: 28mm; text-align: right; }
tr { break-inside: avoid; }
tr.client td { font-weight: 700; }
.total { display: flex; justify-content: flex-end; gap: 6mm; margin-top: 6mm; padding-right: 5mm; font-size: 17pt; font-weight: 700; }
</style>
</head>
<body>
<div class="bar"></div>
<div class="page">
<div class="author">${name ? escapeHtml(name) : ''}</div>
<div class="head">
<h1>${escapeHtml(log.title)}</h1>
<p class="date">Period: ${escapeHtml(log.covered)}</p>
</div>
<table>
<thead><tr><th>Activity</th><th class="r">Time (h)</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<div class="total"><span>Total</span><span>${escapeHtml(logHours(log.minutes))} h</span></div>
</div>
</body>
</html>
`
}
