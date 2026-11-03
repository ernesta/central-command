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
import { HomeHours } from './HomeHours'

// Tue 3 Nov 2026. Luminos has a client worked today; Royal Holloway (the older start) has none.
const luminos: TrackingYear = {
  ...emptyYear('2026-10-30', { ...WORK_PLAN, hoursPerWeek: 480, clients: ['Impact', 'Teaching'] }),
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
  Element.prototype.scrollIntoView = () => {}
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
  vi.restoreAllMocks()
})

async function show(scope: string): Promise<string> {
  const base = defaultSettings('/z.bib')
  const settings = { ...base, ui: { ...base.ui, moduleState: { 'work-contract': { scope } } } }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() =>
    root.render(
      createElement(
        SettingsContext.Provider,
        { value: { settings, update: () => Promise.resolve() } },
        createElement(MemoryRouter, null, createElement(HomeHours, { workspace: 'work' }))
      )
    )
  )
  for (let i = 0; i < 8; i++) await act(async () => void (await Promise.resolve()))
  return host.textContent ?? ''
}

describe("Work's Home hours", () => {
  it('under All, today is the sum over the contracts and the periods are per contract, with no aim', async () => {
    const text = await show('all')
    expect(text).toContain('3:00')
    expect(text).toContain('Impact')
    expect(text).toContain('Luminos · this month')
    expect(text).toContain('Royal Holloway · this week')
    expect(text).not.toContain(' of ')
    // The filter is in the top bar, not in the panel.
    expect(host.querySelector('button[aria-label="Contract"]')).toBeNull()
  })

  it('a day worked on the contract that is not the one a page would open on is counted, not 0:00', async () => {
    const text = await show('all')
    expect(text).not.toMatch(/^Today0:00/)
    expect(host.querySelector('section')?.getAttribute('aria-label')).toBe('Today')
  })

  it('under one contract it looks as before: the period against its aim, today and the clients', async () => {
    const text = await show('2026-10-30')
    expect(host.querySelector('section')?.getAttribute('aria-label')).toBe('This month')
    expect(text).toContain('4:00')
    expect(text).toContain('Today 3:00')
    expect(text).toContain('Teaching')
  })

  it('under a contract with no hours today it reads 0:00', async () => {
    const text = await show('2026-09-28')
    expect(text).toContain('0:00')
  })
})
