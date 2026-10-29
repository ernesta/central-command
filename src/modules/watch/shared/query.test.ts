import { describe, expect, it } from 'vitest'
import {
  cutGroups,
  DEFAULT_WATCH_QUERY,
  GROUP_ROWS_SHOWN,
  groupItems,
  LIST_STATES,
  LIST_STATE_LABELS,
  openedWith,
  sortItems,
  queryItems,
  reconcileWatchQuery,
  sourceOptions
} from './query'
import type { WatchItem } from './types'

const item = (over: Partial<WatchItem>): WatchItem => ({
  id: 1,
  sourceId: 1,
  workspace: 'research',
  sourceTitle: 'LINGUIST List',
  section: 'conference',
  manual: false,
  title: 'An item',
  url: 'https://ex.org/1',
  summary: '',
  publishedAt: null,
  eventDate: null,
  eventEnd: null,
  deadline: null,
  deadlineLabel: null,
  date: null,
  dateKind: null,
  score: 0,
  matched: [],
  state: 'new',
  firstSeenAt: '2026-10-26T08:00:00.000Z',
  readAt: null,
  ...over
})

const items = [
  item({ id: 1, title: 'Workshop on reading', state: 'new' }),
  item({
    id: 2,
    title: 'Summer school',
    sourceId: 2,
    sourceTitle: 'UK Data Service',
    state: 'seen'
  }),
  item({ id: 3, title: 'Saved thing', state: 'saved' })
]

describe('queryItems', () => {
  it('starts with every item, whatever its state', () => {
    expect(DEFAULT_WATCH_QUERY.state).toBe('all')
    expect(queryItems(items, DEFAULT_WATCH_QUERY).map((i) => i.id)).toEqual([1, 2, 3])
  })
  it('shows one state', () => {
    expect(queryItems(items, { ...DEFAULT_WATCH_QUERY, state: 'saved' }).map((i) => i.id)).toEqual([
      3
    ])
    expect(queryItems(items, { ...DEFAULT_WATCH_QUERY, state: 'seen' }).map((i) => i.id)).toEqual([
      2
    ])
    expect(LIST_STATES.map((s) => LIST_STATE_LABELS[s])).toEqual(['Saved', 'New', 'Read', 'All'])
  })
  it('searches title and source, every word', () => {
    expect(
      queryItems(items, { ...DEFAULT_WATCH_QUERY, search: 'uk data' }).map((i) => i.id)
    ).toEqual([2])
    expect(
      queryItems(items, { ...DEFAULT_WATCH_QUERY, search: 'reading workshop' }).map((i) => i.id)
    ).toEqual([1])
  })
  it('filters by source', () => {
    expect(queryItems(items, { ...DEFAULT_WATCH_QUERY, source: '2' }).map((i) => i.id)).toEqual([2])
  })
})

describe('groups, sources and the cut', () => {
  it('groups All as Saved, New, Read, and a single state with no header', () => {
    const shown = queryItems(items, DEFAULT_WATCH_QUERY)
    expect(
      groupItems(shown, DEFAULT_WATCH_QUERY).map((g) => [g.label, g.rows.map((i) => i.id)])
    ).toEqual([
      ['Saved', [3]],
      ['New', [1]],
      ['Read', [2]]
    ])
    const saved = { ...DEFAULT_WATCH_QUERY, state: 'saved' as const }
    expect(groupItems(queryItems(items, saved), saved).map((g) => g.label)).toEqual([null])
    expect(groupItems([], DEFAULT_WATCH_QUERY)).toEqual([])
  })
  it('cuts each group after its first rows, with the number left, until it is opened', () => {
    const many = Array.from({ length: GROUP_ROWS_SHOWN + 4 }, (_, i) =>
      item({ id: 100 + i, state: 'seen' })
    )
    const groups = groupItems([...items, ...many], DEFAULT_WATCH_QUERY)
    const cut = cutGroups(groups, new Set())
    expect(cut.map((g) => [g.key, g.rows.length, g.hidden])).toEqual([
      ['saved', 1, 0],
      ['new', 1, 0],
      ['seen', GROUP_ROWS_SHOWN, 5]
    ])
    expect(cutGroups(groups, new Set(['seen'])).map((g) => g.hidden)).toEqual([0, 0, 0])
    // A single-state list is cut the same way.
    const one = { ...DEFAULT_WATCH_QUERY, state: 'seen' as const }
    expect(cutGroups(groupItems(queryItems(many, one), one), new Set())[0].hidden).toBe(4)
  })
  it('lists each source once and drops a remembered one that has gone', () => {
    expect(sourceOptions(items)).toEqual([
      { id: 1, title: 'LINGUIST List' },
      { id: 2, title: 'UK Data Service' }
    ])
    expect(reconcileWatchQuery({ ...DEFAULT_WATCH_QUERY, source: '9' }, items).source).toBe('all')
    expect(reconcileWatchQuery({ ...DEFAULT_WATCH_QUERY, source: '2' }, items).source).toBe('2')
  })
})

describe('a row opened this visit is held where it was', () => {
  const day = (n: number): string => `2026-10-${String(n).padStart(2, '0')}T08:00:00.000Z`
  const list = [
    item({ id: 1, state: 'new', firstSeenAt: day(26) }),
    item({ id: 2, state: 'seen', firstSeenAt: day(25) }), // opened just now
    item({ id: 3, state: 'new', firstSeenAt: day(24) }),
    item({ id: 4, state: 'seen', firstSeenAt: day(20), readAt: day(21) })
  ]
  const held = new Set([2])
  const shape = (groups: ReturnType<typeof groupItems>): unknown[] =>
    groups.map((g) => [g.key, g.rows.map((r) => r.id)])

  it('is listed as New, between the New rows it was between', () => {
    const sorted = sortItems(list, held)
    expect(sorted.map((i) => i.id)).toEqual([1, 2, 3, 4])
    expect(shape(groupItems(sorted, DEFAULT_WATCH_QUERY, held))).toEqual([
      ['new', [1, 2, 3]],
      ['seen', [4]]
    ])
    const onlyNew = queryItems(sorted, { ...DEFAULT_WATCH_QUERY, state: 'new' }, held)
    expect(onlyNew.map((i) => i.id)).toEqual([1, 2, 3])
  })

  it('goes to the Read group once the page lets it go', () => {
    expect(shape(groupItems(sortItems(list), DEFAULT_WATCH_QUERY))).toEqual([
      ['new', [1, 3]],
      ['seen', [4, 2]]
    ])
  })

  it('a held row that was saved since is Saved, not New', () => {
    const saved = [{ ...list[1], state: 'saved' as const }]
    expect(groupItems(saved, DEFAULT_WATCH_QUERY, held)[0].key).toBe('saved')
  })
})

describe('Read is most recently read first', () => {
  it('orders by when it was read; rows with no time come after, by the day found', () => {
    const list = [
      item({ id: 1, state: 'seen', firstSeenAt: '2026-10-26T08:00:00.000Z' }),
      item({ id: 2, state: 'seen', readAt: '2026-10-27T10:00:00.000Z' }),
      item({ id: 3, state: 'seen', readAt: '2026-10-28T10:00:00.000Z' }),
      item({ id: 4, state: 'seen', firstSeenAt: '2026-10-20T08:00:00.000Z' })
    ]
    expect(sortItems(list).map((i) => i.id)).toEqual([3, 2, 1, 4])
  })
})

describe('a search hit’s item is never in a cut group', () => {
  const many = Array.from({ length: GROUP_ROWS_SHOWN + 5 }, (_, i) =>
    item({ id: i + 1, state: 'seen' })
  )
  const groups = groupItems(many, DEFAULT_WATCH_QUERY)

  it('opens the group the item is in when it is past the cut', () => {
    expect(cutGroups(groups, openedWith(groups, new Set(), many.length))[0].hidden).toBe(0)
  })

  it('leaves the cut alone for an item that is shown, or for none', () => {
    expect(cutGroups(groups, openedWith(groups, new Set(), 1))[0].hidden).toBe(5)
    expect(cutGroups(groups, openedWith(groups, new Set(), null))[0].hidden).toBe(5)
  })
})
