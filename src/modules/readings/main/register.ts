import { BrowserWindow, ipcMain } from 'electron'
import type { MainContext, MainModule } from '../../main-registry'
import { READINGS_IPC } from '../shared/api'
import { readingsMigrations } from './migrations'
import { normaliseQuery } from '../shared/query'
import { queryReadings, collectTags } from './query'
import { getCounts, getReadingByCitekey, listAllReadings } from './repository'
import { SyncService } from './sync-service'
import { ExportWatcher } from './watcher'

function register({ db, settings }: MainContext): () => void {
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

  void watcher.watch(settings.get().zoteroExportPath)
  void sync.sync()

  return () => {
    offStatus()
    offSettings()
    void watcher.close()
  }
}

export const readingsMainModule: MainModule = {
  id: 'readings',
  migrations: readingsMigrations,
  register
}
