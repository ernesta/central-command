/**
 * One-off importer: bring your two Google Sheets (Study Hour Tracker and Time Off Tracker, one workbook per
 * tracking year) into Hours and Time off: one year file per workbook at ~/CentralCommand/time/research/.
 *
 *   npm run import:hours -- --old ~/Downloads/2025-26.xlsx --new ~/Downloads/2026-27.xlsx            # dry run
 *   npm run import:hours -- --old <xlsx> --new <xlsx> --apply                                           # writes files
 *
 * Sources are read only. Each workbook is one year (its start is the Monday of its first dated row). The daily
 * rows are the truth: the sheet's own weekly column is compared with them and any difference is reported, not
 * followed. A year that fails the safety check (read back through the app's rules and compared with the daily
 * rows) is left out as ATTENTION. Never overwrites: a year whose file already holds anything is skipped.
 * Not imported: the scratch area (reported), annual leave typed as blocks (reported; add the dates in the app),
 * rows outside the year (reported).
 */
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { readXlsxSheets } from '../src/modules/training/main/import/xlsx'
import { planYear, type YearPlan } from '../src/main/tracking/import/hours-import'
import { parseStudySheet, parseTimeOffSheet } from '../src/main/tracking/import/hours-sheet'
import { TrackingStore } from '../src/main/tracking/store'
import { formatHours, formatSignedHours } from '../src/shared/tracking/format'
import { formatDate, nowMoment } from '../src/shared/time'
import { normaliseYearStarts, yearEnd } from '../src/shared/year'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const oldArg = arg('old')
const newArg = arg('new')
if (!oldArg || !newArg)
  fail('Usage: npm run import:hours -- --old <2025-26 .xlsx> --new <2026-27 .xlsx> [--apply]')
const apply = process.argv.includes('--apply')
const workspace = 'research'
const today = nowMoment().date
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const root = join(home, 'CentralCommand')
const timeDir = join(root, 'time')

function sheetsOf(path: string): { study: string[][]; off: string[][] } {
  if (!existsSync(path)) return fail(`Workbook not found: ${path}`)
  let sheets
  try {
    sheets = readXlsxSheets(readFileSync(path))
  } catch (error) {
    return fail(`${path} is not a workbook: ${(error as Error).message}`)
  }
  const find = (name: string): string[][] | undefined =>
    sheets.find((s) => s.name.trim().toLowerCase() === name)?.rows
  const study = find('study hour tracker')
  const off = find('time off tracker')
  if (!study || !off)
    return fail(
      `${path} should have the tabs "Study Hour Tracker" and "Time Off Tracker" but has: ${sheets.map((s) => `"${s.name}"`).join(', ')}.`
    )
  return { study, off }
}

const plans: { source: string; plan: YearPlan }[] = [oldArg as string, newArg as string].map(
  (p) => {
    const path = expand(p)
    const { study, off } = sheetsOf(path)
    const parsed = parseStudySheet(study)
    // A year that is over keeps the planned days typed in the sheet; one still running takes them from the list.
    const finished = parsed.start !== null && yearEnd(parsed.start) < today
    return {
      source: path,
      plan: planYear({ study: parsed, timeOff: parseTimeOffSheet(off), typedDays: finished, today })
    }
  }
)

console.log(`Workbooks : ${plans.map((p) => p.source).join('\n            ')}`)
console.log(`Writes to : ${join(timeDir, workspace)}`)
console.log(
  apply ? 'Mode      : APPLY (writing files)\n' : 'Mode      : dry run (nothing will be written)\n'
)

const d = (date: string): string => formatDate(date)
const list = (title: string, lines: string[]): void => {
  if (lines.length === 0) return
  console.log(`  ${title}`)
  for (const line of lines) console.log(`    ${line}`)
}

for (const { plan } of plans) {
  console.log(`=== ${plan.label}${plan.start ? ` (from ${d(plan.start)})` : ''}`)
  if (plan.status === 'attention') {
    console.log('ATTENTION: left out.')
    for (const p of plan.problems) console.log(`    ${p}`)
  } else {
    const c = plan.check
    const r = plan.report
    console.log(
      `import: ${d(plan.start)} to ${d(yearEnd(plan.start))}, ${Object.keys(plan.year.days).length} days with hours or a note, ${plan.year.timeOff.length} days off, ${Object.keys(plan.year.weekDays).length} typed weeks`
    )
    const finished = yearEnd(plan.start) < today
    const holidays = `${c.publicHolidays} public and ${c.universityHolidays} university holidays`
    if (finished) {
      console.log(
        `  Checked against the daily rows: ${formatHours(c.minutes)} worked, ${c.plannedDays} planned days, plan ${formatHours(c.plan)}, balance ${formatSignedHours(c.balance)}, average week ${c.averageWeek === null ? '-' : formatHours(c.averageWeek)}, ${holidays}.`
      )
    } else {
      const t = plan.today
      console.log(
        `  Checked against the daily rows: ${formatHours(c.minutes)} worked, ${c.plannedDays} planned days in the whole year, ${holidays}.`
      )
      console.log(
        `  Today (${d(today)}): ${formatHours(t.minutes)} against a plan of ${formatHours(t.plan)} so far over ${t.plannedDays} planned days, balance ${formatSignedHours(t.balance)}.`
      )
    }
    if (r.sheetTotal.sheet !== null)
      console.log(
        `  The sheet's own weekly total says ${formatHours(r.sheetTotal.sheet)}; the daily rows give ${formatHours(r.sheetTotal.days)} (${formatSignedHours(r.sheetTotal.difference ?? 0)}). The app uses the daily rows.`
      )
    list(
      "Weeks where the sheet's weekly column disagrees with its daily rows (reported, not a failure):",
      r.weekDifferences.map(
        (w) =>
          `Week ${w.week} (${d(w.from)}): sheet ${formatHours(w.sheet)}, daily rows ${formatHours(w.days)} (${formatSignedHours(w.sheet - w.days)})`
      )
    )
    list('Dates with no row (counted as no time):', r.missingDates.map(d))
    list('Rows outside the year (left out):', [
      ...r.outsideDays.map((x) => `hours row ${x.row}: ${d(x.date)}, ${formatHours(x.minutes)}`),
      ...r.outsideTimeOff.map((x) => `time off row ${x.row}: ${d(x.date)} (${x.rawType})`)
    ])
    list(
      'Time off on a weekend (left out):',
      r.weekendTimeOff.map((x) => `row ${x.row}: ${d(x.date)} (${x.rawType})`)
    )
    list(
      'Hours that are not a whole number of quarter hours (imported as typed):',
      r.notQuarter.map((x) => `row ${x.row}: ${d(x.date)}, ${x.hours} h`)
    )
    list(
      'Weeks where the typed planned days differ from the time-off list (the list is used):',
      r.typedDaysDiffer.map(
        (w) => `Week ${w.week} (${d(w.from)}): typed ${w.typed}, the list gives ${w.list}`
      )
    )
    list('Scratch area, not imported (say which day each belongs to):', r.scratch)
    list('Other cells nothing reads:', r.unread)
    list(
      'Annual leave typed as blocks, not imported (add the exact dates in Time off):',
      r.leaveBlocks.map((b) => `${b.days} days from ${d(b.from)}`)
    )
    list('Other text in the time-off summary:', r.timeOffNotes)
    console.log(`  ${r.notes} day note${r.notes === 1 ? '' : 's'} imported.`)
  }
  console.log('')
}

const good = plans.flatMap(({ plan }) => (plan.status === 'import' ? [plan] : []))
const bad = plans.length - good.length
console.log(`${good.length} year${good.length === 1 ? '' : 's'} to import, ${bad} need attention.`)

if (apply) {
  let settingsStarts: unknown = []
  try {
    settingsStarts =
      (JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')) as { yearStarts?: unknown })
        .yearStarts ?? []
  } catch {
    // no settings yet: the years' own starts are enough
  }
  const starts = normaliseYearStarts([
    ...(Array.isArray(settingsStarts) ? settingsStarts : []),
    ...good.map((p) => p.start)
  ])
  const store = new TrackingStore(timeDir, { starts: () => starts, now: () => nowMoment() })
  for (const p of good) {
    const result = store.importYear(workspace, p.year)
    console.log(
      result.ok
        ? `Wrote ${p.label}.`
        : `Skipped ${p.label}: ${result.reason === 'not-empty' ? 'its file already holds data, nothing was changed' : result.reason}.`
    )
  }
  console.log('\nOpen the app (or restart it) and the years will appear.')
} else {
  console.log('\nDry run only. Re-run with --apply to write these files.')
}
process.exit(bad > 0 && apply ? 1 : 0)
