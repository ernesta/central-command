import { describe, expect, it } from 'vitest'
import type { TrainingIndexRow } from '../shared/types'
import { trainingHits } from './search'

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
