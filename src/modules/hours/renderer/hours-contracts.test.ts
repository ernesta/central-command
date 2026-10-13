// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AllWeeks } from './AllWeeks'
import { BalanceCard } from './BalanceCard'
import { InvoiceCard } from './InvoiceCard'
import { WeekCard } from './WeekCard'
import { WeeksChart } from './WeeksChart'
import { contract, headers, mount, NOW, unmount } from './hours-ui-test-utils'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 900 } as DOMRect)
  ;(window as unknown as { api: unknown }).api = { tracking: {} }
})
afterEach(() => {
  unmount()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const noop = (): void => {}

describe('InvoiceCard', () => {
  const show = (aim: boolean, invoice: 'week' | 'month'): HTMLElement =>
    mount(
      createElement(InvoiceCard, {
        data: contract({ aim, invoice }),
        week: '2026-10-05',
        onWeekChange: noop,
        now: NOW
      })
    )

  it('a month with an aim: weeks with their plan, the month against its plan, and a balance', () => {
    const host = show(true, 'month')
    expect(headers(host)).toEqual(['Week', 'Hours', 'Plan'])
    expect(host.textContent).toContain('2:00 of ')
    expect(host.textContent).toContain('to go')
    expect(host.textContent).toContain('Balance')
    expect(host.querySelector('button[aria-label="Previous month"]')).not.toBeNull()
  })

  it('a month without an aim: hours only, no plan column, no "to go", no balance', () => {
    const host = show(false, 'month')
    expect(headers(host)).toEqual(['Week', 'Hours'])
    expect(host.querySelector('header')?.textContent).toContain('2:00')
    expect(host.textContent).not.toContain(' of ')
    expect(host.textContent).not.toContain('to go')
    expect(host.textContent).not.toContain('Balance')
  })

  it('a week with an aim: no week table, hours per client with the week total and its plan', () => {
    const host = show(true, 'week')
    expect(headers(host)).toEqual([])
    expect(host.querySelector('button[aria-label="Previous week"]')).not.toBeNull()
    expect(host.textContent).toContain('Royal Holloway – Total')
    expect(host.textContent).toContain('to go')
    expect(host.textContent).not.toContain('Balance')
  })

  it('a week without an aim: hours only, no plan cell', () => {
    const host = show(false, 'week')
    expect(host.textContent).toContain('Royal Holloway – Total')
    expect(host.textContent).not.toContain('to go')
    expect(host.querySelectorAll('tfoot tr:first-child td')).toHaveLength(1)
  })

  it('moves to the neighbouring period with the arrows', () => {
    const changed: string[] = []
    const host = mount(
      createElement(InvoiceCard, {
        data: contract({ aim: true, invoice: 'week' }),
        week: '2026-10-05',
        onWeekChange: (w: string) => changed.push(w),
        now: NOW
      })
    )
    ;(host.querySelector('button[aria-label="Next week"]') as HTMLButtonElement).click()
    ;(host.querySelector('button[aria-label="Previous week"]') as HTMLButtonElement).click()
    expect(changed).toEqual(['2026-10-12', '2026-09-28'])
  })
})

describe('the no-aim branches of the Hours cards', () => {
  it('WeekCard shows the hours so far, not a plan or a balance, and no bar column', () => {
    const host = mount(
      createElement(WeekCard, {
        workspace: 'work',
        data: contract({ aim: false, invoice: 'week' }),
        week: '2026-10-05',
        onWeekChange: noop,
        now: NOW
      })
    )
    expect(host.querySelector('section > p')?.textContent).toBe('2:00')
    expect(headers(host)).toEqual(['Day', 'Hours'])
    expect(host.querySelectorAll('[aria-hidden]').length).toBe(host.querySelectorAll('svg').length)
  })

  it.each([false, true])(
    'a weekly-invoiced contract (aim %s) shows the same week header on the Week card and the invoice card',
    (aim) => {
      for (const week of ['2026-09-28', '2026-10-05']) {
        const data = contract({ aim, invoice: 'week' })
        const label = (el: React.JSX.Element): string | undefined => {
          const host = mount(el)
          const text = host.querySelector('header span')?.textContent ?? undefined
          unmount()
          return text
        }
        const props = { data, week, onWeekChange: noop, now: NOW }
        const weekCard = label(createElement(WeekCard, { workspace: 'work', ...props }))
        const invoice = label(createElement(InvoiceCard, props))
        expect(weekCard).toMatch(/^Week \d+ · /)
        expect(invoice).toBe(weekCard)
      }
    }
  )

  it('WeekCard with an aim shows the plan and a balance', () => {
    const host = mount(
      createElement(WeekCard, {
        workspace: 'work',
        data: contract({ aim: true, invoice: 'week' }),
        week: '2026-10-05',
        onWeekChange: noop,
        now: NOW
      })
    )
    expect(host.querySelector('section')?.textContent).toMatch(/of 8:00/)
    // The balance is against the whole week's aim, not what is expected so far: 2:00 worked of 8:00 is -6:00.
    expect(host.querySelector('section')?.textContent).toMatch(/[−-]6:00/)
    expect(headers(host)).toHaveLength(3)
  })

  it('BalanceCard without an aim has only the average week and the hours', () => {
    const host = mount(
      createElement(BalanceCard, {
        workspace: 'work',
        data: contract({ aim: false, invoice: 'month' }),
        now: NOW
      })
    )
    const labels = [...host.querySelectorAll('dt')].map((d) => d.textContent)
    expect(labels).toEqual(['Average week', 'Hours so far'])
  })

  it('BalanceCard with an aim also has the balance and the plan', () => {
    const host = mount(
      createElement(BalanceCard, {
        workspace: 'work',
        data: contract({ aim: true, invoice: 'month' }),
        now: NOW
      })
    )
    const labels = [...host.querySelectorAll('dt')].map((d) => d.textContent)
    expect(labels).toHaveLength(4)
    expect(labels[0]).toBe('Balance')
  })

  it('WeeksChart draws no plan line and no balance text without an aim', () => {
    const without = mount(
      createElement(WeeksChart, { data: contract({ aim: false, invoice: 'week' }), now: NOW })
    )
    const paths = without.querySelectorAll('path').length
    unmount()
    const withAim = mount(
      createElement(WeeksChart, { data: contract({ aim: true, invoice: 'week' }), now: NOW })
    )
    expect(withAim.querySelectorAll('path').length).toBeGreaterThan(paths)
  })

  it('AllWeeks has Week, Dates and Hours only without an aim', () => {
    const host = mount(
      createElement(AllWeeks, {
        workspace: 'work',
        data: contract({ aim: false, invoice: 'week' }),
        now: NOW
      })
    )
    expect(headers(host)).toEqual(['Week', 'Dates', 'Hours'])
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('AllWeeks adds Plan, Balance and Year with an aim', () => {
    const host = mount(
      createElement(AllWeeks, {
        workspace: 'work',
        data: contract({ aim: true, invoice: 'week' }),
        now: NOW
      })
    )
    expect(headers(host)).toEqual(['Week', 'Dates', 'Hours', 'Plan', 'Balance', 'Year'])
  })
})
