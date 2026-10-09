import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../db/migrate'
import { tasksMigrations } from '../../modules/tasks/main/migrations'
import { TasksStore } from '../../modules/tasks/main/tasks-store'
import type { BacklinkFolder } from './backlinks'
import { collectMentionedReadingKeys } from './reading-mentions'

let root: string
let folders: BacklinkFolder[]
let db: Database.Database

const put = (dir: string, name: string, content: string): void =>
  writeFileSync(join(root, dir, name), content)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-reading-mentions-'))
  for (const d of ['notes', 'meetings']) mkdirSync(join(root, d))
  folders = [
    { kind: 'note', workspace: 'research', dir: join(root, 'notes') },
    { kind: 'meeting', workspace: 'research', dir: join(root, 'meetings') },
    { kind: 'plan', workspace: 'research', dir: join(root, 'no-such-folder') }
  ]
  db = new Database(':memory:')
  runMigrations(db, tasksMigrations)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('collectMentionedReadingKeys', () => {
  it('finds a reading citekey mentioned in a note, ignores other kinds, and skips folders that do not exist', async () => {
    put('notes', 'Plan.md', 'See [Smith](cc://reading/smith2020) and [K](cc://person/Kathy)\n')
    expect(await collectMentionedReadingKeys(db, folders)).toEqual(new Set(['smith2020']))
  })

  it('collects every mentioned citekey across every folder, once each', async () => {
    put('notes', 'A.md', '[a](cc://reading/a) [a again](cc://reading/a)\n')
    put('meetings', '2026-01-01 X.md', '[b](cc://reading/b)\n')
    expect(await collectMentionedReadingKeys(db, folders)).toEqual(new Set(['a', 'b']))
  })

  it('finds a reading citekey mentioned in a task description, and ignores a deleted task', async () => {
    const store = new TasksStore(db)
    store.create({
      workspace: 'research',
      title: 'Read it',
      list: 'L',
      description: '[Smith](cc://reading/smith2020)'
    })
    const gone = store.create({
      workspace: 'research',
      title: 'Gone',
      list: 'L',
      description: '[Lee](cc://reading/lee2021)'
    })
    store.delete(gone.uid)
    expect(await collectMentionedReadingKeys(db, folders)).toEqual(new Set(['smith2020']))
  })

  it('returns an empty set when nothing mentions a reading', async () => {
    put('notes', 'Plain.md', 'Nothing here\n')
    expect(await collectMentionedReadingKeys(db, folders)).toEqual(new Set())
  })
})
