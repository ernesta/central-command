import { describe, expect, it } from 'vitest'
import type { TrainingIndexRow } from '../shared/types'
import { planHits, planYears, trainingHits } from './search'
import { plainRequest, searchRequest } from '@shared/search-query'

const entry = (over: Partial<TrainingIndexRow>): TrainingIndexRow => ({
  workspace: 'research',
  id: '2025-09-24 Applied Economics',
  date: '2025-09-24',
  start: null,
  end: null,
  title: 'Applied Economics September Meet-up',
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
  excerpt: 'Presentations on logistics infrastructure in England and commodity shocks.',
  hasNotes: true,
  problems: [],
  contentHash: 'h',
  ...over
})

describe('trainingHits', () => {
  const rows = [
    entry({}),
    entry({
      id: 'x',
      title: 'DataCamp: R basics',
      series: 'DataCamp',
      excerpt: '',
      date: '2026-01-05'
    })
  ]

  it('finds an entry by its title and labels it with its series and describes it by date', () => {
    const [hit] = trainingHits(rows, [], plainRequest('datacamp'))
    expect(hit).toMatchObject({
      title: 'DataCamp: R basics',
      detail: 'Jan 5',
      route: '/research/training/t/x'
    })
  })

  it('finds an entry by its notes and shows the part that matched', () => {
    const [hit] = trainingHits(rows, [], plainRequest('logistics'))
    expect(hit.title).toBe('Applied Economics September Meet-up')
    expect(hit.detail).toContain('logistics')
  })
})

describe('planHits', () => {
  const plans = [
    {
      year: '2026-09-21',
      markdown: '# Priorities\n\n## Bayesian modelling\n\nLearn to fit multilevel models.'
    },
    { year: '2025-09-22', markdown: '' }
  ]

  it('finds a plan by its text and shows the part that matched', () => {
    const [hit] = planHits(plans, plainRequest('bayesian'))
    expect(hit).toMatchObject({
      key: 'plan-2026',
      title: 'Training plan 2026–27',
      route: '/research/training/plan?year=2026-09-21'
    })
    expect(hit.detail.toLowerCase()).toContain('bayesian')
  })

  it('finds a plan by its name, and skips a plan with no text', () => {
    expect(planHits(plans, plainRequest('training plan')).map((h) => h.key)).toEqual(['plan-2026'])
  })

  it('finds nothing for a word that is not there', () => {
    expect(planHits(plans, plainRequest('zebra'))).toEqual([])
  })
})

describe('planYears', () => {
  it('has the years of the entries, this year and the next, newest first', () => {
    expect(planYears(['2025-10-02'], '2026-09-26', ['2025-09-22', '2026-09-21'])).toEqual([
      '2027-09-20',
      '2026-09-21',
      '2025-09-22'
    ])
  })
})

describe('trainingHits with modifiers', () => {
  const today = '2026-10-19'
  const rows = [
    entry({ id: 'a', series: 'DataCamp', date: '2026-01-05', leads: ['Zed Lead'], skills: ['R'] }),
    entry({ id: 'b', series: null, date: '2025-09-24', leads: [], skills: [] }),
    entry({ id: 'c', series: 'DataCamp', date: '', leads: ['Zed Lead'], skills: ['Stats'] })
  ]
  const run = (query: string): string[] =>
    trainingHits(rows, [], searchRequest(query, today), 40).map((h) => h.key)

  it('with: and by: are both the leads', () => {
    expect(run('with:"zed lead"').sort()).toEqual(['a', 'c'])
    expect(run('by:"zed lead"').sort()).toEqual(['a', 'c'])
    expect(run('-by:"zed lead"')).toEqual(['b'])
  })

  it('series: and skill:', () => {
    expect(run('series:datacamp').sort()).toEqual(['a', 'c'])
    expect(run('skill:r')).toEqual(['a'])
    expect(run('-series:datacamp')).toEqual(['b'])
  })

  it('dates', () => {
    expect(run('after:2025-12')).toEqual(['a'])
    expect(run('during:2025')).toEqual(['b'])
    expect(run('before:2026-01-05')).toEqual(['b'])
  })
})

describe('planHits with modifiers', () => {
  const plans = [{ year: '2026-10-01', markdown: 'Bayesian modelling course.' }]
  it('a plan has none of the fields, so only a negated filter lets it through', () => {
    expect(planHits(plans, searchRequest('bayesian'))).toHaveLength(1)
    expect(planHits(plans, searchRequest('bayesian -series:x'))).toHaveLength(1)
    expect(planHits(plans, searchRequest('bayesian series:x'))).toEqual([])
    expect(planHits(plans, searchRequest('bayesian after:2000'))).toEqual([])
  })
  it('matches a quoted phrase', () => {
    expect(planHits(plans, searchRequest('"bayesian modelling"'))).toHaveLength(1)
    expect(planHits(plans, searchRequest('"modelling bayesian"'))).toEqual([])
  })
})
