import { describe, expect, it } from 'vitest'
import { MAX_PINNED, canPin, pinnedNotes } from './pinning'
import type { NoteIndexRow } from './types'

const note = (id: string, pinned: boolean, edited = 1): NoteIndexRow => ({
  workspace: 'research',
  id,
  title: id,
  group: '',
  subgroup: '',
  pinned,
  created: '',
  edited,
  firstLine: '',
  excerpt: '',
  problems: [],
  contentHash: 'h'
})

describe('pinning', () => {
  const four = ['a', 'b', 'c', 'd'].map((id) => note(id, true))

  it('allows up to four pinned notes', () => {
    expect(MAX_PINNED).toBe(4)
    expect(canPin([...four.slice(0, 3), note('e', false)], 'e')).toBe(true)
    expect(canPin([...four, note('e', false)], 'e')).toBe(false)
  })

  it('always lets a pinned note stay pinned', () => {
    expect(canPin(four, 'a')).toBe(true)
  })

  it('shows the four most recently edited when a hand-edited file makes five', () => {
    const rows = [
      ...four.map((n, i) => ({ ...n, edited: 10 + i })),
      note('e', true, 1),
      note('f', false, 99)
    ]
    expect(pinnedNotes(rows).map((n) => n.id)).toEqual(['d', 'c', 'b', 'a'])
  })
})
