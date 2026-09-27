import { describe, expect, it, vi } from 'vitest'
import type { SearchHit } from '@shared/search'
import { runSearches, searchEverywhere, type Searchable } from './run-search'

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

  it('passes the limit on to each source', async () => {
    const search = vi.fn(async () => [hit('a1')])
    await runSearches([{ id: 'a', label: 'A', search }], 'x', 30)
    expect(search).toHaveBeenCalledWith('x', 30)
  })
})

describe('searchEverywhere', () => {
  const sources: Searchable[] = [
    { id: 'readings', label: 'Readings', search: async () => [hit('r1')] },
    { id: 'training', label: 'Training', search: async () => [hit('t1')] },
    { id: 'meetings', label: 'Meetings', search: async () => [hit('m1')] },
    { id: 'notes', label: 'Notes', search: async () => [hit('n1')] },
    { id: 'people', label: 'People', search: async () => [hit('p1')] },
    { id: 'actions', label: 'Actions', search: async () => [hit('act1')] }
  ]

  it('does not search anyone for a plain empty query', async () => {
    const search = vi.fn(async () => [hit('a1')])
    expect(await searchEverywhere([{ id: 'a', label: 'A', search }], '   ')).toEqual([])
    expect(search).not.toHaveBeenCalled()
  })

  it('orders the groups Actions, People, Notes, Meetings, Training, Readings, whatever order the sources answered in', async () => {
    const groups = await searchEverywhere(sources, 'x')
    expect(groups.map((g) => g.id)).toEqual([
      'actions',
      'people',
      'notes',
      'meetings',
      'training',
      'readings'
    ])
  })

  it('puts a source this build does not know about last, rather than dropping it', async () => {
    const groups = await searchEverywhere(
      [...sources, { id: 'mystery', label: 'Mystery', search: async () => [hit('z1')] }],
      'x'
    )
    expect(groups.at(-1)?.id).toBe('mystery')
  })

  it('restricts to the sources an in: modifier names, and still passes the rest of the text on', async () => {
    const meetings = vi.fn(async () => [hit('m1')])
    const notes = vi.fn(async () => [hit('n1')])
    const groups = await searchEverywhere(
      [
        { id: 'meetings', label: 'Meetings', search: meetings },
        { id: 'notes', label: 'Notes', search: notes }
      ],
      'in:meetings luminos'
    )
    expect(groups.map((g) => g.id)).toEqual(['meetings'])
    expect(meetings).toHaveBeenCalledWith('luminos', undefined)
    expect(notes).not.toHaveBeenCalled()
  })

  it('searches everything in a source named alone, with nothing else to match', async () => {
    const meetings = vi.fn(async () => [hit('m1')])
    const groups = await searchEverywhere(
      [{ id: 'meetings', label: 'Meetings', search: meetings }],
      'in:meetings'
    )
    expect(groups).toHaveLength(1)
    expect(meetings).toHaveBeenCalledWith('', undefined)
  })
})
