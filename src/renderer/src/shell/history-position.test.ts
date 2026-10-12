import { describe, expect, it } from 'vitest'
import { advance, type HistoryPosition } from './history-position'

const start: HistoryPosition = { keys: ['a'], index: 0 }

describe('advance', () => {
  it('has nothing to go back to at the start, even after the start-up redirect replaces the entry', () => {
    expect(advance(start, 'REPLACE', 'b')).toEqual({ keys: ['b'], index: 0 })
  })

  it('moves forward on push and back on pop', () => {
    const two = advance(start, 'PUSH', 'b')
    expect(two).toEqual({ keys: ['a', 'b'], index: 1 })
    expect(advance(two, 'POP', 'a').index).toBe(0)
  })

  it('forgets the pages ahead when a push follows going back', () => {
    const back = advance(advance(start, 'PUSH', 'b'), 'POP', 'a')
    expect(advance(back, 'PUSH', 'c')).toEqual({ keys: ['a', 'c'], index: 1 })
  })

  it('keeps the position for a pop to a key it does not know', () => {
    expect(advance(start, 'POP', 'zzz')).toBe(start)
  })
})
