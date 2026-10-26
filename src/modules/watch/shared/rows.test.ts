import { describe, expect, it } from 'vitest'
import { foundLabel, noteFor, sectionsOf } from './rows'
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

describe('foundLabel', () => {
  it('says the day an item was found', () => {
    expect(foundLabel('2026-10-26T08:00:00.000Z', '2026-10-26')).toBe('Today')
    expect(foundLabel('2026-10-25T23:30:00.000Z', '2026-10-26')).toBe('Yesterday')
    expect(foundLabel('2026-10-23T08:00:00.000Z', '2026-10-26')).toBe('3 days ago')
    expect(foundLabel('2026-10-09T08:00:00.000Z', '2026-10-26')).toMatch(/9/)
  })
})

describe('noteFor', () => {
  it('names a deadline still to come, and says nothing otherwise', () => {
    expect(noteFor(item({ date: '2026-11-05', dateKind: 'deadline' }), '2026-10-26')).toMatch(
      /^Apply by .*5/
    )
    expect(noteFor(item({ date: '2026-11-05', dateKind: 'date' }), '2026-10-26')).toBe('')
    expect(noteFor(item({ date: '2026-10-01', dateKind: 'deadline' }), '2026-10-26')).toBe('')
    expect(noteFor(item({}), '2026-10-26')).toBe('')
  })
})

describe('sectionsOf', () => {
  it('puts saved items first and splits the rest by kind, leaving out dismissed ones and kinds not shown', () => {
    const s = sectionsOf([
      item({ id: 1, kind: 'conference', state: 'saved', date: '2026-12-01' }),
      item({ id: 2, kind: 'training', state: 'saved', date: '2026-11-05' }),
      item({ id: 3, kind: 'summer-school', state: 'new' }),
      item({ id: 4, kind: 'conference', state: 'seen' }),
      item({ id: 5, kind: 'conference', state: 'dismissed' }),
      item({ id: 6, kind: 'journal', state: 'new' })
    ])
    expect(s.saved.map((i) => i.id)).toEqual([2, 1])
    expect(s.training.map((i) => i.id)).toEqual([3])
    expect(s.conference.map((i) => i.id)).toEqual([4])
  })
})
