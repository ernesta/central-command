import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { withLocale } from '@shared/with-locale.testing'
import { tasksMigrations } from './migrations'
import { restoreOwnMeetingTask, trashOwnMeetingTask } from './session-tasks'
import { TasksStore } from './tasks-store'

let db: Database.Database
let store: TasksStore
let parentUid: string

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db, tasksMigrations)
  store = new TasksStore(db)
  parentUid = store.create({ workspace: 'research', title: 'Supervision', list: 'Meetings' }).uid
})

const sub = (title: string, ownKind?: 'meeting' | 'training'): string =>
  store.create({ workspace: 'research', title, parentUid, ...(ownKind ? { ownKind } : {}) }).uid

describe('trashOwnMeetingTask', () => {
  it.each(['en-US', 'en-GB', 'de-DE'])(
    '%s: trashes a marked task and an older one titled in this region, and Undo brings it back',
    (locale) => {
      const title = withLocale(
        locale,
        () =>
          `Supervision · ${new Date(Date.UTC(2026, 9, 19)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
      )
      for (const uid of [sub('whatever', 'meeting'), sub(title)]) {
        expect(trashOwnMeetingTask(store, uid)?.uid).toBe(uid)
        expect(store.get(uid)).toBeNull()
        expect(restoreOwnMeetingTask(db, store, uid)?.uid).toBe(uid)
        expect(store.get(uid)).not.toBeNull()
      }
    }
  )

  it('never touches a task the user chose, a training task or a series task', () => {
    for (const uid of [
      sub('Prepare for the supervision'),
      sub('Supervision · 19 Oct 2026', 'training'),
      parentUid
    ]) {
      expect(trashOwnMeetingTask(store, uid)).toBeNull()
      expect(store.get(uid)).not.toBeNull()
    }
    expect(trashOwnMeetingTask(store, 'gone')).toBeNull()
  })

  it('restore does nothing for a task that is not in the trash, or whose series task is', () => {
    const uid = sub('x', 'meeting')
    expect(restoreOwnMeetingTask(db, store, uid)).toBeNull()
    trashOwnMeetingTask(store, uid)
    store.delete(parentUid)
    expect(restoreOwnMeetingTask(db, store, uid)).toBeNull()
  })
})
