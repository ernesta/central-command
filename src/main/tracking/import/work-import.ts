import { daysBetween, inYear, weeksOf, yearEnd } from '@shared/year'
import { contractWeeks } from '@shared/tracking/workspace-weeks'
import { parseYear } from '@shared/tracking/parse'
import { yearTotals } from '@shared/tracking/plan'
import { minutesByClient, weeklyMinutes, yearMinutes } from '@shared/tracking/totals'
import { emptyYear, WORK_PLAN, type Adjust, type TrackingYear } from '@shared/tracking/types'
import { monthsOf } from '../../../modules/hours/shared/months'
import type { ActivityLog } from './work-logs'
import type { WorkRow, WorkSheet } from './work-sheet'

/**
 * Turning the Work sheet into the user's two contracts, one entry (an adjust with a client) per sheet row, and checking
 * the result against the monthly activity logs. The rules are the user's own (5 Oct 2026): contract dates are fixed,
 * a contract's total must be exactly what its logs state, hours are quarter hours, rows go on the sheet's day except
 * the few the user said belong elsewhere, and both accounted and unaccounted rows are imported.
 */

export interface ContractSpec {
  label: string
  start: string
  end: string
  /** Every row is for this client (the old contract was all Impact), whatever the sheet's Team says. */
  onlyClient?: string
}

export const WORK_CONTRACTS: readonly ContractSpec[] = [
  {
    label: 'Wed 1 Oct 2025 to Tue 31 Mar 2026',
    start: '2025-10-01',
    end: '2026-03-31',
    onlyClient: 'Impact'
  },
  { label: 'Fri 1 May to Thu 29 Oct 2026', start: '2026-05-01', end: '2026-10-29' }
]

/** A sheet row the user said belongs on another day (it was invoiced in another contract's log). */
export interface Move {
  date: string
  activity: string
  minutes: number
  to: string
}

const CODEBOOK = 'Data preparation for analysis (Classroom Observation Data codebook and cleanup)'
/**
 * The user's moved work: 4:00 of classroom observation codebook work done in late March and on 1 April, which the
 * May log invoices (its line is exactly 4.00 h) and the March log does not (its codebook line is the 6.75 h left).
 */
export const WORK_MOVES: readonly Move[] = [
  { date: '2026-03-26', activity: CODEBOOK, minutes: 105, to: '2026-05-01' },
  { date: '2026-03-27', activity: CODEBOOK, minutes: 45, to: '2026-05-01' },
  { date: '2026-04-01', activity: CODEBOOK, minutes: 90, to: '2026-05-01' }
]

/** A typo the user corrected: 2.15 h on 5 Oct 2026 is 2.25 h (hours are quarter hours). */
export interface Correction {
  date: string
  hours: number
  minutes: number
}
export const WORK_CORRECTIONS: readonly Correction[] = [
  { date: '2026-10-05', hours: 2.15, minutes: 135 }
]

/** Time the logs state that the sheet does not hold, once the user has said where it belongs. */
export interface LogAddition {
  date: string
  label: string
  minutes: number
  client: string
}
export const WORK_LOG_ADDITIONS: readonly LogAddition[] = []

export interface Placed {
  row: number
  date: string
  /** Where the sheet has it, when that is not `date`. */
  from?: string
  label: string
  minutes: number
  client: string
  accounted: boolean
  /** The hours the sheet has, when the user's correction changed them. */
  typed?: number
}

export interface Left {
  row: number
  date: string
  label: string
  minutes: number
}

export interface PeriodDifference {
  log: string
  from: string
  to: string
  logMinutes: number
  sheetMinutes: number
  difference: number
  /** Per section of a log that has them (from May 2026): the log's total against the sheet's rows for that client. */
  clients: { client: string; logMinutes: number; sheetMinutes: number; difference: number }[]
}

export interface MonthDifference {
  id: string
  name: string
  from: string
  to: string
  minutes: number
  plan: number
  /** The log of the same month, when there is one. */
  log: string | null
  logMinutes: number | null
  difference: number | null
}

export interface ContractReport {
  /** Every entry, in the order they are written. */
  entries: Placed[]
  /** Rows whose date the importer changed. */
  moved: Placed[]
  corrected: Placed[]
  /** Time added from the logs (the user said where). */
  added: Placed[]
  /** Rows imported with no client choice of the user's (all of them are the sheet's team). */
  rows: number
  accounted: { yes: number; no: number; noMinutes: number }
  periods: PeriodDifference[]
  months: MonthDifference[]
  weeks: { number: number; from: string; to: string; minutes: number; plan: number }[]
  /** Minutes of the logs for this contract, up to the last log's end, against the imported minutes in that time. */
  logTotal: { logs: number; imported: number; through: string | null; after: number }
  clients: { client: string | null; minutes: number }[]
}

export type ContractPlan =
  | {
      status: 'import'
      spec: ContractSpec
      year: TrackingYear
      minutes: number
      report: ContractReport
    }
  | { status: 'attention'; spec: ContractSpec; problems: string[]; report?: ContractReport }

export interface WorkPlan {
  contracts: ContractPlan[]
  /** Rows that fall in no contract and were not moved: left out. */
  outside: Left[]
  /** Problems that are no one contract's (the sheet or a log could not be read). */
  problems: string[]
  sheet: { rows: number; minutes: number }
}

function contractIndex(specs: readonly ContractSpec[], date: string): number {
  return specs.findIndex((s) => date >= s.start && date <= s.end)
}
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0)
const clientOf = (team: WorkRow['team']): string =>
  team === 'Teaching' ? 'Teaching & Learning' : 'Impact'

export function planWorkHours(input: {
  sheet: WorkSheet
  logs: readonly ActivityLog[]
  contracts?: readonly ContractSpec[]
  moves?: readonly Move[]
  corrections?: readonly Correction[]
  additions?: readonly LogAddition[]
}): WorkPlan {
  const specs = input.contracts ?? WORK_CONTRACTS
  const moves = input.moves ?? WORK_MOVES
  const corrections = input.corrections ?? WORK_CORRECTIONS
  const additions = input.additions ?? WORK_LOG_ADDITIONS
  // A log that cannot be read is a problem of its own contract only; a sheet that cannot be read is everyone's.
  const problems = [...input.sheet.problems]
  const logProblems = specs.map((spec) =>
    input.logs.filter((l) => l.from >= spec.start && l.to <= spec.end).flatMap((l) => l.problems)
  )
  problems.push(
    ...input.logs.filter((l) => contractIndex(specs, l.from) < 0).flatMap((l) => l.problems)
  )

  // ---- every row gets its place
  const placed: (Placed & { contract: number })[] = []
  const outside: Left[] = []
  const rowProblems: string[][] = logProblems
  const contractOf = (date: string): number => contractIndex(specs, date)

  // Each agreed move names exactly one sheet row; a sheet that no longer has it means it changed since.
  const moveOf = new Map<number, Move>()
  for (const move of moves) {
    const found = input.sheet.rows.filter(
      (r) =>
        !moveOf.has(r.row) &&
        r.date === move.date &&
        r.minutes === move.minutes &&
        r.activity === move.activity
    )
    if (found.length === 0)
      problems.push(
        `Moved row not found: ${move.date}, ${move.minutes} min, "${move.activity}". The sheet has changed since the move was agreed.`
      )
    else moveOf.set(found[0].row, move)
  }

  for (const r of input.sheet.rows) {
    let minutes = r.minutes
    let typed: number | undefined
    const fix = corrections.find((c) => c.date === r.date && c.hours === r.hours)
    if (fix) {
      typed = r.hours
      minutes = fix.minutes
    }
    const move = moveOf.get(r.row)
    const date = move ? move.to : r.date
    const i = contractOf(date)
    const label = r.activity
    if (i < 0) {
      outside.push({ row: r.row, date, label, minutes })
      continue
    }
    if (minutes % 15 !== 0) {
      rowProblems[i].push(
        `Row ${r.row}: ${r.hours} h on ${r.date} is not a whole number of quarter hours.`
      )
      continue
    }
    const spec = specs[i]
    const client = spec.onlyClient ?? clientOf(r.team)
    if (spec.onlyClient && clientOf(r.team) !== spec.onlyClient)
      rowProblems[i].push(
        `Row ${r.row}: ${r.date} is for ${clientOf(r.team)} but every row of this contract is for ${spec.onlyClient}.`
      )
    placed.push({
      contract: i,
      row: r.row,
      date,
      ...(move ? { from: r.date } : {}),
      label,
      minutes,
      client,
      accounted: r.accounted,
      ...(typed !== undefined ? { typed } : {})
    })
  }
  additions.forEach((a, n) => {
    const i = contractOf(a.date)
    if (i < 0) problems.push(`A time added from the logs (${a.date}) falls in no contract.`)
    else
      placed.push({
        contract: i,
        row: -(n + 1),
        date: a.date,
        label: a.label,
        minutes: a.minutes,
        client: a.client,
        accounted: true
      })
  })

  const contracts = specs.map((spec, i) =>
    planContract(
      spec,
      placed.filter((p) => p.contract === i),
      input.logs,
      rowProblems[i]
    )
  )
  // A contract that cannot be read leaves the whole run honest: say so on every contract.
  if (problems.length > 0)
    contracts.forEach((c, i) => {
      if (c.status === 'import')
        contracts[i] = { status: 'attention', spec: c.spec, problems, report: c.report }
      else c.problems.unshift(...problems)
    })
  return {
    contracts,
    outside,
    problems,
    sheet: { rows: input.sheet.rows.length, minutes: sum(input.sheet.rows.map((r) => r.minutes)) }
  }
}

function planContract(
  spec: ContractSpec,
  rows: readonly Placed[],
  allLogs: readonly ActivityLog[],
  rowProblems: string[]
): ContractPlan {
  const problems = [...rowProblems]
  const weeks = contractWeeks(spec.start, spec.end)
  if (!weeks.ok)
    return {
      status: 'attention',
      spec,
      problems: [...problems, 'The contract dates are not whole weeks.']
    }
  const logs = allLogs
    .filter((l) => l.from >= spec.start && l.to <= spec.end)
    .sort((a, b) => a.from.localeCompare(b.from))

  // The sheet is newest first: within a day the highest row is the oldest entry, so a day is written from the bottom of the sheet upwards.
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date) || b.row - a.row)
  const adjusts: Adjust[] = ordered.map((p, n) => ({
    id: `import-${String(n + 1).padStart(3, '0')}`,
    date: p.date,
    label: p.label,
    minutes: p.minutes,
    client: p.client
  }))
  const clients = [...(WORK_PLAN.clients ?? [])]
  const built: TrackingYear = {
    ...emptyYear(spec.start, WORK_PLAN, 0),
    weeks: weeks.weeks,
    plan: { ...WORK_PLAN, workDays: [...WORK_PLAN.workDays], clients },
    adjusts
  }
  const total = sum(ordered.map((p) => p.minutes))

  // ---- the report (nothing here fails the contract on its own)
  const through = logs.length ? logs[logs.length - 1].to : null
  const inPeriod = (from: string, to: string, client?: string): number =>
    sum(
      ordered
        .filter(
          (p) => p.date >= from && p.date <= to && (client === undefined || p.client === client)
        )
        .map((p) => p.minutes)
    )
  const periods: PeriodDifference[] = logs.map((l) => ({
    log: l.name,
    from: l.from,
    to: l.to,
    logMinutes: l.totals.total,
    sheetMinutes: inPeriod(l.from, l.to),
    difference: inPeriod(l.from, l.to) - l.totals.total,
    clients: (
      [
        ['Impact', l.totals.impact],
        ['Teaching & Learning', l.totals.teaching]
      ] as const
    ).flatMap(([client, logMinutes]) => {
      if (logMinutes === null) return []
      const sheetMinutes = inPeriod(l.from, l.to, client)
      return [{ client, logMinutes, sheetMinutes, difference: sheetMinutes - logMinutes }]
    })
  }))
  const logMinutes = sum(logs.map((l) => l.totals.total))
  const importedThrough = through
    ? sum(ordered.filter((p) => p.date <= through).map((p) => p.minutes))
    : 0

  // ---- the safety check: read the contract back through the app's rules
  const saved = parseYear(JSON.parse(JSON.stringify(built)))
  if (!saved)
    return {
      status: 'attention',
      spec,
      problems: [
        ...problems,
        'The contract built from the sheet is refused by the year file reader.'
      ]
    }
  const wrong: string[] = []
  const expect = (what: string, got: unknown, want: unknown): void => {
    if (got !== want)
      wrong.push(`${what}: the saved contract gives ${got}, the sheet gives ${want}.`)
  }
  const weekRows = weeksOf(spec.start, weeks.weeks).map((w) => ({
    ...w,
    minutes: inPeriod(w.from, w.to)
  }))
  expect('Weeks', saved.weeks, weeks.weeks)
  expect('Last day', yearEnd(saved.start, saved.weeks), spec.end)
  expect('Total minutes', yearMinutes(saved), total)
  expect('Minutes by week', sum(weeklyMinutes(saved).map((w) => w.minutes)), total)
  weeklyMinutes(saved).forEach((w, i) =>
    expect(`Week ${w.number} minutes`, w.minutes, weekRows[i].minutes)
  )
  const months = monthsOf(saved)
  expect('Minutes by month', sum(months.map((m) => m.minutes)), total)
  const byClient = minutesByClient(saved, spec.start, spec.end)
  for (const c of clients)
    expect(
      `${c} minutes`,
      byClient.find((x) => x.client === c)?.minutes ?? 0,
      sum(ordered.filter((p) => p.client === c).map((p) => p.minutes))
    )
  expect('Time with no client', byClient.find((x) => x.client === null)?.minutes ?? 0, 0)
  expect('Entries', saved.adjusts.length, ordered.length)
  const planWhole = yearTotals(saved, spec.end).plan
  expect('Plan (minutes)', planWhole, weeks.weeks * WORK_PLAN.hoursPerWeek)
  for (const a of saved.adjusts)
    if (!inYear(a.date, saved.start, saved.weeks))
      wrong.push(`${a.label} on ${a.date} is outside the contract.`)
  // The user's rule: the contract's total is exactly what its logs state.
  if (logs.length === 0)
    wrong.push('No activity log belongs to this contract, so its total cannot be checked.')
  else if (importedThrough !== logMinutes)
    wrong.push(
      `The contract's hours up to ${through} (${importedThrough} min) are not the activity logs' total (${logMinutes} min): ${importedThrough - logMinutes > 0 ? '+' : ''}${importedThrough - logMinutes} min.`
    )
  const logWeeks = sum(logs.map((l) => Math.round((daysBetween(l.from, l.to) + 1) / 7)))
  if (through && logWeeks !== Math.round((daysBetween(spec.start, through) + 1) / 7))
    wrong.push('The activity logs do not cover the contract without gaps or overlaps.')

  const report: ContractReport = {
    entries: ordered,
    moved: ordered.filter((p) => p.from),
    corrected: ordered.filter((p) => p.typed !== undefined),
    added: ordered.filter((p) => p.row < 0),
    rows: ordered.length,
    accounted: {
      yes: ordered.filter((p) => p.accounted).length,
      no: ordered.filter((p) => !p.accounted).length,
      noMinutes: sum(ordered.filter((p) => !p.accounted).map((p) => p.minutes))
    },
    periods,
    months: months.map((m) => {
      const log = logs.find((l) => l.month === m.id) ?? null
      return {
        id: m.id,
        name: m.name,
        from: m.from,
        to: m.to,
        minutes: m.minutes,
        plan: m.plan,
        log: log?.name ?? null,
        logMinutes: log?.totals.total ?? null,
        difference: log ? m.minutes - log.totals.total : null
      }
    }),
    weeks: weekRows.map((w) => ({ ...w, plan: WORK_PLAN.hoursPerWeek })),
    logTotal: {
      logs: logMinutes,
      imported: importedThrough,
      through,
      after: total - importedThrough
    },
    clients: byClient
  }
  const all = [...problems, ...wrong]
  if (all.length > 0) return { status: 'attention', spec, problems: all, report }
  return { status: 'import', spec, year: saved, minutes: total, report }
}
