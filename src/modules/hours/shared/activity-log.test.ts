import { describe, expect, it } from 'vitest'
import { emptyYear, WORK_PLAN } from '@shared/tracking/types'
import { activityLog, activityLogHtml, levelOfEffort, logHours } from './activity-log'
import { monthsOf, weekPeriodsOf } from './periods'

const plan = { ...WORK_PLAN, hoursPerWeek: 480, clients: ['Impact', 'Teaching & Learning'] }
const contract = {
  ...emptyYear('2026-05-01', plan),
  weeks: 26,
  adjusts: [
    {
      id: 'a',
      date: '2026-09-23',
      label: 'Proposal review',
      minutes: 135,
      client: 'Teaching & Learning'
    },
    { id: 'b', date: '2026-09-27', label: 'Liberia RAI', minutes: 135, client: 'Impact' },
    {
      id: 'c',
      date: '2026-09-29',
      label: 'Interviews',
      minutes: 30,
      client: 'Teaching & Learning'
    },
    {
      id: 'd',
      date: '2026-09-30',
      label: 'interviews',
      minutes: 90,
      client: 'Teaching & Learning'
    },
    { id: 'e', date: '2026-10-02', label: 'Next month', minutes: 60, client: 'Impact' }
  ]
}
const september = monthsOf(contract).find((m) => m.name === 'September')!

describe('activityLog', () => {
  const log = activityLog(contract, september)

  it('groups tasks under their client, in the plan order, summing a task over the period', () => {
    expect(log.groups.map((g) => [g.client, g.minutes])).toEqual([
      ['Impact', 135],
      ['Teaching & Learning', 255]
    ])
    expect(log.groups[1].rows).toEqual([
      { label: 'Proposal review', minutes: 135 },
      { label: 'Interviews', minutes: 120 }
    ])
    expect(log.minutes).toBe(390)
  })

  it('counts meetings and trainings, which the totals count', () => {
    const withMeeting = {
      ...contract,
      sessions: [
        {
          id: 'meeting:m1',
          date: '2026-09-24',
          start: '10:00:00',
          end: '11:00:00',
          label: 'Developer call',
          client: 'Teaching & Learning',
          derived: { kind: 'meeting' as const, id: 'm1' }
        }
      ]
    }
    const log = activityLog(
      withMeeting,
      monthsOf(withMeeting).find((m) => m.name === 'September')!
    )
    expect(log.groups[1].rows).toContainEqual({ label: 'Developer call', minutes: 60 })
    expect(log.minutes).toBe(450)
  })

  it('leaves out time from outside the period', () => {
    expect(JSON.stringify(log)).not.toContain('Next month')
  })

  it('names the file and the period', () => {
    expect(log.fileName).toBe('2026 09 Activity Log.pdf')
    expect(log.title).toBe('September 2026 Activity Log')
    expect(log.intro).toContain('during September 2026.')
    expect(log.intro).toContain('level of effort at 1 day per week')
    expect(log.intro).toContain('the four weeks between')
  })

  it('says nothing of effort where the contract has no aim', () => {
    const none = { ...contract, plan: { ...plan, hoursPerWeek: 0 } }
    expect(activityLog(none, september).intro).not.toContain('level of effort')
  })

  it('writes a weekly-invoiced contract per week', () => {
    const weekly = { ...contract, invoice: 'week' as const }
    const week = weekPeriodsOf(weekly).find((w) => w.from <= '2026-09-23' && w.to >= '2026-09-23')!
    const one = activityLog(weekly, week)
    expect(one.title).toBe(`${week.name} Activity Log`)
    expect(one.intro).toContain('the week between')
    expect(one.fileName).toBe(`${week.from.replace(/-/g, ' ')} Activity Log.pdf`)
  })
})

describe('activityLogHtml', () => {
  it('escapes names and totals the log', () => {
    const year = {
      ...contract,
      adjusts: [{ id: 'x', date: '2026-09-23', label: 'A <b> & B', minutes: 45, client: 'Impact' }]
    }
    const html = activityLogHtml(activityLog(year, september), '2026-10-04')
    expect(html).toContain('A &lt;b&gt; &amp; B')
    expect(html).toContain('Impact – Total')
    expect(html).toContain('<td class="r">0.75</td>')
  })
})

describe('formats', () => {
  it('writes hours as decimals', () => {
    expect([0, 15, 135, 840, 975].map(logHours)).toEqual(['0', '0.25', '2.25', '14', '16.25'])
  })
  it('writes the level of effort', () => {
    expect(levelOfEffort(contract)).toBe('1 day per week')
    expect(levelOfEffort({ ...contract, plan: { ...plan, hoursPerWeek: 960 } })).toBe(
      '2 days per week'
    )
    expect(levelOfEffort({ ...contract, plan: { ...plan, hoursPerWeek: 360 } })).toBe(
      '6 hours per week'
    )
  })
})
