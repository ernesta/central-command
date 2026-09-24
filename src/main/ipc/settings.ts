import { ipcMain } from 'electron'
import { IPC, type SettingsPatch } from '@shared/api'
import type { SettingsStore } from '../settings'

export function registerSettingsIpc(store: SettingsStore): void {
  ipcMain.handle(IPC.settingsGet, () => store.get())
  ipcMain.handle(IPC.settingsUpdate, (_event, patch: SettingsPatch) => store.update(patch))
}
