import { describe, expect, it } from 'vitest'
import { checkedLabel, displayTitle, foundLabel, noteFor, sectionsOf } from './rows'
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

describe('checkedLabel', () => {
  const src = { lastCheckedAt: '2026-10-26T08:00:00.000Z', lastError: null, failures: 0 }
  it('says when a working source was checked, and only a failing one says so', () => {
    expect(checkedLabel(src, '2026-10-26')).toEqual({ text: 'Today', failing: false })
    expect(checkedLabel({ ...src, lastCheckedAt: null }, '2026-10-26').text).toBe('Not yet')
    expect(checkedLabel({ ...src, lastError: 'HTTP 404', failures: 3 }, '2026-10-26')).toEqual({
      text: 'Can’t open: 3 tries',
      failing: true
    })
    expect(checkedLabel({ ...src, lastError: 'x', failures: 1 }, '2026-10-26').text).toBe(
      'Can’t open: 1 try'
    )
  })
})

describe('displayTitle', () => {
  it('drops the closing full stop and a local organiser’s name', () => {
    expect(displayTitle('EPS Meeting: Cardiff University. 7th – 9th April 2027.')).toBe(
      'EPS Meeting: Cardiff University. 7th – 9th April 2027'
    )
    expect(
      displayTitle(
        'Local Organiser: Adam Parker EPS Research Workshop: Birmingham City University. 20th January 2027.'
      )
    ).toBe('EPS Research Workshop: Birmingham City University. 20th January 2027')
  })
})
