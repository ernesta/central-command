import { mkdir } from 'fs/promises'
import { BrowserWindow, ipcMain } from 'electron'
import type { MainContext, MainModule } from '../../main-registry'
import { READINGS_IPC } from '../shared/api'
import { readingsMigrations } from './migrations'
import { normaliseQuery } from '../shared/query'
import { queryReadings, collectTags } from './query'
import { NotesStore } from './notes-store'
import { NotesWatcher } from '../../../main/notes/watcher'
import { getCounts, getReadingByCitekey, listAllReadings } from './repository'
import { SyncService } from './sync-service'
import { ExportWatcher } from './watcher'

function register({ db, paths, settings }: MainContext): () => void {
  const sync = new SyncService({ db, getExportPath: () => settings.get().zoteroExportPath })
  const watcher = new ExportWatcher({ onChange: () => void sync.sync() })

  ipcMain.handle(READINGS_IPC.syncNow, () => sync.sync())
  ipcMain.handle(READINGS_IPC.syncStatus, () => sync.status())
  ipcMain.handle(READINGS_IPC.counts, () => getCounts(db))
  ipcMain.handle(READINGS_IPC.list, (_event, query: unknown) =>
    queryReadings(listAllReadings(db), normaliseQuery(query))
  )
  ipcMain.handle(READINGS_IPC.tags, () => collectTags(listAllReadings(db)))
  ipcMain.handle(READINGS_IPC.get, (_event, citekey: unknown) =>
    typeof citekey === 'string' ? getReadingByCitekey(db, citekey) : null
  )

  // Push status changes to every open window.
  const offStatus = sync.onStatusChange((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(READINGS_IPC.syncStatusChanged, status)
    }
  })

  // Re-point the watcher and resync whenever the export path changes.
  const offSettings = settings.onChange((now, previous) => {
    if (now.zoteroExportPath === previous.zoteroExportPath) return
    void watcher.watch(now.zoteroExportPath).then(() => sync.sync())
  })

  // Notes: Markdown files on disk, with caches (has_notes, excerpt) kept in the database.
  const notes = new NotesStore({ db, notesDir: paths.readingsNotes })
  ipcMain.handle(READINGS_IPC.notesRead, (_event, citekey: unknown) => {
    if (typeof citekey !== 'string') throw new Error('Invalid citekey')
    return notes.read(citekey)
  })
  ipcMain.handle(
    READINGS_IPC.notesWrite,
    (_event, citekey: unknown, content: unknown, baseHash: unknown) => {
      if (
        typeof citekey !== 'string' ||
        typeof content !== 'string' ||
        typeof baseHash !== 'string'
      ) {
        throw new Error('Invalid note write')
      }
      return notes.write(citekey, content, baseHash)
    }
  )
  const notesWatcher = new NotesWatcher({
    dir: paths.readingsNotes,
    onNoteChanged: (fileName) => {
      void notes.reindexFile(fileName).then(async (citekey) => {
        if (!citekey) return
        const { hash } = await notes.read(citekey)
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(READINGS_IPC.notesChanged, { citekey, hash })
        }
      })
    }
  })
  // Reconcile caches with the folder at startup and after each sync (new readings may already have notes).
  let lastReconciled = ''
  const offReconcile = sync.onStatusChange((status) => {
    const finished = status.lastRun?.finishedAt ?? ''
    if (status.state === 'idle' && finished !== lastReconciled) {
      lastReconciled = finished
      void notes.reindexAll()
    }
  })
  void mkdir(paths.readingsNotes, { recursive: true }).then(() => {
    notesWatcher.start()
    return notes.reindexAll()
  })

  void watcher.watch(settings.get().zoteroExportPath)
  void sync.sync()

  return () => {
    offStatus()
    offSettings()
    offReconcile()
    void watcher.close()
    void notesWatcher.close()
  }
}

export const readingsMainModule: MainModule = {
  id: 'readings',
  migrations: readingsMigrations,
  register
}
