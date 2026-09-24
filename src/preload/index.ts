import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '@shared/api'

const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  dialog: {
    pickPath: (options) => ipcRenderer.invoke(IPC.dialogPickPath, options)
  }
}

contextBridge.exposeInMainWorld('api', api)
