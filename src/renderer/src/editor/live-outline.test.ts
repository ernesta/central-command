// @vitest-environment jsdom
import { EditorView } from '@codemirror/view'
import { describe, expect, it, vi } from 'vitest'
import { headingStart, liveViewIn, placeCursorOnLine, scrollToPos } from './live-outline'
import { openView, show } from './live-key-utils'

const NOTE = '# One\n\ntext\n\n## Two\n\n```\n## not a heading\n```\n\n### Three'

/** The position the last scroll effect was sent to. */
function scrollTarget(spy: ReturnType<typeof vi.spyOn>): number {
  const effects = (
    spy.mock.calls.at(-1)?.[0] as { effects: { value: { range: { from: number } } } }
  ).effects
  return effects.value.range.from
}

describe('finding the live editor', () => {
  it('finds the view from an element around it, and nothing in an element without one', () => {
    const { view } = openView(NOTE)
    const around = view.dom.parentElement!.parentElement as HTMLElement
    expect(liveViewIn(around)).toBe(view)
    expect(liveViewIn(document.createElement('div'))).toBeNull()
    expect(liveViewIn(null)).toBeNull()
  })
})

describe('the start of an outline heading', () => {
  it('is the start of that line, when it is still a heading', () => {
    const { view } = openView(NOTE)
    expect(headingStart(view.state, 0)).toBe(0)
    expect(headingStart(view.state, 4)).toBe(NOTE.indexOf('## Two'))
    expect(headingStart(view.state, 10)).toBe(NOTE.indexOf('### Three'))
  })
  it('is null once the line has changed or is not there, so a click never lands somewhere else', () => {
    const { view } = openView(NOTE)
    expect(headingStart(view.state, 2)).toBeNull()
    expect(headingStart(view.state, 99)).toBeNull()
    expect(headingStart(view.state, -1)).toBeNull()
    view.dispatch({ changes: { from: 0, insert: 'x' } })
    expect(headingStart(view.state, 0)).toBeNull()
  })
  it('counts lines the way the outline does in a CRLF note', () => {
    const { view } = openView('a\r\n\r\n## B')
    expect(headingStart(view.state, 2)).toBe(view.state.doc.line(3).from)
  })
})

describe('scrolling to a heading', () => {
  it('sends the view to the position and leaves the cursor alone', () => {
    const { view } = openView('# One|\n\n## Two')
    const spy = vi.spyOn(view, 'dispatch')
    scrollToPos(view, 8)
    expect(scrollTarget(spy)).toBe(8)
    expect(show(view)).toBe('# One|\n\n## Two')
    expect(EditorView.findFromDOM(view.dom)).toBe(view)
  })
  it('puts the cursor at the end of the heading line for a topic clicked in the side panel', () => {
    const { view } = openView('# One\n\n## Two words\n\ntext')
    const spy = vi.spyOn(view, 'dispatch')
    placeCursorOnLine(view, 7)
    expect(show(view)).toBe('# One\n\n## Two words|\n\ntext')
    expect(scrollTarget(spy)).toBe(7)
  })
})
