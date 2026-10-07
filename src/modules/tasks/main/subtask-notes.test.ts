import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { tasksMigrations } from './migrations'
import { appendSection, applyNoteMoves, findNoteMoves } from './subtask-notes'
import { TasksStore } from './tasks-store'

let db: Database.Database
let store: TasksStore
beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, tasksMigrations)
  store = new TasksStore(db)
})
const parent = (title: string, description = ''): string =>
  store.create({ workspace: 'research', title, list: 'L', description }).uid
const kid = (p: string, title: string, description = ''): string =>
  store.create({ workspace: 'research', title, parentUid: p, description }).uid

describe('appendSection', () => {
  it('adds a ### section after the text, or starts the description', () => {
    expect(appendSection('Old text\n\n', 'Step', ' note ')).toBe('Old text\n\n### Step\n\nnote')
    expect(appendSection('', 'Step', 'note')).toBe('### Step\n\nnote')
  })
})

describe('moving subtask notes', () => {
  it('moves notes to the parent in sibling order, keeps its text, clears the subtask', () => {
    const p = parent('P', 'Existing')
    const a = kid(p, 'A', 'first')
    const b = kid(p, 'B', 'second')
    kid(p, 'C')
    const moves = findNoteMoves(db)
    expect(moves.map((m) => m.kidUid)).toEqual([a, b])
    applyNoteMoves(db, moves)
    expect(store.get(p)!.description).toBe('Existing\n\n### A\n\nfirst\n\n### B\n\nsecond')
    expect(store.get(a)!.description).toBe('')
    expect(store.get(b)!.description).toBe('')
  })
  it('finds nothing on a second run', () => {
    const p = parent('P')
    kid(p, 'A', 'note')
    applyNoteMoves(db, findNoteMoves(db))
    expect(findNoteMoves(db)).toEqual([])
  })
  it('ignores blank notes, trashed subtasks and trashed parents', () => {
    const p = parent('P')
    kid(p, 'Blank', '  \n')
    const gone = kid(p, 'Gone', 'x')
    store.delete(gone)
    const p2 = parent('Q')
    kid(p2, 'K', 'y')
    store.delete(p2)
    expect(findNoteMoves(db)).toEqual([])
  })
  it('changes nothing when one move fails midway', () => {
    const p = parent('P', 'Keep')
    const a = kid(p, 'A', 'one')
    const b = kid(p, 'B', 'two')
    const moves = findNoteMoves(db)
    store.update(b, { description: 'edited meanwhile' })
    expect(() => applyNoteMoves(db, moves)).toThrow('changed since')
    expect(store.get(p)!.description).toBe('Keep')
    expect(store.get(a)!.description).toBe('one')
  })
})
