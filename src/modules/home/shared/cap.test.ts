import { describe, expect, it } from 'vitest'
import { SHOWN_ROWS, capRows } from './cap'

const rows = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

describe('capRows', () => {
  it('shows the first five and counts the rest', () => {
    const { shown, more } = capRows(rows(8))
    expect(SHOWN_ROWS).toBe(5)
    expect(shown).toEqual([0, 1, 2, 3, 4])
    expect(more).toBe(3)
  })

  it('shows everything, with nothing more, at five or fewer', () => {
    expect(capRows(rows(5))).toEqual({ shown: rows(5), more: 0 })
    expect(capRows(rows(2))).toEqual({ shown: rows(2), more: 0 })
    expect(capRows([])).toEqual({ shown: [], more: 0 })
  })

  it('counts top-level rows only: a subtask stays with its task and is not counted', () => {
    const list = ['a', 'a1', 'a2', 'b', 'c', 'd', 'e', 'e1', 'f', 'g']
    const { shown, more } = capRows(list, 0, 5, (r) => r.length > 1)
    expect(shown).toEqual(['a', 'a1', 'a2', 'b', 'c', 'd', 'e', 'e1'])
    expect(more).toBe(2)
  })

  it('adds what the summary already left out', () => {
    expect(capRows(rows(7), 4).more).toBe(6)
    expect(capRows(rows(3), 2)).toEqual({ shown: rows(3), more: 2 })
  })
})
