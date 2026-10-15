import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { tasksMigrations } from './migrations'
import { listTasks } from './repository'
import { TasksStore } from './tasks-store'

describe('tasks/0002_life', () => {
  it('keeps every task, subtask and tag, and then accepts a Life task', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db, [tasksMigrations[0]])
    const insert = db.prepare(
      `INSERT INTO tasks (uid, workspace, title, list, parent_uid, position, source_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`
    )
    insert.run('a', 'research', 'Read', 'Reading', null, 'cu1')
    insert.run('b', 'research', 'Chapter 1', '', 'a', 'cu2')
    insert.run('c', 'work', 'Invoice', 'Impact', null, null)
    db.prepare('INSERT INTO task_tags (task_uid, tag) VALUES (?, ?)').run('a', 'stats')
    expect(() => insert.run('x', 'life', 'Nope', 'Home', null, null)).toThrow()

    expect(runMigrations(db, tasksMigrations)).toEqual(['tasks/0002_life'])

    const before = db.prepare('SELECT uid, parent_uid, source_id FROM tasks ORDER BY uid').all()
    expect(before).toEqual([
      { uid: 'a', parent_uid: null, source_id: 'cu1' },
      { uid: 'b', parent_uid: 'a', source_id: 'cu2' },
      { uid: 'c', parent_uid: null, source_id: null }
    ])
    expect(db.prepare('SELECT * FROM task_tags').all()).toEqual([{ task_uid: 'a', tag: 'stats' }])
    expect(db.pragma('foreign_key_check')).toEqual([])

    const store = new TasksStore(db)
    const life = store.create({ workspace: 'life', title: 'Renew passport', list: 'Admin' })
    expect(listTasks(db, 'life').map((t) => t.title)).toEqual(['Renew passport'])
    expect(listTasks(db, 'research').map((t) => t.uid)).toEqual(['a', 'b'])
    expect(life.workspace).toBe('life')
    // Still enforced: a subtask needs a parent that exists, and a workspace must be a known one.
    expect(() => insert.run('d', 'research', 'Orphan', '', 'missing', null)).toThrow()
    expect(() => insert.run('e', 'play', 'Nope', 'Home', null, null)).toThrow()
    // The indexes came across.
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'tasks'")
      .all()
      .map((r) => (r as { name: string }).name)
    expect(indexes).toEqual(
      expect.arrayContaining(['tasks_workspace', 'tasks_parent', 'tasks_series'])
    )
  })
})
