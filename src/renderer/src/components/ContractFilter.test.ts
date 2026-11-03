// @vitest-environment jsdom
import { act, createElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, type Settings } from '@shared/settings'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { SettingsContext } from '../state/settings-context'
import { resetRememberedScope, useContractFilter } from '../state/use-contract-filter'
import { ContractFilter } from './ContractFilter'
import { click, mount, type Mounted } from './picker-test-utils'

const files: Record<string, TrackingYear> = {
  '2026-10-30': {
    ...emptyYear('2026-10-30', { ...WORK_PLAN, clients: ['Impact'] }),
    name: 'Luminos',
    weeks: 4,
    end: '2026-11-26'
  },
  '2026-09-28': {
    ...emptyYear('2026-09-28', { ...WORK_PLAN, clients: ['Royal Holloway'] }),
    name: 'Royal Holloway',
    weeks: 26,
    end: '2027-03-28'
  }
}
const STARTS = ['2026-10-30', '2026-09-28']

let mounted: Mounted | null = null
beforeEach(() => {
  resetRememberedScope()
  Element.prototype.scrollIntoView = () => {}
  vi.stubGlobal(
    'window',
    Object.assign(window, {
      api: {
        tracking: {
          get: vi.fn((_w: string, y: string) => Promise.resolve(files[y])),
          years: vi.fn(() => Promise.resolve(STARTS)),
          onChanged: () => () => {}
        }
      }
    })
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

const flush = (): Promise<void> => act(async () => void (await Promise.resolve()))

const open = async (): Promise<string[]> => {
  await flush()
  await flush()
  click(document.body.querySelector('button[aria-label="Contract"]')!)
  return [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent ?? '')
}

describe('ContractFilter', () => {
  it('is labelled Contract and offers All contracts, then each contract by name and dates', async () => {
    mounted = mount(
      createElement(ContractFilter, { scope: 'all', starts: STARTS, onChange: vi.fn() })
    )
    expect(document.body.querySelector('span[aria-hidden="true"]')?.textContent).toBe('Contract')
    const options = await open()
    expect(options).toHaveLength(3)
    expect(options[0]).toBe('All contracts')
    expect(options[1]).toMatch(/^Luminos · .*2026 – .*2026$/)
    expect(options[2]).toMatch(/^Royal Holloway · .*2026 – .*2027$/)
  })

  it('reports the contract chosen, and All', async () => {
    const onChange = vi.fn()
    mounted = mount(createElement(ContractFilter, { scope: 'all', starts: STARTS, onChange }))
    await open()
    click(document.body.querySelectorAll('[role="option"]')[2])
    expect(onChange).toHaveBeenCalledWith('2026-09-28')
  })
})

/** The hook as a page uses it, with a settings store that records what is saved. */
function Page({ onScope }: { onScope: (scope: string) => void }): React.JSX.Element {
  const filter = useContractFilter('work')
  onScope(filter.scope)
  return createElement(ContractFilter, {
    scope: filter.scope,
    starts: filter.starts,
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
  const settings: Settings = { ...base, ui: { ...base.ui, moduleState } }
  return mount(
    createElement(
      SettingsContext.Provider,
      { value: { settings, update: save } },
      createElement(MemoryRouter, { initialEntries: [url] }, createElement(Page, { onScope }))
    )
  )
}

describe('the remembered scope', () => {
  it('opens on All contracts when nothing is remembered', async () => {
    const seen: string[] = []
    mounted = render({}, '/work/hours', vi.fn(), (s) => seen.push(s))
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('all')
  })

  it('remembers a choice: saved when the page is left, and read back on the next visit', async () => {
    const save = vi.fn(() => Promise.resolve())
    const seen: string[] = []
    mounted = render({}, '/work/hours', save, (s) => seen.push(s))
    await open()
    click(document.body.querySelectorAll('[role="option"]')[1])
    expect(seen.at(-1)).toBe('2026-10-30')
    mounted.unmount()
    mounted = null
    expect(save).toHaveBeenCalledWith({
      ui: { moduleState: expect.objectContaining({ 'work-contract': { scope: '2026-10-30' } }) }
    })

    const next: string[] = []
    mounted = render({ 'work-contract': { scope: '2026-10-30' } }, '/work/meetings', vi.fn(), (s) =>
      next.push(s)
    )
    await flush()
    await flush()
    expect(next.at(-1)).toBe('2026-10-30')
  })

  it('a remembered contract that no longer exists falls back to All', async () => {
    const seen: string[] = []
    mounted = render({ 'work-contract': { scope: '2020-01-01' } }, '/work/hours', vi.fn(), (s) =>
      seen.push(s)
    )
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('all')
  })

  it('a link with ?year= sets the scope for that visit and does not change what is remembered', async () => {
    const save = vi.fn(() => Promise.resolve())
    const seen: string[] = []
    mounted = render(
      { 'work-contract': { scope: 'all' } },
      '/work/hours?year=2026-09-28',
      save,
      (s) => seen.push(s)
    )
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('2026-09-28')
    mounted.unmount()
    mounted = null
    expect(save).not.toHaveBeenCalled()
  })

  it('a link naming a contract that does not exist is ignored', async () => {
    const seen: string[] = []
    mounted = render(
      { 'work-contract': { scope: '2026-10-30' } },
      '/work/hours?year=1999-01-01',
      vi.fn(),
      (s) => seen.push(s)
    )
    await flush()
    await flush()
    expect(seen.at(-1)).toBe('2026-10-30')
  })
})
