import { describe, expect, it } from 'vitest'
import { searchRequest } from '@shared/search-query'
import type { WatchItem } from '../shared/types'
import { titleParts } from '../shared/rows'
import { watchHits } from './search'

describe('watchHits', () => {
  it('titles a hit the way the list does, without the feed tag or a date', () => {
    const title = 'Confs: 10 December 2026 Machine learning and probability: missing data.'
    const item = {
      id: 1,
      title,
      summary: '',
      sourceTitle: 'LSE',
      state: 'new',
      section: 'conference',
      workspace: 'research'
    } as unknown as WatchItem
    const [hit] = watchHits([item], searchRequest('machine learning', '2026-10-30'))
    expect(hit.title).toBe(titleParts(title).name)
    expect(hit.title).not.toMatch(/^Confs:|^10 December/)
  })
})
