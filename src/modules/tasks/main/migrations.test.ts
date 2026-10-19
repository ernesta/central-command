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

    expect(runMigrations(db, tasksMigrations.slice(0, 2))).toEqual(['tasks/0002_life'])

    const before = db.prepare('SELECT uid, parent_uid, source_id FROM tasks ORDER BY uid').all()
    expect(before).toEqual([
      { uid: 'a', parent_uid: null, source_id: 'cu1' },
      { uid: 'b', parent_uid: 'a', source_id: 'cu2' },
      { uid: 'c', parent_uid: null, source_id: null }
    ])
    expect(db.prepare('SELECT * FROM task_tags').all()).toEqual([{ task_uid: 'a', tag: 'stats' }])
    expect(db.pragma('foreign_key_check')).toEqual([])

    runMigrations(db, tasksMigrations)
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

describe('tasks/0003_own_kind', () => {
  it('adds the marker, empty on every task there was, and a task keeps what it is made with', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db, [tasksMigrations[0], tasksMigrations[1]])
    db.prepare(
      `INSERT INTO tasks (uid, workspace, title, list, created_at, updated_at)
       VALUES ('before', 'research', 'Read', 'Reading', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`
    ).run()

    expect(runMigrations(db, tasksMigrations.slice(0, 3))).toEqual(['tasks/0003_own_kind'])
    const store = new TasksStore(db)
    expect(store.get('before')?.ownKind).toBeNull()

    const parent = store.create({ workspace: 'research', title: 'Supervision', list: 'Meetings' })
    const sub = store.create({
      workspace: 'research',
      title: 'Supervision · 19 Oct 2026',
      parentUid: parent.uid,
      ownKind: 'meeting'
    })
    expect(store.get(sub.uid)?.ownKind).toBe('meeting')
    expect(store.update(sub.uid, { title: 'Supervision · 20 Oct 2026' }).ownKind).toBe('meeting')
    expect(store.update(sub.uid, { ownKind: null }).ownKind).toBeNull()
  })
})
