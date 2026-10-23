import { yearLabel } from '@shared/year'
import { escapeHtml, reportPageHtml } from '@shared/report-page'
import { formatHours, sortSkills } from '@shared/skills'
import { meetingHours, meetingsInYear } from './hours'
import { compareNewestFirst, isUpcoming } from './query'
import { durationMinutes, formatDate } from './time'
import type { MeetingIndexRow } from './types'

/** The series Research's log is kept for. Work has no such series, so its export covers every meeting. */
export const REPORT_SERIES = 'Supervision'

const MODE_LABELS = { 'in-person': 'In person', online: 'Online' } as const

export interface MeetingsReportInput {
  rows: readonly MeetingIndexRow[]
  /** The year's start date (a contract's first day in Work). */
  year: string
  /** The period's length, when it is not the 52-week year (a contract's). */
  weeks?: number
  /** What the period is called in the report, when it is not "2026–27" (a contract's name and dates). */
  label?: string
  today: string
  /** Only meetings of this series, titled "<seriesFilter> log"; omitted, every meeting, titled "Meetings log". */
  seriesFilter?: string
}

/** The file name suggested for the export, for example "Supervision log 2025-26.pdf". */
export function reportFileName(year: string, seriesFilter?: string, label?: string): string {
  const title = seriesFilter ?? 'Meetings'
  return `${title} log ${(label ?? yearLabel(year)).replace('–', '-').replace(/[/:]/g, '-')}.pdf`
}

/**
 * One year's meetings as a printable page: the totals, then one row per meeting, oldest first.
 * Meetings that have not happened yet are left out. Pure: the same input gives the same HTML.
 */
export function meetingsReportHtml(input: MeetingsReportInput): string {
  const { year, today, seriesFilter, weeks } = input
  const included = seriesFilter ? input.rows.filter((r) => r.series === seriesFilter) : input.rows
  const rows = meetingsInYear(included, year, weeks)
    .filter((r) => !isUpcoming(r, today) && durationMinutes(r.start, r.end))
    .sort((a, b) => -compareNewestFirst(a, b))
  const hours = meetingHours(included, year, today, weeks)
  const label = input.label ?? yearLabel(year)
  const title = seriesFilter ?? 'Meetings'

  const body = rows
    .map((r) => {
      const minutes = durationMinutes(r.start, r.end)
      const time = r.start && r.end ? `${r.start}–${r.end}` : (r.start ?? '')
      return `<tr>
<td class="nw">${escapeHtml(formatDate(r.date))}</td>
<td class="nw">${escapeHtml(time)}</td>
<td class="nw r">${minutes === null ? '' : escapeHtml(formatHours(minutes))}</td>
<td>${escapeHtml(r.mode ? MODE_LABELS[r.mode] : '')}</td>
<td>${escapeHtml(r.summary)}</td>
<td>${sortSkills(r.skills).map(escapeHtml).join('<br>')}</td>
<td>${r.attendees.map(escapeHtml).join('<br>')}</td>
</tr>`
    })
    .join('\n')

  const skills = sortSkills(hours.perSkill.map((s) => s.skill))
    .map((name) => hours.perSkill.find((s) => s.skill === name)!)
    .map((s) => `${escapeHtml(s.skill)}: ${escapeHtml(formatHours(s.minutes))}`)
    .join(' · ')

  return reportPageHtml({
    title: `${title} log ${label}`,
    subtitle: `Generated ${formatDate(today)}. Meetings that have not happened yet are not included.`,
    totalsHtml: `<strong>${escapeHtml(formatHours(hours.minutes))}</strong> in ${hours.meetings} ${hours.meetings === 1 ? 'meeting' : 'meetings'}.${skills ? `<br>Hours per skill (a meeting counts towards each of its skills): ${skills}` : ''}`,
    headHtml:
      '<th>Date</th><th>Time</th><th class="r">Hours</th><th>Type</th><th>Summary</th><th>Skills</th><th>Attendees</th>',
    bodyHtml: body
  })
}
