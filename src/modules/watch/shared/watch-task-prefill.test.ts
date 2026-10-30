import { describe, expect, it } from 'vitest'
import type { WatchItem } from './types'
import { SUMMARY_LIMIT, watchTaskPrefill } from './watch-task-prefill'

const item = (over: Partial<WatchItem> = {}): WatchItem => ({
  id: 12,
  sourceId: 1,
  workspace: 'research',
  sourceTitle: 'Source',
  section: 'opportunity',
  manual: false,
  title: 'BOLD Science Communication Fellowship',
  url: 'https://ex.org/bold',
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
  firstSeenAt: '2026-10-01T00:00:00.000Z',
  readAt: null,
  ...over
})

describe('watchTaskPrefill', () => {
  it('takes the title as the page shows it, and the item and its address for the link', () => {
    const p = watchTaskPrefill(item({ title: 'Confs: Summer Meeting.' }))
    expect(p.title).toBe('Summer Meeting')
    expect(p.watchItem).toEqual({ id: 12, url: 'https://ex.org/bold' })
  })

  it('is due on the deadline, else the start date, else on no date', () => {
    expect(watchTaskPrefill(item({ deadline: '2026-10-31', eventDate: '2026-12-01' })).due).toBe(
      '2026-10-31'
    )
    expect(watchTaskPrefill(item({ eventDate: '2026-12-01' })).due).toBe('2026-12-01')
    expect(watchTaskPrefill(item()).due).toBeNull()
  })

  it('gives a past date as it is', () => {
    expect(watchTaskPrefill(item({ deadline: '2020-01-01' })).due).toBe('2020-01-01')
  })

  it("takes the item's workspace", () => {
    expect(watchTaskPrefill(item({ workspace: 'life' })).workspace).toBe('life')
    expect(watchTaskPrefill(item()).workspace).toBe('research')
  })

  it('describes with the address, then the summary', () => {
    expect(watchTaskPrefill(item({ summary: 'Apply  by\n 31 Oct.' })).description).toBe(
      'https://ex.org/bold\n\nApply by 31 Oct.'
    )
    expect(watchTaskPrefill(item()).description).toBe('https://ex.org/bold')
  })

  it('cuts a long summary at a word', () => {
    const long = 'word '.repeat(200)
    const d = watchTaskPrefill(item({ summary: long })).description
    const summary = d.slice('https://ex.org/bold\n\n'.length)
    expect(summary.endsWith('word…')).toBe(true)
    expect(summary.length).toBeLessThanOrEqual(SUMMARY_LIMIT + 1)
  })
})
