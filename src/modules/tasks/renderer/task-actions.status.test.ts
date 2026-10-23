// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearToast, currentToast } from '@renderer/components/toast-store'
import { setNavigator } from '@renderer/shell/navigate-store'
import { setTaskStatus } from './task-actions'

function stubApi(next: unknown): void {
  vi.stubGlobal('window', {
    ...globalThis.window,
    api: {
      tasks: {
        get: async () => ({ status: 'todo' }),
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
