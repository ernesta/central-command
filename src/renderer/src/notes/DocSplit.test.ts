import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DocSplit } from './DocSplit'
import styles from './DocSplit.module.css'

const doc = createElement('div', null, 'the note')

const render = (props: Omit<Parameters<typeof DocSplit>[0], 'children'>): string =>
  renderToStaticMarkup(createElement(DocSplit, props as Parameters<typeof DocSplit>[0], doc))

describe('DocSplit', () => {
  it('puts the panels in a column beside the document', () => {
    const html = render({ side: createElement('aside', null, 'Outline') })
    expect(html).toContain('the note')
    expect(html).toContain('Outline')
    expect(html).toContain(styles.hasSide)
    expect(html).toContain(styles.side)
  })

  it('keeps the page to one column when there are no panels', () => {
    const html = render({})
    expect(html).not.toContain(styles.hasSide)
    expect(html).not.toContain(styles.side)
  })

  // A note is capped at a readable line length; the training plan asks for the room it has.
  it('caps the document unless the page asks for the full width', () => {
    expect(render({})).not.toContain(styles.wide)
    expect(render({ fullWidth: true })).toContain(styles.wide)
  })

  it('only makes room for two columns of panels when asked', () => {
    expect(render({ side: doc })).not.toContain(styles.roomy)
    expect(render({ side: doc, roomySide: true })).toContain(styles.roomy)
  })
})
