// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import { task } from '../shared/test-utils'
import { TasksPage } from './TasksPage'

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
const tasks = [
  task({ uid: 'a', title: 'Draft the impact report', list: 'Impact' }),
  task({ uid: 'b', title: 'Write the literature section', list: 'Royal Holloway' })
]

let host: HTMLElement
let root: Root
beforeEach(() => {
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
        years: () => Promise.resolve(['2026-10-30', '2026-09-28']),
        get: (_w: string, y: string) => Promise.resolve(files[y]),
        running: () => Promise.resolve(null)
      }),
      tasks: stub({
        list: () => Promise.resolve(tasks),
        clients: () => Promise.resolve(['Impact', 'Royal Holloway'])
      })
    } as Record<string, unknown>,
    { get: (target, key: string) => target[key] ?? stub({}) }
  )
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
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
        createElement(
          MemoryRouter,
          { initialEntries: ['/work/tasks/all'] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/work/tasks/all', element: createElement(TasksPage) })
          )
        )
      )
    )
  )
  for (let i = 0; i < 8; i++) await act(async () => void (await Promise.resolve()))
  return host.textContent ?? ''
}

describe('Work Tasks follow the contract filter', () => {
  it('under All, every task, and the filter is in the header', async () => {
    const text = await show('all')
    expect(text).toContain('Draft the impact report')
    expect(text).toContain('Write the literature section')
    expect(host.querySelector('header button[aria-label="Contract"]')).not.toBeNull()
  })

  it('under a contract, the tasks whose list is one of its clients', async () => {
    const text = await show('2026-10-30')
    expect(text).toContain('Draft the impact report')
    expect(text).not.toContain('Write the literature section')
  })

  it('under the other contract, the other tasks', async () => {
    const text = await show('2026-09-28')
    expect(text).not.toContain('Draft the impact report')
    expect(text).toContain('Write the literature section')
  })

  it('a new task starts in a list of the chosen contract, so it is made where it shows', async () => {
    await show('2026-09-28')
    expect(host.querySelector('form[aria-label="Add a task"]')?.textContent).toContain(
      'Royal Holloway'
    )
    act(() => root.unmount())
    host.remove()
    await show('2026-10-30')
    expect(host.querySelector('form[aria-label="Add a task"]')?.textContent).toContain('Impact')
  })
})
