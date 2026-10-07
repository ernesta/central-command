import { describe, expect, it } from 'vitest'
import type { TrainingIndexRow } from '../shared/types'
import { planHits, planYears, trainingHits } from './search'

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

  it('finds an entry by its title and describes it by date and series', () => {
    const [hit] = trainingHits(rows, [], 'datacamp')
    expect(hit).toMatchObject({
      title: 'DataCamp: R basics',
      detail: 'Jan 5 · DataCamp',
      route: '/research/training/t/x'
    })
  })

  it('finds an entry by its notes and shows the part that matched', () => {
    const [hit] = trainingHits(rows, [], 'logistics')
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
    const [hit] = planHits(plans, 'bayesian')
    expect(hit).toMatchObject({
      key: 'plan-2026',
      title: 'Training plan 2026–27',
      route: '/research/training/plan?year=2026-09-21'
    })
    expect(hit.detail.toLowerCase()).toContain('bayesian')
  })

  it('finds a plan by its name, and skips a plan with no text', () => {
    expect(planHits(plans, 'training plan').map((h) => h.key)).toEqual(['plan-2026'])
  })

  it('finds nothing for a word that is not there', () => {
    expect(planHits(plans, 'zebra')).toEqual([])
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
