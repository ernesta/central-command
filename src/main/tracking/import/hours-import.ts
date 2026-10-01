import { addDays, daysBetween, inYear, weekdayOf, weeksOf, yearEnd, yearLabel } from '@shared/year'
import { parseYear } from '@shared/tracking/parse'
import { plannedDays } from '@shared/tracking/plan'
import { timeOffCounts } from '@shared/tracking/timeoff'
import { weeklyMinutes, yearMinutes, yearTotals, type YearTotals } from '@shared/tracking/totals'
import {
  DEFAULT_PLAN,
  emptyYear,
  type TimeOffEntry,
  type TimeOffType,
  type TrackingYear
} from '@shared/tracking/types'
import {
  missingDates,
  type DayRow,
  type StudySheet,
  type TimeOffRow,
  type TimeOffSheet
} from './hours-sheet'

/** What a year's import found that the user should know, none of it a reason to distrust the year. */
export interface YearReport {
  /** The sheet's own weekly total against the daily rows (the daily rows win). */
  sheetTotal: { sheet: number | null; days: number; difference: number | null }
  /** Weeks whose weekly column does not equal their daily rows (the old sheet's ranges overlap or drift). */
  weekDifferences: { week: number; from: string; sheet: number; days: number }[]
  /** Dates between the first and last row with no row at all (counted as no time). */
  missingDates: string[]
  /** Dated rows outside the 52 weeks, left out. */
  outsideDays: DayRow[]
  /** Time-off rows outside the year, left out. */
  outsideTimeOff: TimeOffRow[]
  /** Time-off rows on a weekend, left out (a weekend is never a day off that counts). */
  weekendTimeOff: TimeOffRow[]
  /** Hours typed that are not a whole number of quarter hours (imported as typed). */
  notQuarter: DayRow[]
  /** Weeks where the typed planned days differ from what the time-off list gives (2026–27 uses the list). */
  typedDaysDiffer: { week: number; from: string; typed: number; list: number }[]
  /** Scratch-area rows: no date, not imported. */
  scratch: string[]
  /** Cells nothing reads. */
  unread: string[]
  /** Annual leave typed as blocks, with no exact dates: not imported (the user adds the dates in the app). */
  leaveBlocks: { from: string; days: number }[]
  /** Other text in the time-off summary block. */
  timeOffNotes: string[]
  /** Day notes imported. */
  notes: number
}

export interface YearCheck {
  minutes: number
  plannedDays: number
  plan: number
  balance: number
  averageWeek: number | null
  weeks: number
  publicHolidays: number
  universityHolidays: number
}

export type YearPlan =
  | {
      status: 'import'
      label: string
      start: string
      year: TrackingYear
      /** The year's numbers worked out by the rules from the saved file's contents. */
      totals: YearTotals
      check: YearCheck
      /** The year so far, for the dry run. */
      today: YearTotals
      report: YearReport
    }
  | {
      status: 'attention'
      label: string
      start: string | null
      problems: string[]
      report?: YearReport
    }

export interface PlanInput {
  study: StudySheet
  timeOff: TimeOffSheet
  /** The weekly `Days` column is read as typed (2025–26) or left to the time-off list (2026–27). */
  typedDays: boolean
  /** Today, for the "so far" figures. */
  today: string
}

const QUARTER = 15

function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

/** The planned days of a week worked out independently of `plannedDays`, for the check. */
function listDays(
  weekStart: string,
  off: ReadonlySet<string>,
  workDays: readonly number[]
): number {
  let n = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i)
    if (workDays.includes(weekdayOf(d)) && !off.has(d)) n++
  }
  return n
}

export function planYear(input: PlanInput): YearPlan {
  const { study, timeOff, typedDays, today } = input
  const problems = [...study.problems, ...timeOff.problems]
  const start = study.start
  if (start === null) {
    problems.push('The Study Hour Tracker has no dated rows.')
    return { status: 'attention', label: '?', start: null, problems }
  }
  const label = yearLabel(start)
  if (problems.length) return { status: 'attention', label, start, problems }

  // ---- what is in the year
  const inside = study.days.filter((d) => inYear(d.date, start))
  const outsideDays = study.days.filter((d) => !inYear(d.date, start))
  const seen = new Set<string>()
  for (const d of inside) {
    if (seen.has(d.date))
      problems.push(`Row ${d.row}: ${d.date} is in the list twice, so its hours are ambiguous.`)
    seen.add(d.date)
  }
  const weekRows = new Map<number, (typeof study.weeks)[number]>()
  for (const w of study.weeks) {
    if (w.number < 1 || w.number > 52)
      problems.push(`Row ${w.row}: week ${w.number} is not 1 to 52.`)
    else if (weekRows.has(w.number)) problems.push(`Row ${w.row}: week ${w.number} appears twice.`)
    else weekRows.set(w.number, w)
  }
  const offRows = timeOff.rows
  for (const r of offRows) {
    if (r.type === null)
      problems.push(`Time off row ${r.row}: "${r.rawType}" is not a type the app knows.`)
    if (
      r.yearLabel !== '' &&
      r.yearLabel.replace('–', '-') !== label.replace('–', '-') &&
      inYear(r.date, start)
    )
      problems.push(`Time off row ${r.row}: year "${r.yearLabel}" but the date is in ${label}.`)
  }
  const outsideTimeOff = offRows.filter((r) => !inYear(r.date, start))
  const inYearOff = offRows.filter((r) => inYear(r.date, start))
  const weekendTimeOff = inYearOff.filter((r) => weekdayOf(r.date) > 5)
  const entries: TimeOffEntry[] = []
  const offSeen = new Set<string>()
  for (const r of inYearOff) {
    if (weekdayOf(r.date) > 5 || r.type === null) continue
    if (offSeen.has(r.date)) problems.push(`Time off row ${r.row}: ${r.date} is listed twice.`)
    offSeen.add(r.date)
    entries.push({ date: r.date, type: r.type as TimeOffType })
  }
  entries.sort((a, b) => a.date.localeCompare(b.date))

  // ---- build the year
  const year: TrackingYear = emptyYear(
    start,
    {
      ...DEFAULT_PLAN,
      allowanceDays:
        timeOff.typed.allowance !== null && Number.isInteger(timeOff.typed.allowance)
          ? timeOff.typed.allowance
          : DEFAULT_PLAN.allowanceDays
    },
    0
  )
  const notQuarter: DayRow[] = []
  let notes = 0
  for (const d of inside) {
    if (d.minutes % QUARTER !== 0 || Math.abs(d.hours * 60 - d.minutes) > 0.01) notQuarter.push(d)
    if (d.minutes > 0 || d.note) {
      year.days[d.date] = {
        ...(d.minutes > 0 ? { minutes: d.minutes } : {}),
        ...(d.note ? { note: d.note } : {})
      }
    }
    if (d.note) notes++
  }
  year.timeOff = entries
  if (typedDays) {
    for (const [number, w] of weekRows)
      if (w.days !== null) year.weekDays[addDays(start, (number - 1) * 7)] = w.days
  }

  // ---- reports that are not failures
  const dayMinutes = new Map(inside.map((d) => [d.date, d.minutes]))
  const weekSums = weeksOf(start).map((w) =>
    sum(Array.from({ length: 7 }, (_, i) => dayMinutes.get(addDays(w.from, i)) ?? 0))
  )
  const dailyTotal = sum(weekSums)
  const weekDifferences: YearReport['weekDifferences'] = []
  for (const [number, w] of weekRows)
    if (w.sheetMinutes !== null && w.sheetMinutes !== weekSums[number - 1])
      weekDifferences.push({
        week: number,
        from: addDays(start, (number - 1) * 7),
        sheet: w.sheetMinutes,
        days: weekSums[number - 1]
      })
  weekDifferences.sort((a, b) => a.week - b.week)
  const off = new Set(entries.map((e) => e.date))
  const typedDaysDiffer: YearReport['typedDaysDiffer'] = []
  if (!typedDays)
    for (const [number, w] of weekRows) {
      const from = addDays(start, (number - 1) * 7)
      const list = listDays(from, off, DEFAULT_PLAN.workDays)
      if (w.days !== null && w.days !== list)
        typedDaysDiffer.push({ week: number, from, typed: w.days, list })
    }
  typedDaysDiffer.sort((a, b) => a.week - b.week)
  const report: YearReport = {
    sheetTotal: {
      sheet: study.typedTotal.minutes,
      days: dailyTotal,
      difference: study.typedTotal.minutes === null ? null : study.typedTotal.minutes - dailyTotal
    },
    weekDifferences,
    missingDates: missingDates(study.days),
    outsideDays,
    outsideTimeOff,
    weekendTimeOff,
    notQuarter,
    typedDaysDiffer,
    scratch: study.scratch,
    unread: study.unread,
    leaveBlocks: timeOff.leaveBlocks,
    timeOffNotes: timeOff.notes,
    notes
  }
  if (problems.length) return { status: 'attention', label, start, problems, report }

  // ---- the safety check: read the year back through the rules and compare with the daily rows
  const saved = parseYear(JSON.parse(JSON.stringify(year)))
  if (!saved) {
    return {
      status: 'attention',
      label,
      start,
      problems: ['The year built from the sheet is refused by the year file reader.'],
      report
    }
  }
  const totals = yearTotals(saved, yearEnd(start))
  const weeks = weeklyMinutes(saved)
  const counts = timeOffCounts(saved, today)
  const perDay = DEFAULT_PLAN.hoursPerWeek / DEFAULT_PLAN.workDays.length
  const expectedDays = sum(
    weeksOf(start).map((w) =>
      typedDays && weekRows.get(w.number)?.days != null
        ? (weekRows.get(w.number)?.days as number)
        : listDays(w.from, off, DEFAULT_PLAN.workDays)
    )
  )
  const expectedBalance = dailyTotal - perDay * expectedDays
  const wrong: string[] = []
  const expect = (what: string, got: unknown, want: unknown): void => {
    if (got !== want)
      wrong.push(`${what}: the saved year gives ${got}, the daily rows give ${want}.`)
  }
  expect('Total minutes', yearMinutes(saved), dailyTotal)
  expect('Total minutes by week', sum(weeks.map((w) => w.minutes)), dailyTotal)
  weeks.forEach((w, i) => expect(`Week ${w.number} minutes`, w.minutes, weekSums[i]))
  expect('Planned days', totals.plannedDays, expectedDays)
  expect(
    'Planned days by week',
    sum(weeksOf(start).map((w) => plannedDays(saved, w.from))),
    expectedDays
  )
  expect('Balance (minutes)', Math.round(totals.balance * 100), Math.round(expectedBalance * 100))
  expect(
    'Average week (minutes)',
    totals.averageWeek === null ? null : Math.round(totals.averageWeek * 100),
    expectedDays === 0 ? null : Math.round((dailyTotal / expectedDays) * 5 * 100)
  )
  expect('Days off listed', counts.taken + counts.booked, entries.length)
  if (typedDays && study.typedTotal.days !== null)
    expect("Planned days against the sheet's own Total row", expectedDays, study.typedTotal.days)
  const typedPublic = timeOff.typed.public
  if (typedPublic !== null)
    expect('Public holidays against the typed count', counts.byType.public, typedPublic)
  const typedUni = timeOff.typed.university
  if (typedUni !== null)
    expect('University holidays against the typed count', counts.byType.university, typedUni)
  if (daysBetween(start, yearEnd(start)) !== 363) wrong.push('The year is not 52 weeks.')
  if (wrong.length) return { status: 'attention', label, start, problems: wrong, report }

  return {
    status: 'import',
    label,
    start,
    year: saved,
    totals,
    check: {
      minutes: totals.minutes,
      plannedDays: totals.plannedDays,
      plan: totals.plan,
      balance: totals.balance,
      averageWeek: totals.averageWeek,
      weeks: weeks.length,
      publicHolidays: counts.byType.public,
      universityHolidays: counts.byType.university
    },
    today: yearTotals(saved, today),
    report
  }
}
