// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearUndoStack, undoLast } from '@renderer/components/undo-store'
import { clearToast, currentToast } from '@renderer/components/toast-store'
import { setNavigator } from '@renderer/shell/navigate-store'
import { setTaskStatus, updateTaskUndoable } from './task-actions'
import type { Task } from '../shared/types'

const asTask = (t: Record<string, unknown>): Task => t as unknown as Task

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
    expect(toast?.text).toBe('Changed status of “Write intro” back to To do.')
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

describe('Cmd-Z messages for other task edits', () => {
  afterEach(() => clearUndoStack())
  const task = { uid: 'a', title: 'Write intro', workspace: 'work' }

  function stubUpdate(): void {
    vi.stubGlobal('window', {
      ...globalThis.window,
      api: { tasks: { update: vi.fn(async () => ({})) } }
    })
  }

  it('names the due date put back, or "no date"', async () => {
    stubUpdate()
    await updateTaskUndoable(
      asTask({ ...task, due: '2026-10-30' }),
      { due: '2026-11-02' },
      'task change'
    )
    await undoLast()
    expect(currentToast()?.text).toBe('Changed due date of “Write intro” back to Oct 30, 2026.')
    await updateTaskUndoable(asTask({ ...task, due: null }), { due: '2026-11-02' }, 'task change')
    await undoLast()
    expect(currentToast()?.text).toBe('Changed due date of “Write intro” back to no date.')
  })

  it('names the list and the priority put back', async () => {
    stubUpdate()
    await updateTaskUndoable(
      asTask({ ...task, list: 'Training', sublist: null }),
      { list: 'Work' },
      'task change'
    )
    await undoLast()
    expect(currentToast()?.text).toBe('Changed list of “Write intro” back to Training.')
    await updateTaskUndoable(asTask({ ...task, priority: 'normal' }), { priority: 'high' }, 'x')
    await undoLast()
    expect(currentToast()?.text).toBe('Changed priority of “Write intro” back to P2.')
  })

  it('ellipsises a very long title', async () => {
    stubUpdate()
    await updateTaskUndoable(
      asTask({ ...task, title: 'A'.repeat(80), priority: 'low' }),
      { priority: 'high' },
      'x'
    )
    await undoLast()
    expect(currentToast()?.text).toBe(`Changed priority of “${'A'.repeat(39)}…” back to P3.`)
  })
})
