import { app, BrowserWindow, Menu } from 'electron'
import { IPC, type DockActionId } from '@shared/api'

const ACTIONS: { id: DockActionId; label: string }[] = [
  { id: 'new-note', label: 'New Note' },
  { id: 'new-meeting', label: 'New Meeting' },
  { id: 'new-training', label: 'New Training Entry' }
]

/**
 * Right-click (or long-press) the Dock icon for the same three "start something now" actions the command
 * palette offers. macOS only: `app.dock` does not exist elsewhere. The window does the actual creating, the
 * same way it does for its own "New …" buttons; this only tells it which one was chosen.
 */
export function installDockMenu(): void {
  if (!app.dock) return
  app.dock.setMenu(
    Menu.buildFromTemplate(
      ACTIONS.map(({ id, label }) => ({
        label,
        click: () => {
          const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
          window?.webContents.send(IPC.appDockAction, id)
        }
      }))
    )
  )
}
