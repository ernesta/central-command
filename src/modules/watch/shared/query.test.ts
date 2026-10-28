import { describe, expect, it } from 'vitest'
import {
  cutGroups,
  DEFAULT_WATCH_QUERY,
  GROUP_ROWS_SHOWN,
  groupItems,
  LIST_STATES,
  LIST_STATE_LABELS,
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
  kind: 'conference',
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
