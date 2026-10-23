// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InvoiceCard } from './InvoiceCard'
import { WeekCard } from './WeekCard'
import { contract, mount, NOW, unmount } from './hours-ui-test-utils'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    }
  )
  ;(window as unknown as { api: unknown }).api = { tracking: {} }
})
afterEach(() => {
  unmount()
  vi.unstubAllGlobals()
})

const button = (host: HTMLElement, text: string): HTMLButtonElement | undefined =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === text)

describe('back to this week / month', () => {
  it('the Week card offers "This week" only away from the current week, and goes there', () => {
    const onWeekChange = vi.fn()
    const data = contract({ aim: true, invoice: 'month' })
    const props = { workspace: 'work' as const, data, onWeekChange, now: NOW }
    const here = mount(createElement(WeekCard, { ...props, week: '2026-10-05' }))
    expect(button(here, 'This week')).toBeUndefined()
    unmount()
    const away = mount(createElement(WeekCard, { ...props, week: '2026-09-21' }))
    act(() => button(away, 'This week')?.click())
    expect(onWeekChange).toHaveBeenCalledWith('2026-10-05')
  })

  it('the invoice card says "This month" or "This week" by its unit, only while away', () => {
    const onWeekChange = vi.fn()
    const month = contract({ aim: true, invoice: 'month' })
    const props = { onWeekChange, now: NOW }
    const here = mount(createElement(InvoiceCard, { ...props, data: month, week: '2026-10-05' }))
    expect(button(here, 'This month')).toBeUndefined()
    unmount()
    const away = mount(createElement(InvoiceCard, { ...props, data: month, week: '2026-11-09' }))
    act(() => button(away, 'This month')?.click())
    expect(onWeekChange).toHaveBeenCalledWith('2026-10-05')
    unmount()
    const weekly = contract({ aim: true, invoice: 'week' })
    const w = mount(createElement(InvoiceCard, { ...props, data: weekly, week: '2026-09-28' }))
    expect(button(w, 'This week')).toBeDefined()
  })
})
