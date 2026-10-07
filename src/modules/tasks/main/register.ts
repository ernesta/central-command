import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { BrowserWindow, ipcMain } from 'electron'
import type { MainContext, MainModule } from '../../main-registry'
import { TASKS_IPC, type CreateTaskInput, type TasksChangedEvent } from '../shared/api'
import { isValidRecurrence } from '../shared/recurrence'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_WORKSPACES,
  type TaskChanges,
  type TaskPriority,
  type TaskStatus,
  type TaskWorkspace
} from '../shared/types'
import { tasksMigrations } from './migrations'
import { basename } from 'path'
import { countAllTasks, listTasks, listTrash } from './repository'
import { writeTasksSnapshot } from './snapshot'
import { TrackingStore } from '../../../main/tracking/store'
import { trackingMoment } from '@shared/time'
import { workClients } from '../shared/work-lists'
import { TasksStore } from './tasks-store'

/** One readable copy of the tasks per day, taken when the app starts (nothing is written while there are no tasks). */
function snapshotOncePerDay({ db, paths }: MainContext): void {
  if (countAllTasks(db) === 0) return
  const dir = join(paths.root, 'backups', 'tasks')
  const day = new Date().toISOString().slice(0, 10)
  if (existsSync(dir) && readdirSync(dir).some((f) => f.startsWith(`tasks-${day}`))) return
  writeTasksSnapshot(db, dir)
}

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`Invalid ${what}`)
  return value as Record<string, unknown>
}

function asWorkspace(value: unknown): TaskWorkspace {
  if (typeof value !== 'string' || !(TASK_WORKSPACES as readonly string[]).includes(value)) {
    throw new Error('Invalid workspace')
  }
  return value as TaskWorkspace
}

function asUid(value: unknown): string {
  if (typeof value !== 'string' || value === '') throw new Error('Invalid task')
  return value
}

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const dateOrNull = (v: unknown): string | null | undefined =>
  v === null ? null : typeof v === 'string' ? v : undefined

function asTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every((t) => typeof t === 'string')) {
    throw new Error('Invalid tags')
  }
  return value as string[]
}

function asRecurrence(value: unknown): CreateTaskInput['recurrence'] {
  if (value === undefined || value === null) return value
  if (!isValidRecurrence(value)) throw new Error('Invalid repeat rule')
  return { every: value.every, unit: value.unit }
}

function register(context: MainContext): () => void {
  try {
    snapshotOncePerDay(context)
  } catch (error) {
    console.error('Could not take the daily tasks snapshot:', error)
  }
  // Work's lists are its clients: read from the contracts on disk each time, so a client added in Settings counts at once.
  const tracking = new TrackingStore(context.paths.time, {
    starts: () => context.settings.get().yearStarts,
    now: trackingMoment
  })
  const clients = (): string[] =>
    workClients(tracking.years('work').map((y) => tracking.get('work', y).plan))
  const store = new TasksStore(context.db, undefined, clients)
  const broadcast = (workspace: TaskWorkspace): void => {
    const event: TasksChangedEvent = { workspace }
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(TASKS_IPC.changed, event)
    }
  }
  /** Run a change, then tell every window which workspace's tasks moved. */
  const changing = <T>(uid: string | string[], run: () => T): T => {
    const uids = Array.isArray(uid) ? uid : [uid]
    const workspaces = new Set(
      uids.flatMap((u) => {
        const t = store.get(u)
        return t ? [t.workspace] : []
      })
    )
    const result = run()
    for (const w of workspaces) broadcast(w)
    return result
  }

  ipcMain.handle(TASKS_IPC.list, (_event, workspace: unknown) =>
    listTasks(context.db, asWorkspace(workspace))
  )
  ipcMain.handle(TASKS_IPC.get, (_event, uid: unknown) => store.get(asUid(uid)))
  ipcMain.handle(TASKS_IPC.clients, (_event, workspace: unknown) =>
    asWorkspace(workspace) === 'work' ? clients() : null
  )
  ipcMain.handle(TASKS_IPC.create, (_event, input: unknown) => {
    const o = asObject(input, 'task')
    const priority = text(o.priority)
    if (priority !== undefined && !(TASK_PRIORITIES as readonly string[]).includes(priority)) {
      throw new Error('Invalid priority')
    }
    const task = store.create({
      workspace: asWorkspace(o.workspace),
      title: text(o.title) ?? '',
      list: text(o.list),
      sublist: text(o.sublist),
      description: text(o.description),
      priority: priority as TaskPriority | undefined,
      due: dateOrNull(o.due),
      parentUid: o.parentUid === null || o.parentUid === undefined ? null : asUid(o.parentUid),
      recurrence: asRecurrence(o.recurrence),
      tags: asTags(o.tags)
    })
    broadcast(task.workspace)
    return task
  })
  ipcMain.handle(TASKS_IPC.update, (_event, uid: unknown, changes: unknown) => {
    const o = asObject(changes, 'changes')
    const priority = text(o.priority)
    const patch: TaskChanges = {
      title: text(o.title),
      description: text(o.description),
      priority: priority as TaskPriority | undefined,
      due: dateOrNull(o.due),
      list: text(o.list),
      sublist: text(o.sublist),
      recurrence: asRecurrence(o.recurrence),
      tags: asTags(o.tags),
      parentUid: o.parentUid === undefined ? undefined : asUid(o.parentUid)
    }
    // Fields that were not sent must stay out of the patch altogether (`undefined` means "leave it").
    for (const key of Object.keys(patch) as (keyof TaskChanges)[]) {
      if (patch[key] === undefined) delete patch[key]
    }
    return changing(asUid(uid), () => store.update(asUid(uid), patch))
  })
  ipcMain.handle(TASKS_IPC.setStatus, (_event, uid: unknown, status: unknown) => {
    if (typeof status !== 'string' || !(TASK_STATUSES as readonly string[]).includes(status)) {
      throw new Error('Invalid status')
    }
    return changing(asUid(uid), () => store.setStatus(asUid(uid), status as TaskStatus))
  })
  ipcMain.handle(TASKS_IPC.setDue, (_event, uids: unknown, due: unknown) => {
    if (!Array.isArray(uids)) throw new Error('Invalid tasks')
    const list = uids.map(asUid)
    changing(list, () => store.setDue(list, dateOrNull(due) ?? null))
  })
  ipcMain.handle(TASKS_IPC.delete, (_event, uid: unknown) =>
    changing(asUid(uid), () => store.delete(asUid(uid)))
  )
  ipcMain.handle(TASKS_IPC.restore, (_event, uid: unknown) => {
    const task = store.restore(asUid(uid))
    broadcast(task.workspace)
    return task
  })
  ipcMain.handle(TASKS_IPC.trash, () => {
    const all = listTrash(context.db)
    const trashed = new Set(all.map((r) => r.task.uid))
    // A subtask deleted along with its parent comes back with it, so only the ones that stand alone are listed.
    return all.filter((r) => !r.task.parentUid || !trashed.has(r.task.parentUid))
  })
  ipcMain.handle(TASKS_IPC.snapshot, () =>
    basename(
      writeTasksSnapshot(
        context.db,
        join(context.paths.root, 'backups', 'tasks'),
        new Date(),
        'manual'
      )
    )
  )
  ipcMain.handle(TASKS_IPC.discardIfEmpty, (_event, uid: unknown) =>
    changing(asUid(uid), () => store.discardIfEmpty(asUid(uid)))
  )

  return () => {
    for (const channel of Object.values(TASKS_IPC)) ipcMain.removeHandler(channel)
  }
}

export const tasksMainModule: MainModule = {
  id: 'tasks',
  migrations: tasksMigrations,
  register
}
