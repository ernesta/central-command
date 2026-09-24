import { mkdir } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { readNoteFile } from '../../../main/notes/guarded-file'
import { NotesWatcher } from '../../../main/notes/watcher'
import type { MainContext, MainModule } from '../../main-registry'
import { MEETINGS_IPC, type MeetingChangedEvent, type CreateMeetingInput } from '../shared/api'
import type { MeetingChanges } from '../shared/front-matter'
import { MEETING_WORKSPACES, type MeetingRef, type MeetingWorkspace } from '../shared/types'
import { meetingPath } from './file-name'
import { meetingsMigrations } from './migrations'
import { MeetingsStore } from './meetings-store'
import { PeopleStore } from './people-store'

/** Workspaces whose meetings folder is created and watched. Work joins when it gets its own page. */
const ACTIVE_WORKSPACES: readonly MeetingWorkspace[] = ['research']

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${what}`)
  return value as Record<string, unknown>
}

function asRef(value: unknown): MeetingRef {
  const o = asObject(value, 'meeting')
  if (
    typeof o.workspace !== 'string' ||
    !(MEETING_WORKSPACES as readonly string[]).includes(o.workspace) ||
    typeof o.id !== 'string'
  ) {
    throw new Error('Invalid meeting')
  }
  return { workspace: o.workspace as MeetingWorkspace, id: o.id }
}

function register({ db, paths }: MainContext): () => void {
  const dirFor = (workspace: MeetingWorkspace): string => join(paths.meetingsNotes, workspace)
  const store = new MeetingsStore({
    db,
    dirFor,
    trash: (path) => shell.trashItem(path)
  })
  const people = new PeopleStore(paths.people)
  people.load().catch((error) => console.error('Could not read the people list:', error))

  ipcMain.handle(MEETINGS_IPC.create, (_event, input: unknown) =>
    store.create(asObject(input, 'meeting') as unknown as CreateMeetingInput)
  )
  ipcMain.handle(MEETINGS_IPC.read, (_event, ref: unknown) => store.read(asRef(ref)))
  ipcMain.handle(MEETINGS_IPC.save, (_event, ref: unknown, changes: unknown, baseHash: unknown) => {
    if (typeof baseHash !== 'string') throw new Error('Invalid meeting save')
    return store.save(asRef(ref), asObject(changes, 'changes') as MeetingChanges, baseHash)
  })
  ipcMain.handle(MEETINGS_IPC.delete, (_event, ref: unknown) => store.delete(asRef(ref)))
  ipcMain.handle(MEETINGS_IPC.syncPrevious, (_event, ref: unknown, baseHash: unknown) => {
    if (typeof baseHash !== 'string') throw new Error('Invalid sync request')
    return store.syncPreviousTodos(asRef(ref), baseHash)
  })
  ipcMain.handle(MEETINGS_IPC.peopleList, () => people.list())
  ipcMain.handle(MEETINGS_IPC.peopleAdd, (_event, name: unknown) => {
    if (typeof name !== 'string') throw new Error('Invalid name')
    return people.add({ name })
  })

  const watchers = ACTIVE_WORKSPACES.map(
    (workspace) =>
      new NotesWatcher({
        dir: dirFor(workspace),
        onNoteChanged: (fileName) => {
          void store.reindexFile(workspace, fileName).then(async (ref) => {
            if (!ref) return
            const note = await readNoteFile(meetingPath(dirFor(workspace), ref.id))
            const event: MeetingChangedEvent = { ref, hash: note.exists ? note.hash : null }
            for (const window of BrowserWindow.getAllWindows()) {
              window.webContents.send(MEETINGS_IPC.changed, event)
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
    for (const channel of Object.values(MEETINGS_IPC)) ipcMain.removeHandler(channel)
  }
}

export const meetingsMainModule: MainModule = {
  id: 'meetings',
  migrations: meetingsMigrations,
  register
}
