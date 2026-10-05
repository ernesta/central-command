import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { contractWeeks } from '@shared/tracking/workspace-weeks'
import { weekdayOf } from '@shared/year'
import { TrackingStore } from '../store'
import type { ActivityLog } from './work-logs'
import type { WorkRow, WorkSheet } from './work-sheet'
import {
  planWorkHours,
  WORK_CONTRACTS,
  WORK_CORRECTIONS,
  WORK_MOVES,
  type ContractSpec,
  type WorkPlan,
  type Move
} from './work-import'

const SPECS: ContractSpec[] = [
  { label: 'A', start: '2026-03-04', end: '2026-03-31', onlyClient: 'Impact' },
  { label: 'B', start: '2026-05-01', end: '2026-05-28' }
]
const CODEBOOK = 'Codebook'
const MOVES: Move[] = [
  { date: '2026-03-26', activity: CODEBOOK, minutes: 105, to: '2026-05-01' },
  { date: '2026-04-01', activity: CODEBOOK, minutes: 30, to: '2026-05-01' }
]

function row(
  n: number,
  date: string,
  minutes: number,
  team: WorkRow['team'] = 'Impact',
  activity = 'Audit',
  accounted = true
): WorkRow {
  return { row: n, date, hours: minutes / 60, minutes, accounted, team, activity }
}

function sheetOf(rows: WorkRow[]): WorkSheet {
  return { rows, scratch: [], problems: [] }
}

function log(
  month: string,
  from: string,
  to: string,
  impact: number,
  teaching: number | null = null
): ActivityLog {
  return {
    month,
    name: `${month} Activity Log`,
    from,
    to,
    entries: [],
    totals: {
      impact: teaching === null ? null : impact,
      teaching,
      total: impact + (teaching ?? 0)
    },
    problems: []
  }
}

/** A sheet that agrees with its logs once the two codebook rows have moved to 1 May. */
function good(): { sheet: WorkSheet; logs: ActivityLog[] } {
  return {
    sheet: sheetOf([
      row(10, '2026-05-08', 60), // Impact
      row(9, '2026-05-07', 60, 'Teaching', 'Review', false),
      row(7, '2026-04-01', 30, 'Impact', CODEBOOK),
      row(8, '2026-03-26', 105, 'Impact', CODEBOOK),
      row(6, '2026-03-05', 120),
      row(5, '2026-03-05', 15, 'Impact', 'Monthly Activity Log: March')
    ]),
    logs: [
      log('2026-03', '2026-03-04', '2026-03-31', 135),
      log('2026-05', '2026-05-01', '2026-05-28', 195, 60)
    ]
  }
}

const plan = (input: { sheet: WorkSheet; logs: ActivityLog[] }, extra = {}): WorkPlan =>
  planWorkHours({
    ...input,
    contracts: SPECS,
    moves: MOVES,
    corrections: [],
    additions: [],
    ...extra
  })

describe("the user's contracts", () => {
  it('are 26 whole weeks each, Wednesday to Tuesday and Friday to Thursday', () => {
    for (const c of WORK_CONTRACTS)
      expect(contractWeeks(c.start, c.end)).toEqual({ ok: true, weeks: 26 })
    expect(weekdayOf(WORK_CONTRACTS[0].start)).toBe(3)
    expect(weekdayOf(WORK_CONTRACTS[1].start)).toBe(5)
    expect(WORK_CONTRACTS[0].onlyClient).toBe('Impact')
    expect(WORK_CONTRACTS[1].onlyClient).toBeUndefined()
  })

  it('move exactly the three codebook rows the May log invoices, 4:00 in all', () => {
    expect(WORK_MOVES.map((m) => m.minutes)).toEqual([105, 45, 90])
    expect(WORK_MOVES.reduce((a, m) => a + m.minutes, 0)).toBe(240)
    expect(WORK_MOVES.every((m) => m.to === '2026-05-01')).toBe(true)
    expect(WORK_CORRECTIONS).toEqual([{ date: '2026-10-05', hours: 2.15, minutes: 135 }])
  })
})

describe('planWorkHours', () => {
  it('imports one entry per sheet row, accounted or not, with the right client', () => {
    const p = plan(good())
    const [a, b] = p.contracts
    if (a.status !== 'import' || b.status !== 'import') throw new Error(JSON.stringify([a, b]))
    expect(p.outside).toEqual([])
    expect(a.year.adjusts.map((x) => [x.date, x.minutes, x.client])).toEqual([
      ['2026-03-05', 120, 'Impact'], // the sheet is newest first, so the higher row is the older entry
      ['2026-03-05', 15, 'Impact']
    ])
    expect(b.year.adjusts.map((x) => [x.date, x.minutes, x.client, x.label])).toEqual([
      ['2026-05-01', 105, 'Impact', CODEBOOK],
      ['2026-05-01', 30, 'Impact', CODEBOOK],
      ['2026-05-07', 60, 'Teaching & Learning', 'Review'],
      ['2026-05-08', 60, 'Impact', 'Audit']
    ])
    expect(b.report.accounted).toEqual({ yes: 3, no: 1, noMinutes: 60 })
    expect(b.year.weeks).toBe(4)
    expect(b.year.plan.clients).toEqual(['Impact', 'Teaching & Learning'])
    expect(b.year.plan.hoursPerWeek).toBe(480)
    expect(b.minutes).toBe(255)
  })

  it("moves the user's rows to the day they belong to and reports them", () => {
    const [a, b] = plan(good()).contracts
    expect(b.report?.moved.map((m) => [m.from, m.date, m.minutes])).toEqual([
      ['2026-03-26', '2026-05-01', 105],
      ['2026-04-01', '2026-05-01', 30]
    ])
    expect(a.report?.moved).toEqual([])
  })

  it('checks each contract against its logs, in total, per log period and per client', () => {
    const [, b] = plan(good()).contracts
    expect(b.report?.logTotal).toEqual({
      logs: 255,
      imported: 255,
      through: '2026-05-28',
      after: 0
    })
    expect(b.report?.periods[0].difference).toBe(0)
    expect(b.report?.periods[0].clients).toEqual([
      { client: 'Impact', logMinutes: 195, sheetMinutes: 195, difference: 0 },
      { client: 'Teaching & Learning', logMinutes: 60, sheetMinutes: 60, difference: 0 }
    ])
  })

  it("leaves out a contract whose hours are not its logs' total, and still reports", () => {
    const input = good()
    input.logs[1] = log('2026-05', '2026-05-01', '2026-05-28', 195, 75) // the log has 15 min more
    const [a, b] = plan(input).contracts
    expect(a.status).toBe('import')
    expect(b.status).toBe('attention')
    expect(b.status === 'attention' && b.problems.join()).toMatch(/-15 min/)
    expect(b.report?.periods[0].clients[1].difference).toBe(-15)
  })

  it('counts time after the last log separately (it has no log yet)', () => {
    const input = good()
    input.sheet.rows.unshift(row(11, '2026-05-28', 15, 'Impact', 'later'))
    input.logs[1] = log('2026-05', '2026-05-01', '2026-05-27', 195, 60)
    const [, b] = plan(input).contracts
    expect(b.status).toBe('import')
    expect(b.report?.logTotal).toMatchObject({ through: '2026-05-27', after: 15 })
  })

  it('lists a row in no contract and not moved, and leaves it out', () => {
    const input = good()
    input.sheet.rows.push(row(12, '2026-04-15', 30, 'Impact', 'Loose'))
    const p = plan(input)
    expect(p.outside).toEqual([{ row: 12, date: '2026-04-15', label: 'Loose', minutes: 30 }])
    expect(p.contracts.every((c) => c.status === 'import')).toBe(true)
    expect(p.sheet).toEqual({ rows: 7, minutes: 60 + 60 + 30 + 105 + 120 + 15 + 30 })
  })

  it('reads a typo as the quarter hour the user meant and says so', () => {
    const input = good()
    input.sheet.rows[0] = { ...row(10, '2026-05-08', 129), hours: 2.15 }
    input.logs[1] = log('2026-05', '2026-05-01', '2026-05-28', 270, 60) // 2:15 instead of 1:00 on 8 May
    const b = plan(input, { corrections: [{ date: '2026-05-08', hours: 2.15, minutes: 135 }] })
      .contracts[1]
    expect(b.status).toBe('import')
    expect(b.report?.corrected.map((c) => [c.minutes, c.typed])).toEqual([[135, 2.15]])
    // without the correction the row is refused, not rounded
    expect(plan(input).contracts[1].status).toBe('attention')
  })

  it('refuses a row that is not a whole number of quarter hours', () => {
    const input = good()
    input.sheet.rows[0] = row(10, '2026-05-08', 65)
    const b = plan(input).contracts[1]
    expect(b.status).toBe('attention')
    expect(b.status === 'attention' && b.problems.join()).toMatch(/Row 10.*quarter/)
  })

  it('refuses a Teaching row in the all-Impact contract', () => {
    const input = good()
    input.sheet.rows[5] = row(5, '2026-03-05', 15, 'Teaching')
    const a = plan(input).contracts[0]
    expect(a.status).toBe('attention')
    expect(a.status === 'attention' && a.problems.join()).toMatch(
      /for Teaching & Learning but every row/
    )
  })

  it('says when an agreed move finds no row, and leaves every contract out', () => {
    const input = good()
    input.sheet.rows = input.sheet.rows.filter((r) => r.row !== 8)
    const p = plan(input)
    expect(p.problems.join()).toMatch(/Moved row not found: 2026-03-26/)
    expect(p.contracts.map((c) => c.status)).toEqual(['attention', 'attention'])
  })

  it("does not blame a contract for the other one's unreadable log", () => {
    const input = good()
    input.logs[1] = { ...input.logs[1], problems: ['2026 05: the lines do not add up'] }
    const [a, b] = plan(input).contracts
    expect(a.status).toBe('import')
    expect(b.status).toBe('attention')
  })

  it('adds time the logs state when the user has said where it belongs', () => {
    const input = good()
    input.logs[1] = log('2026-05', '2026-05-01', '2026-05-28', 195, 75)
    const p = plan(input, {
      additions: [
        {
          date: '2026-05-20',
          label: 'Background review',
          minutes: 15,
          client: 'Teaching & Learning'
        }
      ]
    })
    expect(p.contracts[1].status).toBe('import')
    expect(p.contracts[1].report?.added).toHaveLength(1)
  })

  it('reports each month of the contract against the log of that month', () => {
    const [, b] = plan(good()).contracts
    expect(b.report?.months.map((m) => [m.id, m.minutes, m.logMinutes, m.difference])).toEqual([
      ['2026-05', 255, 255, 0]
    ])
    expect(b.report?.weeks.map((w) => w.minutes)).toEqual([195, 60, 0, 0])
  })

  it('fails a contract with no log at all', () => {
    const input = good()
    input.logs = [input.logs[0]]
    const b = plan(input).contracts[1]
    expect(b.status).toBe('attention')
    expect(b.status === 'attention' && b.problems.join()).toMatch(/No activity log/)
  })
})

describe('writing a planned contract', () => {
  it('creates the contract file and never overwrites one that holds data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cc-work-import-'))
    try {
      const store = new TrackingStore(dir, {
        starts: () => [],
        now: () => ({ date: '2026-05-10', time: '10:00:00' })
      })
      const b = plan(good()).contracts[1]
      if (b.status !== 'import') throw new Error('not importable')
      expect(store.createContract('work', b.spec.start, b.spec.end).ok).toBe(true)
      expect(store.importYear('work', b.year).ok).toBe(true)
      const read = store.get('work', b.spec.start)
      expect(read?.adjusts).toHaveLength(4)
      expect(read?.adjusts[0].client).toBe('Impact')
      const again = store.importYear('work', b.year)
      expect(again).toEqual({ ok: false, reason: 'not-empty' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
