import { describe, expect, it } from 'vitest'
import type { Person } from '@shared/people'
import {
  DEFAULT_TRAINING_QUERY,
  entriesInYear,
  entryMinutes,
  entryParts,
  entriesInYearOrPlanned,
  isUpcoming,
  leadNames,
  normaliseTrainingQuery,
  queryTraining,
  reconcileTrainingQuery,
  institutionOptions,
  seriesOptions,
  recentAndUpcoming,
  seriesSummaries,
  trainingFiltersActive,
  trainingHours
} from './rules'
import type { TrainingIndexRow } from './types'

const row = (date: string, over: Partial<TrainingIndexRow> = {}): TrainingIndexRow => ({
  workspace: 'research',
  id: `${date} Talk`,
  date,
  start: '10:00',
  end: '11:00',
  title: 'Talk',
  series: null,
  type: null,
  mode: null,
  skills: [],
  leads: [],
  institution: null,
  folder: null,
  task: '',
  selfStudy: '',
  summary: '',
  excerpt: '',
  hasNotes: false,
  problems: [],
  contentHash: 'h',
  ...over
})

const TODAY = '2026-03-01'
const people: Person[] = [{ name: 'Robert Darby', initials: 'RD', me: false }]

describe('trainingHours', () => {
  it('adds up minutes from the times within the year only', () => {
    const rows = [
      row('2025-09-22'),
      row('2026-02-10', { start: '09:00', end: '09:45' }),
      row('2025-09-21'),
      row('2026-09-21')
    ]
    expect(trainingHours(rows, '2025-09-22', TODAY, 200).minutes).toBe(105)
    expect(entriesInYear(rows, '2025-09-22')).toHaveLength(2)
  })

  it('leaves out upcoming entries', () => {
    const hours = trainingHours([row('2026-03-02'), row('2026-03-01')], '2025-09-22', TODAY, 200)
    expect(hours.entries).toBe(1)
    expect(hours.minutes).toBe(60)
  })

  it('leaves out an entry without times, neither done nor mentioned; the times decide, not any typed hours', () => {
    const hours = trainingHours(
      [row('2026-01-01', { start: null, end: null }), row('2026-01-02', { end: '09:00' })],
      '2025-09-22',
      TODAY,
      200
    )
    expect(hours.minutes).toBe(0)
    expect(hours.entries).toBe(0)
  })

  it('counts an entry fully towards each skill, so skills can add up to more than the total', () => {
    const hours = trainingHours(
      [
        row('2026-01-01', { skills: ['Networking (RP)', 'Leadership (RP)'] }),
        row('2026-01-02', { skills: ['Networking (RP)'] })
      ],
      '2025-09-22',
      TODAY,
      200
    )
    expect(hours.minutes).toBe(120)
    expect(hours.perSkill).toEqual([
      { skill: 'Networking (RP)', minutes: 120 },
      { skill: 'Leadership (RP)', minutes: 60 }
    ])
  })

  it('reports progress towards the aim, passing 1 when it is reached', () => {
    const rows = [row('2026-01-01', { start: '09:00', end: '19:00' })] // 10 h
    expect(trainingHours(rows, '2025-09-22', TODAY, 20).progress).toBeCloseTo(0.5)
    expect(trainingHours(rows, '2025-09-22', TODAY, 5).progress).toBeCloseTo(2)
    expect(trainingHours(rows, '2025-09-22', TODAY, 0).progress).toBe(0)
  })
})

describe('queryTraining', () => {
  const rows = [
    row('2025-10-01', {
      title: 'Mixed methods',
      series: 'SEDarc',
      type: 'Research methods',
      skills: ['Qualitative skills (SS)'],
      leads: ['Robert Darby'],
      summary: 'Ethnography'
    }),
    row('2025-11-01', {
      title: 'Python basics',
      series: 'DataCamp',
      skills: ['Quantitative skills (GS)']
    }),
    row('2025-12-01', { title: 'Unsorted' })
  ]

  it('sorts newest first', () => {
    expect(queryTraining(rows, DEFAULT_TRAINING_QUERY, people).map((r) => r.date)).toEqual([
      '2025-12-01',
      '2025-11-01',
      '2025-10-01'
    ])
  })

  it('filters by series, type, skill and lead', () => {
    const q = (patch: object): string[] =>
      queryTraining(rows, { ...DEFAULT_TRAINING_QUERY, ...patch }, people).map((r) => r.title)
    expect(q({ series: 'DataCamp' })).toEqual(['Python basics'])
    expect(q({ type: 'Research methods' })).toEqual(['Mixed methods'])
    expect(q({ skill: 'Quantitative skills (GS)' })).toEqual(['Python basics'])
    expect(q({ lead: 'Robert Darby' })).toEqual(['Mixed methods'])
  })

  it('searches title, summary, skills, and leads by initials, ignoring accents and case', () => {
    const q = (search: string): string[] =>
      queryTraining(rows, { ...DEFAULT_TRAINING_QUERY, search }, people).map((r) => r.title)
    expect(q('ETHNOGRAPHY')).toEqual(['Mixed methods'])
    expect(q('quantitative')).toEqual(['Python basics'])
    expect(q('rd')).toEqual(['Mixed methods'])
    expect(q('mixed nothing')).toEqual([])
  })

  it('keeps an entry with no date (planned), first, and counts it as upcoming', () => {
    const list = queryTraining(
      [...rows, row('', { title: 'Undated' })],
      DEFAULT_TRAINING_QUERY,
      people
    )
    expect(list.at(0)?.title).toBe('Undated')
    expect(isUpcoming({ date: '' }, TODAY)).toBe(true)
    // A planned entry adds nothing to the hours until it has a date and has happened.
    expect(trainingHours([row('', { title: 'Undated' })], '2025-09-22', TODAY, 200).minutes).toBe(0)
  })
})

describe('remembered query', () => {
  it('repairs anything odd', () => {
    expect(normaliseTrainingQuery(null)).toEqual(DEFAULT_TRAINING_QUERY)
    expect(normaliseTrainingQuery({ series: 5, search: 'x', lead: '' })).toEqual({
      ...DEFAULT_TRAINING_QUERY,
      search: 'x'
    })
  })

  it('resets a filter whose value no longer exists', () => {
    const q = { ...DEFAULT_TRAINING_QUERY, series: 'Gone', skill: 'Impact (RP)' }
    const r = reconcileTrainingQuery(q, {
      series: ['SEDarc'],
      types: [],
      skills: ['Impact (RP)'],
      leads: []
    })
    expect(r.series).toBe('all')
    expect(r.skill).toBe('Impact (RP)')
    expect(trainingFiltersActive(r)).toBe(true)
    expect(trainingFiltersActive(DEFAULT_TRAINING_QUERY)).toBe(false)
  })
})

describe('option lists', () => {
  it('lists only series found in the files, sorted; leads and skills sorted', () => {
    const rows = [
      row('2025-10-01', { series: 'SENSS', leads: ['B B', 'A A'], skills: ['Z', 'A'] }),
      row('2025-10-02', { series: 'DataCamp', leads: ['A A'] })
    ]
    expect(seriesOptions(rows)).toEqual(['DataCamp', 'SENSS'])
    expect(seriesOptions([])).toEqual([])
    expect(leadNames(rows)).toEqual(['A A', 'B B'])
  })

  it('lists the institutions in use, sorted and without repeats', () => {
    const rows = [
      row('2025-10-01', { institution: 'Royal Holloway' }),
      row('2025-10-02', { institution: 'Aston University' }),
      row('2025-10-03', { institution: 'Royal Holloway' }),
      row('2025-10-04', { institution: null })
    ]
    expect(institutionOptions(rows)).toEqual(['Aston University', 'Royal Holloway'])
  })
})

describe('entriesInYearOrPlanned', () => {
  const rows = [row('2025-10-01'), row('2026-10-01'), row('', { title: 'Planned' })]
  const today = '2026-09-30' // in 2026–27

  it('shows planned entries in the current year only', () => {
    expect(entriesInYearOrPlanned(rows, '2026-09-21', today).map((r) => r.title)).toEqual([
      'Talk',
      'Planned'
    ])
    expect(entriesInYearOrPlanned(rows, '2025-09-22', today).map((r) => r.title)).toEqual(['Talk'])
  })
})

describe('a training total (session plus self-study, one number)', () => {
  const training = (
    date: string,
    task: string,
    over: Partial<TrainingIndexRow> = {}
  ): TrainingIndexRow => row(date, { task, series: 'Intro', skills: ['Networking (RP)'], ...over })
  const study = new Map([['k1', 45]])

  it('is the session alone for a note with no self-study or no task: the same numbers as before', () => {
    const rows = [
      training('2026-01-01', 'k1'),
      training('2026-01-02', ''),
      training('2026-01-03', 'auto')
    ]
    const plain = trainingHours(rows, '2025-09-22', TODAY, 200)
    expect(trainingHours(rows, '2025-09-22', TODAY, 200, new Map())).toEqual(plain)
    expect(trainingHours(rows, '2025-09-22', TODAY, 200, new Map([['other', 99]]))).toEqual(plain)
    expect(plain.minutes).toBe(180)
  })

  it('adds the self-study of the training to its session, in the total and in every skill', () => {
    const rows = [training('2026-01-01', 'k1'), training('2026-01-02', 'k2')]
    const hours = trainingHours(rows, '2025-09-22', TODAY, 200, study)
    expect(hours.minutes).toBe(60 + 45 + 60)
    expect(hours.perSkill).toEqual([{ skill: 'Networking (RP)', minutes: 165 }])
  })

  it('never gives an older note (no task) the self-study of a task, even one with the same uid text', () => {
    expect(entryMinutes({ start: '10:00', end: '11:00', task: '', selfStudy: '' }, study)).toBe(60)
    expect(
      entryMinutes(
        { start: '10:00', end: '11:00', task: 'auto', selfStudy: '' },
        new Map([['auto', 5]])
      )
    ).toBe(60)
  })

  it('counts self-study on a training with no times, which then counts as done', () => {
    const rows = [training('2026-01-01', 'k1', { start: null, end: null })]
    const hours = trainingHours(rows, '2025-09-22', TODAY, 200, study)
    expect(hours.minutes).toBe(45)
    expect(hours.entries).toBe(1)
    expect(trainingHours(rows, '2025-09-22', TODAY, 200).entries).toBe(0)
    expect(entryMinutes({ start: null, end: null, task: 'k2', selfStudy: '' }, study)).toBeNull()
  })

  it('counts a series upcoming entries apart from the ones that happened', () => {
    const rows = [
      training('2026-01-01', 'k1', { series: 'Intro' }),
      training('2099-01-01', 'k2', { series: 'Intro' }),
      training('2099-02-01', 'k3', { series: 'Intro' })
    ]
    expect(seriesSummaries(rows, TODAY)).toMatchObject([{ series: 'Intro', count: 1, upcoming: 2 }])
  })

  it('totals each series with its trainings self-study', () => {
    const rows = [training('2026-01-01', 'k1'), training('2026-01-02', 'k2')]
    expect(seriesSummaries(rows, TODAY, study)).toMatchObject([
      { series: 'Intro', count: 2, minutes: 165 }
    ])
    expect(seriesSummaries(rows, TODAY)).toMatchObject([
      { series: 'Intro', count: 2, minutes: 120, selfStudy: 0 }
    ])
  })
})

describe('a training total with a self-study task of its own', () => {
  const both = { start: '10:00', end: '11:00', task: 'k1', selfStudy: 'k7' }

  it('is the session plus the time on the training task plus the time on the self-study task', () => {
    expect(entryMinutes(both, new Map([['k1', 15]]))).toBe(75)
    expect(entryMinutes(both, new Map([['k7', 30]]))).toBe(90)
    expect(
      entryMinutes(
        both,
        new Map([
          ['k1', 15],
          ['k7', 30]
        ])
      )
    ).toBe(105)
  })

  it('counts a task once, even if both keys name it, and never counts an unrelated task', () => {
    expect(entryMinutes({ ...both, selfStudy: 'k1' }, new Map([['k1', 15]]))).toBe(75)
    expect(entryMinutes(both, new Map([['other', 99]]))).toBe(60)
  })

  it('counts self-study alone on a note with no times or training task', () => {
    const open = { start: null, end: null, task: '', selfStudy: 'k7' }
    expect(entryMinutes(open, new Map([['k7', 30]]))).toBe(30)
    expect(entryMinutes(open, new Map())).toBeNull()
  })

  it('an older note (no self-study task) gives the numbers it gave before', () => {
    expect(
      entryMinutes(
        { ...both, selfStudy: '' },
        new Map([
          ['k1', 15],
          ['k7', 30]
        ])
      )
    ).toBe(75)
  })

  it('flows into the year, per skill and the series summaries', () => {
    const rows = [
      row('2026-01-01', { ...both, series: 'Intro', skills: ['Networking (RP)'] }),
      row('2026-01-02', {
        task: 'k2',
        selfStudy: 'k8',
        series: 'Intro',
        skills: ['Networking (RP)']
      })
    ]
    const tracked = new Map([
      ['k1', 15],
      ['k7', 30],
      ['k8', 10]
    ])
    const hours = trainingHours(rows, '2025-09-22', TODAY, 200, tracked)
    expect(hours.minutes).toBe(105 + 70)
    expect(hours.perSkill).toEqual([{ skill: 'Networking (RP)', minutes: 175 }])
    expect(seriesSummaries(rows, TODAY, tracked)).toMatchObject([
      { series: 'Intro', count: 2, minutes: 175 }
    ])
  })

  it('every total gives one number: the entry, the year, the skill and the series agree', () => {
    const tracked = new Map([
      ['k1', 15],
      ['k7', 30]
    ])
    const rows = [
      row('2026-01-01', { ...both, series: 'Intro', skills: ['Networking (RP)'] }),
      row('2026-01-02', {
        start: '09:00',
        end: '09:30',
        series: 'Intro',
        skills: ['Networking (RP)']
      })
    ]
    const entries = rows.map((r) => entryMinutes(r, tracked) ?? 0)
    const year = trainingHours(rows, '2025-09-22', TODAY, 200, tracked)
    const [summary] = seriesSummaries(rows, TODAY, tracked)
    expect(year.minutes).toBe(entries[0] + entries[1])
    expect(year.perSkill[0].minutes).toBe(year.minutes)
    expect(summary.minutes).toBe(year.minutes)
  })
})

describe('entryParts and the split of a series', () => {
  const row = { start: '09:00', end: '12:00', task: 'l1', selfStudy: 's1' }
  it('splits the session and the training task from the self-study, and entryMinutes is their sum', () => {
    const tracked = new Map([
      ['l1', 15],
      ['s1', 75]
    ])
    expect(entryParts(row, tracked)).toEqual({ training: 195, selfStudy: 75 })
    expect(entryMinutes(row, tracked)).toBe(270)
  })
  it('is null with no times and nothing tracked', () => {
    expect(entryParts({ ...row, start: null, end: null }, new Map())).toBeNull()
  })
})

describe('recentAndUpcoming', () => {
  it('gives the last 7 days (newest first) and the next 7 days (soonest first, undated last)', () => {
    const rows = [
      row('2026-10-10'),
      row('2026-10-11'),
      row('2026-10-18'),
      row('2026-10-25'),
      row('2026-10-26'),
      row('', { id: 'Planned' })
    ]
    const { upcoming, recent } = recentAndUpcoming(rows, '2026-10-18')
    expect(upcoming.map((r) => r.date)).toEqual(['2026-10-25', ''])
    expect(recent.map((r) => r.date)).toEqual(['2026-10-18', '2026-10-11'])
  })
})

describe("today's entry and the clock", () => {
  const rows = [row(TODAY)] // 10:00–11:00
  const minutes = (now: string): number =>
    trainingHours(rows, '2025-09-22', TODAY, 20, undefined, now).minutes

  it('counts once it is over, not before or while it runs', () => {
    expect(minutes('09:00')).toBe(0)
    expect(minutes('10:30')).toBe(0)
    expect(minutes('11:00')).toBe(60)
  })

  it('is upcoming until its end', () => {
    expect(isUpcoming(rows[0], TODAY, '10:59')).toBe(true)
    expect(isUpcoming(rows[0], TODAY, '11:00')).toBe(false)
  })
})
