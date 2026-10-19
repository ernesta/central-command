import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearToast, currentToast } from './toast-store'
import { clearUndoStack, pushUndo, pushUndoWithToast, undoEntry, undoLast } from './undo-store'

vi.mock('@renderer/lib/ipc-error', () => ({ ipcErrorMessage: (e: unknown) => String(e) }))

afterEach(() => {
  clearUndoStack()
  clearToast()
})

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

  it('says what Cmd-Z undid, and not when the undo failed', async () => {
    pushUndo({ label: 'move to Work', undo: () => {} })
    await undoLast()
    expect(currentToast()?.text).toBe('Undid the move to Work.')
    pushUndo({
      label: 'removal of x',
      undo: () => {
        throw new Error('no')
      }
    })
    await undoLast()
    expect(currentToast()?.text).toBe('Couldn’t undo the removal of x: Error: no')
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
