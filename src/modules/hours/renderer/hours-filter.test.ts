// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { resetRememberedScope } from '@renderer/state/use-contract-filter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { openContracts } from '@shared/tracking/contracts'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import { HoursPage } from './HoursPage'

// Two overlapping contracts on 3 Nov 2026: Luminos (a client worked today) and Royal Holloway (none).
const luminos: TrackingYear = {
  ...emptyYear('2026-10-30', {
    ...WORK_PLAN,
    hoursPerWeek: 480,
    clients: ['Impact', 'Teaching']
  }),
  name: 'Luminos',
  weeks: 4,
  end: '2026-11-26',
  adjusts: [
    { id: 'a', date: '2026-11-03', label: 'Proposal', minutes: 180, client: 'Impact' },
    { id: 'b', date: '2026-11-02', label: 'Notes', minutes: 60, client: 'Teaching' }
  ]
}
const holloway: TrackingYear = {
  ...emptyYear('2026-09-28', { ...WORK_PLAN, hoursPerWeek: 0, clients: ['Royal Holloway'] }),
  name: 'Royal Holloway',
  weeks: 26,
  end: '2027-03-28',
  invoice: 'week'
}
const files: Record<string, TrackingYear> = { '2026-10-30': luminos, '2026-09-28': holloway }

let host: HTMLElement
let root: Root
beforeEach(() => {
  resetRememberedScope()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 12, 0, 0))
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    }
  )
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 900 } as DOMRect)
  // Whatever the page asks for gets an empty answer; the tracking files are real.
  const stub = (overrides: Record<string, unknown>): object =>
    new Proxy(overrides, {
      get: (target, key: string) =>
        key in target
          ? target[key]
          : key.startsWith('on')
            ? () => () => {}
            : () => Promise.resolve([])
    })
  ;(window as unknown as { api: unknown }).api = new Proxy(
    {
      tracking: stub({
        years: () => Promise.resolve(['2026-10-30', '2026-09-28']),
        get: (_w: string, y: string) => Promise.resolve(files[y]),
        running: () => Promise.resolve(null),
        openContracts: () => Promise.resolve(openContracts([luminos, holloway], '2026-11-03'))
      }),
      tasks: stub({ clients: () => Promise.resolve(['Impact', 'Teaching', 'Royal Holloway']) })
    } as Record<string, unknown>,
    { get: (target, key: string) => target[key] ?? stub({}) }
  )
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await act(async () => void (await Promise.resolve()))
}

async function show(scope: string | null, url = '/work/hours'): Promise<string> {
  const base = defaultSettings('/z.bib')
  const settings = {
    ...base,
    ui: { ...base.ui, moduleState: scope ? { 'work-contract': { scope } } : {} }
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() =>
    root.render(
      createElement(
        SettingsContext.Provider,
        { value: { settings, update: () => Promise.resolve() } },
        createElement(MemoryRouter, { initialEntries: [url] }, createElement(HoursPage))
      )
    )
  )
  await flush()
  return host.textContent ?? ''
}

const ariaLabels = (): string[] =>
  [...host.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label') ?? '')

describe('the Hours page under All contracts', () => {
  it('is the default, and shows only Today and Week', async () => {
    await show(null)
    expect(ariaLabels()).toEqual(['Today', 'Patterns', 'Week'])
  })

  it('adds the day worked on a contract that is not the one the page used to show', async () => {
    const text = await show('all')
    // 3:00 for Luminos; Royal Holloway, the contract the page used to open on, has none today.
    const today = host.querySelector('section[aria-label="Today"]')!.textContent ?? ''
    expect(today).toContain('3:00')
    expect(today).toContain('Luminos')
    expect(today).toContain('Impact')
    expect(today).toContain('Royal Holloway')
    expect(text).not.toContain('Contract')
  })

  it('the week adds the contracts, Monday to Sunday', async () => {
    await show('all')
    const week = host.querySelector('section[aria-label="Week"]')!.textContent ?? ''
    expect(week).toContain('4:00')
    expect(week).toContain('Teaching')
  })

  it('has no aim, balance, invoice or export, and has the charts', async () => {
    const text = await show('all')
    for (const word of ['Balance', 'balance', 'Invoice', 'Export', 'to go', 'Add', 'Start', ' of '])
      expect(text).not.toContain(word)
    expect(host.querySelectorAll('button[aria-label="Start"]')).toHaveLength(0)
  })
})

describe('the Hours page under one contract', () => {
  it('looks as it does today: Today with its form, Patterns, Week and the balance', async () => {
    await show('2026-10-30')
    expect(ariaLabels()).toEqual(expect.arrayContaining(['Today', 'Patterns', 'Week']))
    const today = host.querySelector('section[aria-label="Today"]')!.textContent ?? ''
    expect(today).toContain('3:00')
    expect(today).toContain('Start')
    expect(host.textContent).toContain('balance')
    expect(host.textContent).toContain('Export')
  })

  it('shows only that contract: the other has no hours today', async () => {
    await show('2026-09-28')
    const today = host.querySelector('section[aria-label="Today"]')!.textContent ?? ''
    expect(today).not.toContain('3:00')
  })

  it('a link with ?year= opens that contract whatever is remembered', async () => {
    await show('all', '/work/hours?year=2026-09-28')
    expect(ariaLabels()).toContain('Patterns')
  })
})
