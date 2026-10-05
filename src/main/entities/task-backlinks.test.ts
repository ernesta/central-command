import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../db/migrate'
import { tasksMigrations } from '../../modules/tasks/main/migrations'
import { TasksStore } from '../../modules/tasks/main/tasks-store'
import { findTaskBacklinks } from './task-backlinks'

describe('findTaskBacklinks', () => {
  it('lists the tasks whose description mentions the target, with the line, never the target itself or a deleted task', () => {
    const db = new Database(':memory:')
    runMigrations(db, tasksMigrations)
    const store = new TasksStore(db)
    const target = store.create({ workspace: 'research', title: 'Target', list: 'L' })
    const mentions = store.create({
      workspace: 'research',
      title: 'Mentions',
      list: 'L',
      description: `Ask [Target](cc://task/${target.uid}) first\nand more`
    })
    store.create({ workspace: 'work', title: 'Plain', list: 'L', description: 'no links' })
    const gone = store.create({
      workspace: 'research',
      title: 'Gone',
      list: 'L',
      description: `[T](cc://task/${target.uid})`
    })
    store.delete(gone.uid)
    store.update(target.uid, { description: `[me](cc://task/${target.uid})` })
    expect(findTaskBacklinks(db, { kind: 'task', key: target.uid })).toEqual([
      {
        source: { kind: 'task', workspace: 'research', id: mentions.uid },
        title: 'Mentions',
        context: 'Ask Target first'
      }
    ])
    expect(findTaskBacklinks(db, { kind: 'person', key: 'Kathy' })).toEqual([])
  })
})
