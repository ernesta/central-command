// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearUndoStack, undoLast } from '@renderer/components/undo-store'
import { clearToast, currentToast } from '@renderer/components/toast-store'
import { setNavigator } from '@renderer/shell/navigate-store'
import { setTaskStatus } from './task-actions'

function stubApi(next: unknown): void {
  vi.stubGlobal('window', {
    ...globalThis.window,
    api: {
      tasks: {
        get: async () => ({
          status: 'todo',
          title: 'Write intro',
          workspace: 'research',
          uid: 'a'
        }),
        setStatus: async () => ({ task: {}, next })
      }
    }
  })
}

afterEach(() => {
  clearToast()
  setNavigator(null)
  vi.unstubAllGlobals()
})

describe('setTaskStatus on a recurring task', () => {
  it('shows the next due date with an Open chip that goes to the new task', async () => {
    stubApi({ uid: 'n 1', workspace: 'work', due: '2026-11-02' })
    const go = vi.fn()
    setNavigator(go)
    await setTaskStatus({ uid: 'a' }, 'done')
    const toast = currentToast()
    expect(toast?.text).toMatch(/^Done\. The next one is due/)
    expect(toast?.action?.label).toBe('Open')
    toast?.action?.run()
    expect(go).toHaveBeenCalledWith('/work/tasks/t/n%201')
  })

  it('shows no toast when there is no next task', async () => {
    stubApi(null)
    await setTaskStatus({ uid: 'a' }, 'done')
    expect(currentToast()).toBeNull()
  })
})

describe('Undo of a status change', () => {
  afterEach(() => clearUndoStack())

  function stub(before: unknown): {
    setStatus: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  } {
    const setStatus = vi.fn(async () => ({ task: {}, next: null }))
    const update = vi.fn(async () => ({}))
    vi.stubGlobal('window', {
      ...globalThis.window,
      api: { tasks: { get: async () => before, setStatus, update } }
    })
    return { setStatus, update }
  }

  it('puts "no date" back for a task that had none', async () => {
    const { setStatus, update } = stub({ status: 'todo', due: null })
    await setTaskStatus({ uid: 'a' }, 'done')
    await undoLast()
    expect(setStatus).toHaveBeenLastCalledWith('a', 'todo')
    expect(update).toHaveBeenCalledWith('a', { due: null })
  })

  it('says which task and what changed, with an Open chip that goes to it', async () => {
    const go = vi.fn()
    setNavigator(go)
    stub({ status: 'todo', due: '2026-11-01', title: 'Write intro', workspace: 'work', uid: 'a' })
    await setTaskStatus({ uid: 'a' }, 'done')
    await undoLast()
    const toast = currentToast()
    expect(toast?.text).toBe('Undid the status change of “Write intro” from To do to Done.')
    expect(toast?.action?.label).toBe('Open')
    toast?.action?.run()
    expect(go).toHaveBeenCalledWith('/work/tasks/t/a')
  })

  it('leaves a dated task alone', async () => {
    const { update } = stub({ status: 'todo', due: '2026-11-01' })
    await setTaskStatus({ uid: 'a' }, 'done')
    await undoLast()
    expect(update).not.toHaveBeenCalled()
  })
})
