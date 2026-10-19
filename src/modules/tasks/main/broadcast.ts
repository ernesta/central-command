import { BrowserWindow } from 'electron'
import { TASKS_IPC, type TasksChangedEvent } from '../shared/api'
import type { TaskWorkspace } from '../shared/types'

/** Tell every window the tasks of a workspace moved, so each open page refreshes. */
export function broadcastTasksChanged(workspace: TaskWorkspace): void {
  const event: TasksChangedEvent = { workspace }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(TASKS_IPC.changed, event)
  }
}
