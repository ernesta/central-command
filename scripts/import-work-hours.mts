/**
 * One-off importer: bring your Google Sheet "Time Tracking" (Work) into Hours as two contracts, one entry per sheet row
 * with its client, and check each contract against your monthly activity logs.
 *
 *   npm run import:work-hours -- --sheet <xlsx> --logs <folder of Activity Log .docx files>            # dry run
 *   npm run import:work-hours -- --sheet <xlsx> --logs <folder> --apply                                  # writes files
 *   npm run import:work-hours -- --sheet <xlsx> --logs <folder> --detail 2026-05                         # one log's lines and rows
 *
 * Sources are read only (the logs are read with macOS's textutil). The contracts are fixed (Wed 1 Oct 2025 to Tue 31 Mar
 * 2026, and Fri 1 May to Thu 29 Oct 2026, 8:00 a week). A contract that fails the safety check (read back through the
 * app's rules, and its hours compared with its logs' totals) is left out as ATTENTION. Never overwrites: a contract whose
 * file already holds anything is skipped. Apply only with the app closed.
 */
import { execFileSync } from 'child_process'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { basename, join, resolve } from 'path'
import { assertAbsoluteHome } from '../src/main/home-dir'
import { readXlsxSheets } from '../src/modules/training/main/import/xlsx'
import { parseWorkSheet } from '../src/main/tracking/import/work-sheet'
import { parseActivityLog, type ActivityLog } from '../src/main/tracking/import/work-logs'
import { planWorkHours, type Placed } from '../src/main/tracking/import/work-import'
import { TrackingStore } from '../src/main/tracking/store'
import { formatHours, formatSignedHours } from '../src/shared/tracking/format'
import { formatDate, nowMoment } from '../src/shared/time'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const expand = (p: string): string => resolve(p.replace(/^~(?=$|\/)/, homedir()))
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const sheetArg = arg('sheet')
const logsArg = arg('logs')
if (!sheetArg || !logsArg)
  fail(
    'Usage: npm run import:work-hours -- --sheet <Time Tracking .xlsx> --logs <Activity Logs folder> [--apply] [--detail YYYY-MM]'
  )
const apply = process.argv.includes('--apply')
const detail = arg('detail')
const workspace = 'work'
const home = assertAbsoluteHome(process.env.CENTRAL_COMMAND_HOME || homedir())
const root = join(home, 'CentralCommand')
const timeDir = join(root, 'time')

const sheetPath = expand(sheetArg as string)
if (!existsSync(sheetPath)) fail(`Workbook not found: ${sheetPath}`)
const sheets = readXlsxSheets(readFileSync(sheetPath))
const tab = sheets.find((s) => s.name.trim().toLowerCase() === 'time tracking')
if (!tab)
  fail(
    `${sheetPath} should have the tab "Time Tracking" but has: ${sheets.map((s) => `"${s.name}"`).join(', ')}.`
  )
const sheet = parseWorkSheet((tab as { rows: string[][] }).rows)

const logsDir = expand(logsArg as string)
if (!existsSync(logsDir)) fail(`Folder not found: ${logsDir}`)
if (process.platform !== 'darwin') fail('Reading the Word logs needs macOS (textutil).')
const logs: ActivityLog[] = readdirSync(logsDir)
  .filter((f) => f.endsWith('.docx') && !f.startsWith('~$'))
  .sort()
  .map((f) =>
    parseActivityLog(
      basename(f, '.docx'),
      execFileSync('textutil', ['-convert', 'txt', '-stdout', join(logsDir, f)], {
        encoding: 'utf8'
      })
    )
  )

const plan = planWorkHours({ sheet, logs })

const d = (date: string): string => formatDate(date)
const h = formatHours
const sign = (m: number): string =>
  `${formatSignedHours(m)}, ${m > 0 ? '+' : m < 0 ? '−' : ''}${Math.abs(m / 60).toFixed(2)} h`
const list = (title: string, lines: string[]): void => {
  if (lines.length === 0) return
  console.log(`  ${title}`)
  for (const line of lines) console.log(`    ${line}`)
}
const rowLine = (p: Placed): string =>
  `row ${p.row}: ${d(p.date)}${p.from ? ` (sheet: ${d(p.from)})` : ''}, ${h(p.minutes)}, ${p.client}, ${p.accounted ? 'accounted' : 'not accounted'}, ${p.label}`

console.log(
  `Sheet     : ${sheetPath} (${sheet.rows.length} rows, ${h(plan.sheet.minutes)} as typed)`
)
console.log(`Logs      : ${logsDir} (${logs.length} files)`)
console.log(`Writes to : ${join(timeDir, workspace)}`)
console.log(
  apply ? 'Mode      : APPLY (writing files)\n' : 'Mode      : dry run (nothing will be written)\n'
)

list('Problems reading the sheet or the logs:', plan.problems)
list(
  'Text beside rows in columns G onwards (scratch, not read):',
  sheet.scratch.map((s) => `row ${s.row}: ${s.text}`)
)

for (const c of plan.contracts) {
  console.log(`=== Contract ${c.spec.label}`)
  const r = c.report
  if (c.status === 'attention') {
    console.log('ATTENTION: left out.')
    for (const p of c.problems) console.log(`    ${p}`)
  } else {
    console.log(
      `import: ${d(c.spec.start)} to ${d(c.spec.end)}, ${c.year.weeks} weeks, ${c.report.entries.length} entries, ${h(c.minutes)} worked, plan ${h((c.year.weeks ?? 0) * c.year.plan.hoursPerWeek)}`
    )
  }
  if (r) {
    console.log(
      `  ${r.accounted.yes} accounted and ${r.accounted.no} not accounted entries (${h(r.accounted.noMinutes)} not accounted), all imported.`
    )
    list(
      'Clients:',
      r.clients.map((x) => `${x.client ?? 'No client'}: ${h(x.minutes)}`)
    )
    console.log(
      `  Against the logs: the logs state ${h(r.logTotal.logs)} up to ${r.logTotal.through ? d(r.logTotal.through) : '-'}; the contract has ${h(r.logTotal.imported)} up to then (${sign(r.logTotal.imported - r.logTotal.logs)}); ${h(r.logTotal.after)} comes after the last log.`
    )
    list("Rows moved to another day (the user's rule):", r.moved.map(rowLine))
    list(
      'Hours corrected:',
      r.corrected.map((p) => `${rowLine(p)} (the sheet says ${p.typed} h)`)
    )
    list('Time added from the logs:', r.added.map(rowLine))
    list(
      "Per log period (the sheet's rows on those days, after the moves, against the log):",
      r.periods.flatMap((p) => [
        `${p.log}: ${d(p.from)} to ${d(p.to)}, log ${h(p.logMinutes)}, sheet ${h(p.sheetMinutes)} (${sign(p.difference)})`,
        ...p.clients.map(
          (c) =>
            `    ${c.client}: log ${h(c.logMinutes)}, sheet ${h(c.sheetMinutes)} (${sign(c.difference)})`
        )
      ])
    )
    list(
      'Per month of the contract (whole weeks, a week belongs to the month its first day is in), against the log of that month:',
      r.months.map(
        (m) =>
          `${m.name} ${d(m.from)} to ${d(m.to)}: ${h(m.minutes)} of ${h(m.plan)}` +
          (m.log === null
            ? ', no log'
            : `, log ${h(m.logMinutes as number)} (${sign(m.difference as number)})`)
      )
    )
    list(
      'Per week, against the 8:00 plan:',
      r.weeks.map(
        (w) =>
          `Week ${String(w.number).padStart(2)} ${d(w.from)}: ${h(w.minutes)} (${sign(w.minutes - w.plan)})`
      )
    )
  }
  console.log('')
}

list(
  'Rows in no contract and not moved (left out):',
  plan.outside.map((o) => `row ${o.row}: ${d(o.date)}, ${h(o.minutes)}, ${o.label}`)
)

if (detail) {
  const log = logs.find((l) => l.month === detail)
  if (!log) fail(`No log for ${detail}.`)
  else {
    const c = plan.contracts.find((x) => x.report?.periods.some((p) => p.log === log.name))
    console.log(`=== Detail: ${log.name} (${d(log.from)} to ${d(log.to)}, ${h(log.totals.total)})`)
    for (const e of log.entries)
      console.log(`  log: ${h(e.minutes)}  ${e.client ?? ''}  ${e.label}`)
    for (const p of c?.report?.entries.filter((x) => x.date >= log.from && x.date <= log.to) ?? [])
      console.log(
        `  sheet: ${d(p.date)}  ${h(p.minutes)}  ${p.client}  ${p.label}${p.from ? ` (moved from ${d(p.from)})` : ''}`
      )
  }
}

const good = plan.contracts.flatMap((c) => (c.status === 'import' ? [c] : []))
const bad = plan.contracts.length - good.length
console.log(
  `${good.length} contract${good.length === 1 ? '' : 's'} to import, ${bad} need attention.`
)

if (apply) {
  const now = nowMoment()
  const store = new TrackingStore(timeDir, { starts: () => [], now: () => now })
  for (const c of good) {
    const made = store.createContract(workspace, c.spec.start, c.spec.end)
    if (!made.ok && made.reason !== 'overlap' && made.reason !== 'changed-on-disk') {
      console.log(`Skipped ${c.spec.label}: ${made.reason}.`)
      continue
    }
    const result = store.importYear(workspace, c.year)
    console.log(
      result.ok
        ? `Wrote ${c.spec.label}.`
        : `Skipped ${c.spec.label}: ${result.reason === 'not-empty' ? 'its file already holds data, nothing was changed' : result.reason}.`
    )
  }
  console.log('\nOpen the app (or restart it) and the contracts will appear.')
} else {
  console.log('\nDry run only. Re-run with --apply to write these files.')
}
process.exit(bad > 0 && apply ? 1 : 0)
