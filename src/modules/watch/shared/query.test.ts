import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WATCH_QUERY,
  groupItems,
  normaliseWatchQuery,
  queryItems,
  reconcileWatchQuery,
  sourceOptions
} from './query'
import type { WatchItem } from './types'

const item = (over: Partial<WatchItem>): WatchItem => ({
  id: 1,
  sourceId: 1,
  sourceTitle: 'LINGUIST List',
  kind: 'conference',
  title: 'An item',
  url: 'https://ex.org/1',
  summary: '',
  publishedAt: null,
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
  item({ id: 3, title: 'Saved thing', state: 'saved' }),
  item({ id: 4, title: 'Gone', state: 'dismissed' })
]

describe('queryItems', () => {
  it('starts with everything not dismissed', () => {
    expect(queryItems(items, DEFAULT_WATCH_QUERY).map((i) => i.id)).toEqual([1, 2, 3])
  })
  it('shows one state, including the dismissed', () => {
    expect(
      queryItems(items, { ...DEFAULT_WATCH_QUERY, state: 'dismissed' }).map((i) => i.id)
    ).toEqual([4])
    expect(queryItems(items, { ...DEFAULT_WATCH_QUERY, state: 'saved' }).map((i) => i.id)).toEqual([
      3
    ])
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

describe('groups, sources and the remembered query', () => {
  it('groups New above Earlier in the default view only', () => {
    const shown = queryItems(items, DEFAULT_WATCH_QUERY)
    expect(
      groupItems(shown, DEFAULT_WATCH_QUERY).map((g) => [g.label, g.rows.map((i) => i.id)])
    ).toEqual([
      ['New', [1]],
      ['Earlier', [2, 3]]
    ])
    const saved = { ...DEFAULT_WATCH_QUERY, state: 'saved' as const }
    expect(groupItems(queryItems(items, saved), saved).map((g) => g.label)).toEqual([null])
    expect(groupItems([], DEFAULT_WATCH_QUERY)).toEqual([])
  })
  it('lists each source once and drops a remembered one that has gone', () => {
    expect(sourceOptions(items)).toEqual([
      { id: 1, title: 'LINGUIST List' },
      { id: 2, title: 'UK Data Service' }
    ])
    expect(reconcileWatchQuery({ ...DEFAULT_WATCH_QUERY, source: '9' }, items).source).toBe('all')
    expect(reconcileWatchQuery({ ...DEFAULT_WATCH_QUERY, source: '2' }, items).source).toBe('2')
  })
  it('repairs a hand-edited query', () => {
    expect(normaliseWatchQuery({ search: 3, source: '', state: 'bogus' })).toEqual(
      DEFAULT_WATCH_QUERY
    )
    expect(normaliseWatchQuery(null)).toEqual(DEFAULT_WATCH_QUERY)
  })
})
