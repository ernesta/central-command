// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { resetRememberedScope } from '@renderer/state/use-contract-filter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '@shared/settings'
import { openContracts } from '@shared/tracking/contracts'
import { emptyYear, WORK_PLAN, type TrackingYear } from '@shared/tracking/types'
import { SettingsContext } from '../../../renderer/src/state/settings-context'
import type { MeetingIndexRow } from '../shared/types'
import { MeetingsCard } from './MeetingsCard'
import { MeetingsLanding } from './MeetingsLanding'

// Tue 3 Nov 2026. Luminos (Impact) 30 Oct – 26 Nov; Royal Holloway 28 Sep 2026 – 28 Mar 2027.
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
const todo = (text: string, line: number): MeetingIndexRow['todos'][number] => ({
  kind: 'inline',
  owners: [],
  text,
  done: false,
  line
})
const meeting = (
  id: string,
  task: string,
  date: string,
  todos: MeetingIndexRow['todos']
): MeetingIndexRow => ({
  workspace: 'work',
  id,
  uid: id,
  task,
  series: 'Check-in',
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
  todos,
  contentHash: id
})
const rows = [
  meeting(
    'm1',
    'ta',
    '2026-11-02',
    [1, 2, 3, 4, 5, 6, 7].map((n) => todo(`Impact job ${n}`, n))
  ),
  meeting('m2', 'tb', '2026-11-02', [todo('Holloway job', 1)])
]
const taskList = [
  { uid: 'ta', list: 'Impact', parentUid: null },
  { uid: 'tb', list: 'Royal Holloway', parentUid: null }
]

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
        running: () => Promise.resolve(null),
        openContracts: () => Promise.resolve(openContracts(Object.values(files), '2026-11-03'))
      }),
      tasks: stub({ list: () => Promise.resolve(taskList) }),
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
  element: () => React.ReactElement = () => createElement(MeetingsLanding)
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
          { initialEntries: ['/work/meetings'] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/work/meetings',
              element: element()
            })
          )
        )
      )
    )
  )
  for (let i = 0; i < 10; i++) await act(async () => void (await Promise.resolve()))
  return host.textContent ?? ''
}

const click = (el: Element | null): void => act(() => (el as HTMLElement).click())
const buttonNamed = (name: string): Element | null =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === name) ?? null

describe("Work Meetings' open TODOs follow the contract filter", () => {
  it("under a contract, only that contract's meetings' TODOs", async () => {
    const text = await show('2026-10-30')
    expect(text).toContain('Impact job 1')
    expect(text).not.toContain('Holloway job')
    expect(text).toContain('7 open')
  })

  it('under the other contract, the other meeting’s TODOs', async () => {
    const text = await show('2026-09-28')
    expect(text).toContain('Holloway job')
    expect(text).not.toContain('Impact job')
    expect(text).toContain('1 open')
  })

  it('under All, every contract’s, cut to five with a way to show the rest', async () => {
    const text = await show('all')
    expect(text).toContain('8 open')
    expect(text).toContain('Showing 5 of 8')
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(5)
    click(buttonNamed('Show all'))
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(8)
    expect(host.textContent).toContain('Showing all 8')
    click(buttonNamed('Show fewer'))
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(5)
  })

  it('a list that fits has no "Showing" line', async () => {
    const text = await show('2026-09-28')
    expect(text).not.toContain('Showing')
  })

  it("the Home card counts the chosen contract's meetings and TODOs", async () => {
    expect(await show('2026-09-28', () => createElement(MeetingsCard))).toContain('1 open TODO')
    act(() => root.unmount())
    host.remove()
    const all = await show('all', () => createElement(MeetingsCard))
    expect(all).toContain('2 done')
    expect(all).toContain('8 open TODOs')
  })
})
