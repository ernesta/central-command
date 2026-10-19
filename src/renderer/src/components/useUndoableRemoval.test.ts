// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearUndoStack, undoLast } from './undo-store'
import { useUndoableRemoval } from './useUndoableRemoval'

vi.mock('@renderer/lib/ipc-error', () => ({ ipcErrorMessage: (e: unknown) => String(e) }))

let host: HTMLElement
let root: Root
let api: { items: string[]; remove: (item: string) => void; set: (items: string[]) => void }
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  clearUndoStack()
  if (host.isConnected) await act(() => root.unmount())
  host.remove()
})

function Field(): React.JSX.Element {
  const [items, set] = useState(['a', 'b', 'c'])
  const remove = useUndoableRemoval(items, set)
  api = { items, remove, set }
  return createElement('p', null, items.join(','))
}

describe('useUndoableRemoval', () => {
  it('puts the item back where it was, keeping changes made since', async () => {
    await act(() => root.render(createElement(Field)))
    await act(() => api.remove('b'))
    expect(host.textContent).toBe('a,c')
    await act(() => api.set(['a', 'c', 'd']))
    await act(async () => void (await undoLast()))
    expect(host.textContent).toBe('a,b,c,d')
  })

  it('does nothing once the field is gone', async () => {
    await act(() => root.render(createElement(Field)))
    await act(() => api.remove('a'))
    await act(() => root.unmount())
    expect(await undoLast()).toBe(false)
  })
})
