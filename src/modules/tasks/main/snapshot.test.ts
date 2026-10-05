import { mkdtempSync, readdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { tasksMigrations } from './migrations'
import { SNAPSHOTS_KEPT, writeTasksSnapshot } from './snapshot'
import { TasksStore } from './tasks-store'

describe('writeTasksSnapshot', () => {
  it('writes every task and the trash, and keeps only the newest few', () => {
    const db = new Database(':memory:')
    runMigrations(db, tasksMigrations)
    const store = new TasksStore(db)
    store.create({ workspace: 'research', title: 'Kept', list: 'L', tags: ['t'] })
    const gone = store.create({ workspace: 'work', title: 'Trashed', list: 'L' })
    store.delete(gone.uid)
    const dir = join(mkdtempSync(join(tmpdir(), 'tasks-snap-')), 'backups')
    const first = writeTasksSnapshot(db, dir, new Date('2026-10-01T10:00:00Z'))
    const body = JSON.parse(readFileSync(first, 'utf8'))
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual(['Kept'])
    expect(body.tasks[0].tags).toEqual(['t'])
    expect(body.trash.map((r: { task: { title: string } }) => r.task.title)).toEqual(['Trashed'])
    for (let i = 0; i < SNAPSHOTS_KEPT + 2; i++) {
      writeTasksSnapshot(db, dir, new Date(Date.UTC(2026, 9, 2 + i, 10)))
    }
    expect(readdirSync(dir)).toHaveLength(SNAPSHOTS_KEPT)
    expect(readdirSync(dir).includes(first.split('/').pop() as string)).toBe(false)
  })
})
