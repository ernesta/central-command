// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { resetRememberedYear } from '@renderer/state/use-year-filter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { emptyYear, WORK_PLAN } from '@shared/tracking/types'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import { task } from '../shared/test-utils'
import { TasksCard } from './TasksCard'
import { TasksLanding } from './TasksLanding'
import { TasksPage } from './TasksPage'

// Tue 3 Nov 2026, in the year 2026–27 (from 21 Sep 2026). The year before runs 22 Sep 2025 to 20 Sep 2026.
const Y26 = '2026-09-21'
const Y25 = '2025-09-22'
const tasks = [
  task({ uid: 'a', title: 'Write chapter two', due: '2026-10-20' }),
  task({ uid: 'b', title: 'Submit ethics form', due: '2025-11-01' }),
  task({ uid: 'c', title: 'Plan the conference', due: '2027-10-01' }),
  task({ uid: 'd', title: 'Read the backlog' }),
  task({ uid: 'e', title: 'Collect the data', due: '2026-10-01', status: 'done' }),
  task({ uid: 'f', title: 'Draft the proposal', due: '2025-10-01', status: 'done' })
]

let host: HTMLElement
let root: Root
beforeEach(() => {
  resetRememberedYear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 3, 12, 0, 0))
  Element.prototype.scrollIntoView = () => {}
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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
        get: (_w: string, y: string) => Promise.resolve(emptyYear(y, WORK_PLAN)),
        running: () => Promise.resolve(null)
      }),
      tasks: stub({ list: () => Promise.resolve(tasks) })
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

async function show(scope: string, url: string): Promise<string> {
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
          { initialEntries: [url] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/research/tasks/all',
              element: createElement(TasksPage)
            }),
            createElement(Route, { path: '/research/tasks', element: createElement(TasksLanding) }),
            createElement(Route, { path: '/research/card', element: createElement(TasksCard) })
          )
        )
      )
    )
  )
  for (let i = 0; i < 8; i++) await act(async () => void (await Promise.resolve()))
  return host.textContent ?? ''
}
const again = (): void => {
  act(() => root.unmount())
  host.remove()
  resetRememberedYear()
}

describe('Research Tasks follow the academic year filter', () => {
  it('under All years, every open task', async () => {
    const text = await show('all', '/research/tasks/all')
    for (const title of [
      'Write chapter two',
      'Submit ethics form',
      'Plan the conference',
      'Read the backlog'
    ])
      expect(text).toContain(title)
  })

  it('under the current year, what is due in it, the undated, and the open one late from an earlier year', async () => {
    const text = await show(Y26, '/research/tasks/all')
    expect(text).toContain('Write chapter two')
    expect(text).toContain('Read the backlog')
    expect(text).toContain('Submit ethics form')
    expect(text).not.toContain('Plan the conference')
  })

  it('under the earlier year, what is due then and the undated, and nothing due later', async () => {
    const text = await show(Y25, '/research/tasks/all')
    expect(text).toContain('Submit ethics form')
    expect(text).toContain('Read the backlog')
    expect(text).not.toContain('Write chapter two')
    expect(text).not.toContain('Plan the conference')
  })

  it('the Done view holds the done tasks of the year, not those of another year', async () => {
    const text = await show(Y26, '/research/tasks/all?view=done')
    expect(text).toContain('Collect the data')
    expect(text).not.toContain('Draft the proposal')
    again()
    const before = await show(Y25, '/research/tasks/all?view=done')
    expect(before).toContain('Draft the proposal')
    expect(before).not.toContain('Collect the data')
  })

  it('the landing lists the same tasks as the page', async () => {
    const text = await show(Y26, '/research/tasks')
    expect(text).toContain('Write chapter two')
    expect(text).not.toContain('Plan the conference')
  })

  it('the Home card counts the chosen year’s tasks', async () => {
    const all = await show('all', '/research/card')
    expect(all).toContain('4 open')
    again()
    const one = await show(Y26, '/research/card')
    expect(one).toContain('3 open')
  })
})
