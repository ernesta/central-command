import { mkdir } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { readNoteFile } from '../../../main/notes/guarded-file'
import { NotesWatcher } from '../../../main/notes/watcher'
import type { MainContext, MainModule } from '../../main-registry'
import { TRAINING_IPC, type CreateTrainingInput, type TrainingChangedEvent } from '../shared/api'
import type { TrainingChanges } from '../shared/front-matter'
import { TRAINING_WORKSPACES, type TrainingRef, type TrainingWorkspace } from '../shared/types'
import { trainingPath } from './file-name'
import { trainingMigrations } from './migrations'
import { TrainingStore } from './training-store'

/** Workspaces whose training folder is created and watched. */
const ACTIVE_WORKSPACES: readonly TrainingWorkspace[] = ['research']

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${what}`)
  return value as Record<string, unknown>
}

function asWorkspace(value: unknown): TrainingWorkspace {
  if (typeof value !== 'string' || !(TRAINING_WORKSPACES as readonly string[]).includes(value)) {
    throw new Error('Invalid workspace')
  }
  return value as TrainingWorkspace
}

function asRef(value: unknown): TrainingRef {
  const o = asObject(value, 'training entry')
  if (typeof o.id !== 'string') throw new Error('Invalid training entry')
  return { workspace: asWorkspace(o.workspace), id: o.id }
}

function register({ db, paths }: MainContext): () => void {
  const dirFor = (workspace: TrainingWorkspace): string => join(paths.trainingNotes, workspace)
  const store = new TrainingStore({ db, dirFor, trash: (path) => shell.trashItem(path) })

  ipcMain.handle(TRAINING_IPC.create, (_event, input: unknown) =>
    store.create(asObject(input, 'training entry') as unknown as CreateTrainingInput)
  )
  ipcMain.handle(TRAINING_IPC.read, (_event, ref: unknown) => store.read(asRef(ref)))
  ipcMain.handle(TRAINING_IPC.list, async (_event, workspace: unknown) => {
    const w = asWorkspace(workspace)
    await store.pruneMissing(w)
    return store.list(w)
  })
  ipcMain.handle(TRAINING_IPC.save, (_event, ref: unknown, changes: unknown, baseHash: unknown) => {
    if (typeof baseHash !== 'string') throw new Error('Invalid training save')
    return store.save(asRef(ref), asObject(changes, 'changes') as TrainingChanges, baseHash)
  })
  ipcMain.handle(TRAINING_IPC.delete, (_event, ref: unknown) => store.delete(asRef(ref)))

  const watchers = ACTIVE_WORKSPACES.map(
    (workspace) =>
      new NotesWatcher({
        dir: dirFor(workspace),
        onNoteChanged: (fileName) => {
          void store.reindexFile(workspace, fileName).then(async (ref) => {
            if (!ref) return
            const note = await readNoteFile(trainingPath(dirFor(workspace), ref.id))
            const event: TrainingChangedEvent = { ref, hash: note.exists ? note.hash : null }
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send(TRAINING_IPC.changed, event)
            }
          })
        }
      })
  )
  void Promise.all(
    ACTIVE_WORKSPACES.map(async (workspace) => {
      await mkdir(dirFor(workspace), { recursive: true })
      await store.reindexAll(workspace)
    })
  ).then(() => watchers.forEach((w) => w.start()))

  return () => {
    for (const w of watchers) void w.close()
    for (const channel of Object.values(TRAINING_IPC)) ipcMain.removeHandler(channel)
  }
}

export const trainingMainModule: MainModule = {
  id: 'training',
  migrations: trainingMigrations,
  register
}
