import { describe, expect, it } from 'vitest'
import type { Person } from '@modules/meetings/shared/types'
import {
  DEFAULT_TRAINING_QUERY,
  entriesInYear,
  leadNames,
  meetingsLine,
  normaliseTrainingQuery,
  queryTraining,
  reconcileTrainingQuery,
  seriesOptions,
  skillNames,
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
  it('adds up minutes from the times within the academic year only', () => {
    const rows = [
      row('2025-09-01'),
      row('2026-02-10', { start: '09:00', end: '09:45' }),
      row('2025-08-31'),
      row('2026-09-01')
    ]
    expect(trainingHours(rows, 2025, TODAY, 200).minutes).toBe(105)
    expect(entriesInYear(rows, 2025)).toHaveLength(2)
  })

  it('leaves out upcoming entries', () => {
    const hours = trainingHours([row('2026-03-02'), row('2026-03-01')], 2025, TODAY, 200)
    expect(hours.entries).toBe(1)
    expect(hours.minutes).toBe(60)
  })

  it('counts an entry without times as zero and says so; the times decide, not any typed hours', () => {
    const hours = trainingHours(
      [row('2026-01-01', { start: null, end: null }), row('2026-01-02', { end: '09:00' })],
      2025,
      TODAY,
      200
    )
    expect(hours.minutes).toBe(0)
    expect(hours.withoutTimes).toBe(2)
  })

  it('counts an entry fully towards each skill, so skills can add up to more than the total', () => {
    const hours = trainingHours(
      [
        row('2026-01-01', { skills: ['Networking (RP)', 'Leadership (RP)'] }),
        row('2026-01-02', { skills: ['Networking (RP)'] })
      ],
      2025,
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
    expect(trainingHours(rows, 2025, TODAY, 20).progress).toBeCloseTo(0.5)
    expect(trainingHours(rows, 2025, TODAY, 5).progress).toBeCloseTo(2)
    expect(trainingHours(rows, 2025, TODAY, 0).progress).toBe(0)
  })
})

describe('queryTraining', () => {
  const rows = [
    row('2025-10-01', {
      title: 'Mixed methods',
      series: 'SEDarc',
      type: 'Research methods course',
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
    expect(q({ type: 'Research methods course' })).toEqual(['Mixed methods'])
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

  it('keeps an entry with no date, at the end', () => {
    const list = queryTraining(
      [...rows, row('', { title: 'Undated' })],
      DEFAULT_TRAINING_QUERY,
      people
    )
    expect(list.at(-1)?.title).toBe('Undated')
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
  it('lists the start series first, then others; leads and skills sorted', () => {
    const rows = [
      row('2025-10-01', { series: 'SENSS', leads: ['B B', 'A A'], skills: ['Z', 'A'] }),
      row('2025-10-02', { series: 'DataCamp', leads: ['A A'] })
    ]
    expect(seriesOptions(rows, ['SEDarc', 'DataCamp'])).toEqual(['SEDarc', 'DataCamp', 'SENSS'])
    expect(leadNames(rows)).toEqual(['A A', 'B B'])
    expect(skillNames(rows)).toEqual(['A', 'Z'])
  })

  it('words the meetings line', () => {
    expect(meetingsLine(2190)).toBe('plus 36.5 h of meetings, which Inkpath also counts')
  })
})
