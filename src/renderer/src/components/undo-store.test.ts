import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearUndoStack, pushUndo, pushUndoWithToast, undoEntry, undoLast } from './undo-store'

vi.mock('@renderer/lib/ipc-error', () => ({ ipcErrorMessage: (e: unknown) => String(e) }))

afterEach(() => clearUndoStack())

describe('undo store', () => {
  it('takes back the latest change first, each once', async () => {
    const calls: string[] = []
    pushUndo({ label: 'a', undo: () => void calls.push('a') })
    pushUndo({ label: 'b', undo: () => void calls.push('b') })
    expect(await undoLast()).toBe(true)
    expect(await undoLast()).toBe(true)
    expect(await undoLast()).toBe(false)
    expect(calls).toEqual(['b', 'a'])
  })

  it('does not undo twice when the toast and Cmd-Z both ask', async () => {
    const undo = vi.fn()
    const entry = pushUndo({ label: 'a', undo })
    await undoEntry(entry)
    await undoEntry(entry)
    await undoLast()
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('skips an entry whose page is gone', async () => {
    const calls: string[] = []
    pushUndo({ label: 'a', undo: () => void calls.push('a') })
    pushUndo({ label: 'b', undo: () => void calls.push('b'), isStale: () => true })
    expect(await undoLast()).toBe(true)
    expect(await undoLast()).toBe(false)
    expect(calls).toEqual(['a'])
  })

  it('keeps going when an undo fails', async () => {
    pushUndoWithToast('x', {
      label: 'x',
      undo: () => {
        throw new Error('no')
      }
    })
    await expect(undoLast()).resolves.toBe(true)
  })
})
