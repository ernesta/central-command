import { describe, expect, it } from 'vitest'
import { dayMinutes, weekMinutes } from '@shared/tracking/totals'
import { DEFAULT_PLAN, emptyYear, WORK_PLAN, type Moment } from '@shared/tracking/types'
import type { MeetingIndexRow } from '../../meetings/shared/types'
import { visibleTasks } from '../../tasks/shared/session-lock'
import type { Task } from '../../tasks/shared/types'
import type { TrainingIndexRow } from '../../training/shared/types'
import { derivedEntries, shownYear, type DerivedSources } from './shown-year'

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
  hasNotes: false,
  todos: [],
  contentHash: '',
  ...over
})

const training = (over: Partial<TrainingIndexRow> = {}): TrainingIndexRow => ({
  workspace: 'research',
  id: '2026-10-13 Plotly',
  date: '2026-10-13',
  start: '10:00',
  end: '11:30',
  title: 'Plotly',
  series: 'PS5210',
  type: null,
  mode: null,
  skills: [],
  leads: [],
  institution: null,
  folder: null,
  task: 'l1',
  selfStudy: '',
  summary: '',
  excerpt: '',
  hasNotes: false,
  problems: [],
  contentHash: 'h',
  ...over
})

const sources = (over: Partial<DerivedSources> = {}): DerivedSources => ({
  meetings: [meeting()],
  trainings: [training()],
  tasks: [task('m1', 'Supervision', { list: 'Meetings' }), task('l1', 'Plotly')],
  clients: null,
  today: now.date,
  ...over
})

const research = emptyYear('2026-09-14', DEFAULT_PLAN)

describe('shownYear', () => {
  it('adds a meeting’s and a training’s own session to the stored year, as ended sessions marked derived', () => {
    const year = shownYear(research, sources())
    expect(year.sessions.map((s) => [s.date, s.start, s.end, s.derived?.kind])).toEqual([
      ['2026-10-14', '14:00:00', '15:00:00', 'meeting'],
      ['2026-10-13', '10:00:00', '11:30:00', 'training']
    ])
    expect(dayMinutes(year, '2026-10-14', now)).toBe(60)
    expect(weekMinutes(year, '2026-10-12', now)).toBe(60 + 90)
  })

  it('counts the same whether the session tasks are hidden from task views or not (hiding is display only)', () => {
    const plain = sources()
    const session = sources({
      tasks: [
        task('m1', 'Supervision', { list: 'Meetings', ownKind: 'meeting' }),
        task('l1', 'Plotly', { ownKind: 'training' })
      ]
    })
    expect(visibleTasks(session.tasks)).toEqual([])
    const totals = (src: DerivedSources): number[] => {
      const year = shownYear(research, src)
      return [dayMinutes(year, '2026-10-14', now), weekMinutes(year, '2026-10-12', now)]
    }
    expect(totals(session)).toEqual(totals(plain))
    expect(totals(session)).toEqual([60, 150])
    // The task views' list would lose them: Hours reads the unfiltered list.
    expect(totals({ ...session, tasks: visibleTasks(session.tasks) })).toEqual([0, 0])
  })

  it('leaves the stored year alone (a copy, nothing written) and returns it as it is when nothing derives', () => {
    const before = JSON.stringify(research)
    shownYear(research, sources())
    expect(JSON.stringify(research)).toBe(before)
    expect(shownYear(research, sources({ meetings: [], trainings: [] }))).toBe(research)
  })

  it('leaves out what has not happened, has no task, no end time, or whose task is gone', () => {
    const year = shownYear(
      research,
      sources({
        meetings: [
          meeting({ id: 'future', date: '2026-10-16' }),
          meeting({ id: 'untasked', task: '' }),
          meeting({ id: 'open', end: null }),
          meeting({ id: 'gone', task: 'nope' })
        ],
        trainings: []
      })
    )
    expect(year).toBe(research)
  })

  it('a subtask counts in its parent’s list, so Work’s meeting lands under its client', () => {
    const work = emptyYear('2026-09-14', { ...WORK_PLAN, clients: ['Impact', 'Luminos'] })
    const tasks = [
      task('p', 'Impact', { workspace: 'work', list: 'Impact' }),
      task('m1', 'Planning', { workspace: 'work', list: '', parentUid: 'p' })
    ]
    const shown = shownYear(
      work,
      sources({
        meetings: [meeting({ workspace: 'work' })],
        trainings: [],
        tasks,
        clients: ['Impact', 'Luminos']
      })
    )
    expect(shown.sessions).toHaveLength(1)
    expect(shown.sessions[0].client).toBe('Impact')
    // a client the plan does not have cannot be placed in Work
    const stray = shownYear(
      work,
      sources({
        meetings: [meeting({ workspace: 'work' })],
        trainings: [],
        tasks: [task('m1', 'Planning', { workspace: 'work', list: 'Elsewhere' })],
        clients: ['Impact', 'Luminos']
      })
    )
    expect(stray).toBe(work)
  })

  it('counts a typed entry and a meeting on the same task and day once (history linked later already holds the hours)', () => {
    const earlier = {
      ...research,
      adjusts: [
        {
          id: 'e',
          date: '2026-10-14',
          label: 'Supervision',
          minutes: 60,
          task: 'cc://task/m1',
          earlier: true as const
        }
      ]
    }
    const shown = shownYear(earlier, sources({ trainings: [] }))
    expect(shown.sessions).toHaveLength(0)
    expect(dayMinutes(shown, '2026-10-14', now)).toBe(60)
  })

  it('keeps a training’s session and the time typed on its self-study task apart: both count', () => {
    const typed = {
      ...research,
      adjusts: [
        {
          id: 's',
          date: '2026-10-13',
          label: 'Plotly · self-study',
          minutes: 30,
          task: 'cc://task/s1'
        }
      ]
    }
    const shown = shownYear(typed, sources({ meetings: [] }))
    expect(dayMinutes(shown, '2026-10-13', now)).toBe(90 + 30)
  })
})

describe('derivedEntries', () => {
  it('has a training only when the workspace gave trainings, and labels it “Series: title”', () => {
    const entries = derivedEntries(sources({ meetings: [] }))
    expect(entries).toHaveLength(1)
    expect(entries[0].label).toBe('PS5210: Plotly')
    expect(derivedEntries(sources({ meetings: [], trainings: [] }))).toEqual([])
  })
})
