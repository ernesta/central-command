import { mkdir } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { exportHtmlAsPdf } from '../../../main/export-pdf'
import { todayIso } from '@shared/time'
import { readNoteFile } from '../../../main/notes/guarded-file'
import { NotesWatcher } from '../../../main/notes/watcher'
import type { MainContext, MainModule } from '../../main-registry'
import {
  MEETINGS_IPC,
  type MeetingChangedEvent,
  type CreateMeetingInput,
  type MeetingsExportResult
} from '../shared/api'
import { meetingsReportHtml, reportFileName } from '../shared/report'
import type { MeetingChanges } from '../shared/front-matter'
import { MEETING_WORKSPACES, type MeetingRef, type MeetingWorkspace } from '../shared/types'
import { meetingPath } from './file-name'
import { meetingsMigrations } from './migrations'
import { MeetingsStore } from './meetings-store'
import { listMeetingRows } from './repository'
import { listTrainingRows } from '../../training/main/repository'
import { PeopleService } from './people-service'
import { PeopleStore } from './people-store'
import type { RemoveHow } from '../shared/api'

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
  const peopleService = new PeopleService({
    store: people,
    meetingsDir: dirFor('research'),
    trainingDir: join(paths.trainingNotes, 'research'),
    backupsDir: join(paths.root, 'backups'),
    indexed: () => ({
      meetings: listMeetingRows(db, 'research'),
      trainings: listTrainingRows(db, 'research')
    })
  })

  ipcMain.handle(MEETINGS_IPC.create, (_event, input: unknown) =>
    store.create(asObject(input, 'meeting') as unknown as CreateMeetingInput)
  )
  ipcMain.handle(
    MEETINGS_IPC.exportPdf,
    async (event, year: unknown): Promise<MeetingsExportResult> => {
      if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 3000) {
        throw new Error('Invalid academic year')
      }
      return exportHtmlAsPdf(event.sender, {
        html: meetingsReportHtml({
          rows: listMeetingRows(db, 'research'),
          year,
          today: todayIso()
        }),
        dialogTitle: 'Export the supervision log',
        fileName: reportFileName(year)
      })
    }
  )
  ipcMain.handle(MEETINGS_IPC.read, (_event, ref: unknown) => store.read(asRef(ref)))
  ipcMain.handle(MEETINGS_IPC.list, async (_event, workspace: unknown) => {
    if (
      typeof workspace !== 'string' ||
      !(MEETING_WORKSPACES as readonly string[]).includes(workspace)
    ) {
      throw new Error('Invalid workspace')
    }
    await store.pruneMissing(workspace as MeetingWorkspace)
    return listMeetingRows(db, workspace as MeetingWorkspace)
  })
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
  ipcMain.handle(MEETINGS_IPC.peopleAdd, (_event, input: unknown) => {
    const o = asObject(input, 'person')
    if (typeof o.name !== 'string') throw new Error('Invalid person')
    return people.add({
      name: o.name,
      initials: typeof o.initials === 'string' ? o.initials : undefined,
      me: o.me === true
    })
  })
  ipcMain.handle(MEETINGS_IPC.peopleUsage, () => peopleService.usage())
  ipcMain.handle(MEETINGS_IPC.peopleUpdate, (_event, name: unknown, patch: unknown) => {
    if (typeof name !== 'string') throw new Error('Invalid person')
    const o = asObject(patch, 'change')
    return peopleService.update(name, {
      name: typeof o.name === 'string' ? o.name : undefined,
      initials: typeof o.initials === 'string' ? o.initials : undefined,
      me: typeof o.me === 'boolean' ? o.me : undefined
    })
  })
  ipcMain.handle(MEETINGS_IPC.peopleRemove, (_event, name: unknown, how: unknown) => {
    if (typeof name !== 'string') throw new Error('Invalid person')
    const o = asObject(how, 'removal')
    if (o.how === 'delete' || o.how === 'archive') return peopleService.remove(name, { how: o.how })
    if (o.how === 'merge' && typeof o.into === 'string') {
      return peopleService.remove(name, { how: 'merge', into: o.into } satisfies RemoveHow)
    }
    throw new Error('Invalid removal')
  })
  ipcMain.handle(MEETINGS_IPC.peopleRestore, (_event, name: unknown) => {
    if (typeof name !== 'string') throw new Error('Invalid person')
    return peopleService.restore(name)
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
