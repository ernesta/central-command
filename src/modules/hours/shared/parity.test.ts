import { describe, expect, it } from 'vitest'
import { derivedRows } from '@shared/tracking/derived'
import { roundToQuarter } from '@shared/tracking/rounding'
import { dayMinutes, weekMinutes } from '@shared/tracking/totals'
import { DEFAULT_PLAN, emptyYear, WORK_PLAN, type Moment } from '@shared/tracking/types'
import { addDays } from '@shared/year'
import type { MeetingIndexRow } from '../../meetings/shared/types'
import { trackedByTask } from '../../tasks/shared/tracked'
import type { Task } from '../../tasks/shared/types'
import { entryMinutes, seriesSummaries, trainingHours } from '../../training/shared/rules'
import type { TrainingIndexRow } from '../../training/shared/types'
import { periodFigures, thisWeek } from './so-far'
import { shownYear, type DerivedSources } from './shown-year'

/**
 * One fixture library, read every way hours are read: the Hours page (days and weeks, the "Meetings and training" rows), Home (the
 * period figures, which the Home summary and the widget file also use), a task's Time, and the training totals. Same numbers, or the
 * one documented difference.
 */
const now: Moment = { date: '2026-10-15', time: '17:00' }

const task = (uid: string, title: string, over: Partial<Task> = {}): Task => ({
  uid,
  ownKind: null,
  workspace: 'research',
  title,
  description: '',
  status: 'doing',
  priority: 'normal',
  due: null,
  completedAt: null,
  list: 'Training',
  sublist: '',
  parentUid: null,
  position: 0,
  recurrence: null,
  seriesUid: null,
  earlierMinutes: 0,
  sourceId: null,
  tags: [],
  createdAt: '',
  updatedAt: '',
  ...over
})

const meeting = (over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id: '2026-10-14 Supervision',
  uid: '',
  task: 'm1',
  series: 'Supervision',
  date: '2026-10-14',
  start: '14:00',
  end: '15:00',
  mode: null,
  attendees: [],
  skills: [],
  summary: '',
  excerpt: '',
  problems: [],
  topicCount: 0,
  todos: [],
  contentHash: '',
  ...over
})

const lecture = (over: Partial<TrainingIndexRow> = {}): TrainingIndexRow => ({
  workspace: 'research',
  id: '2026-10-13 Plotly',
  date: '2026-10-13',
  start: '10:00',
  end: '11:30',
  title: 'Plotly',
  series: 'PS5210',
  type: null,
  mode: null,
  skills: ['Networking (RP)'],
  leads: [],
  institution: null,
  folder: null,
  task: 'l1',
  selfStudy: 's1',
  summary: '',
  excerpt: '',
  hasNotes: false,
  problems: [],
  contentHash: 'h',
  ...over
})

const stored = {
  ...emptyYear('2026-09-21', DEFAULT_PLAN),
  adjusts: [
    // self-study on the lecture's own task, and an hour of something else
    {
      id: 's',
      date: '2026-10-13',
      label: 'Plotly · self-study',
      minutes: 30,
      task: 'cc://task/s1'
    },
    { id: 'x', date: '2026-10-15', label: 'Reading', minutes: 60 }
  ]
}

const sources = (over: Partial<DerivedSources> = {}): DerivedSources => ({
  meetings: [meeting()],
  lectures: [lecture()],
  tasks: [
    task('m1', 'Supervision', { list: 'Meetings' }),
    task('l1', 'Plotly', { parentUid: 'p', list: '' }),
    task('s1', 'Plotly · self-study', { parentUid: 'q', list: '' }),
    task('p', 'PS5210'),
    task('q', 'PS5210 · self-study')
  ],
  clients: null,
  today: now.date,
  ...over
})

const week = (shown: ReturnType<typeof shownYear>): string[] => {
  const from = thisWeek(shown, now)
  return Array.from({ length: 7 }, (_, i) => addDays(from, i))
}

describe('hours counted the same way everywhere (Research)', () => {
  const shown = shownYear(stored, sources())

  it('the Hours page’s days add up to its week, and Home’s figure is that week', () => {
    const days = week(shown).map((d) => dayMinutes(shown, d, now))
    expect(days.reduce((a, b) => a + b, 0)).toBe(weekMinutes(shown, thisWeek(shown, now), now))
    // 60 meeting + 90 lecture + 30 self-study + 60 typed
    expect(weekMinutes(shown, thisWeek(shown, now), now)).toBe(240)
    const home = periodFigures(shown, now)
    expect(home.minutes).toBe(240)
    expect(home.today).toBe(dayMinutes(shown, now.date, now))
    expect(home.today).toBe(60)
  })

  it('the stored year alone would miss what the notes derive (the old Home summary’s mistake)', () => {
    expect(periodFigures(stored, now).minutes).toBe(90)
  })

  it('the Hours page’s Meetings and training rows are the derived hours, and nothing else', () => {
    const rows = week(shown).flatMap((d) => derivedRows(shown, d))
    expect(rows.map((r) => [r.kind, r.minutes])).toEqual([
      ['training', 90],
      ['meeting', 60]
    ])
  })

  it('a task’s Time (the shown year) and the training total (the stored year) give the lecture the same hours', () => {
    const onTasks = trackedByTask([shown])
    const study = trackedByTask([stored])
    const row = lecture()
    // task Time of the lecture task + the self-study task = the note's total
    expect(entryMinutes(row, study)).toBe(120)
    expect((onTasks.get('l1') ?? 0) + (onTasks.get('s1') ?? 0)).toBe(120)
    // the training year total, per skill and per series agree with it
    const hours = trainingHours([row], '2026-09-21', now.date, 200, study)
    expect(hours.minutes).toBe(120)
    expect(hours.perSkill).toEqual([{ skill: 'Networking (RP)', minutes: 120 }])
    expect(seriesSummaries([row], now.date, study)).toEqual([
      { series: 'PS5210', count: 1, upcoming: 0, minutes: 120, training: 90, selfStudy: 30 }
    ])
  })

  it('the self-study time is counted once on the Hours page, however many places read it', () => {
    const onTasks = trackedByTask([shown])
    expect(onTasks.get('s1')).toBe(30)
    expect(onTasks.get('l1')).toBe(90)
  })

  it('a lecture that is not a whole number of quarter hours: Hours and the training log both report to the quarter', () => {
    // Once a known difference (docs/DECISIONS.md, "Meetings' derived hours"); since 18 Oct 2026 every report of time is to the quarter hour,
    // the session's length included.
    const odd = lecture({
      id: '2026-10-12 Odd',
      date: '2026-10-12',
      start: '09:00',
      end: '10:10',
      task: 'l2',
      selfStudy: ''
    })
    const withOdd = shownYear(
      stored,
      sources({ lectures: [odd], tasks: [...sources().tasks, task('l2', 'Odd')] })
    )
    const hoursPage = trackedByTask([withOdd]).get('l2')
    const trainingLog = entryMinutes(odd, trackedByTask([stored]))
    expect(trainingLog).toBe(75)
    expect(hoursPage).toBe(75)
    expect(hoursPage).toBe(roundToQuarter(70 * 60))
    expect(derivedRows(withOdd, '2026-10-12').map((r) => r.minutes)).toEqual([75])
  })
})

describe('hours counted the same way everywhere (Work)', () => {
  const plan = { ...WORK_PLAN, clients: ['Impact', 'Luminos'] }
  const work = {
    ...emptyYear('2026-09-14', plan),
    adjusts: [{ id: 'a', date: '2026-10-12', label: 'Proposal', minutes: 45, client: 'Impact' }]
  }
  const shown = shownYear(
    work,
    sources({
      meetings: [meeting({ workspace: 'work', date: '2026-10-13' })],
      lectures: [],
      tasks: [task('m1', 'Planning', { workspace: 'work', list: 'Luminos' })],
      clients: ['Impact', 'Luminos']
    })
  )

  it('the month, its clients and the days all add up to the same figure', () => {
    const f = periodFigures(shown, now)
    expect(f.label).toBe('This month')
    expect(f.minutes).toBe(45 + 60)
    expect(f.clients.reduce((n, c) => n + c.minutes, 0)).toBe(f.minutes)
    expect(f.clients).toEqual(
      expect.arrayContaining([
        { client: 'Impact', minutes: 45 },
        { client: 'Luminos', minutes: 60 }
      ])
    )
    const days = Array.from({ length: 31 }, (_, i) => addDays('2026-10-01', i))
    expect(days.reduce((n, d) => n + dayMinutes(shown, d, now), 0)).toBe(f.minutes)
  })
})
