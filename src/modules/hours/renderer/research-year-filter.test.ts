// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { resetRememberedYear } from '@renderer/state/use-year-filter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { openContracts } from '@shared/tracking/contracts'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import { TimeOffPage } from '../../time-off/renderer/TimeOffPage'
import { HoursPage } from './HoursPage'

// Tue 3 Nov 2026, in the year 2026–27 (from 21 Sep 2026). The year before runs 22 Sep 2025 to 20 Sep 2026.
const Y26 = '2026-09-21'
const Y25 = '2025-09-22'
const plan = { ...WORK_PLAN, clients: [] }
const files: Record<string, TrackingYear> = {
  [Y26]: {
    ...emptyYear(Y26, plan),
    adjusts: [{ id: 'a', date: '2026-11-03', label: 'This year', minutes: 90 }]
  },
  [Y25]: {
    ...emptyYear(Y25, plan),
    adjusts: [{ id: 'b', date: '2025-11-10', label: 'Last year', minutes: 30 }]
  }
}

let host: HTMLElement
let root: Root
const asked: string[] = []
beforeEach(() => {
  asked.length = 0
  resetRememberedYear()
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
        years: () => Promise.resolve([Y26, Y25]),
        get: (_w: string, y: string) => {
          asked.push(y)
          return Promise.resolve(files[y])
        },
        running: () => Promise.resolve(null),
        openContracts: () => Promise.resolve(openContracts(Object.values(files), '2026-11-03'))
      })
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

async function show(scope: string, page: React.FunctionComponent, url: string): Promise<void> {
  const base = defaultSettings('/z.bib')
  const settings = {
    ...base,
    yearStarts: [Y25, Y26],
    ui: { ...base.ui, moduleState: { 'research-year': { scope } } }
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() =>
    root.render(
      createElement(
        SettingsContext.Provider,
        { value: { settings, update: () => Promise.resolve() } },
        createElement(MemoryRouter, { initialEntries: [url] }, createElement(page))
      )
    )
  )
  for (let i = 0; i < 8; i++) await act(async () => void (await Promise.resolve()))
}

const heading = (): string | null => host.querySelector('h1')?.textContent ?? null
const labels = (): string[] =>
  [...host.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label') ?? '')
const again = (): void => {
  act(() => root.unmount())
  host.remove()
  resetRememberedYear()
}

describe('Research Hours follows the academic year filter', () => {
  it('under All years it is the current year, which the heading names, with no selector of its own', async () => {
    await show('all', HoursPage, '/research/hours')
    expect(heading()).toBe('Hours 2026–27')
    expect(asked).toContain(Y26)
    expect(asked).not.toContain(Y25)
    expect(labels()).toContain('Today')
    expect(host.querySelector('button[aria-label="Year"]')).toBeNull()
  })

  it('under one year it is that year as before: the heading is plain, and a finished year has no Today', async () => {
    await show(Y26, HoursPage, '/research/hours')
    expect(heading()).toBe('Hours')
    expect(labels()).toContain('Today')
    again()
    asked.length = 0
    await show(Y25, HoursPage, '/research/hours')
    expect(heading()).toBe('Hours')
    expect(asked).toContain(Y25)
    expect(asked).not.toContain(Y26)
    expect(labels()).not.toContain('Today')
  })
})

describe('Research Time off follows the academic year filter', () => {
  it('under All years it is the current year, named in the heading, with no selector of its own', async () => {
    await show('all', TimeOffPage, '/research/time-off')
    expect(heading()).toBe('Time off 2026–27')
    expect(asked).toContain(Y26)
    expect(host.querySelector('button[aria-label="Year"]')).toBeNull()
  })

  it('under one year it is that year, with a plain heading', async () => {
    await show(Y25, TimeOffPage, '/research/time-off')
    expect(heading()).toBe('Time off')
    expect(asked).toContain(Y25)
    expect(asked).not.toContain(Y26)
    expect(host.querySelector('button[aria-label="Year"]')).toBeNull()
  })
})
