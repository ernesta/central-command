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
  /** One sub-folder per workspace, e.g. meetings/research. */
  meetingsNotes: string
  /** One sub-folder per workspace, e.g. training/research. */
  trainingNotes: string
  /** The yearly training plans (one Markdown file per academic year), apart from the entry files. */
  trainingPlans: string
  people: string
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
    meetingsNotes: join(notes, 'meetings'),
    trainingNotes: join(notes, 'training'),
    trainingPlans: join(notes, 'training-plans'),
    people: join(data, 'people.json'),
    settings: join(root, 'settings.json')
  }
}

/**
 * `CENTRAL_COMMAND_HOME` relocates the whole data folder's parent (for tests and
 * trying the app against a scratch library without touching real data).
 */
export function getAppPaths(): AppPaths {
  return resolvePaths(process.env.CENTRAL_COMMAND_HOME || app.getPath('home'))
}
