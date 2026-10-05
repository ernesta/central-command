import { app, BrowserWindow, Menu } from 'electron'
import { IPC, type DockActionId } from '@shared/api'

const ACTIONS: { id: DockActionId; label: string }[] = [
  { id: 'new-note', label: 'New Note' },
  { id: 'new-meeting', label: 'New Meeting' },
  { id: 'new-training', label: 'New Training Entry' },
  { id: 'new-task', label: 'New Task' }
]

const STOP_TIMER = { id: 'stop-timer', label: 'Stop Timer' } as const

function send(id: DockActionId): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  window?.webContents.send(IPC.appDockAction, id)
}

function buildMenu(timerRunning: boolean): Menu {
  const items = ACTIONS.map(({ id, label }) => ({ label, click: () => send(id) }))
  if (timerRunning) items.push({ label: STOP_TIMER.label, click: () => send(STOP_TIMER.id) })
  return Menu.buildFromTemplate(items)
}

/**
 * Right-click (or long-press) the Dock icon for the same "start something now" actions the command
 * palette offers, plus Stop Timer while a timer runs. macOS only: `app.dock` does not exist elsewhere.
 * The window does the actual work, the same way it does for its own buttons; this only tells it which
 * one was chosen. Returns the function that tells the menu whether a timer runs.
 */
export function installDockMenu(): (timerRunning: boolean) => void {
  const set = (timerRunning: boolean): void => app.dock?.setMenu(buildMenu(timerRunning))
  set(false)
  return set
}
