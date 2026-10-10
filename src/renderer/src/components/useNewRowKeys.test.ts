// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNewRowKeys } from './useNewRowKeys'

let host: HTMLElement
let root: Root
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  vi.useFakeTimers()
})
afterEach(async () => {
  await act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

function Shown({ keys }: { keys: string[] }): React.JSX.Element {
  const entering = useNewRowKeys(keys)
  return createElement(
    'p',
    null,
    keys.map((key) => (entering.has(key) ? `[${key}]` : key)).join(',')
  )
}

async function show(keys: string[]): Promise<void> {
  await act(() => root.render(createElement(Shown, { keys })))
}

describe('useNewRowKeys', () => {
  it('never flashes the rows a page opens with', async () => {
    await show(['mon', 'tue'])
    expect(host.textContent).toBe('mon,tue')
  })

  it('flashes a key that appears later, and only that one', async () => {
    await show(['mon'])
    await show(['mon', 'tue'])
    expect(host.textContent).toBe('mon,[tue]')
  })

  it('stops flashing once the highlight has had its moment', async () => {
    await show(['mon'])
    await show(['mon', 'tue'])
    expect(host.textContent).toBe('mon,[tue]')
    await act(() => vi.advanceTimersByTime(1400))
    expect(host.textContent).toBe('mon,tue')
  })

  it('never re-flashes a key once it has been seen, even if it leaves and comes back', async () => {
    await show(['mon', 'tue'])
    await show(['mon'])
    await show(['mon', 'tue'])
    expect(host.textContent).toBe('mon,tue')
  })

  it('still clears the flash after an unrelated re-render happens first (a stale cleanup once cancelled it for good)', async () => {
    await show(['mon'])
    await show(['mon', 'tue'])
    expect(host.textContent).toBe('mon,[tue]')
    // Same rows, a new array each time, as a parent re-rendering for any other reason would pass.
    await show(['mon', 'tue'])
    await show(['mon', 'tue'])
    await act(() => vi.advanceTimersByTime(1400))
    expect(host.textContent).toBe('mon,tue')
  })
})
