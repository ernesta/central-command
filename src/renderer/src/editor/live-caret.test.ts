import { describe, expect, it } from 'vitest'
import { stateFor } from './live-test-utils'
import { liveCaret } from './live-caret'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/** Whether the caret anchor is drawn with the cursor at `at` in `doc`. */
function anchored(doc: string, at: number): boolean {
  const base = stateFor(doc, at)
  const state = EditorState.create({
    doc: base.doc,
    selection: base.selection,
    extensions: [liveCaret]
  })
  const sources = state.facet(EditorView.decorations)
  return sources.some((source) => {
    const set = typeof source === 'function' ? null : source
    if (!set) return false
    let found = false
    set.between(0, state.doc.length, () => {
      found = true
    })
    return found
  })
}

describe('the caret anchor', () => {
  it('is drawn on an empty bullet, number, task or quote line, with the cursor at its end', () => {
    for (const line of ['- ', '1. ', '- [ ] ', '> ', '  - ']) {
      const doc = `a\n${line}`
      expect(anchored(doc, doc.length), JSON.stringify(line)).toBe(true)
    }
  })

  it('is not drawn on text, a blank line, a heading, or a selection', () => {
    expect(anchored('a\n- b', 5)).toBe(false)
    expect(anchored('a\n\nb', 2)).toBe(false)
    expect(anchored('a\n## ', 5)).toBe(false)
    expect(anchored('a\n- b', 2)).toBe(false)
  })
})
