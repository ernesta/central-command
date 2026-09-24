import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC, type PickPathOptions } from '@shared/api'

export function registerDialogIpc(): void {
  ipcMain.handle(IPC.dialogPickPath, async (event, options: PickPathOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const properties: Electron.OpenDialogOptions['properties'] =
      options.kind === 'folder' ? ['openDirectory', 'createDirectory'] : ['openFile']
    const dialogOptions: Electron.OpenDialogOptions = {
      title: options.title,
      defaultPath: options.defaultPath || undefined,
      properties,
      filters:
        options.kind === 'file' && options.extensions?.length
          ? [{ name: 'Files', extensions: options.extensions }]
          : undefined
    }
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
}
