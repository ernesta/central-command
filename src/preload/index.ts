import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api } from '@shared/api'
import { MEETINGS_IPC } from '@modules/meetings/shared/api'
import type { MeetingChangedEvent } from '@modules/meetings/shared/api'
import { READINGS_IPC } from '@modules/readings/shared/api'
import { TRAINING_IPC } from '@modules/training/shared/api'
import type { TrainingChangedEvent } from '@modules/training/shared/api'
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
  meetings: {
    create: (input) => ipcRenderer.invoke(MEETINGS_IPC.create, input),
    read: (ref) => ipcRenderer.invoke(MEETINGS_IPC.read, ref),
    list: (workspace) => ipcRenderer.invoke(MEETINGS_IPC.list, workspace),
    save: (ref, changes, baseHash) => ipcRenderer.invoke(MEETINGS_IPC.save, ref, changes, baseHash),
    delete: (ref) => ipcRenderer.invoke(MEETINGS_IPC.delete, ref),
    syncPreviousTodos: (ref, baseHash) =>
      ipcRenderer.invoke(MEETINGS_IPC.syncPrevious, ref, baseHash),
    people: {
      list: () => ipcRenderer.invoke(MEETINGS_IPC.peopleList),
      add: (input) => ipcRenderer.invoke(MEETINGS_IPC.peopleAdd, input),
      update: (name, patch) => ipcRenderer.invoke(MEETINGS_IPC.peopleUpdate, name, patch),
      remove: (name) => ipcRenderer.invoke(MEETINGS_IPC.peopleRemove, name)
    },
    onChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, change: MeetingChangedEvent): void =>
        listener(change)
      ipcRenderer.on(MEETINGS_IPC.changed, handler)
      return () => ipcRenderer.removeListener(MEETINGS_IPC.changed, handler)
    }
  },
  training: {
    create: (input) => ipcRenderer.invoke(TRAINING_IPC.create, input),
    read: (ref) => ipcRenderer.invoke(TRAINING_IPC.read, ref),
    list: (workspace) => ipcRenderer.invoke(TRAINING_IPC.list, workspace),
    save: (ref, changes, baseHash) => ipcRenderer.invoke(TRAINING_IPC.save, ref, changes, baseHash),
    delete: (ref) => ipcRenderer.invoke(TRAINING_IPC.delete, ref),
    exportPdf: (year) => ipcRenderer.invoke(TRAINING_IPC.exportPdf, year),
    files: {
      list: (folder, sub) => ipcRenderer.invoke(TRAINING_IPC.filesList, folder, sub),
      open: (folder, sub, name) => ipcRenderer.invoke(TRAINING_IPC.filesOpen, folder, sub, name),
      reveal: (folder, sub, name) =>
        ipcRenderer.invoke(TRAINING_IPC.filesReveal, folder, sub, name),
      toRelative: (absolute) => ipcRenderer.invoke(TRAINING_IPC.filesToRelative, absolute)
    },
    onChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, change: TrainingChangedEvent): void =>
        listener(change)
      ipcRenderer.on(TRAINING_IPC.changed, handler)
      return () => ipcRenderer.removeListener(TRAINING_IPC.changed, handler)
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
