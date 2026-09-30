// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { openView, show } from './live-key-utils'
import { pasteText } from './live-paste'

function pasted(before: string, text: string, trusted = true): string {
  const { view } = openView(before)
  pasteText(view, text, trusted)
  return show(view)
}

/** A paste event as the browser sends it, carrying the given flavours of the clipboard. */
function pasteEvent(flavours: Record<string, string>): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => flavours[type] ?? '' }
  })
  return event
}

describe('paste', () => {
  it('inserts the text as it is, in place of the selection', () => {
    expect(pasted('a |b| c', 'X')).toBe('a X| c')
    expect(pasted('a| c', '**not** *rich*\nsecond')).toBe('a**not** *rich*\nsecond| c')
  })

  it('turns Windows and old Mac line ends into the ones the note uses', () => {
    const { view } = openView('|')
    pasteText(view, 'one\r\ntwo\rthree', true)
    expect(view.state.sliceDoc()).toBe('one\ntwo\nthree')
  })

  it('uses a Windows note’s own line ends for pasted lines', () => {
    // (Positions count a line end once, so the cursor is put at the end by hand.)
    const { view } = openView('a\r\nb')
    view.dispatch({ selection: { anchor: view.state.doc.length } })
    pasteText(view, 'x\ny', true)
    expect(view.state.sliceDoc()).toBe('a\r\nbx\r\ny')
  })

  it('makes selected text a link when a web address is pasted over it', () => {
    expect(pasted('see |the docs| now', 'https://example.org/docs')).toBe(
      'see [the docs](https://example.org/docs)| now'
    )
    expect(pasted('|site|', 'www.example.org')).toBe('[site](https://www.example.org)|')
    expect(pasted('|mail|', 'mailto:a@b.org')).toBe('[mail](mailto:a@b.org)|')
  })

  it('escapes brackets in the text that would end the label early', () => {
    expect(pasted('|a] b|', 'https://x.org')).toBe('[a\\] b](https://x.org)|')
    expect(pasted('|a [b] c|', 'https://x.org')).toBe('[a [b] c](https://x.org)|')
  })

  it('inserts a web address as text when nothing is selected, or the selection spans lines', () => {
    expect(pasted('a |', 'https://x.org')).toBe('a https://x.org|')
    expect(pasted('|a\nb|', 'https://x.org')).toBe('https://x.org|')
  })

  it('does not link a made-up paste (Cmd-Shift-V is plain on purpose)', () => {
    expect(pasted('|word|', 'https://x.org', false)).toBe('https://x.org|')
  })

  it('does not link anything that is more than an address', () => {
    expect(pasted('|word|', 'https://x.org and more')).toBe('https://x.org and more|')
  })

  it('is one undo step and reports the change', () => {
    const { view, reports } = openView('|a|')
    pasteText(view, 'https://x.org', true)
    expect(reports).toEqual(['[a](https://x.org)'])
  })
})

describe('the paste event', () => {
  it('takes the text flavour only, so pasting from Word or a web page leaves the formatting behind', () => {
    const { view } = openView('a|')
    const event = pasteEvent({ 'text/html': '<b>bold</b>', 'text/plain': ' plain' })
    view.contentDOM.dispatchEvent(event)
    expect(view.state.sliceDoc()).toBe('a plain')
    expect(event.defaultPrevented).toBe(true)
  })

  it('a made-up paste event (Cmd-Shift-V) puts a web address in as text, even over a selection', () => {
    const { view } = openView('pick |this|')
    view.contentDOM.dispatchEvent(pasteEvent({ 'text/plain': 'https://x.org' }))
    expect(view.state.sliceDoc()).toBe('pick https://x.org')
  })

  it('pastes nothing, and keeps the browser from pasting formatted content, when there is no text', () => {
    const { view } = openView('a|')
    const event = pasteEvent({ 'text/html': '<b>bold</b>' })
    view.contentDOM.dispatchEvent(event)
    expect(view.state.sliceDoc()).toBe('a')
    expect(event.defaultPrevented).toBe(true)
  })
})
