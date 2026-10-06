import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type Api, type DockActionId } from '@shared/api'
import { MEETINGS_IPC } from '@modules/meetings/shared/api'
import type { MeetingChangedEvent } from '@modules/meetings/shared/api'
import { NOTES_IPC } from '@modules/notes/shared/api'
import type { NoteChangedEvent as NotesChangedEvent } from '@modules/notes/shared/api'
import { READING_LISTS_IPC } from '@modules/reading-lists/shared/api'
import type { ReadingListChangedEvent } from '@modules/reading-lists/shared/api'
import { READINGS_IPC } from '@modules/readings/shared/api'
import { TASKS_IPC, type TasksChangedEvent } from '@modules/tasks/shared/api'
import { TRAINING_IPC } from '@modules/training/shared/api'
import type { TrainingChangedEvent } from '@modules/training/shared/api'
import type { NoteChangedEvent } from '@shared/notes'
import { TRACKING_IPC, type TrackingChangedEvent } from '@shared/tracking/api'
import type { SyncStatus } from '@modules/readings/shared/types'

const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC.settingsUpdate, patch)
  },
  dialog: {
    pickPath: (options) => ipcRenderer.invoke(IPC.dialogPickPath, options)
  },
  app: {
    info: () => ipcRenderer.invoke(IPC.appInfo),
    revealData: () => ipcRenderer.invoke(IPC.appRevealData),
    onDockAction: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, action: DockActionId): void =>
        listener(action)
      ipcRenderer.on(IPC.appDockAction, handler)
      return () => ipcRenderer.removeListener(IPC.appDockAction, handler)
    },
    onFullScreenChange: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, isFullScreen: boolean): void =>
        listener(isFullScreen)
      ipcRenderer.on(IPC.appFullScreenChange, handler)
      return () => ipcRenderer.removeListener(IPC.appFullScreenChange, handler)
    },
    onPastePlain: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, text: string): void => listener(text)
      ipcRenderer.on(IPC.appPastePlain, handler)
      return () => ipcRenderer.removeListener(IPC.appPastePlain, handler)
    }
  },
  entities: {
    backlinks: (ref) => ipcRenderer.invoke(IPC.entitiesBacklinks, ref)
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
    move: (ref, to) => ipcRenderer.invoke(MEETINGS_IPC.move, ref, to),
    ensureUid: (ref) => ipcRenderer.invoke(MEETINGS_IPC.ensureUid, ref),
    syncPreviousTodos: (ref, baseHash) =>
      ipcRenderer.invoke(MEETINGS_IPC.syncPrevious, ref, baseHash),
    tickTodo: (ref, todo) => ipcRenderer.invoke(MEETINGS_IPC.tickTodo, ref, todo),
    exportPdf: (workspace, year) => ipcRenderer.invoke(MEETINGS_IPC.exportPdf, workspace, year),
    people: {
      list: () => ipcRenderer.invoke(MEETINGS_IPC.peopleList),
      add: (input) => ipcRenderer.invoke(MEETINGS_IPC.peopleAdd, input),
      update: (name, patch) => ipcRenderer.invoke(MEETINGS_IPC.peopleUpdate, name, patch),
      usage: () => ipcRenderer.invoke(MEETINGS_IPC.peopleUsage),
      remove: (name, how) => ipcRenderer.invoke(MEETINGS_IPC.peopleRemove, name, how),
      restore: (name) => ipcRenderer.invoke(MEETINGS_IPC.peopleRestore, name)
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
    plan: {
      read: (year) => ipcRenderer.invoke(TRAINING_IPC.planRead, year),
      write: (year, content, baseHash) =>
        ipcRenderer.invoke(TRAINING_IPC.planWrite, year, content, baseHash),
      reveal: () => ipcRenderer.invoke(TRAINING_IPC.planReveal),
      onChanged: (listener) => {
        const handler = (_event: Electron.IpcRendererEvent, change: NoteChangedEvent): void =>
          listener(change)
        ipcRenderer.on(TRAINING_IPC.planChanged, handler)
        return () => ipcRenderer.removeListener(TRAINING_IPC.planChanged, handler)
      }
    },
    onChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, change: TrainingChangedEvent): void =>
        listener(change)
      ipcRenderer.on(TRAINING_IPC.changed, handler)
      return () => ipcRenderer.removeListener(TRAINING_IPC.changed, handler)
    }
  },
  tasks: {
    list: (workspace) => ipcRenderer.invoke(TASKS_IPC.list, workspace),
    get: (uid) => ipcRenderer.invoke(TASKS_IPC.get, uid),
    create: (input) => ipcRenderer.invoke(TASKS_IPC.create, input),
    update: (uid, changes) => ipcRenderer.invoke(TASKS_IPC.update, uid, changes),
    setStatus: (uid, status) => ipcRenderer.invoke(TASKS_IPC.setStatus, uid, status),
    setDue: (uids, due) => ipcRenderer.invoke(TASKS_IPC.setDue, uids, due),
    delete: (uid) => ipcRenderer.invoke(TASKS_IPC.delete, uid),
    restore: (uid) => ipcRenderer.invoke(TASKS_IPC.restore, uid),
    trash: () => ipcRenderer.invoke(TASKS_IPC.trash),
    snapshot: () => ipcRenderer.invoke(TASKS_IPC.snapshot),
    discardIfEmpty: (uid) => ipcRenderer.invoke(TASKS_IPC.discardIfEmpty, uid),
    onChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, event: TasksChangedEvent): void =>
        listener(event)
      ipcRenderer.on(TASKS_IPC.changed, handler)
      return () => ipcRenderer.removeListener(TASKS_IPC.changed, handler)
    }
  },
  notes: {
    create: (input) => ipcRenderer.invoke(NOTES_IPC.create, input),
    read: (ref) => ipcRenderer.invoke(NOTES_IPC.read, ref),
    list: (workspace) => ipcRenderer.invoke(NOTES_IPC.list, workspace),
    save: (ref, changes, baseHash) => ipcRenderer.invoke(NOTES_IPC.save, ref, changes, baseHash),
    delete: (ref) => ipcRenderer.invoke(NOTES_IPC.delete, ref),
    move: (ref, to) => ipcRenderer.invoke(NOTES_IPC.move, ref, to),
    ensureUid: (ref) => ipcRenderer.invoke(NOTES_IPC.ensureUid, ref),
    discardIfEmpty: (ref) => ipcRenderer.invoke(NOTES_IPC.discardIfEmpty, ref),
    onChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, change: NotesChangedEvent): void =>
        listener(change)
      ipcRenderer.on(NOTES_IPC.changed, handler)
      return () => ipcRenderer.removeListener(NOTES_IPC.changed, handler)
    }
  },
  readingLists: {
    create: (input) => ipcRenderer.invoke(READING_LISTS_IPC.create, input),
    read: (ref) => ipcRenderer.invoke(READING_LISTS_IPC.read, ref),
    list: (workspace) => ipcRenderer.invoke(READING_LISTS_IPC.list, workspace),
    save: (ref, changes, baseHash) =>
      ipcRenderer.invoke(READING_LISTS_IPC.save, ref, changes, baseHash),
    delete: (ref) => ipcRenderer.invoke(READING_LISTS_IPC.delete, ref),
    forReading: (citekey) => ipcRenderer.invoke(READING_LISTS_IPC.forReading, citekey),
    onChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, change: ReadingListChangedEvent): void =>
        listener(change)
      ipcRenderer.on(READING_LISTS_IPC.changed, handler)
      return () => ipcRenderer.removeListener(READING_LISTS_IPC.changed, handler)
    }
  },
  tracking: {
    years: (workspace) => ipcRenderer.invoke(TRACKING_IPC.years, workspace),
    get: (workspace, year) => ipcRenderer.invoke(TRACKING_IPC.get, workspace, year),
    running: () => ipcRenderer.invoke(TRACKING_IPC.running),
    start: (workspace, label, task, client) =>
      ipcRenderer.invoke(TRACKING_IPC.start, workspace, label, task, client),
    stop: () => ipcRenderer.invoke(TRACKING_IPC.stop),
    endAt: (workspace, year, id, time) =>
      ipcRenderer.invoke(TRACKING_IPC.endAt, workspace, year, id, time),
    deleteSession: (workspace, year, id) =>
      ipcRenderer.invoke(TRACKING_IPC.deleteSession, workspace, year, id),
    setTaskMinutes: (workspace, year, date, label, minutes, client) =>
      ipcRenderer.invoke(
        TRACKING_IPC.setTaskMinutes,
        workspace,
        year,
        date,
        label,
        minutes,
        client
      ),
    renameTask: (workspace, year, date, from, to, client) =>
      ipcRenderer.invoke(TRACKING_IPC.renameTask, workspace, year, date, from, to, client),
    setClient: (workspace, year, date, label, from, to) =>
      ipcRenderer.invoke(TRACKING_IPC.setClient, workspace, year, date, label, from, to),
    addTime: (workspace, year, date, label, minutes, client, task) =>
      ipcRenderer.invoke(TRACKING_IPC.addTime, workspace, year, date, label, minutes, client, task),
    setNote: (workspace, year, date, note) =>
      ipcRenderer.invoke(TRACKING_IPC.setNote, workspace, year, date, note),
    createContract: (workspace, start, end, terms) =>
      ipcRenderer.invoke(TRACKING_IPC.createContract, workspace, start, end, terms),
    setContractEnd: (workspace, year, end) =>
      ipcRenderer.invoke(TRACKING_IPC.setContractEnd, workspace, year, end),
    setPlan: (workspace, year, plan) =>
      ipcRenderer.invoke(TRACKING_IPC.setPlan, workspace, year, plan),
    addTimeOff: (workspace, year, from, to, type) =>
      ipcRenderer.invoke(TRACKING_IPC.addTimeOff, workspace, year, from, to, type),
    editTimeOff: (workspace, year, from, to, type) =>
      ipcRenderer.invoke(TRACKING_IPC.editTimeOff, workspace, year, from, to, type),
    removeTimeOff: (workspace, year, date) =>
      ipcRenderer.invoke(TRACKING_IPC.removeTimeOff, workspace, year, date),
    onChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, change: TrackingChangedEvent): void =>
        listener(change)
      ipcRenderer.on(TRACKING_IPC.changed, handler)
      return () => ipcRenderer.removeListener(TRACKING_IPC.changed, handler)
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
