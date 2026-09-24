import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '@shared/api'
import { READINGS_IPC } from '@modules/readings/shared/api'
import type { NoteChangedEvent } from '@shared/notes'
import type { SyncStatus } from '@modules/readings/shared/types'

const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  dialog: {
    pickPath: (options) => ipcRenderer.invoke(IPC.dialogPickPath, options)
  },
  readings: {
    sync: {
      now: () => ipcRenderer.invoke(READINGS_IPC.syncNow),
      status: () => ipcRenderer.invoke(READINGS_IPC.syncStatus),
      onStatus: (listener) => {
        const handler = (_event: Electron.IpcRendererEvent, status: SyncStatus): void =>
          listener(status)
        ipcRenderer.on(READINGS_IPC.syncStatusChanged, handler)
        return () => ipcRenderer.removeListener(READINGS_IPC.syncStatusChanged, handler)
      }
    },
    counts: () => ipcRenderer.invoke(READINGS_IPC.counts),
    list: (query) => ipcRenderer.invoke(READINGS_IPC.list, query),
    tags: () => ipcRenderer.invoke(READINGS_IPC.tags),
    get: (citekey) => ipcRenderer.invoke(READINGS_IPC.get, citekey),
    notes: {
      read: (citekey) => ipcRenderer.invoke(READINGS_IPC.notesRead, citekey),
      write: (citekey, content, baseHash) =>
        ipcRenderer.invoke(READINGS_IPC.notesWrite, citekey, content, baseHash),
      onChanged: (listener) => {
        const handler = (_event: Electron.IpcRendererEvent, change: NoteChangedEvent): void =>
          listener(change)
        ipcRenderer.on(READINGS_IPC.notesChanged, handler)
        return () => ipcRenderer.removeListener(READINGS_IPC.notesChanged, handler)
      }
    }
  },
  lifecycle: {
    onBeforeClose: (handler) => {
      const listener = async (): Promise<void> => {
        try {
          await handler()
        } finally {
          ipcRenderer.send(IPC.appCloseReady)
        }
      }
      ipcRenderer.on(IPC.appBeforeClose, listener)
      return () => ipcRenderer.removeListener(IPC.appBeforeClose, listener)
    }
  },
  build: {
    openSession: () => ipcRenderer.invoke(IPC.buildOpenSession)
  }
}

contextBridge.exposeInMainWorld('api', api)
