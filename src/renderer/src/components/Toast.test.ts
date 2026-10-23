// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Toast } from './Toast'
import { clearToast, showToast } from './toast-store'

let host: HTMLElement
let root: Root
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  clearToast()
  await act(() => root.unmount())
  host.remove()
})

describe('Toast', () => {
  it('keeps the words around a quoted title whole and leaves the title as its own element to ellipsise', async () => {
    await act(() => root.render(createElement(Toast)))
    const long = 'Attend and present at '.repeat(12)
    await act(() =>
      showToast(`Deleted “${long}” and 3:45 of time.`, { label: 'Undo', run: () => {} })
    )
    expect(host.textContent).toBe(`Deleted “${long}” and 3:45 of time.Undo`)
    const title = host.querySelector('[class*="title"]')
    expect(title?.textContent).toBe(long)
    expect(host.querySelectorAll('[class*="fixed"]')).toHaveLength(2)
    expect(host.querySelector('button')?.textContent).toBe('Undo')
  })

  it('shows a message with no quoted title as one ellipsisable run', async () => {
    await act(() => root.render(createElement(Toast)))
    await act(() => showToast('Timer discarded.'))
    expect(host.querySelector('[class*="title"]')?.textContent).toBe('Timer discarded.')
  })
})
