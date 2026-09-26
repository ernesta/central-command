import { app, ipcMain, shell } from 'electron'
import { APP_NAME } from '@shared/app-info'
import { IPC, type AppInfo } from '@shared/api'

/** The app's version and data folder, and a way to open that folder in Finder. Nothing else about the machine is exposed. */
export function registerAppIpc(dataDir: string): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    name: APP_NAME,
    version: app.getVersion(),
    dataDir
  }))
  ipcMain.handle(IPC.appRevealData, async () => {
    const problem = await shell.openPath(dataDir)
    if (problem) throw new Error(problem)
  })
}
