import { describe, expect, it } from 'vitest'
import { emptyYear, WORK_PLAN } from '@shared/tracking/types'
import { activityLog, activityLogHtml, activityName, logHours } from './activity-log'
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
    expect(log.groups[1].rows).toContainEqual({ label: 'Meeting: Developer call', minutes: 60 })
    expect(log.minutes).toBe(450)
  })

  it('leaves out time from outside the period', () => {
    expect(JSON.stringify(log)).not.toContain('Next month')
  })

  it('names the file and the period', () => {
    expect(log.fileName).toBe('2026 09 Activity Log.pdf')
    expect(log.title).toBe('September 2026 Activity Log')
    expect(log.covered).toMatch(/^\w{3} \d{1,2}, 2026 – \w{3} \d{1,2}, 2026$/)
  })

  it('writes a weekly-invoiced contract per week', () => {
    const weekly = { ...contract, invoice: 'week' as const }
    const week = weekPeriodsOf(weekly).find((w) => w.from <= '2026-09-23' && w.to >= '2026-09-23')!
    const one = activityLog(weekly, week)
    expect(one.title).toBe(`${week.name} Activity Log`)
    expect(one.covered).toContain(' – ')
    expect(one.fileName).toBe(`${week.from.replace(/-/g, ' ')} Activity Log.pdf`)
  })
})

describe('activityLogHtml', () => {
  it('escapes names and totals the log', () => {
    const year = {
      ...contract,
      adjusts: [{ id: 'x', date: '2026-09-23', label: 'A <b> & B', minutes: 45, client: 'Impact' }]
    }
    const html = activityLogHtml(activityLog(year, september))
    expect(html).toContain('A &lt;b&gt; &amp; B')
    expect(html).toContain('Impact – Subtotal')
    expect(html).toContain('<td class="r">0.75</td>')
    expect(activityLogHtml(activityLog(year, september), 'Ada <L>')).toContain('Ada &lt;L&gt;')
  })
})

describe('formats', () => {
  it('writes hours as decimals', () => {
    expect([0, 15, 135, 840, 975].map(logHours)).toEqual(['0', '0.25', '2.25', '14', '16.25'])
  })
})

describe('activityName', () => {
  const year = { ...emptyYear('2026-05-01', plan), name: 'Luminos' }
  it('drops a part that repeats the contract or the client', () => {
    expect(activityName('Document Automation – Luminos', year, 'Impact')).toBe(
      'Document Automation'
    )
    expect(activityName('Luminos - Impact - Weekly sync', year, 'Impact')).toBe('Weekly sync')
    expect(activityName('Impact', year, 'Impact')).toBe('Impact')
  })
  it('says what a note-derived line is', () => {
    expect(activityName('Document Automation – Luminos', year, null, 'meeting')).toBe(
      'Meeting: Document Automation'
    )
    expect(activityName('Python course', year, null, 'training')).toBe('Training: Python course')
  })
  it('leaves a typed task as it is', () => {
    expect(activityName('Liberia RAI for the upcoming endline', year, 'Impact')).toBe(
      'Liberia RAI for the upcoming endline'
    )
  })
})
