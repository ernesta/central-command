// @vitest-environment jsdom
import { act, createElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, type Settings } from '@shared/settings'
import { SettingsContext } from '../state/settings-context'
import { resetRememberedYear, useYearFilter } from '../state/use-year-filter'
import { YearFilter } from './YearFilter'
import { click, mount, type Mounted } from './picker-test-utils'

const STARTS = ['2024-09-23', '2025-09-22', '2026-09-21']
// Today is in 2026–27, so 2027–28 is the next year offered.
const NEWEST_FIRST = ['2027-09-20', '2026-09-21', '2025-09-22', '2024-09-23']

let mounted: Mounted | null = null
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-03T12:00:00'))
  resetRememberedYear()
  Element.prototype.scrollIntoView = () => {}
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: { tracking: { years: vi.fn(() => Promise.resolve([])), onChanged: () => () => {} } }
    })
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

const flush = (): Promise<void> => act(async () => void (await Promise.resolve()))

const open = async (): Promise<string[]> => {
  await flush()
  await flush()
  click(document.body.querySelector('button[aria-label="Academic year"]')!)
  return [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '')
}

describe('YearFilter', () => {
  it('is named Academic year for assistive tech, shows no label of its own, and offers All years, then each year newest first', async () => {
    mounted = mount(
      createElement(YearFilter, { scope: 'all', years: NEWEST_FIRST, onChange: vi.fn() })
    )
    expect(document.body.querySelector('button[aria-label="Academic year"]')).not.toBeNull()
    expect(document.body.textContent).not.toMatch(/Academic year|Year /)
    const options = await open()
    expect(options).toEqual(['All years', '2027–28', '2026–27', '2025–26', '2024–25'])
  })

  it('reports the year chosen, and All', async () => {
    const onChange = vi.fn()
    mounted = mount(
      createElement(YearFilter, { scope: '2026-09-21', years: NEWEST_FIRST, onChange })
    )
    await open()
    click(document.body.querySelectorAll('[role="option"]')[3])
    expect(onChange).toHaveBeenCalledWith('2025-09-22')
    click(document.body.querySelector('button[aria-label="Academic year"]')!)
    click(document.body.querySelectorAll('[role="option"]')[0])
    expect(onChange).toHaveBeenCalledWith('all')
  })
})

/** The hook as a page uses it, with a settings store that records what is saved. */
function Page({ onScope }: { onScope: (scope: string) => void }): React.JSX.Element {
  const filter = useYearFilter('research')
  onScope(filter.scope)
  return createElement(YearFilter, {
    scope: filter.scope,
    years: filter.years,
    onChange: filter.setScope
  })
}

function render(
  moduleState: Record<string, unknown>,
  url: string,
  save: (patch: unknown) => Promise<void>,
  onScope: (scope: string) => void
): Mounted {
  const base = defaultSettings('/z.bib')
  const settings: Settings = { ...base, yearStarts: STARTS, ui: { ...base.ui, moduleState } }
  return mount(
    createElement(
      SettingsContext.Provider,
      { value: { settings, update: save } },
      createElement(MemoryRouter, { initialEntries: [url] }, createElement(Page, { onScope }))
    )
  )
}

describe('the remembered year', () => {
  it('opens on All years when nothing is remembered', async () => {
    const seen: string[] = []
    mounted = render({}, '/research/hours', vi.fn(), (s) => seen.push(s))
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('all')
  })

  it('remembers a choice: saved at once, and read back on the next visit', async () => {
    const save = vi.fn(() => Promise.resolve())
    const seen: string[] = []
    mounted = render({}, '/research/hours', save, (s) => seen.push(s))
    await open()
    click(document.body.querySelectorAll('[role="option"]')[3])
    expect(seen.at(-1)).toBe('2025-09-22')
    mounted.unmount()
    mounted = null
    expect(save).toHaveBeenCalledWith({
      ui: { moduleState: expect.objectContaining({ 'research-year': { scope: '2025-09-22' } }) }
    })

    resetRememberedYear()
    const next: string[] = []
    mounted = render(
      { 'research-year': { scope: '2025-09-22' } },
      '/research/meetings',
      vi.fn(),
      (s) => next.push(s)
    )
    await flush()
    await flush()
    expect(next.at(-1)).toBe('2025-09-22')
  })

  it('a remembered year that no longer exists falls back to All years', async () => {
    const seen: string[] = []
    mounted = render(
      { 'research-year': { scope: '2019-09-23' } },
      '/research/hours',
      vi.fn(),
      (s) => seen.push(s)
    )
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('all')
  })

  it('a link with ?year= sets the scope for that visit and does not change what is remembered', async () => {
    const save = vi.fn(() => Promise.resolve())
    const seen: string[] = []
    mounted = render(
      { 'research-year': { scope: 'all' } },
      '/research/hours?year=2025-09-22',
      save,
      (s) => seen.push(s)
    )
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('2025-09-22')
    mounted.unmount()
    mounted = null
    expect(save).not.toHaveBeenCalled()
  })

  it('?year=all works too, over a remembered year', async () => {
    const seen: string[] = []
    mounted = render(
      { 'research-year': { scope: '2025-09-22' } },
      '/research/hours?year=all',
      vi.fn(),
      (s) => seen.push(s)
    )
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('all')
  })

  it('a link naming a year that does not exist is ignored', async () => {
    const seen: string[] = []
    mounted = render(
      { 'research-year': { scope: '2025-09-22' } },
      '/research/hours?year=1999-01-01',
      vi.fn(),
      (s) => seen.push(s)
    )
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('2025-09-22')
  })
})
