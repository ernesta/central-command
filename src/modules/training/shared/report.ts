import { academicYearLabel } from '@shared/academic-year'
import { escapeHtml, reportPageHtml } from '@shared/report-page'
import { formatHours, sortSkills } from '@shared/skills'
import { durationMinutes, formatDate } from '@shared/time'
import { compareNewestFirst, entriesInYear, isUpcoming, trainingHours } from './rules'
import { typeLabel, type TrainingIndexRow } from './types'

export interface TrainingReportInput {
  rows: readonly TrainingIndexRow[]
  year: number
  today: string
  aimHours: number
  /** Minutes of meetings in the same year, mentioned in one quiet line; 0 to leave it out. */
  meetingMinutes: number
}

/** The file name suggested for the export, for example "Training log 2025-26.pdf". */
export function reportFileName(year: number): string {
  return `Training log ${academicYearLabel(year).replace('–', '-')}.pdf`
}

/**
 * The training log of one academic year as a printable page: the totals, then one row per entry,
 * oldest first. Entries that have not happened yet are left out. Plain system fonts and no scripts or
 * network resources, so it prints the same anywhere. Pure: the same input gives the same HTML.
 */
export function trainingReportHtml(input: TrainingReportInput): string {
  const { year, today, aimHours, meetingMinutes } = input
  const rows = entriesInYear(input.rows, year)
    .filter((r) => !isUpcoming(r, today))
    .sort((a, b) => -compareNewestFirst(a, b))
  const hours = trainingHours(input.rows, year, today, aimHours)
  const label = academicYearLabel(year)

  const body = rows
    .map((r) => {
      const minutes = durationMinutes(r.start, r.end)
      const time = r.start && r.end ? `${r.start}–${r.end}` : (r.start ?? '')
      return `<tr>
<td class="nw">${escapeHtml(r.date ? formatDate(r.date) : '')}</td>
<td class="nw">${escapeHtml(time)}</td>
<td class="nw r">${minutes === null ? '' : escapeHtml(formatHours(minutes))}</td>
<td>${escapeHtml(typeLabel(r.type))}</td>
<td><strong>${escapeHtml(r.title || 'Untitled')}</strong>${r.series ? ` <span class="q">${escapeHtml(r.series)}</span>` : ''}${r.summary ? `<br>${escapeHtml(r.summary)}` : ''}</td>
<td>${sortSkills(r.skills).map(escapeHtml).join('<br>')}</td>
<td>${r.leads.map(escapeHtml).join('<br>')}</td>
</tr>`
    })
    .join('\n')

  const skills = sortSkills(hours.perSkill.map((s) => s.skill))
    .map((name) => hours.perSkill.find((s) => s.skill === name)!)
    .map((s) => `${escapeHtml(s.skill)}: ${escapeHtml(formatHours(s.minutes))}`)
    .join(' · ')

  return reportPageHtml({
    title: `Training log ${label}`,
    subtitle: `Generated ${formatDate(today)}. Entries that have not happened yet are not included.`,
    totalsHtml: `<strong>${escapeHtml(formatHours(hours.minutes))}</strong> of ${escapeHtml(String(aimHours))} h in ${hours.entries} ${hours.entries === 1 ? 'entry' : 'entries'}${hours.withoutTimes > 0 ? ` (${hours.withoutTimes} without times, counted as 0)` : ''}.${meetingMinutes > 0 ? ` Plus ${escapeHtml(formatHours(meetingMinutes))} of meetings.` : ''}${skills ? `<br>Hours per skill (an entry counts towards each of its skills): ${skills}` : ''}`,
    headHtml:
      '<th>Date</th><th>Time</th><th class="r">Hours</th><th>Type</th><th>Title and summary</th><th>Skills</th><th>Leads</th>',
    bodyHtml: body
  })
}
