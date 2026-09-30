// @vitest-environment jsdom
import { redo, undo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { createLiveState, lineSeparatorFor } from './live-state'

function open(doc: string): { view: EditorView; reports: string[] } {
  const reports: string[] = []
  const view = new EditorView({
    parent: document.body.appendChild(document.createElement('div')),
    state: createLiveState({
      doc,
      label: 'test',
      onChange: (text) => reports.push(text),
      openLink: () => undefined
    })
  })
  return { view, reports }
}

// jsdom cannot measure text; CodeMirror only asks when it draws.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()

describe('the live editor state', () => {
  it('holds the file text exactly, and opening it reports nothing', () => {
    const doc = '# Title\n\n*  odd bullet\n\ttab\ttext  \n\n\n**x**\\\nend\n'
    const { view, reports } = open(doc)
    expect(view.state.sliceDoc()).toBe(doc)
    expect(reports).toEqual([])
  })

  it('reports the full text synchronously on every edit, and only edits', () => {
    const { view, reports } = open('one\ntwo')
    view.dispatch({ changes: { from: 3, insert: '!' } })
    expect(reports).toEqual(['one!\ntwo'])
    view.dispatch({ selection: { anchor: 0 } })
    expect(reports).toHaveLength(1)
    view.dispatch({ changes: { from: 0, insert: '# ' } })
    expect(reports[1]).toBe('# one!\ntwo')
  })

  it('undoes and redoes as plain text, reporting each step', () => {
    const { view, reports } = open('text')
    view.dispatch({ changes: { from: 4, insert: ' more' }, userEvent: 'input.type' })
    expect(undo(view)).toBe(true)
    expect(view.state.sliceDoc()).toBe('text')
    expect(redo(view)).toBe(true)
    expect(reports.at(-1)).toBe('text more')
  })

  it('keeps Windows line breaks, and a lone carriage return, as they were', () => {
    expect(lineSeparatorFor('a\r\nb')).toBe('\r\n')
    for (const doc of ['a\r\nb\r\n', 'a\rb', 'a\nb\r\nc']) {
      const { view, reports } = open(doc)
      expect(view.state.sliceDoc()).toBe(doc)
      view.dispatch({ changes: { from: 0, insert: 'X' } })
      expect(reports[0]).toBe(`X${doc}`)
    }
  })
})
