import { describe, expect, it, vi } from 'vitest'
import type { SearchHit, Searchable } from '@shared/search'
import type { Person } from '@shared/people'
import { parseSearch, plainRequest, type SearchRequest } from '@shared/search-query'
import {
  countResults,
  runSearches,
  searchEverywhere,
  type SearchGroup,
  type SearchOutcome
} from './run-search'

const hit = (key: string): SearchHit => ({ key, title: key, detail: '', route: `/${key}` })
const source = (
  id: string,
  hits: SearchHit[] = [hit(`${id}1`)],
  workspace: Searchable['workspace'] = null
): Searchable => ({ id, label: id, workspace, search: async () => hits })
const planFor = (sources: Searchable[]): { source: Searchable; request: SearchRequest }[] =>
  sources.map((s) => ({ source: s, request: plainRequest('x') }))

describe('runSearches', () => {
  it('keeps the modules that found something, in the order given', async () => {
    const groups = await runSearches(
      planFor([source('a'), source('b', []), source('c', [hit('c1'), hit('c2')])])
    )
    expect(groups.map((g) => [g.id, g.hits.length])).toEqual([
      ['a', 1],
      ['c', 2]
    ])
  })

  it('leaves out a module that fails and still shows the others', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const failing: Searchable = {
      ...source('a'),
      search: async () => {
        throw new Error('boom')
      }
    }
    const groups = await runSearches(planFor([failing, source('b')]))
    expect(groups.map((g) => g.id)).toEqual(['b'])
    error.mockRestore()
  })

  it('passes the request and the limit on to each source', async () => {
    const search = vi.fn(async () => [hit('a1')])
    const request = plainRequest('x')
    await runSearches([{ source: { ...source('a'), search }, request }], 30)
    expect(search).toHaveBeenCalledWith(request, 30)
  })
})

describe('searchEverywhere', () => {
  const people = async (): Promise<Person[]> => []
  const run = (sources: Searchable[], query: string, limit?: number): Promise<SearchOutcome> =>
    searchEverywhere(sources, query, limit, people, '2026-10-19')
  const sources: Searchable[] = [
    source('readings'),
    source('training', [hit('t1')], 'research'),
    source('meetings', [hit('m1')], 'research'),
    source('notes', [hit('n1')], 'work'),
    source('tasks', [hit('k1')], 'research'),
    source('people'),
    source('actions')
  ]
  const ids = async (query: string): Promise<string[]> =>
    (await run(sources, query)).groups.map((g) => g.id)

  it('does not search anyone for a plain empty query', async () => {
    const search = vi.fn(async () => [hit('a1')])
    const outcome = await run([{ ...source('a'), search }], '   ')
    expect(outcome.groups).toEqual([])
    expect(search).not.toHaveBeenCalled()
  })

  it('orders the groups Actions, People, Notes, Meetings, Tasks, Training, Readings, whatever order the sources answered in', async () => {
    expect(await ids('x')).toEqual([
      'actions',
      'people',
      'notes',
      'meetings',
      'tasks',
      'training',
      'readings'
    ])
  })

  it('puts a source this build does not know about last, rather than dropping it', async () => {
    const outcome = await run([...sources, source('mystery', [hit('z1')])], 'x')
    expect(outcome.groups.at(-1)?.id).toBe('mystery')
  })

  it('restricts to the sources an in: modifier names, and passes the rest of the text on', async () => {
    const meetings = vi.fn(async () => [hit('m1')])
    const notes = vi.fn(async () => [hit('n1')])
    const outcome = await run(
      [
        { ...source('meetings'), search: meetings },
        { ...source('notes'), search: notes }
      ],
      'in:meetings luminos'
    )
    expect(outcome.groups.map((g) => g.id)).toEqual(['meetings'])
    expect(meetings).toHaveBeenCalledWith(expect.objectContaining({ text: 'luminos' }), undefined)
    expect(notes).not.toHaveBeenCalled()
  })

  it('finds tasks with in:task (the search that once found nothing)', async () => {
    expect(await ids('experiments in:task')).toEqual(['tasks'])
  })

  it('searches everything in a source named alone, with nothing else to match', async () => {
    const meetings = vi.fn(async () => [hit('m1')])
    const outcome = await run([{ ...source('meetings'), search: meetings }], 'in:meetings')
    expect(outcome.groups).toHaveLength(1)
    expect(meetings).toHaveBeenCalledWith(expect.objectContaining({ text: '' }), undefined)
  })

  it('keeps the commands out when a modifier is used or no words are typed', async () => {
    expect(await ids('in:notes x')).toEqual(['notes'])
    expect(await ids('workspace:work')).toEqual(['people', 'notes', 'readings'])
    expect(await ids('-in:readings x')).not.toContain('readings')
  })

  it('workspace: keeps its workspace and the sources that have none', async () => {
    expect(await ids('workspace:work x')).toEqual(['actions', 'people', 'notes', 'readings'])
    expect(await ids('workspace:research x')).toEqual([
      'actions',
      'people',
      'meetings',
      'tasks',
      'training',
      'readings'
    ])
  })

  it('gives each source only the filters it has', async () => {
    const tasks = vi.fn(async () => [hit('k1')])
    await run([{ ...source('tasks'), search: tasks }], 'in:tasks priority:p1 -tag:a workspace:work')
    expect(tasks).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          { name: 'priority', value: 'p1', negated: false },
          { name: 'tag', value: 'a', negated: true }
        ]
      }),
      undefined
    )
  })

  it('searches nothing and says so for two different in:, even though words were typed', async () => {
    const search = vi.fn(async () => [hit('a1')])
    const outcome = await run([{ ...source('notes'), search }], 'x in:notes in:tasks')
    expect(search).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({
      groups: [],
      impossible: true,
      notices: ['No item has two sources.']
    })
  })

  it('is not a search for a modifier with no value, an unknown one or a value it does not take', async () => {
    const search = vi.fn(async () => [hit('a1')])
    for (const query of ['in:', 'person:', 'in:home']) {
      const outcome = await run([{ ...source('notes'), search }], query)
      expect(outcome).toMatchObject({ groups: [], searched: false })
    }
    expect(search).not.toHaveBeenCalled()
    expect((await run(sources, 'x')).searched).toBe(true)
  })

  it('returns the notices of a query that does searchable work too', async () => {
    const outcome = await run(sources, 'x foo:bar')
    expect(outcome.notices).toEqual(['Not a filter: foo:bar'])
    expect(outcome.groups.length).toBeGreaterThan(0)
  })

  it('turns with: into the person’s full name, and says when nobody is meant', async () => {
    const search = vi.fn(async () => [hit('m1')])
    const list = async (): Promise<Person[]> => [
      { name: 'Chris Cummiskey', initials: 'CC', me: false }
    ]
    const m = { ...source('meetings'), search }
    const ok = await searchEverywhere([m], 'with:cc', undefined, list, '2026-10-19')
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ name: 'with', value: 'chris cummiskey', negated: false }]
      }),
      undefined
    )
    expect(ok.notices).toEqual([])
    const bad = await searchEverywhere([m], 'with:Zed luminos', undefined, list, '2026-10-19')
    expect(bad.notices).toEqual(['with: needs a name or initials from the people list'])
  })

  it('parses with the same clock it plans with', () => {
    expect(parseSearch('on:today', '2026-10-19').filters).toHaveLength(1)
  })
})

describe('countResults', () => {
  const group = (n: number): SearchGroup => ({
    id: 'notes',
    label: 'Notes',
    hits: Array.from({ length: n }, (_, i) => hit(`n${i}`))
  })

  it('counts the hits of every group', () => {
    expect(countResults([group(3), group(2)], 40)).toBe('5 results')
    expect(countResults([group(1)], 40)).toBe('1 result')
    expect(countResults([], 40)).toBe('0 results')
  })

  it('says when a kind was cut short', () => {
    expect(countResults([group(40), group(2)], 40)).toBe('42 results · up to 40 of each kind')
  })
})
