import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SidePanel } from './SidePanel'

const render = (props: Parameters<typeof SidePanel>[0]): string =>
  renderToStaticMarkup(createElement(SidePanel, props))

describe('SidePanel', () => {
  it('names the panel for the eye and for assistive tech', () => {
    const html = render({ label: 'Mentioned in', children: createElement('p', null, 'a note') })
    expect(html).toContain('aria-label="Mentioned in"')
    expect(html).toMatch(/<h2[^>]*>Mentioned in<\/h2>/)
    expect(html).toContain('a note')
  })

  it('shows a fuller heading while keeping the plain label as the name', () => {
    const html = render({ label: 'Topics', heading: 'Topics · 1 of 3 discussed' })
    expect(html).toContain('aria-label="Topics"')
    expect(html).toContain('Topics · 1 of 3 discussed')
  })

  it('is a section unless the panel is a way around the page', () => {
    expect(render({ label: 'Files' }).startsWith('<section')).toBe(true)
    expect(render({ label: 'Outline', as: 'nav' }).startsWith('<nav')).toBe(true)
    expect(render({ label: 'Topics', as: 'aside' }).startsWith('<aside')).toBe(true)
  })

  it('leaves out the actions row when there are no actions', () => {
    const bare = render({ label: 'Outline' })
    const acting = render({ label: 'Files', actions: createElement('button', null, 'Link') })
    expect(bare.match(/<div/g)?.length).toBe(1) // the heading row only
    expect(acting).toContain('<button>Link</button>')
    expect(acting.match(/<div/g)?.length).toBe(2)
  })
})
