// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { resetRememberedYear } from '@renderer/state/use-year-filter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import type { MeetingIndexRow } from '../shared/types'
import { MeetingsCard } from './MeetingsCard'
import { MeetingsLanding } from './MeetingsLanding'
import { MeetingsPage } from './MeetingsPage'

// Tue 3 Nov 2026, in the year 2026–27 (from 21 Sep 2026). The year before runs 22 Sep 2025 to 20 Sep 2026.
const Y26 = '2026-09-21'
const Y25 = '2025-09-22'

const todo = (text: string): MeetingIndexRow['todos'][number] => ({
  kind: 'inline',
  owners: [],
  text,
  done: false,
  line: 1
})
const meeting = (id: string, series: string, date: string, job: string): MeetingIndexRow => ({
  workspace: 'research',
  id,
  uid: id,
  task: '',
  series,
  date,
  start: '10:00',
  end: '11:00',
  mode: null,
  attendees: [],
  skills: [],
  summary: '',
  excerpt: '',
  problems: [],
  topicCount: 0,
  hasNotes: true,
  todos: job ? [todo(job)] : [],
  contentHash: id
})
const rows = [
  meeting('old-last', 'Panel', '2026-09-20', 'Last year job'),
  meeting('new-first', 'Review', '2026-09-21', 'This year job'),
  meeting('old', 'Thesis', '2025-11-10', ''),
  meeting('plan', 'Planned', '', '')
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
      tracking: stub({ years: () => Promise.resolve([Y26, Y25]) }),
      meetings: stub({
        list: () => Promise.resolve(rows),
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

describe('Research Meetings follow the academic year filter', () => {
  it('the list shows every meeting under All years, the undated plan too, and has no selector of its own', async () => {
    const text = await show('all', '/research/meetings/all', MeetingsPage)
    for (const series of ['Panel', 'Review', 'Thesis', 'Planned']) expect(text).toContain(series)
    expect(text).toContain('Hours of meetings, all years')
    expect(host.querySelector('button[aria-label="Year"]')).toBeNull()
  })

  it('the list shows one year’s meetings, its first and last day in it, and the plan in the current year only', async () => {
    const now = await show(Y26, '/research/meetings/all', MeetingsPage)
    expect(now).toContain('Review')
    expect(now).toContain('Planned')
    expect(now).not.toContain('Panel')
    expect(now).not.toContain('Thesis')
    expect(now).toContain('Hours of meetings, 2026–27')
    act(() => root.unmount())
    host.remove()
    resetRememberedYear()
    const before = await show(Y25, '/research/meetings/all', MeetingsPage)
    // 20 Sep 2026 is the last day of 2025–26; the undated plan belongs to the current year.
    expect(before).toContain('Panel')
    expect(before).toContain('Thesis')
    expect(before).not.toContain('Review')
    expect(before).not.toContain('Planned')
  })

  it('Before next meeting lists the open TODOs of the chosen year’s meetings, and of all under All', async () => {
    const all = await show('all', '/research/meetings', MeetingsLanding)
    expect(all).toContain('Last year job')
    expect(all).toContain('This year job')
    act(() => root.unmount())
    host.remove()
    resetRememberedYear()
    const one = await show(Y26, '/research/meetings', MeetingsLanding)
    expect(one).toContain('This year job')
    expect(one).not.toContain('Last year job')
  })

  it('the Home card counts the chosen year’s meetings', async () => {
    const all = await show('all', '/research/meetings', MeetingsCard)
    expect(all).toContain('3 done')
    act(() => root.unmount())
    host.remove()
    resetRememberedYear()
    const one = await show(Y25, '/research/meetings', MeetingsCard)
    expect(one).toContain('2 done')
  })
})
