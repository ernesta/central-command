import { mkdir } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { todayIso } from '@shared/time'
import { readNoteFile } from '../../../main/notes/guarded-file'
import { NotesWatcher } from '../../../main/notes/watcher'
import type { MainContext, MainModule } from '../../main-registry'
import { NOTES_IPC, type CreateNoteInput, type NoteChangedEvent } from '../shared/api'
import type { NoteChanges } from '../shared/front-matter'
import { NOTE_WORKSPACES, type NoteRef, type NoteWorkspace } from '../shared/types'
import { notesPath } from './file-name'
import { notesMigrations } from './migrations'
import { NotesStore } from './notes-store'
import { listNoteRows } from './repository'

/** Workspaces whose notes folder is created and watched. Work joins when it gets its own page. */
const ACTIVE_WORKSPACES: readonly NoteWorkspace[] = ['research']

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${what}`)
  return value as Record<string, unknown>
}

function asWorkspace(value: unknown): NoteWorkspace {
  if (typeof value !== 'string' || !(NOTE_WORKSPACES as readonly string[]).includes(value)) {
    throw new Error('Invalid workspace')
  }
  return value as NoteWorkspace
}

function asRef(value: unknown): NoteRef {
  const o = asObject(value, 'note')
  if (typeof o.id !== 'string') throw new Error('Invalid note')
  return { workspace: asWorkspace(o.workspace), id: o.id }
}

function register({ db, paths }: MainContext): () => void {
  const dirFor = (workspace: NoteWorkspace): string => join(paths.noteFiles, workspace)
  const store = new NotesStore({
    db,
    dirFor,
    today: todayIso,
    trash: (path) => shell.trashItem(path)
  })

  ipcMain.handle(NOTES_IPC.create, (_event, input: unknown) => {
    const o = asObject(input, 'note')
    const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
    return store.create({
      workspace: asWorkspace(o.workspace),
      title: text(o.title),
      group: text(o.group),
      subgroup: text(o.subgroup),
      body: text(o.body)
    } satisfies CreateNoteInput)
  })
  ipcMain.handle(NOTES_IPC.read, (_event, ref: unknown) => store.read(asRef(ref)))
  ipcMain.handle(NOTES_IPC.list, async (_event, workspace: unknown) => {
    const w = asWorkspace(workspace)
    await store.pruneMissing(w)
    return listNoteRows(db, w)
  })
  ipcMain.handle(NOTES_IPC.save, (_event, ref: unknown, changes: unknown, baseHash: unknown) => {
    if (typeof baseHash !== 'string') throw new Error('Invalid note save')
    return store.save(asRef(ref), asObject(changes, 'changes') as NoteChanges, baseHash)
  })
  ipcMain.handle(NOTES_IPC.delete, (_event, ref: unknown) => store.delete(asRef(ref)))

  const watchers = ACTIVE_WORKSPACES.map(
    (workspace) =>
      new NotesWatcher({
        dir: dirFor(workspace),
        onNoteChanged: (fileName) => {
          void store.reindexFile(workspace, fileName).then(async (ref) => {
            if (!ref) return
            const note = await readNoteFile(notesPath(dirFor(workspace), ref.id))
            const event: NoteChangedEvent = { ref, hash: note.exists ? note.hash : null }
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send(NOTES_IPC.changed, event)
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
    for (const channel of Object.values(NOTES_IPC)) ipcMain.removeHandler(channel)
  }
}

export const notesMainModule: MainModule = {
  id: 'notes',
  migrations: notesMigrations,
  register
}
