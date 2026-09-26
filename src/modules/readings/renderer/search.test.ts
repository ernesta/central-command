import { describe, expect, it } from 'vitest'
import type { Reading } from '../shared/types'
import { readingHits } from './search'

const reading = (over: Partial<Reading>): Reading =>
  ({
    citekey: 'kimImpact2020',
    shortCitation: 'Kim et al. (2020)',
    fullTitle: 'Impact of Literacy Interventions',
    notesExcerpt: '',
    ...over
  }) as Reading

describe('readingHits', () => {
  it('describes a reading by its short citation and goes to its page', () => {
    expect(readingHits([reading({})], 'literacy')).toEqual([
      {
        key: 'kimImpact2020',
        title: 'Impact of Literacy Interventions',
        detail: 'Kim et al. (2020)',
        route: '/research/readings/kimImpact2020'
      }
    ])
  })

  it('shows the part of the notes that matched when the title does not', () => {
    const [hit] = readingHits(
      [reading({ notesExcerpt: 'Effect sizes were larger for phonics.' })],
      'phonics'
    )
    expect(hit.detail).toContain('phonics')
  })
})
