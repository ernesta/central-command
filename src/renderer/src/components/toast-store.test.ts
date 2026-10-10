// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToast, showToast, useToast } from './toast-store'

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
  clearToast()
  await act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

function Shown(): React.JSX.Element {
  const toast = useToast()
  return createElement(
    'p',
    null,
    toast ? `${toast.text}${toast.action ? ` (${toast.action.label})` : ''}` : '—'
  )
}

async function mount(): Promise<void> {
  await act(() => root.render(createElement(Shown)))
}

describe('toast', () => {
  it('shows nothing until a message is shown', async () => {
    await mount()
    expect(host.textContent).toBe('—')
  })

  it('shows the message and its action', async () => {
    await mount()
    await act(() => showToast('Deleted “Mon”.', { label: 'Undo', run: () => {} }))
    expect(host.textContent).toBe('Deleted “Mon”. (Undo)')
  })

  it('clears itself after a while, and a later one replaces an earlier one before that', async () => {
    await mount()
    await act(() => showToast('First', undefined, 1000))
    await act(() => vi.advanceTimersByTime(999))
    expect(host.textContent).toBe('First')
    await act(() => showToast('Second', undefined, 1000))
    await act(() => vi.advanceTimersByTime(999))
    expect(host.textContent).toBe('Second')
    await act(() => vi.advanceTimersByTime(1))
    expect(host.textContent).toBe('—')
  })

  it('clears on demand, e.g. after its action runs', async () => {
    await mount()
    await act(() => showToast('Deleted.', { label: 'Undo', run: () => {} }))
    expect(host.textContent).toBe('Deleted. (Undo)')
    await act(() => clearToast())
    expect(host.textContent).toBe('—')
  })
})
