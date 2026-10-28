import { describe, expect, it } from 'vitest'
import {
  checkedLabel,
  displayTitle,
  foundLabel,
  deadlineFor,
  whenFor,
  sectionsOf,
  titleParts
} from './rows'
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

describe('foundLabel', () => {
  it('says the day an item was found', () => {
    expect(foundLabel('2026-10-26T08:00:00.000Z', '2026-10-26')).toBe('Today')
    expect(foundLabel('2026-10-25T23:30:00.000Z', '2026-10-26')).toBe('Yesterday')
    expect(foundLabel('2026-10-23T08:00:00.000Z', '2026-10-26')).toBe('3 days ago')
    expect(foundLabel('2026-10-09T08:00:00.000Z', '2026-10-26')).toMatch(/9/)
  })
})

describe('whenFor and deadlineFor', () => {
  it('says the stored dates first, then the date the title ends with', () => {
    expect(whenFor(item({ eventDate: '2026-11-14' }))).toBe('14 Nov 2026')
    expect(whenFor(item({ eventDate: '2027-07-14', eventEnd: '2027-07-17' }))).toBe(
      '14–17 Jul 2027'
    )
    expect(whenFor(item({ title: 'EPS Meeting: Cardiff. 7th – 9th April 2027' }))).toBe(
      '7–9 April 2027'
    )
    expect(whenFor(item({}))).toBe('')
  })
  it('names a deadline still to come, with its own words, and says nothing otherwise', () => {
    const due = { deadline: '2026-11-05', deadlineLabel: 'Register by' }
    expect(deadlineFor(item(due), '2026-10-26')).toBe('Register by 5 Nov')
    expect(deadlineFor(item({ deadline: '2026-11-05' }), '2026-10-26')).toBe('Apply by 5 Nov')
    expect(deadlineFor(item({ ...due, deadline: '2027-01-05' }), '2026-10-26')).toBe(
      'Register by 5 Jan 2027'
    )
    expect(deadlineFor(item({ ...due, deadline: '2026-10-01' }), '2026-10-26')).toBe('')
    expect(deadlineFor(item({ eventDate: '2026-11-05' }), '2026-10-26')).toBe('')
  })
})

describe('sectionsOf', () => {
  it('puts saved items first and splits the rest by kind, listing only new ones and leaving out kinds not shown', () => {
    const s = sectionsOf([
      item({ id: 1, kind: 'conference', state: 'saved', date: '2026-12-01' }),
      item({ id: 2, kind: 'training', state: 'saved', date: '2026-11-05' }),
      item({ id: 3, kind: 'summer-school', state: 'new' }),
      item({ id: 4, kind: 'conference', state: 'seen' }),
      item({ id: 6, kind: 'journal', state: 'new' })
    ])
    expect(s.saved.map((i) => i.id)).toEqual([2, 1])
    expect(s.training.map((i) => i.id)).toEqual([3])
    expect(s.conference.map((i) => i.id)).toEqual([])
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

describe('titleParts', () => {
  it('moves the date at the end of a title into its own part', () => {
    expect(titleParts('EPS Meeting: Cardiff University. 7th – 9th April 2027')).toEqual({
      name: 'EPS Meeting: Cardiff University',
      when: '7–9 April 2027'
    })
    expect(titleParts('Summer school').when).toBe('')
  })
})
