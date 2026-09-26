import { describe, expect, it, vi } from 'vitest'
import type { SearchHit } from '@shared/search'
import { runSearches } from './run-search'

const hit = (key: string): SearchHit => ({ key, title: key, detail: '', route: `/${key}` })

describe('runSearches', () => {
  it('keeps the modules that found something, in the order given', async () => {
    const groups = await runSearches(
      [
        { id: 'a', label: 'A', search: async () => [hit('a1')] },
        { id: 'b', label: 'B', search: async () => [] },
        { id: 'c', label: 'C', search: async () => [hit('c1'), hit('c2')] }
      ],
      'x'
    )
    expect(groups.map((g) => [g.id, g.hits.length])).toEqual([
      ['a', 1],
      ['c', 2]
    ])
  })

  it('leaves out a module that fails and still shows the others', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const groups = await runSearches(
      [
        {
          id: 'a',
          label: 'A',
          search: async () => {
            throw new Error('boom')
          }
        },
        { id: 'b', label: 'B', search: async () => [hit('b1')] }
      ],
      'x'
    )
    expect(groups.map((g) => g.id)).toEqual(['b'])
    error.mockRestore()
  })

  it('does not ask anyone for an empty query', async () => {
    const search = vi.fn(async () => [hit('a1')])
    expect(await runSearches([{ id: 'a', label: 'A', search }], '   ')).toEqual([])
    expect(search).not.toHaveBeenCalled()
  })
})
