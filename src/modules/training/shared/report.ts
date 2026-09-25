import { academicYearLabel } from '@shared/academic-year'
import { formatHours, sortSkills } from '@shared/skills'
import { durationMinutes, formatDate } from '@shared/time'
import { compareNewestFirst, entriesInYear, isUpcoming, trainingHours } from './rules'
import { typeLabel, type TrainingIndexRow } from './types'

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

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

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Training log ${escapeHtml(label)}</title>
<style>
@page { size: A4 landscape; margin: 14mm; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 9.5pt; color: #1b222b; }
h1 { margin: 0 0 4px; font-size: 18pt; }
.sub { margin: 0 0 10px; color: #5c6672; font-size: 9pt; }
.totals { margin: 0 0 12px; font-family: Helvetica, Arial, sans-serif; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; }
th { text-align: left; padding: 4px 6px; border-bottom: 1.5px solid #1b222b; font-size: 8pt; }
td { padding: 4px 6px; border-bottom: 0.5px solid #c3cad2; vertical-align: top; }
tr { break-inside: avoid; }
.nw { white-space: nowrap; }
.r { text-align: right; }
.q { color: #5c6672; }
</style>
</head>
<body>
<h1>Training log ${escapeHtml(label)}</h1>
<p class="sub">Generated ${escapeHtml(formatDate(today))}. Entries that have not happened yet are not included.</p>
<p class="totals"><strong>${escapeHtml(formatHours(hours.minutes))}</strong> of ${escapeHtml(String(aimHours))} h in ${hours.entries} ${hours.entries === 1 ? 'entry' : 'entries'}${hours.withoutTimes > 0 ? ` (${hours.withoutTimes} without times, counted as 0)` : ''}.${meetingMinutes > 0 ? ` Plus ${escapeHtml(formatHours(meetingMinutes))} of meetings.` : ''}${skills ? `<br>Hours per skill (an entry counts towards each of its skills): ${skills}` : ''}</p>
<table>
<thead><tr><th>Date</th><th>Time</th><th class="r">Hours</th><th>Type</th><th>Title and summary</th><th>Skills</th><th>Leads</th></tr></thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>
`
}
