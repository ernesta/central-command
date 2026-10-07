import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { tasksMigrations } from './migrations'
import { listSubtasks, listTasks, listTrash } from './repository'
import { TasksStore, type Clock } from './tasks-store'

let db: Database.Database
let store: TasksStore
let today = '2026-10-05'
let tick = 0
const clock: Clock = {
  today: () => today,
  now: () => `2026-10-05T10:00:${String(tick++).padStart(2, '0')}.000Z`
}

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, tasksMigrations)
  store = new TasksStore(db, clock)
  today = '2026-10-05'
  tick = 0
})

const make = (title: string, over = {}): ReturnType<TasksStore['create']> =>
  store.create({ workspace: 'research', title, list: 'Reading', ...over })

describe('create', () => {
  it('stores a task with its tags and defaults', () => {
    const t = make('  Read it  ', { tags: ['r', 'r', ' ', 'stats'], due: '2026-10-09' })
    expect(store.get(t.uid)).toMatchObject({
      title: 'Read it',
      status: 'todo',
      priority: 'normal',
      due: '2026-10-09',
      list: 'Reading',
      tags: ['r', 'stats'],
      seriesUid: null
    })
  })
  it('needs a list unless it is a subtask, and a real date', () => {
    expect(() => store.create({ workspace: 'research', title: 'x' })).toThrow('list')
    expect(() => make('x', { due: '2026-13-40' })).toThrow('Not a date')
  })
  it('makes a subtask take the parent’s workspace, with no list, after its siblings', () => {
    const p = make('Parent', { list: 'Reading', sublist: 'S' })
    const a = store.create({ workspace: 'work', title: 'A', parentUid: p.uid, list: 'Ignored' })
    const b = store.create({ workspace: 'work', title: 'B', parentUid: p.uid })
    expect(a).toMatchObject({ workspace: 'research', list: '', sublist: '', parentUid: p.uid })
    expect(b.position).toBeGreaterThan(a.position)
  })
  it('refuses subtasks of subtasks, repeating subtasks and a missing parent', () => {
    const p = make('Parent')
    const k = store.create({ workspace: 'research', title: 'K', parentUid: p.uid })
    expect(() => store.create({ workspace: 'research', title: 'G', parentUid: k.uid })).toThrow(
      'subtasks'
    )
    expect(() =>
      store.create({
        workspace: 'research',
        title: 'R',
        parentUid: p.uid,
        recurrence: { every: 1, unit: 'day' }
      })
    ).toThrow('repeat')
    expect(() => store.create({ workspace: 'research', title: 'G', parentUid: 'nope' })).toThrow(
      'parent'
    )
  })
  it('refuses a duplicate source id', () => {
    make('A', { sourceId: 'x1' })
    expect(() => make('B', { sourceId: 'x1' })).toThrow()
  })
})

describe('update', () => {
  it('changes fields and never the importer-only ones', () => {
    const t = make('A', { earlierMinutes: 90, sourceId: 's1' })
    const u = store.update(t.uid, { title: 'B', priority: 'high', due: '2026-10-07', tags: ['q'] })
    expect(u).toMatchObject({ title: 'B', priority: 'high', due: '2026-10-07', tags: ['q'] })
    expect(store.get(t.uid)).toMatchObject({ earlierMinutes: 90, sourceId: 's1' })
  })
  it('clears the sublist when only the list changes, and refuses an empty list or a subtask list', () => {
    const t = make('A', { sublist: 'S' })
    expect(store.update(t.uid, { list: 'Writing' })).toMatchObject({ list: 'Writing', sublist: '' })
    expect(() => store.update(t.uid, { list: ' ' })).toThrow('list')
    const k = store.create({ workspace: 'research', title: 'K', parentUid: t.uid })
    expect(() => store.update(k.uid, { list: 'X' })).toThrow('no list')
  })
  it('sets and clears a repeat rule', () => {
    const t = make('A')
    const r = store.update(t.uid, { recurrence: { every: 2, unit: 'week' } })
    expect(r.recurrence).toEqual({ every: 2, unit: 'week' })
    expect(r.seriesUid).toBe(t.uid)
    expect(store.update(t.uid, { recurrence: null }).recurrence).toBeNull()
    expect(() => store.update(t.uid, { recurrence: { every: 0, unit: 'day' } })).toThrow('repeat')
  })
})

describe('setStatus and recurrence', () => {
  it('sets and clears completedAt', () => {
    const t = make('A')
    expect(store.setStatus(t.uid, 'done').task.completedAt).not.toBeNull()
    expect(store.setStatus(t.uid, 'todo').task.completedAt).toBeNull()
  })

  it('starts the next occurrence from the completion date, with the subtasks copied', () => {
    const t = make('Weekly', {
      due: '2026-09-20',
      recurrence: { every: 1, unit: 'week' },
      tags: ['x']
    })
    store.create({ workspace: 'research', title: 'One', parentUid: t.uid, status: 'done' })
    store.create({ workspace: 'research', title: 'Two', parentUid: t.uid })
    today = '2026-10-05'
    const { task: done, next } = store.setStatus(t.uid, 'done')
    expect(done.status).toBe('done')
    expect(next).toMatchObject({
      title: 'Weekly',
      due: '2026-10-12',
      status: 'todo',
      tags: ['x'],
      seriesUid: t.uid
    })
    expect(next?.recurrence).toEqual({ every: 1, unit: 'week' })
    const kids = listSubtasks(db, next!.uid).sort((a, b) => a.position - b.position)
    expect(kids.map((k) => [k.title, k.status])).toEqual([
      ['One', 'todo'],
      ['Two', 'todo']
    ])
    // The finished one keeps its own subtasks as they were.
    expect(
      listSubtasks(db, t.uid)
        .map((k) => k.status)
        .sort()
    ).toEqual(['done', 'todo'])
  })

  it('drifts: handled late, the next is counted from that day', () => {
    const t = make('Monthly', { due: '2026-08-31', recurrence: { every: 1, unit: 'month' } })
    today = '2026-10-31'
    expect(store.setStatus(t.uid, 'done').next?.due).toBe('2026-11-30')
  })

  it('only ever has one open instance in a series', () => {
    const t = make('Weekly', { due: '2026-10-01', recurrence: { every: 1, unit: 'week' } })
    const first = store.setStatus(t.uid, 'done').next
    expect(first).not.toBeNull()
    // Re-open the finished one and finish it again: the series already has an open instance.
    store.setStatus(t.uid, 'todo')
    expect(store.setStatus(t.uid, 'done').next).toBeNull()
    expect(
      listTasks(db, 'research').filter((x) => x.seriesUid === t.uid && x.status !== 'done')
    ).toHaveLength(1)
  })

  it('does not start another from a second Done on a done task, or from a task that does not repeat', () => {
    const t = make('Weekly', { due: '2026-10-01', recurrence: { every: 1, unit: 'week' } })
    store.setStatus(t.uid, 'done')
    expect(store.setStatus(t.uid, 'done').next).toBeNull()
    expect(store.setStatus(make('Once').uid, 'done').next).toBeNull()
    expect(listTasks(db, 'research')).toHaveLength(3)
  })

  it('a second Done on a finished task starts nothing, even when its next one was deleted', () => {
    const t = make('Weekly', { due: '2026-10-01', recurrence: { every: 1, unit: 'week' } })
    const next = store.setStatus(t.uid, 'done').next!
    store.delete(next.uid)
    expect(store.setStatus(t.uid, 'done').next).toBeNull()
    expect(listTasks(db, 'research')).toHaveLength(1)
  })

  it('moving to in progress never starts the next one', () => {
    const t = make('Weekly', { recurrence: { every: 1, unit: 'week' } })
    expect(store.setStatus(t.uid, 'doing').next).toBeNull()
    expect(listTasks(db, 'research')).toHaveLength(1)
  })

  it('a series that was set on an older task keeps its series through the chain', () => {
    const t = make('W', { due: '2026-10-01', recurrence: { every: 1, unit: 'day' } })
    const n1 = store.setStatus(t.uid, 'done').next!
    const n2 = store.setStatus(n1.uid, 'done').next!
    expect(n2.seriesUid).toBe(t.uid)
    expect(store.get(n2.uid)?.seriesUid).toBe(t.uid)
  })
})

describe('setDue', () => {
  it('moves several tasks to a date or to the backlog', () => {
    const a = make('A', { due: '2026-09-01' })
    const b = make('B', { due: '2026-09-02' })
    store.setDue([a.uid, b.uid], '2026-10-05')
    expect(store.get(a.uid)?.due).toBe('2026-10-05')
    store.setDue([a.uid, b.uid], null)
    expect(store.get(b.uid)?.due).toBeNull()
  })
  it('changes nothing when one task is missing', () => {
    const a = make('A', { due: '2026-09-01' })
    expect(() => store.setDue([a.uid, 'nope'], null)).toThrow()
    expect(store.get(a.uid)?.due).toBe('2026-09-01')
  })
})

describe('delete, restore and discardIfEmpty', () => {
  it('trashes a task with its subtasks, and restores them together', () => {
    const p = make('P')
    const k = store.create({ workspace: 'research', title: 'K', parentUid: p.uid })
    store.delete(p.uid)
    expect(store.get(p.uid)).toBeNull()
    expect(store.get(k.uid)).toBeNull()
    expect(listTasks(db, 'research')).toEqual([])
    expect(
      listTrash(db)
        .map((r) => r.task.uid)
        .sort()
    ).toEqual([p.uid, k.uid].sort())
    store.restore(p.uid)
    expect(store.get(k.uid)?.title).toBe('K')
  })
  it('restores only the subtasks deleted with the parent, not one deleted earlier', () => {
    const p = make('P')
    const old = store.create({ workspace: 'research', title: 'Old', parentUid: p.uid })
    store.delete(old.uid)
    tick += 5
    store.delete(p.uid)
    store.restore(p.uid)
    expect(store.get(old.uid)).toBeNull()
  })
  it('refuses to restore a subtask while its parent is in the trash', () => {
    const p = make('P')
    const k = store.create({ workspace: 'research', title: 'K', parentUid: p.uid })
    store.delete(p.uid)
    expect(() => store.restore(k.uid)).toThrow('parent')
  })
  it('never loses the row on delete', () => {
    const t = make('Keep me', { description: 'text' })
    store.delete(t.uid)
    const row = db
      .prepare('SELECT title, description, deleted_at FROM tasks WHERE uid = ?')
      .get(t.uid) as {
      title: string
      description: string
      deleted_at: string | null
    }
    expect(row).toMatchObject({ title: 'Keep me', description: 'text' })
    expect(row.deleted_at).not.toBeNull()
  })
  it('removes for real only a task nobody wrote in', () => {
    const blank = make('')
    expect(store.discardIfEmpty(blank.uid)).toBe(true)
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 0 })
    const titled = make('x')
    expect(store.discardIfEmpty(titled.uid)).toBe(false)
    const described = make('', { description: 'hi' })
    expect(store.discardIfEmpty(described.uid)).toBe(false)
    const imported = make('', { sourceId: 'abc' })
    expect(store.discardIfEmpty(imported.uid)).toBe(false)
    const withKid = make('')
    store.create({ workspace: 'research', title: 'k', parentUid: withKid.uid })
    expect(store.discardIfEmpty(withKid.uid)).toBe(false)
  })
})

describe('Work’s lists are its clients', () => {
  let clients = ['Impact', 'Royal Holloway']
  let ruled: TasksStore
  beforeEach(() => {
    clients = ['Impact', 'Royal Holloway']
    ruled = new TasksStore(db, clock, () => clients)
  })
  const inWork = (list: string): ReturnType<TasksStore['create']> =>
    ruled.create({ workspace: 'work', title: 't', list })

  it('creates in a client’s list, in the client’s spelling', () => {
    expect(inWork(' impact ').list).toBe('Impact')
  })
  it('refuses a Work list that is not a client, and a client that has gone', () => {
    expect(() => inWork('Admin')).toThrow('not a client')
    clients = ['Impact']
    expect(() => inWork('Royal Holloway')).toThrow('not a client')
    expect(listTasks(db, 'work')).toHaveLength(0)
  })
  it('refuses a move to a list that is not a client, and keeps the task where it was', () => {
    const t = inWork('Impact')
    expect(() => ruled.update(t.uid, { list: 'Admin' })).toThrow('not a client')
    expect(ruled.get(t.uid)?.list).toBe('Impact')
    expect(ruled.update(t.uid, { list: 'Royal Holloway' }).list).toBe('Royal Holloway')
  })
  it('keeps sublists free text', () => {
    const t = inWork('Impact')
    expect(ruled.update(t.uid, { sublist: 'Anything at all' }).sublist).toBe('Anything at all')
  })
  it('does not touch a task that was already outside the rule unless its list changes', () => {
    const old = store.create({ workspace: 'work', title: 'old', list: 'Luminos' })
    expect(ruled.update(old.uid, { title: 'renamed', list: 'Luminos' }).list).toBe('Luminos')
    expect(() => ruled.update(old.uid, { list: 'Elsewhere' })).toThrow('not a client')
  })
  it('lets a repeating task start its next occurrence even from an old list', () => {
    const old = store.create({
      workspace: 'work',
      title: 'weekly',
      list: 'Luminos',
      recurrence: { every: 1, unit: 'week' }
    })
    expect(ruled.setStatus(old.uid, 'done').next?.list).toBe('Luminos')
  })
  it('leaves Research free and gives a subtask no list to check', () => {
    expect(ruled.create({ workspace: 'research', title: 'r', list: 'Reading' }).list).toBe(
      'Reading'
    )
    const p = inWork('Impact')
    expect(
      ruled.create({ workspace: 'work', title: 's', parentUid: p.uid, list: 'Admin' }).list
    ).toBe('')
  })
})
