import { ipcMain } from 'electron'
import { IPC } from '@shared/api'
import { openBuildSession } from '../build-session'
import type { SettingsStore } from '../settings'

export function registerBuildIpc(settings: SettingsStore): void {
  ipcMain.handle(IPC.buildOpenSession, () => {
    const { repoPath, terminal } = settings.get()
    return openBuildSession(repoPath, terminal)
  })
}
