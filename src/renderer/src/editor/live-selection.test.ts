import { EditorSelection } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { stateFor } from './live-test-utils'

const doc = '## One\ntext\n## Two\nmore\n'

describe('a selection that reaches the next heading', () => {
  it('ends at the start of the line, not after the hidden marker', () => {
    const state = stateFor(doc, 3, 3)
    const after = state.update({ selection: EditorSelection.single(3, 15) }).state
    expect(after.selection.main.from).toBe(3)
    expect(after.selection.main.to).toBe(12)
  })

  it('snaps a backwards selection too', () => {
    const state = stateFor(doc)
    const after = state.update({ selection: EditorSelection.single(15, 3) }).state
    expect(after.selection.main.anchor).toBe(12)
    expect(after.selection.main.head).toBe(3)
  })

  it('leaves a selection that starts inside the heading alone', () => {
    const after = stateFor(doc).update({ selection: EditorSelection.single(12, 15) }).state
    expect([after.selection.main.from, after.selection.main.to]).toEqual([12, 15])
  })

  it('leaves a selection that ends inside the heading text alone', () => {
    const after = stateFor(doc).update({ selection: EditorSelection.single(3, 16) }).state
    expect(after.selection.main.to).toBe(16)
  })
})

describe('a selection that reaches a line opening with hidden span markers', () => {
  const bold = 'one\n\n**Two** here\n'
  it('ends at the start of the line, not after the hidden **', () => {
    const after = stateFor(bold, 0, 0).update({ selection: EditorSelection.single(0, 7) }).state
    expect(after.selection.main.to).toBe(5)
  })
  it('snaps after a list bullet and an italic marker too', () => {
    const doc2 = 'one\n- *Two* here\n'
    const after = stateFor(doc2, 0, 0).update({ selection: EditorSelection.single(0, 7) }).state
    expect(after.selection.main.to).toBe(4)
  })
  it('leaves a selection that starts inside the line alone', () => {
    const after = stateFor(bold).update({ selection: EditorSelection.single(5, 7) }).state
    expect([after.selection.main.from, after.selection.main.to]).toEqual([5, 7])
  })
  it('leaves a selection that ends past the markers, inside the text, alone', () => {
    const after = stateFor(bold, 0, 0).update({ selection: EditorSelection.single(0, 9) }).state
    expect(after.selection.main.to).toBe(9)
  })
})
