import { mkdir } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { exportHtmlAsPdf } from '../../../main/export-pdf'
import { readNoteFile } from '../../../main/notes/guarded-file'
import { listMeetingRows } from '../../meetings/main/repository'
import { meetingHours } from '../../meetings/shared/hours'
import { todayIso, trackingMoment } from '@shared/time'
import { dayNumber } from '@shared/year'
import { NotesWatcher } from '../../../main/notes/watcher'
import { TrackingStore } from '../../../main/tracking/store'
import { trackedByTask } from '../../tasks/shared/tracked'
import type { MainContext, MainModule } from '../../main-registry'
import {
  TRAINING_IPC,
  type CreateTrainingInput,
  type TrainingChangedEvent,
  type TrainingExportResult
} from '../shared/api'
import { reportFileName, trainingReportHtml } from '../shared/report'
import type { TrainingChanges } from '../shared/front-matter'
import { TRAINING_WORKSPACES, type TrainingRef, type TrainingWorkspace } from '../shared/types'
import { trainingPath } from './file-name'
import { PlanStore } from './plan-store'
import { planYearFromFileName } from '../shared/plan'
import { openablePath, relativeToRoot, resolveInside } from './files'
import { FolderMemory, listLinkedFolder } from './folder-memory'
import { trainingMigrations } from './migrations'
import { settleSelfStudyTasks } from './self-study-sweep'
import { TrainingStore } from './training-store'
import { broadcastTasksChanged } from '../../tasks/main/broadcast'
import { localMoment } from '../../tasks/main/session-sweep'
import { TasksStore } from '../../tasks/main/tasks-store'

/** Workspaces whose training folder is created and watched. */
const ACTIVE_WORKSPACES: readonly TrainingWorkspace[] = ['life', 'research']

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

function register({ db, paths, settings }: MainContext): () => void {
  // Read only: the Hours files, for the time tracked on each lecture's task (its self-study) in the PDF.
  const tracking = new TrackingStore(paths.time, {
    starts: () => settings.get().yearStarts,
    now: trackingMoment
  })
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
  ipcMain.handle(TRAINING_IPC.restore, (_event, ref: unknown, content: unknown) => {
    if (typeof content !== 'string') throw new Error('Not a note')
    return store.restore(asRef(ref), content)
  })

  ipcMain.handle(
    TRAINING_IPC.exportPdf,
    async (event, year: unknown): Promise<TrainingExportResult> => {
      if (typeof year !== 'string' || dayNumber(year) === null) {
        throw new Error('Invalid year')
      }
      const today = todayIso()
      const html = trainingReportHtml({
        rows: store.list('research'),
        year,
        today,
        aimHours: settings.get().trainingAimHours,
        meetingMinutes: meetingHours(listMeetingRows(db, 'research'), year, today).minutes,
        selfStudy: trackedByTask(tracking.years('research').map((y) => tracking.get('research', y)))
      })
      return exportHtmlAsPdf(event.sender, {
        html,
        dialogTitle: 'Export the training log',
        fileName: reportFileName(year)
      })
    }
  )

  // The yearly plan: one Markdown file per year, in its own folder. The renderer's notes
  // session names a note by a string, so the year travels as text.
  const plans = new PlanStore(paths.trainingPlans)
  const asYear = (value: unknown): number => {
    const year = typeof value === 'string' ? Number(value) : NaN
    if (!Number.isInteger(year) || year < 1900 || year > 3000) throw new Error('Invalid plan year')
    return year
  }
  ipcMain.handle(TRAINING_IPC.planRead, (_event, year: unknown) => plans.read(asYear(year)))
  ipcMain.handle(
    TRAINING_IPC.planWrite,
    (_event, year: unknown, content: unknown, baseHash: unknown) => {
      if (typeof content !== 'string' || typeof baseHash !== 'string') {
        throw new Error('Invalid plan write')
      }
      return plans.write(asYear(year), content, baseHash)
    }
  )
  ipcMain.handle(TRAINING_IPC.planReveal, async () => {
    await mkdir(paths.trainingPlans, { recursive: true })
    const failure = await shell.openPath(paths.trainingPlans)
    if (failure) throw new Error(failure)
  })
  const planWatcher = new NotesWatcher({
    dir: paths.trainingPlans,
    onNoteChanged: (fileName) => {
      const year = planYearFromFileName(fileName)
      if (year === null) return
      void plans.read(year).then(({ hash }) => {
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send(TRAINING_IPC.planChanged, { citekey: String(year), hash })
        }
      })
    }
  })
  void mkdir(paths.trainingPlans, { recursive: true }).then(() => planWatcher.start())

  // The Trainings folder is read from the settings on every call, so a change there applies at once.
  const root = (): string => settings.get().trainingsFolder
  const text = (value: unknown, what: string): string => {
    if (typeof value !== 'string') throw new Error(`Invalid ${what}`)
    return value
  }
  const folderMemory = new FolderMemory(db)
  ipcMain.handle(TRAINING_IPC.filesList, (_event, folder: unknown, sub: unknown) =>
    listLinkedFolder(
      root(),
      text(folder, 'folder'),
      sub === undefined ? '' : text(sub, 'sub-folder'),
      folderMemory
    )
  )
  ipcMain.handle(
    TRAINING_IPC.filesOpen,
    async (_event, folder: unknown, sub: unknown, name: unknown) => {
      const path = await openablePath(
        root(),
        text(folder, 'folder'),
        text(sub, 'sub'),
        text(name, 'name')
      )
      const failure = await shell.openPath(path)
      if (failure) throw new Error(failure)
    }
  )
  ipcMain.handle(
    TRAINING_IPC.filesReveal,
    async (_event, folder: unknown, sub: unknown, name: unknown) => {
      shell.showItemInFolder(
        await resolveInside(root(), text(folder, 'folder'), text(sub, 'sub'), text(name, 'name'))
      )
    }
  )
  ipcMain.handle(TRAINING_IPC.filesToRelative, (_event, absolute: unknown) =>
    relativeToRoot(root(), text(absolute, 'path'))
  )

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
  // Every Research entry with a title and a date has its self-study task: made here so it exists whether or not the note is opened.
  const tasks = new TasksStore(db)
  let settling = false
  const settleSelfStudy = async (): Promise<void> => {
    if (settling) return
    settling = true
    try {
      const changed = await settleSelfStudyTasks({
        db,
        tasks,
        training: store,
        now: localMoment(),
        nowMs: Date.now()
      })
      if (changed) broadcastTasksChanged('research')
    } catch (error) {
      console.error('Could not settle the self-study tasks:', error)
    } finally {
      settling = false
    }
  }
  let sweep: ReturnType<typeof setInterval> | null = null
  void Promise.all(
    ACTIVE_WORKSPACES.map(async (workspace) => {
      await mkdir(dirFor(workspace), { recursive: true })
      await store.reindexAll(workspace)
    })
  ).then(() => {
    watchers.forEach((w) => w.start())
    void settleSelfStudy()
    sweep = setInterval(() => void settleSelfStudy(), 60_000)
  })

  return () => {
    if (sweep) clearInterval(sweep)
    for (const w of watchers) void w.close()
    void planWatcher.close()
    for (const channel of Object.values(TRAINING_IPC)) ipcMain.removeHandler(channel)
  }
}

export const trainingMainModule: MainModule = {
  id: 'training',
  migrations: trainingMigrations,
  register
}
