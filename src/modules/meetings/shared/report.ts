import { academicYearLabel } from '@shared/academic-year'
import { escapeHtml, reportPageHtml } from '@shared/report-page'
import { formatHours, sortSkills } from '@shared/skills'
import { meetingHours, meetingsInYear } from './hours'
import { compareNewestFirst, isUpcoming } from './query'
import { durationMinutes, formatDate } from './time'
import type { MeetingIndexRow } from './types'

/** The series the log is kept for. */
export const REPORT_SERIES = 'Supervision'

const MODE_LABELS = { 'in-person': 'In person', online: 'Online' } as const

export interface MeetingsReportInput {
  rows: readonly MeetingIndexRow[]
  year: number
  today: string
}

/** The file name suggested for the export, for example "Supervision log 2025-26.pdf". */
export function reportFileName(year: number): string {
  return `${REPORT_SERIES} log ${academicYearLabel(year).replace('–', '-')}.pdf`
}

/**
 * The supervision log of one academic year as a printable page: the totals, then one row per meeting,
 * oldest first. Meetings that have not happened yet are left out. Pure: the same input gives the same HTML.
 */
export function meetingsReportHtml(input: MeetingsReportInput): string {
  const { year, today } = input
  const supervision = input.rows.filter((r) => r.series === REPORT_SERIES)
  const rows = meetingsInYear(supervision, year)
    .filter((r) => !isUpcoming(r, today))
    .sort((a, b) => -compareNewestFirst(a, b))
  const hours = meetingHours(supervision, year, today)
  const label = academicYearLabel(year)

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
    title: `${REPORT_SERIES} log ${label}`,
    subtitle: `Generated ${formatDate(today)}. Meetings that have not happened yet are not included.`,
    totalsHtml: `<strong>${escapeHtml(formatHours(hours.minutes))}</strong> in ${hours.meetings} ${hours.meetings === 1 ? 'meeting' : 'meetings'}${hours.withoutTimes > 0 ? ` (${hours.withoutTimes} without times, counted as 0)` : ''}.${skills ? `<br>Hours per skill (a meeting counts towards each of its skills): ${skills}` : ''}`,
    headHtml:
      '<th>Date</th><th>Time</th><th class="r">Hours</th><th>Type</th><th>Summary</th><th>Skills</th><th>Attendees</th>',
    bodyHtml: body
  })
}
