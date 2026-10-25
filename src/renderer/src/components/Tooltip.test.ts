// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip'
import { isCut, placeTip, TOOLTIP_DELAY_MS } from './tooltip-place'
import { IconButton } from './IconButton'

const h = createElement as (
  type: unknown,
  props: unknown,
  ...kids: unknown[]
) => ReactElement<object>
let host: HTMLElement
let root: Root
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

const tip = (): HTMLElement | null => document.body.querySelector('[role="tooltip"]')
const render = async (el: ReactElement<object>): Promise<void> => {
  await act(() => root.render(el))
}
const enter = async (el: Element): Promise<void> => {
  await act(() => {
    el.parentElement!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  })
}
const wait = async (ms: number): Promise<void> => {
  await act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function child(
  text: string,
  props: Record<string, unknown> = {}
): ReturnType<typeof createElement> {
  return h('span', { 'data-t': '1', ...props }, text)
}

describe('Tooltip', () => {
  it('shows its text after the pause on hover and hides on leaving', async () => {
    await render(h(Tooltip, { text: 'Full title' }, child('Full')))
    const el = host.querySelector('[data-t]')!
    await enter(el)
    expect(tip()).toBeNull()
    await wait(TOOLTIP_DELAY_MS)
    expect(tip()?.textContent).toBe('Full title')
    expect(el.getAttribute('aria-describedby')).toBe(tip()?.id)
    await act(() => {
      el.parentElement!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })
    expect(tip()).toBeNull()
    expect(el.hasAttribute('aria-describedby')).toBe(false)
  })

  it('shows nothing for empty text or when disabled', async () => {
    await render(h(Tooltip, { text: '' }, child('x')))
    await enter(host.querySelector('[data-t]')!)
    await wait(1000)
    expect(tip()).toBeNull()
    await render(h(Tooltip, { text: 'Hi', disabled: true }, child('x')))
    await enter(host.querySelector('[data-t]')!)
    await wait(1000)
    expect(tip()).toBeNull()
  })

  it('with whenCut shows only when the text is cut off', async () => {
    await render(h(Tooltip, { text: 'Long', whenCut: true }, child('Long')))
    const el = host.querySelector('[data-t]') as HTMLElement
    await enter(el)
    await wait(1000)
    expect(tip()).toBeNull()
    Object.defineProperty(el, 'scrollWidth', { value: 200, configurable: true })
    Object.defineProperty(el, 'clientWidth', { value: 100, configurable: true })
    await enter(el)
    await wait(TOOLTIP_DELAY_MS)
    expect(tip()?.textContent).toBe('Long')
  })

  it('hides on Escape and on scroll', async () => {
    await render(h(Tooltip, { text: 'Hi' }, child('x')))
    const el = host.querySelector('[data-t]')!
    await enter(el)
    await wait(TOOLTIP_DELAY_MS)
    expect(tip()).not.toBeNull()
    await act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(tip()).toBeNull()
    await enter(el)
    await wait(TOOLTIP_DELAY_MS)
    expect(tip()).not.toBeNull()
    await act(() => {
      document.dispatchEvent(new Event('scroll'))
    })
    expect(tip()).toBeNull()
  })

  it('shows on keyboard focus only (focus-visible) and hides on blur', async () => {
    await render(h(Tooltip, { text: 'Hi' }, h('button', { 'data-t': '1' }, 'b')))
    const el = host.querySelector('button')!
    const matches = vi.spyOn(el, 'matches').mockReturnValue(false)
    await act(() => el.focus())
    await wait(1000)
    expect(tip()).toBeNull()
    await act(() => el.blur())
    matches.mockReturnValue(true)
    await act(() => el.focus())
    await wait(TOOLTIP_DELAY_MS)
    expect(tip()?.textContent).toBe('Hi')
    await act(() => el.blur())
    expect(tip()).toBeNull()
  })

  it('adds no box around its child', async () => {
    await render(h(Tooltip, { text: 'Hi' }, child('x')))
    expect(host.firstElementChild?.className).toMatch(/wrap/)
    expect(host.firstElementChild?.firstElementChild?.hasAttribute('data-t')).toBe(true)
  })
})

describe('IconButton tooltip', () => {
  it('shows its label and shortcut', async () => {
    await render(h(IconButton, { label: 'Search', shortcut: 'Mod-k' }, 'i'))
    await enter(host.querySelector('button')!)
    await wait(TOOLTIP_DELAY_MS)
    expect(tip()?.textContent).toMatch(/^Search \(.+\)$/)
  })
})

describe('placeTip', () => {
  const win = { width: 800, height: 600 }
  const size = { width: 100, height: 24 }
  it('goes below and centred', () => {
    expect(placeTip({ left: 300, top: 100, width: 40, height: 20 }, size, win)).toEqual({
      left: 270,
      top: 126
    })
  })
  it('flips above at the bottom edge', () => {
    const p = placeTip({ left: 300, top: 580, width: 40, height: 20 }, size, win)
    expect(p.top).toBe(580 - 6 - 24)
  })
  it('stays inside the window at the right and left edges', () => {
    expect(placeTip({ left: 790, top: 100, width: 10, height: 20 }, size, win).left).toBe(692)
    expect(placeTip({ left: 0, top: 100, width: 10, height: 20 }, size, win).left).toBe(8)
  })
})

describe('isCut', () => {
  it('is true only when scrollWidth exceeds clientWidth', () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollWidth', { value: 50, configurable: true })
    Object.defineProperty(el, 'clientWidth', { value: 50, configurable: true })
    expect(isCut(el)).toBe(false)
    Object.defineProperty(el, 'scrollWidth', { value: 51, configurable: true })
    expect(isCut(el)).toBe(true)
    expect(isCut(null)).toBe(false)
  })
})
