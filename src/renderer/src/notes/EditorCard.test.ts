import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EditorCard } from './EditorCard'

const noon = (y: number, m: number, d: number): number => new Date(y, m - 1, d, 12).getTime()

type Props = Parameters<typeof EditorCard>[0]

function render(props: Omit<Props, 'children'>): string {
  // The child goes as the third argument, as the lint rule wants; the cast is for the required `children` prop.
  return renderToStaticMarkup(
    createElement(EditorCard, props as Props, createElement('div', null, 'editor'))
  )
}

/** The facts line of a card, as text. */
function footer(props: Omit<Props, 'children'>): string {
  const html = render(props)
  const match = /<p[^>]*>(.*?)<\/p>/.exec(html)
  if (!match) throw new Error('no facts line')
  return match[1]
}

describe('EditorCard', () => {
  it('shows created, edited and the word count, in that order', () => {
    expect(
      footer({ text: 'one two three', created: '2026-03-04', edited: noon(2026, 9, 25) })
    ).toBe('Created Mar 4, 2026 · Edited Sep 25, 2026 · 3 words')
  })

  it('leaves Created out for notes that do not record it', () => {
    expect(footer({ text: 'one', edited: noon(2026, 9, 25) })).toBe('Edited Sep 25, 2026 · 1 word')
  })

  it('leaves Edited out until it is known, and still says 0 words for an empty note', () => {
    expect(footer({ text: '', edited: null })).toBe('0 words')
  })

  it('puts the editor above the facts line', () => {
    const html = render({ text: '', edited: null })
    expect(html.indexOf('editor')).toBeLessThan(html.indexOf('0 words'))
  })
})
