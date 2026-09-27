import { mkdir } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { readNoteFile } from '../../../main/notes/guarded-file'
import { NotesWatcher } from '../../../main/notes/watcher'
import type { MainContext, MainModule } from '../../main-registry'
import {
  READING_LISTS_IPC,
  type CreateListInput,
  type ReadingListChangedEvent
} from '../shared/api'
import type { ListChanges } from '../shared/front-matter'
import {
  READING_LIST_WORKSPACES,
  type ReadingListRef,
  type ReadingListWorkspace
} from '../shared/types'
import { listPath } from './file-name'
import { readingListsMigrations } from './migrations'
import { ReadingListStore } from './list-store'
import { listListRows, mentionsOf } from './repository'

/** Workspaces whose reading lists folder is created and watched. Work joins when it gets its own page. */
const ACTIVE_WORKSPACES: readonly ReadingListWorkspace[] = ['research']

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${what}`)
  return value as Record<string, unknown>
}

function asWorkspace(value: unknown): ReadingListWorkspace {
  if (
    typeof value !== 'string' ||
    !(READING_LIST_WORKSPACES as readonly string[]).includes(value)
  ) {
    throw new Error('Invalid workspace')
  }
  return value as ReadingListWorkspace
}

function asRef(value: unknown): ReadingListRef {
  const o = asObject(value, 'reading list')
  if (typeof o.id !== 'string') throw new Error('Invalid reading list')
  return { workspace: asWorkspace(o.workspace), id: o.id }
}

function register({ db, paths }: MainContext): () => void {
  const dirFor = (workspace: ReadingListWorkspace): string =>
    join(paths.readingListFiles, workspace)
  const store = new ReadingListStore({
    db,
    dirFor,
    trash: (path) => shell.trashItem(path)
  })

  ipcMain.handle(READING_LISTS_IPC.create, (_event, input: unknown) => {
    const o = asObject(input, 'reading list')
    const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
    return store.create({
      workspace: asWorkspace(o.workspace),
      title: text(o.title)
    } satisfies CreateListInput)
  })
  ipcMain.handle(READING_LISTS_IPC.read, (_event, ref: unknown) => store.read(asRef(ref)))
  ipcMain.handle(READING_LISTS_IPC.list, async (_event, workspace: unknown) => {
    const w = asWorkspace(workspace)
    await store.pruneMissing(w)
    return listListRows(db, w)
  })
  ipcMain.handle(
    READING_LISTS_IPC.save,
    (_event, ref: unknown, changes: unknown, baseHash: unknown) => {
      if (typeof baseHash !== 'string') throw new Error('Invalid reading list save')
      return store.save(asRef(ref), asObject(changes, 'changes') as ListChanges, baseHash)
    }
  )
  ipcMain.handle(READING_LISTS_IPC.delete, (_event, ref: unknown) => store.delete(asRef(ref)))
  ipcMain.handle(READING_LISTS_IPC.forReading, (_event, citekey: unknown) => {
    if (typeof citekey !== 'string') throw new Error('Invalid citekey')
    return mentionsOf(db, citekey)
  })

  const watchers = ACTIVE_WORKSPACES.map(
    (workspace) =>
      new NotesWatcher({
        dir: dirFor(workspace),
        onNoteChanged: (fileName) => {
          void store.reindexFile(workspace, fileName).then(async (ref) => {
            if (!ref) return
            const note = await readNoteFile(listPath(dirFor(workspace), ref.id))
            const event: ReadingListChangedEvent = { ref, hash: note.exists ? note.hash : null }
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send(READING_LISTS_IPC.changed, event)
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
    for (const channel of Object.values(READING_LISTS_IPC)) ipcMain.removeHandler(channel)
  }
}

export const readingListsMainModule: MainModule = {
  id: 'reading-lists',
  migrations: readingListsMigrations,
  register
}
