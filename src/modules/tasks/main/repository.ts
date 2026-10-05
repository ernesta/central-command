import type { Database } from 'better-sqlite3'
import { isValidRecurrence } from '../shared/recurrence'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Recurrence,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskWorkspace
} from '../shared/types'

interface TaskRecord {
  uid: string
  workspace: TaskWorkspace
  title: string
  description: string
  status: string
  priority: string
  due: string | null
  completed_at: string | null
  list: string
  sublist: string
  parent_uid: string | null
  position: number
  recurrence: string | null
  series_uid: string | null
  earlier_minutes: number
  source_id: string | null
  created_at: string
  updated_at: string
}

const COLUMNS = `uid, workspace, title, description, status, priority, due, completed_at, list, sublist, parent_uid,
  position, recurrence, series_uid, earlier_minutes, source_id, created_at, updated_at`

function parseRecurrence(json: string | null): Recurrence | null {
  if (!json) return null
  try {
    const value: unknown = JSON.parse(json)
    return isValidRecurrence(value) ? { every: value.every, unit: value.unit } : null
  } catch {
    return null
  }
}

function toTask(record: TaskRecord, tags: string[]): Task {
  return {
    uid: record.uid,
    workspace: record.workspace,
    title: record.title,
    description: record.description,
    status: (TASK_STATUSES as readonly string[]).includes(record.status)
      ? (record.status as TaskStatus)
      : 'todo',
    priority: (TASK_PRIORITIES as readonly string[]).includes(record.priority)
      ? (record.priority as TaskPriority)
      : 'normal',
    due: record.due,
    completedAt: record.completed_at,
    list: record.list,
    sublist: record.sublist,
    parentUid: record.parent_uid,
    position: record.position,
    recurrence: parseRecurrence(record.recurrence),
    seriesUid: record.series_uid,
    earlierMinutes: record.earlier_minutes,
    sourceId: record.source_id,
    tags,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }
}

function tagMap(db: Database, uids?: string[]): Map<string, string[]> {
  const rows = (
    uids
      ? db
          .prepare(
            `SELECT task_uid, tag FROM task_tags WHERE task_uid IN (${uids.map(() => '?').join(',')}) ORDER BY tag`
          )
          .all(...uids)
      : db.prepare('SELECT task_uid, tag FROM task_tags ORDER BY tag').all()
  ) as { task_uid: string; tag: string }[]
  const map = new Map<string, string[]>()
  for (const r of rows) map.set(r.task_uid, [...(map.get(r.task_uid) ?? []), r.tag])
  return map
}

/** Every task of a workspace that is not in the trash, subtasks included. */
export function listTasks(db: Database, workspace: TaskWorkspace): Task[] {
  const records = db
    .prepare(
      `SELECT ${COLUMNS} FROM tasks WHERE workspace = ? AND deleted_at IS NULL ORDER BY created_at, uid`
    )
    .all(workspace) as TaskRecord[]
  const tags = tagMap(db)
  return records.map((r) => toTask(r, tags.get(r.uid) ?? []))
}

/** One task that is not in the trash. */
export function getTask(db: Database, uid: string): Task | null {
  const record = db
    .prepare(`SELECT ${COLUMNS} FROM tasks WHERE uid = ? AND deleted_at IS NULL`)
    .get(uid) as TaskRecord | undefined
  return record ? toTask(record, tagMap(db, [uid]).get(uid) ?? []) : null
}

/** The task with this uid even when it is in the trash. */
export function getTaskAnywhere(
  db: Database,
  uid: string
): { task: Task; deletedAt: string | null } | null {
  const record = db.prepare(`SELECT ${COLUMNS}, deleted_at FROM tasks WHERE uid = ?`).get(uid) as
    (TaskRecord & { deleted_at: string | null }) | undefined
  return record
    ? { task: toTask(record, tagMap(db, [uid]).get(uid) ?? []), deletedAt: record.deleted_at }
    : null
}

/** A task's subtasks that are not in the trash, in no particular order (callers use `orderSubtasks`). */
export function listSubtasks(db: Database, parentUid: string): Task[] {
  const records = db
    .prepare(`SELECT ${COLUMNS} FROM tasks WHERE parent_uid = ? AND deleted_at IS NULL`)
    .all(parentUid) as TaskRecord[]
  const tags = tagMap(
    db,
    records.map((r) => r.uid)
  )
  return records.map((r) => toTask(r, tags.get(r.uid) ?? []))
}

/** Every task in the trash (and its subtasks), most recently deleted first. */
export function listTrash(db: Database): { task: Task; deletedAt: string }[] {
  const records = db
    .prepare(
      `SELECT ${COLUMNS}, deleted_at FROM tasks WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, uid`
    )
    .all() as (TaskRecord & { deleted_at: string })[]
  const tags = tagMap(db)
  return records.map((r) => ({ task: toTask(r, tags.get(r.uid) ?? []), deletedAt: r.deleted_at }))
}

export function writeTask(db: Database, task: Task): void {
  db.prepare(
    `INSERT INTO tasks (${COLUMNS})
     VALUES (@uid, @workspace, @title, @description, @status, @priority, @due, @completedAt, @list, @sublist,
       @parentUid, @position, @recurrence, @seriesUid, @earlierMinutes, @sourceId, @createdAt, @updatedAt)
     ON CONFLICT (uid) DO UPDATE SET
       workspace = excluded.workspace, title = excluded.title, description = excluded.description,
       status = excluded.status, priority = excluded.priority, due = excluded.due,
       completed_at = excluded.completed_at, list = excluded.list, sublist = excluded.sublist,
       parent_uid = excluded.parent_uid, position = excluded.position, recurrence = excluded.recurrence,
       series_uid = excluded.series_uid, updated_at = excluded.updated_at`
  ).run({ ...task, recurrence: task.recurrence ? JSON.stringify(task.recurrence) : null })
  db.prepare('DELETE FROM task_tags WHERE task_uid = ?').run(task.uid)
  const insert = db.prepare('INSERT OR IGNORE INTO task_tags (task_uid, tag) VALUES (?, ?)')
  for (const tag of task.tags) insert.run(task.uid, tag)
}

/** How many tasks exist, trash included; an import refuses to run when this is not zero. */
export function countAllTasks(db: Database): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n
}

export function markDeleted(db: Database, uids: string[], at: string): void {
  const stmt = db.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE uid = ?')
  for (const uid of uids) stmt.run(at, at, uid)
}

export function markRestored(db: Database, uids: string[], at: string): void {
  const stmt = db.prepare('UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE uid = ?')
  for (const uid of uids) stmt.run(at, uid)
}

export function purge(db: Database, uid: string): void {
  db.prepare('DELETE FROM task_tags WHERE task_uid = ?').run(uid)
  db.prepare('DELETE FROM tasks WHERE uid = ?').run(uid)
}

export function allUids(db: Database): Set<string> {
  return new Set((db.prepare('SELECT uid FROM tasks').all() as { uid: string }[]).map((r) => r.uid))
}

export function openInSeries(db: Database, seriesUid: string, exceptUid: string): number {
  return (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tasks WHERE series_uid = ? AND uid <> ? AND status <> 'done' AND deleted_at IS NULL`
      )
      .get(seriesUid, exceptUid) as { n: number }
  ).n
}

export function maxPosition(db: Database, parentUid: string): number {
  return (
    db
      .prepare('SELECT COALESCE(MAX(position), 0) AS p FROM tasks WHERE parent_uid = ?')
      .get(parentUid) as {
      p: number
    }
  ).p
}
