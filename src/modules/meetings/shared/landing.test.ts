import { describe, expect, it } from 'vitest'
import { recentAndUpcoming, seriesLine, seriesSummaries, type SeriesSummary } from './landing'
import { formatShortDate } from './time'
import type { MeetingIndexRow } from './types'

const row = (id: string, over: Partial<MeetingIndexRow> = {}): MeetingIndexRow => ({
  workspace: 'research',
  id,
  series: 'Supervision',
  date: id.slice(0, 10),
  start: null,
  end: null,
  mode: null,
  attendees: [],
  skills: [],
  summary: '',
  excerpt: '',
  problems: [],
  topicCount: 0,
  todos: [],
  contentHash: 'h',
  ...over
})
const TODAY = '2026-09-24'

describe('seriesSummaries', () => {
  const rows = [
    row('2026-09-10 Supervision'),
    row('2026-09-24 Supervision'),
    row('2026-10-01 Supervision'),
    row('2026-11-01 Supervision'),
    row('2026-09-12 Rastle Lab', { series: 'Rastle Lab' }),
    row('2026-06-01 Book Club', { series: 'Book Club' }),
    row('undated', { date: '', series: 'Other' })
  ]
  const by = (name: string): SeriesSummary | undefined =>
    seriesSummaries(rows, TODAY).find((s) => s.series === name)

  it('counts what has happened, and finds the last and the next', () => {
    expect(by('Supervision')).toEqual({
      series: 'Supervision',
      count: 2,
      last: '2026-09-24',
      next: '2026-10-01'
    })
    expect(by('Rastle Lab')).toEqual({
      series: 'Rastle Lab',
      count: 1,
      last: '2026-09-12',
      next: null
    })
  })
  it('lists every fixed series, even with no meetings, then other series found in the files', () => {
    expect(seriesSummaries(rows, TODAY).map((s) => s.series)).toEqual([
      'Supervision',
      'Rastle Lab',
      'Luminos',
      'Other',
      'Book Club'
    ])
    expect(by('Luminos')).toEqual({ series: 'Luminos', count: 0, last: null, next: null })
  })
  it('does not count a planned (undated) meeting as having happened, and gives it no dates', () => {
    const only = seriesSummaries([row('undated', { date: '', series: 'Other' })], TODAY).find(
      (s) => s.series === 'Other'
    )
    expect(only).toEqual({ series: 'Other', count: 0, last: null, next: null })
  })
})

describe('seriesLine', () => {
  const line = (s: Parameters<typeof seriesLine>[0]): string => seriesLine(s, formatShortDate)
  it('reads like the mockup', () => {
    expect(line({ series: 'S', count: 52, last: '2026-09-24', next: '2026-10-01' })).toBe(
      '52 meetings · last Sep 24 · next Oct 1'
    )
    expect(line({ series: 'S', count: 9, last: '2026-09-12', next: null })).toBe(
      '9 meetings · last Sep 12'
    )
    expect(line({ series: 'S', count: 1, last: '2026-06-23', next: null })).toBe(
      '1 meeting · last Jun 23'
    )
  })
  it('handles none and only-upcoming', () => {
    expect(line({ series: 'S', count: 0, last: null, next: null })).toBe('No meetings yet')
    expect(line({ series: 'S', count: 0, last: null, next: '2026-10-01' })).toBe(
      '0 meetings · next Oct 1'
    )
  })
})

describe('recentAndUpcoming', () => {
  const rows = [
    ...['01', '02', '03', '04', '05', '06', '07'].map((d) => row(`2026-08-${d} Other`)),
    ...['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'].map((d) => row(`${d} Supervision`))
  ]
  it('gives the soonest upcoming (limited) and the latest recent (limited), each in its order', () => {
    const { upcoming, recent } = recentAndUpcoming(rows, TODAY)
    expect(upcoming.map((r) => r.date)).toEqual(['2026-10-01', '2026-10-08', '2026-10-15'])
    expect(recent.map((r) => r.date)).toEqual([
      '2026-08-07',
      '2026-08-06',
      '2026-08-05',
      '2026-08-04',
      '2026-08-03'
    ])
  })
  it('is empty for no meetings, and today counts as recent', () => {
    expect(recentAndUpcoming([], TODAY)).toEqual({ upcoming: [], recent: [] })
    expect(recentAndUpcoming([row('2026-09-24 Other')], TODAY).recent).toHaveLength(1)
  })
})
