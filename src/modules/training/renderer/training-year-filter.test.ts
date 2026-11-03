// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { resetRememberedYear } from '@renderer/state/use-year-filter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { emptyYear, WORK_PLAN } from '@shared/tracking/types'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import type { TrainingIndexRow } from '../shared/types'
import { TrainingLanding } from './TrainingLanding'
import { TrainingPage } from './TrainingPage'
import { TrainingPlanPage } from './TrainingPlanPage'

// Tue 3 Nov 2026, in the year 2026–27 (from 21 Sep 2026). The year before runs 22 Sep 2025 to 20 Sep 2026.
const Y26 = '2026-09-21'
const Y25 = '2025-09-22'

const entry = (title: string, date: string): TrainingIndexRow => ({
  workspace: 'research',
  id: `${date} ${title}`,
  date,
  start: '10:00',
  end: '12:00',
  title,
  series: title,
  type: null,
  mode: null,
  skills: [],
  leads: [],
  institution: null,
  folder: null,
  task: '',
  selfStudy: '',
  summary: '',
  excerpt: '',
  hasNotes: false,
  problems: [],
  contentHash: title
})
const rows = [
  entry('Alpha', '2026-09-20'),
  entry('Beta', '2026-09-21'),
  entry('Gamma', '2025-11-10'),
  entry('Delta', '')
]

let host: HTMLElement
let root: Root
beforeEach(() => {
  resetRememberedYear()
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
        years: () => Promise.resolve([Y26, Y25]),
        get: (_w: string, y: string) => Promise.resolve(emptyYear(y, WORK_PLAN))
      }),
      training: stub({
        list: () => Promise.resolve(rows),
        plan: stub({ read: () => Promise.resolve({ exists: false, content: '', hash: '' }) })
      }),
      meetings: stub({
        list: () => Promise.resolve([]),
        people: stub({ list: () => Promise.resolve([]) })
      })
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

/** What the table lists: the series filter offers every series, so the page's whole text would not tell. */
const listed = (): string =>
  [...host.querySelectorAll('tbody tr')].map((r) => r.textContent).join('|')

async function show(
  scope: string,
  path: string,
  element: React.FunctionComponent
): Promise<string> {
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
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(
            Routes,
            null,
            createElement(Route, { path, element: createElement(element) })
          )
        )
      )
    )
  )
  for (let i = 0; i < 10; i++) await act(async () => void (await Promise.resolve()))
  return host.textContent ?? ''
}

const again = (): void => {
  act(() => root.unmount())
  host.remove()
  resetRememberedYear()
}

describe('Research Training follows the academic year filter', () => {
  it('the list shows every entry under All years, the planned one too, without a selector or an aim', async () => {
    const text = await show('all', '/research/training/all', TrainingPage)
    for (const title of ['Alpha', 'Beta', 'Gamma', 'Delta']) expect(listed()).toContain(title)
    expect(text).toContain('Hours of training, all years')
    expect(host.querySelector('button[aria-label="Year"]')).toBeNull()
    expect(host.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('the list shows one year’s entries, its first and last day in it, and the plan in the current year only', async () => {
    const now = await show(Y26, '/research/training/all', TrainingPage)
    expect(listed()).toContain('Beta')
    expect(listed()).toContain('Delta')
    expect(listed()).not.toContain('Alpha')
    expect(listed()).not.toContain('Gamma')
    expect(now).toContain('Hours of training, 2026–27')
    expect(host.querySelector('[role="progressbar"]')).not.toBeNull()
    again()
    await show(Y25, '/research/training/all', TrainingPage)
    expect(listed()).toContain('Alpha')
    expect(listed()).toContain('Gamma')
    expect(listed()).not.toContain('Beta')
    expect(listed()).not.toContain('Delta')
  })

  it('the landing totals the hours of the chosen year, and of every year under All', async () => {
    const all = await show('all', '/research/training', TrainingLanding)
    expect(all).toContain('Hours of training, all years')
    expect(all).toContain('3 done')
    again()
    const one = await show(Y25, '/research/training', TrainingLanding)
    expect(one).toContain('Hours of training, 2025–26')
    expect(one).toContain('2 done')
  })

  it('the plan is the chosen year’s, and the current year’s under All, named in its heading', async () => {
    const all = await show('all', '/research/training/plan', TrainingPlanPage)
    expect(host.querySelector('h1')?.textContent).toBe('Training plan 2026–27')
    expect(all).not.toContain('Year')
    again()
    await show(Y25, '/research/training/plan', TrainingPlanPage)
    expect(host.querySelector('h1')?.textContent).toBe('Training plan')
  })
})
