import { describe, expect, it } from 'vitest'
import type { InkpathRow } from './inkpath'
import { planReconcile, type MeetingFileInfo } from './reconcile-meetings'

const row = (over: Partial<InkpathRow> = {}): InkpathRow => ({
  row: 2,
  name: 'Supervisor Meeting Apr 1, 2026',
  attendance: '',
  description: '',
  organisation: '',
  provider: '',
  startDate: '2026-04-01',
  endDate: '2026-04-01',
  startTime: '10:00',
  endTime: '11:00',
  hours: 1,
  points: '',
  skills: 'Project management (GS), Data Management and analysis (GS)',
  notes: '',
  ...over
})
const file = (over: Partial<MeetingFileInfo> = {}): MeetingFileInfo => ({
  fileName: '2026-04-01 Supervision.md',
  date: '2026-04-01',
  series: 'Supervision',
  start: null,
  end: null,
  skills: [],
  ...over
})

describe('planReconcile', () => {
  it('adds skills and missing times to a meeting file that has neither', () => {
    const { items } = planReconcile([row()], [file()])
    expect(items).toEqual([
      expect.objectContaining({
        status: 'update',
        patch: {
          skills: ['Project management (GS)', 'Data management and analysis (GS)'],
          start: '10:00',
          end: '11:00'
        }
      })
    ])
  })

  it('never overwrites: existing skills and different times are only reported', () => {
    const plan = planReconcile(
      [row()],
      [file({ start: '09:00', end: '09:45', skills: ['Networking (RP)'] })]
    )
    expect(plan.items[0]).toMatchObject({ status: 'ok' })
    expect((plan.items[0] as { notes: string[] }).notes[0]).toContain('skills differ')
    expect(plan.timeDifferences).toEqual([
      { fileName: '2026-04-01 Supervision.md', file: '09:00–09:45', log: '10:00–11:00' }
    ])
  })

  it('is quiet when the file already agrees, and reports a meeting with no file', () => {
    const agree = file({
      start: '10:00',
      end: '11:00',
      skills: ['Project management (GS)', 'Data management and analysis (GS)']
    })
    const plan = planReconcile([row(), row({ row: 3, startDate: '2026-05-01' })], [agree])
    expect(plan.items.map((i) => i.status)).toEqual(['ok', 'no-file'])
    expect(plan.timeDifferences).toEqual([])
  })

  it('matches by series as well as date, and skips rows that are not meetings', () => {
    const plan = planReconcile(
      [row({ name: 'Rastle Lab Meeting' }), row({ name: 'Some seminar' })],
      [file()]
    )
    expect(plan.items).toEqual([expect.objectContaining({ status: 'no-file' })])
  })
})
