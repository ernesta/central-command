import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { formatHours } from '@shared/tracking/format'
import { addDays } from '@shared/year'
import { TrackingStore } from '../store'
import { planYear, type YearPlan } from './hours-import'
import { parseStudySheet, parseTimeOffSheet, sheetDate } from './hours-sheet'
import { serial, studyRows, timeOffRows } from './hours-test-utils'

const OLD_START = '2025-09-22'
const NEW_START = '2026-09-21'
const TODAY = '2026-10-01'

/**
 * A stand-in for the 2025–26 sheet with the same facts as the real one (made up: the real hours are the user's
 * data and are not committed): 361 daily rows (27 and 28 Sep and 26 Oct 2025 have none) adding up to 1,523:30,
 * 220 planned days typed by week, and a weekly column that counts week 5 twice over for 4 h (1,527:30 in all).
 */
function oldYearRows(): { study: string[][]; off: string[][]; minutes: Map<string, number> } {
  const missing = new Set(['2025-09-27', '2025-09-28', '2025-10-26'])
  const minutes = new Map<string, number>()
  for (let i = 0; i < 364; i++) {
    const d = addDays(OLD_START, i)
    if (!missing.has(d)) minutes.set(d, ((i * 37) % 25) * 15)
  }
  const target = 1523.5 * 60
  let diff = target - [...minutes.values()].reduce((a, b) => a + b, 0)
  const dates = [...minutes.keys()]
  for (let k = 0; diff > 0; k++, diff -= 15)
    minutes.set(dates[k % dates.length], (minutes.get(dates[k % dates.length]) as number) + 15)
  expect(diff).toBe(0)
  const weekDays = new Map<number, number>()
  for (let w = 1; w <= 52; w++) weekDays.set(w, w >= 9 && w <= 16 ? 0 : 5)
  const weekSum = (w: number): number => {
    let s = 0
    for (let i = 0; i < 7; i++) s += minutes.get(addDays(OLD_START, (w - 1) * 7 + i)) ?? 0
    return s
  }
  const study = studyRows({
    start: OLD_START,
    days: minutes,
    weekDays,
    weekHours: new Map([[5, weekSum(5) + 240]]),
    total: { minutes: 1527.5 * 60, days: 220 }
  })
  const off = timeOffRows({
    year: '2025-26',
    typed: { public: 8, university: 7, allowance: 40, used: 39 },
    rows: [
      ...[
        '2025-12-24',
        '2025-12-25',
        '2026-01-01',
        '2026-04-03',
        '2026-04-06',
        '2026-05-04',
        '2026-05-25',
        '2026-08-31'
      ].map((date) => ({ date, type: 'Public Holiday' })),
      ...[
        '2025-12-26',
        '2025-12-29',
        '2025-12-30',
        '2025-12-31',
        '2026-01-02',
        '2026-04-07',
        '2026-04-08'
      ].map((date) => ({ date, type: 'University Holiday' }))
    ],
    extra: [
      [4, 5, serial('2026-04-01')],
      [4, 6, '9'],
      [5, 5, serial('2026-05-01')],
      [5, 6, '2'],
      [9, 5, 'Remainder added to hour tracker (Sep 20, 2026)']
    ]
  })
  return { study, off, minutes }
}

function planOld(
  tweak: (rows: { study: string[][]; off: string[][] }) => void = () => undefined
): YearPlan {
  const rows = oldYearRows()
  tweak(rows)
  return planYear({
    study: parseStudySheet(rows.study),
    timeOff: parseTimeOffSheet(rows.off),
    typedDays: true,
    today: TODAY
  })
}

function must(plan: YearPlan): Extract<YearPlan, { status: 'import' }> {
  if (plan.status !== 'import') throw new Error(`Not imported: ${plan.problems.join(' | ')}`)
  return plan
}

describe('reading the sheets', () => {
  it('reads dates stored as serials or as ISO text, and nothing else', () => {
    expect(sheetDate('45922')).toBe('2025-09-22')
    expect(sheetDate('46285.0')).toBe('2026-09-20')
    expect(sheetDate('2026-09-20')).toBe('2026-09-20')
    expect(sheetDate('Week 1')).toBeNull()
    expect(sheetDate('')).toBeNull()
  })

  it('finds the year start as the Monday of the first dated row, and week numbers despite typos', () => {
    const sheet = parseStudySheet(
      studyRows({
        start: NEW_START,
        days: new Map([['2026-09-23', 450]]),
        extra: [[3, 3, 'Weel 11']]
      })
    )
    expect(sheet.start).toBe(NEW_START)
    expect(sheet.weeks.find((w) => w.number === 11)).toBeDefined()
  })

  it('takes a note beside a dated row as the day note and a row with times as scratch', () => {
    const sheet = parseStudySheet(
      studyRows({
        start: NEW_START,
        days: new Map([
          ['2026-09-22', 450],
          ['2026-09-23', 0]
        ]),
        extra: [
          [3, 12, 'look at inkpath'],
          [4, 9, '1030'],
          [4, 10, '1215'],
          [4, 11, '1.75'],
          [4, 12, 'Prepare a presentation'],
          [5, 12, 'a loose line, no date row'],
          [6, 13, 'stray']
        ]
      })
    )
    expect(sheet.days.find((d) => d.date === '2026-09-23')?.note).toBe('look at inkpath')
    expect(sheet.scratch).toEqual([
      'row 4: start 10:30, end 12:15, duration 1.75, Prepare a presentation',
      'row 5: a loose line, no date row'
    ])
    expect(sheet.unread).toEqual(['N6: stray'])
  })

  it('refuses a workbook that is not the Study Hour Tracker, and one that is not the Time Off Tracker', () => {
    const other = [['Date', 'Hours', 'Accounted', 'Client']]
    expect(parseStudySheet(other).problems[0]).toContain('D1')
    expect(parseTimeOffSheet(other).problems[0]).toContain('Time Off Tracker')
  })
})

describe('2025–26: the known facts', () => {
  it('gives the daily rows’ totals: 1,523:30 over 220 planned days, balance −126:30, average week 34:38', () => {
    const plan = must(planOld())
    expect(formatHours(plan.check.minutes)).toBe('1,523:30')
    expect(plan.check.plannedDays).toBe(220)
    // The sheet's −126:30, plus the 25 allowance days not listed as dates (15 holidays are), 7:30 each.
    expect(formatHours(plan.check.balance)).toBe('61:00')
    expect(formatHours(plan.check.averageWeek as number)).toBe('34:38')
    expect(plan.check.weeks).toBe(52)
    expect(plan.check.publicHolidays).toBe(8)
    expect(plan.check.universityHolidays).toBe(7)
  })

  it('reports the 4 h overlap in the weekly column as a note, not a failure', () => {
    const { report } = must(planOld())
    expect(formatHours(report.sheetTotal.sheet as number)).toBe('1,527:30')
    expect(report.sheetTotal.difference).toBe(240)
    expect(report.weekDifferences).toEqual([
      { week: 5, from: '2025-10-20', sheet: expect.any(Number), days: expect.any(Number) }
    ])
    expect(report.weekDifferences[0].sheet - report.weekDifferences[0].days).toBe(240)
  })

  it('reports the three dates with no row, counting them as no time', () => {
    expect(must(planOld()).report.missingDates).toEqual(['2025-09-27', '2025-09-28', '2025-10-26'])
  })

  it('imports the typed weekly days, and does not import annual leave (the blocks are reported)', () => {
    const plan = must(planOld())
    expect(plan.year.weekDays['2025-10-20']).toBe(5)
    expect(Object.keys(plan.year.weekDays)).toHaveLength(52)
    expect(plan.year.timeOff.some((t) => t.type === 'leave')).toBe(false)
    expect(plan.year.timeOff).toHaveLength(15)
    expect(plan.report.leaveBlocks).toEqual([
      { from: '2026-04-01', days: 9 },
      { from: '2026-05-01', days: 2 }
    ])
    expect(plan.report.timeOffNotes).toEqual(['F9: Remainder added to hour tracker (Sep 20, 2026)'])
  })

  it('reads back through the store as the same year', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cc-hours-import-'))
    try {
      const store = new TrackingStore(dir, {
        starts: () => [OLD_START, NEW_START],
        now: () => ({ date: TODAY, time: '09:00:00' })
      })
      const plan = must(planOld())
      expect(store.importYear('research', plan.year).ok).toBe(true)
      expect(store.get('research', OLD_START)).toEqual(plan.year)
      expect(store.importYear('research', plan.year)).toEqual({ ok: false, reason: 'not-empty' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('2026–27', () => {
  function planNew(): YearPlan {
    const minutes = new Map<string, number>()
    for (let i = 0; i < 14; i++) minutes.set(addDays(NEW_START, i), i < 7 ? 450 : i === 8 ? 0 : -1)
    minutes.set('2026-09-30', 465)
    const study = studyRows({
      start: NEW_START,
      days: minutes,
      weeks: 2,
      weekDays: new Map([
        [1, 5],
        [2, 4]
      ]),
      extra: [
        [16, 12, 'send rabia ai stuff'],
        [5, 9, '1030'],
        [5, 11, '1.75'],
        [5, 12, 'Prepare a presentation'],
        [6, 13, 'w2']
      ]
    })
    const publicDays = [
      '2026-12-24',
      '2026-12-25',
      '2026-12-28',
      '2027-01-01',
      '2027-04-02',
      '2027-04-05',
      '2027-05-03',
      '2027-05-31'
    ]
    const uniDays = [
      '2026-12-23',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-04',
      '2027-01-05'
    ]
    const off = timeOffRows({
      year: '2026-27',
      typed: { public: 8, university: 6, allowance: 40, used: 14 },
      rows: [
        ...publicDays.map((date) => ({ date, type: 'Public Holiday' })),
        ...uniDays.map((date) => ({ date, type: 'University Holiday' })),
        { date: '2027-12-27', type: 'Public Holiday' },
        { date: '2027-12-28', type: 'Public Holiday' }
      ]
    })
    return planYear({
      study: parseStudySheet(study),
      timeOff: parseTimeOffSheet(off),
      typedDays: false,
      today: TODAY
    })
  }

  it('leaves the two Dec 2027 rows out and reports them; the in-year counts match the typed ones', () => {
    const plan = must(planNew())
    expect(plan.report.outsideTimeOff.map((r) => r.date)).toEqual(['2027-12-27', '2027-12-28'])
    expect(plan.year.timeOff).toHaveLength(14)
    expect(plan.check.publicHolidays).toBe(8)
    expect(plan.check.universityHolidays).toBe(6)
  })

  it('imports the hours and notes, leaves planned days to the time-off list, and reports the scratch rows', () => {
    const plan = must(planNew())
    expect(plan.year.weekDays).toEqual({})
    expect(plan.year.days['2026-09-21']).toEqual({ minutes: 450, note: 'send rabia ai stuff' })
    expect(plan.year.days['2026-09-30']).toEqual({ minutes: 465 })
    expect(plan.report.notes).toBe(1)
    expect(plan.report.scratch).toEqual([
      'row 5: start 10:30, duration 1.75, Prepare a presentation'
    ])
    expect(plan.report.unread).toEqual(['N6: w2'])
    expect(plan.report.typedDaysDiffer).toEqual([
      { week: 2, from: '2026-09-28', typed: 4, list: 5 }
    ])
  })
})

describe('the safety check leaves a year out as ATTENTION', () => {
  const attention = (plan: YearPlan): string => {
    expect(plan.status).toBe('attention')
    return plan.status === 'attention' ? plan.problems.join(' | ') : ''
  }

  it('when a date is listed twice', () => {
    const plan = planOld(({ study }) => {
      study.push(['2025-10-01', '3'])
    })
    expect(attention(plan)).toContain('twice')
  })

  it('when the typed planned days do not add up to the sheet’s own Total row', () => {
    const plan = planOld(({ study }) => {
      study[2][5] = '4'
    })
    expect(attention(plan)).toContain('Total row')
  })

  it('when the holidays in the list differ from the typed counts', () => {
    const plan = planOld(({ off }) => {
      off[1][3] = 'University Holiday'
    })
    expect(attention(plan)).toContain('Public holidays')
  })

  it('when a type is unknown, a row is not a date, or a week appears twice', () => {
    expect(
      attention(
        planOld(({ off }) => {
          off[1][3] = 'Sabbatical'
        })
      )
    ).toContain('Sabbatical')
    expect(
      attention(
        planOld(({ study }) => {
          study[10][0] = 'soon'
        })
      )
    ).toContain('not a date')
    expect(
      attention(
        planOld(({ study }) => {
          study[4][3] = 'Week 52'
        })
      )
    ).toContain('twice')
  })

  it('when the year label in the time-off tab belongs to another year', () => {
    expect(
      attention(
        planOld(({ off }) => {
          off[1][0] = '2024-25'
        })
      )
    ).toContain('2024-25')
  })

  it('when it is not the right workbook', () => {
    const plan = planYear({
      study: parseStudySheet([['Date', 'Hours', '', 'Accounted']]),
      timeOff: parseTimeOffSheet(timeOffRows({ year: '2025-26', rows: [] })),
      typedDays: true,
      today: TODAY
    })
    expect(attention(plan)).toContain('Study Hour Tracker')
  })
})

describe('every typed day comes across', () => {
  it('keeps a quarter-hour day and a day that has only a note, and drops a zero day', () => {
    const plan = must(
      planYear({
        study: parseStudySheet(
          studyRows({
            start: NEW_START,
            days: new Map([
              ['2026-09-21', 15],
              ['2026-09-22', 0],
              ['2026-09-23', 30]
            ]),
            weeks: 1,
            extra: [[4, 12, 'look at inkpath']]
          })
        ),
        timeOff: parseTimeOffSheet(timeOffRows({ year: '2026-27', rows: [] })),
        typedDays: false,
        today: TODAY
      })
    )
    expect(plan.year.days).toEqual({
      '2026-09-21': { minutes: 15 },
      '2026-09-22': { note: 'look at inkpath' },
      '2026-09-23': { minutes: 30 }
    })
    expect(plan.check.minutes).toBe(45)
  })
})

describe('what is reported but still imported', () => {
  it('hours that are not a quarter hour are imported as typed and reported', () => {
    const plan = must(
      planOld(({ study }) => {
        study[2][1] = '7.4'
      })
    )
    expect(plan.report.notQuarter.map((d) => d.minutes)).toEqual([444])
  })

  it('a dated row outside the 52 weeks is left out and reported', () => {
    const plan = must(
      planOld(({ study }) => {
        study.push([serial('2026-09-21'), '3'])
      })
    )
    expect(plan.report.outsideDays.map((d) => d.date)).toEqual(['2026-09-21'])
    expect(plan.year.days['2026-09-21']).toBeUndefined()
  })

  it('weekend time off is left out and reported', () => {
    const plan = must(
      planOld(({ off }) => {
        off.push(['2025-26', serial('2026-01-03'), 'Yes', 'Public Holiday'])
      })
    )
    expect(plan.report.weekendTimeOff.map((r) => r.date)).toEqual(['2026-01-03'])
    expect(plan.year.timeOff).toHaveLength(15)
  })
})
