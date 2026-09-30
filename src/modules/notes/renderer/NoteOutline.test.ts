// @vitest-environment jsdom
import { createElement, createRef } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openView } from '@renderer/editor/live-key-utils'
import { NoteOutline } from './NoteOutline'

let host: HTMLElement
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => host.remove())

function render(text: string, doc: HTMLElement): void {
  const docRef = createRef<HTMLElement>()
  Object.defineProperty(docRef, 'current', { value: doc, writable: true })
  flushSync(() => createRoot(host).render(createElement(NoteOutline, { text, docRef })))
}

describe('NoteOutline', () => {
  it('says headings will appear, for a note with none', () => {
    render('Just a paragraph.', document.createElement('div'))
    expect(host.textContent).toContain('Headings you write appear here.')
    expect(host.querySelectorAll('button')).toHaveLength(0)
  })

  it('lists the headings, in order, as buttons', () => {
    render('# Title\n\n## Methods\n\n### Participants\n', document.createElement('div'))
    expect([...host.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Title',
      'Methods',
      'Participants'
    ])
  })

  it('scrolls to the matching heading in the editor when clicked', () => {
    const doc = document.createElement('div')
    doc.innerHTML =
      '<div class="ProseMirror"><h2>Intro</h2><h2>Methods</h2><h3>Participants</h3></div>'
    const methods = doc.querySelectorAll('h2')[1]
    const scrolled: Element[] = []
    for (const h of doc.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      ;(h as HTMLElement).scrollIntoView = () => scrolled.push(h)
    }
    render('## Intro\n\n## Methods\n\n### Participants\n', doc)
    const button = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Methods')!
    flushSync(() => button.click())
    expect(scrolled).toEqual([methods])
  })

  it('does not confuse a heading with the same text at a different level', () => {
    const doc = document.createElement('div')
    doc.innerHTML = '<div class="ProseMirror"><h2>Notes</h2><h3>Notes</h3></div>'
    const h3 = doc.querySelectorAll('h3')[0]
    const scrolled: Element[] = []
    ;(h3 as HTMLElement).scrollIntoView = () => scrolled.push(h3)
    ;(doc.querySelector('h2') as HTMLElement).scrollIntoView = vi.fn()
    render('## Notes\n\n### Notes\n', doc)
    const [, sub] = [...host.querySelectorAll('button')]
    flushSync(() => sub.click())
    expect(scrolled).toEqual([h3])
  })
})

describe('NoteOutline with the live editor', () => {
  it('sends the editor to the heading’s line when clicked, even one far from the screen', () => {
    const text = '# Title\n\n' + 'text\n\n'.repeat(200) + '## Methods\n\n### Participants\n'
    const { view } = openView(text)
    const scrolled: number[] = []
    const dispatch = view.dispatch.bind(view)
    view.dispatch = ((...args: Parameters<typeof view.dispatch>) => {
      const effect = (args[0] as { effects?: { value?: { range?: { from: number } } } }).effects
      if (effect?.value?.range) scrolled.push(effect.value.range.from)
      return dispatch(...args)
    }) as typeof view.dispatch
    const doc = view.dom.parentElement!.parentElement as HTMLElement
    render(text, doc)
    const methods = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Methods')!
    flushSync(() => methods.click())
    expect(scrolled).toEqual([text.indexOf('## Methods')])
    const participants = [...host.querySelectorAll('button')].find(
      (b) => b.textContent === 'Participants'
    )!
    flushSync(() => participants.click())
    expect(scrolled.at(-1)).toBe(text.indexOf('### Participants'))
  })

  it('does nothing when the text has moved on and that line is no longer a heading', () => {
    const { view } = openView('# Title\n\n## Methods')
    const doc = view.dom.parentElement!.parentElement as HTMLElement
    render('# Title\n\n## Methods', doc)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: 'plain\n\nplain\n\nplain' }
    })
    const spy = vi.spyOn(view, 'dispatch')
    flushSync(() =>
      [...host.querySelectorAll('button')].find((b) => b.textContent === 'Methods')!.click()
    )
    expect(spy).not.toHaveBeenCalled()
  })
})
