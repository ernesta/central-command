// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { resetRememberedScope } from '@renderer/state/use-contract-filter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import { task } from '../shared/test-utils'
import { TasksCard } from './TasksCard'
import { TasksLanding } from './TasksLanding'
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
  resetRememberedScope()
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

async function show(
  scope: string,
  landing = false,
  element: () => React.ReactElement = () => createElement(TasksPage)
): Promise<string> {
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
          { initialEntries: [landing ? '/work/tasks' : '/work/tasks/all'] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/work/tasks/all', element: element() }),
            createElement(Route, { path: '/work/tasks', element: createElement(TasksLanding) })
          )
        )
      )
    )
  )
  for (let i = 0; i < 8; i++) await act(async () => void (await Promise.resolve()))
  return host.textContent ?? ''
}

describe('Work Tasks follow the contract filter', () => {
  it('under All, every task, and the filter is not in the page (it is in the top bar)', async () => {
    const text = await show('all')
    expect(text).toContain('Draft the impact report')
    expect(text).toContain('Write the literature section')
    expect(host.querySelector('button[aria-label="Contract"]')).toBeNull()
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

  it("the landing's list cards and the list filter are the chosen contract's clients, not every contract's", async () => {
    await show('2026-10-30', true)
    // What follows the "Lists" heading: the cards (the add bar's own list menu offers every list, on purpose).
    const cards = (): string =>
      (host.textContent ?? '').slice((host.textContent ?? '').lastIndexOf('Lists'))
    expect(cards()).toContain('Impact')
    expect(cards()).not.toContain('Royal Holloway')
    act(() => root.unmount())
    host.remove()
    await show('all', true)
    expect(cards()).toContain('Impact')
    expect(cards()).toContain('Royal Holloway')
    act(() => root.unmount())
    host.remove()
    // The page's list filter offers the same lists.
    await show('2026-10-30')
    const filter = host.querySelector('button[aria-label="Filter by list"]') as HTMLElement
    act(() => filter.click())
    const options = [...document.body.querySelectorAll('[role="option"]')].map((o) => o.textContent)
    expect(options).toContain('Impact')
    expect(options).not.toContain('Royal Holloway')
  })

  it("the Home card counts the chosen contract's tasks, not every contract's", async () => {
    const card = (): string => host.textContent ?? ''
    await show('2026-10-30', false, () => createElement(TasksCard))
    expect(card()).toContain('1 open')
    act(() => root.unmount())
    host.remove()
    await show('all', false, () => createElement(TasksCard))
    expect(card()).toContain('2 open')
  })
})
