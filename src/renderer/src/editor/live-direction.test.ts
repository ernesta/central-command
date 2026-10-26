import { describe, expect, it } from 'vitest'
import { lineDirections } from './live-direction'
import { stateFor } from './live-test-utils'

function directions(doc: string): string[] {
  const state = stateFor(doc)
  const found = lineDirections(state, [{ from: 0, to: state.doc.length }])
  return [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, dir]) => dir)
}

describe('the direction of a line', () => {
  it('follows the first letter of the line, markers and digits aside', () => {
    expect(directions('Hello\nسلام\n## سلام\n- [ ] سلام\n1. سلام\n> Hello')).toEqual([
      'ltr',
      'rtl',
      'rtl',
      'rtl',
      'rtl',
      'ltr'
    ])
  })

  it('keeps a line with no letters left to right', () => {
    expect(directions('\n---\n12')).toEqual(['ltr', 'ltr', 'ltr'])
  })

  it('gives every row of a table the direction of its header', () => {
    expect(directions('| Hello | سلام |\n| --- | --- |\n| وعليكم | Hi |')).toEqual([
      'ltr',
      'ltr',
      'ltr'
    ])
    expect(directions('| سلام | Hello |\n| --- | --- |\n| Hi | وعليكم |')).toEqual([
      'rtl',
      'rtl',
      'rtl'
    ])
  })
})
