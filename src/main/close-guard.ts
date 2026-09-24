import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/api'

interface CloseGuardOptions {
  /** How long to wait for the renderer before closing anyway. */
  timeoutMs?: number
  /** Called after the window has finished closing through the guard. */
  onClosed?: () => void
}

/**
 * Before a window closes, ask the renderer to finish saving (unsaved notes) and wait for its
 * reply, so closing the window or quitting the app never drops the last edits. If the renderer
 * does not answer in time the window closes anyway; the app must never hang on quit.
 */
export function attachCloseGuard(
  window: BrowserWindow,
  { timeoutMs = 3000, onClosed }: CloseGuardOptions = {}
): void {
  let allowClose = false
  let waiting = false

  window.on('close', (event) => {
    if (allowClose || window.webContents.isDestroyed()) return
    event.preventDefault()
    if (waiting) return
    waiting = true

    const finish = (): void => {
      if (allowClose) return
      allowClose = true
      clearTimeout(timer)
      ipcMain.removeListener(IPC.appCloseReady, onReady)
      window.close()
      onClosed?.()
    }
    const onReady = (ipcEvent: Electron.IpcMainEvent): void => {
      if (ipcEvent.sender === window.webContents) finish()
    }
    const timer = setTimeout(finish, timeoutMs)
    ipcMain.on(IPC.appCloseReady, onReady)
    window.webContents.send(IPC.appBeforeClose)
  })
}
