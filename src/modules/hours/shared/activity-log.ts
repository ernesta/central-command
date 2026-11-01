import { escapeHtml } from '@shared/report-page'
import { localeDate } from '@shared/locale-names'
import { hasAim } from '@shared/tracking/plan'
import { dayRows } from '@shared/tracking/totals'
import { sameLabel } from '@shared/tracking/timer'
import { contractEnd } from '@shared/tracking/workspace-weeks'
import { invoiceOf, type Moment, type TrackingYear } from '@shared/tracking/types'
import { addDays, daysBetween } from '@shared/year'
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
  /** The sentence that opens the log. */
  intro: string
  groups: ActivityGroup[]
  minutes: number
  /** The name the PDF is suggested to be saved as, for example "2026 09 Activity Log.pdf". */
  fileName: string
}

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine'
]

const longDate = (date: string): string =>
  localeDate(date, { month: 'long', day: 'numeric', year: 'numeric' })

/** Hours the way the log writes them: 2.25, 14, 0.25. */
export function logHours(minutes: number): string {
  return String(Number((minutes / 60).toFixed(2)))
}

/** "1 day per week", "2 days per week", "6.5 hours per week": the weekly aim, a day being eight hours; null where there is none. */
export function levelOfEffort(year: TrackingYear): string | null {
  if (!hasAim(year)) return null
  const minutes = year.plan.hoursPerWeek
  const days = minutes / 480
  if (Number.isInteger(days)) return `${days} ${days === 1 ? 'day' : 'days'} per week`
  const hours = logHours(minutes)
  return `${hours} ${hours === '1' ? 'hour' : 'hours'} per week`
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
    for (const row of dayRows(year, date, now)) {
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
  const weeks = Math.round((daysBetween(period.from, to) + 1) / 7)
  const effort = levelOfEffort(year)
  const byWeek = invoiceOf(year) === 'week'
  const what = byWeek ? period.name : `${period.name} ${period.id.slice(0, 4)}`
  const span = `${weeks === 1 ? 'week' : `${NUMBER_WORDS[weeks] ?? weeks} weeks`} between ${longDate(period.from)}, and ${longDate(to)}`
  const month = period.id.slice(0, 7).replace('-', ' ')
  return {
    title: `${what} Activity Log`,
    intro:
      `This activity log summarises the consulting work completed during ${byWeek ? `${period.name.toLowerCase()}` : what}. ` +
      `More specifically, ${effort ? `with the contract specifying the level of effort at ${effort}, ` : ''}the log covers the ${span}.`,
    groups,
    minutes: groups.reduce((sum, g) => sum + g.minutes, 0),
    fileName: `${byWeek ? period.from.replace(/-/g, ' ') : month} Activity Log.pdf`
  }
}

/** The printable page: a title, the date, the opening sentence and the table of activities. Everything is escaped. */
export function activityLogHtml(log: ActivityLog, today: string): string {
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
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@page { size: A4 portrait; margin: 20mm; }
body { font-family: Calibri, Carlito, Helvetica, Arial, sans-serif; font-size: 11pt; color: #000; }
h1 { margin: 0 0 14px; font-size: 24pt; font-weight: 600; }
p { margin: 0 0 12px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 4px 8px; border: 0.75pt solid #000; vertical-align: top; }
th { background: #002060; color: #fff; text-align: center; }
td.r, th.r { width: 70px; text-align: center; }
tr { break-inside: avoid; }
tr.client td, tr.total td { background: #e8e8e8; font-weight: 700; }
</style>
</head>
<body>
<h1>${escapeHtml(log.title)}</h1>
<p><strong>Date</strong>: ${escapeHtml(longDate(today))}</p>
<p>${escapeHtml(log.intro)}</p>
<table>
<thead><tr><th>Activity</th><th class="r">Time (h)</th></tr></thead>
<tbody>
${rows}
<tr class="total">${cell('Total')}${cell(logHours(log.minutes), 'r')}</tr>
</tbody>
</table>
</body>
</html>
`
}
