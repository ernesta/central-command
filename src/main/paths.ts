import { join } from 'path'
import { app } from 'electron'
import { DATA_DIR_NAME } from '@shared/app-info'

export interface AppPaths {
  root: string
  data: string
  database: string
  defaultBibExport: string
  notes: string
  readingsNotes: string
  settings: string
}

/** Pure so it can be unit-tested; the home directory is always injected. */
export function resolvePaths(home: string): AppPaths {
  const root = join(home, DATA_DIR_NAME)
  const data = join(root, 'data')
  const notes = join(root, 'notes')
  return {
    root,
    data,
    database: join(data, 'central-command.sqlite'),
    defaultBibExport: join(data, 'zotero-export.bib'),
    notes,
    readingsNotes: join(notes, 'readings'),
    settings: join(root, 'settings.json')
  }
}

export function getAppPaths(): AppPaths {
  return resolvePaths(app.getPath('home'))
}
