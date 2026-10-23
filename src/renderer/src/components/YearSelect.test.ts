// @vitest-environment jsdom
import { createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LandingSection } from './Landing'
import { mount, type Mounted } from './picker-test-utils'
import { YearSelect } from './YearSelect'

let mounted: Mounted | null = null
beforeEach(() => {
  // The select reads the years' files only for a workspace with contracts; it still subscribes.
  vi.stubGlobal(
    'window',
    Object.assign(window, { api: { tracking: { get: vi.fn(), onChanged: () => () => {} } } })
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

const select = (): React.JSX.Element =>
  createElement(YearSelect, { year: '2026-10-05', years: ['2026-10-05'], onChange: vi.fn() })

describe('YearSelect', () => {
  it('shows its label directly before the dropdown', () => {
    mounted = mount(select())
    const label = document.body.querySelector('span[aria-hidden="true"]')!
    expect(label.textContent).toBe('Year')
    expect(label.nextElementSibling?.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Year'
    )
  })

  it('a landing section with a hidden label starts with the select and keeps the heading for screen readers', () => {
    mounted = mount(
      createElement(
        LandingSection,
        { id: 'year', label: 'Year', labelHidden: true, aside: select() } as ComponentProps<
          typeof LandingSection
        >,
        createElement('p', null, 'body')
      )
    )
    const head = document.body.querySelector('section > div')!
    expect(head.querySelector('h2')?.textContent).toBe('Year')
    expect(head.querySelector('h2')?.className).toContain('hidden')
    expect(head.className).toContain('headStart')
  })
})
