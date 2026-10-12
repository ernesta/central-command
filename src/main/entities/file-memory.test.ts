import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renameFileMentions } from '@shared/entities'
import { moveFileMentions } from './file-links'
import { FileMemory, resolveEntityFile } from './file-memory'

let root: string
let memory: FileMemory
let db: InstanceType<typeof Database>
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-filemem-'))
  mkdirSync(join(root, 'research'))
  mkdirSync(join(root, 'work'))
  writeFileSync(join(root, 'research', 'Summary.xlsx'), 'data')
  db = new Database(':memory:')
  db.exec(
    `CREATE TABLE entity_file_memory (key TEXT PRIMARY KEY, dev TEXT NOT NULL, ino TEXT NOT NULL);
     CREATE TABLE tasks (uid TEXT, description TEXT, deleted_at TEXT, updated_at TEXT)`
  )
  memory = new FileMemory(db)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const KEY = 'research/Summary.xlsx'

describe('resolveEntityFile', () => {
  it('returns a file that is there and remembers it', async () => {
    const res = await resolveEntityFile(root, KEY, memory)
    expect(res.file?.key).toBe(KEY)
    expect(res.movedFrom).toBeUndefined()
    expect(memory.get(KEY)).not.toBeNull()
  })

  it('follows a rename', async () => {
    await resolveEntityFile(root, KEY, memory)
    renameSync(join(root, KEY), join(root, 'research', 'Data summary.xlsx'))
    const res = await resolveEntityFile(root, KEY, memory)
    expect(res.file?.key).toBe('research/Data summary.xlsx')
    expect(res.movedFrom).toBe(KEY)
    expect(memory.get(KEY)).toBeNull()
  })

  it('follows a move to another workspace', async () => {
    await resolveEntityFile(root, KEY, memory)
    renameSync(join(root, KEY), join(root, 'work', 'Summary.xlsx'))
    expect((await resolveEntityFile(root, KEY, memory)).file?.key).toBe('work/Summary.xlsx')
  })

  it('finds a file that was moved before it was remembered when its name is unique', async () => {
    renameSync(join(root, KEY), join(root, 'work', 'Summary.xlsx'))
    expect((await resolveEntityFile(root, KEY, memory)).file?.key).toBe('work/Summary.xlsx')
  })

  it('does not guess when two files have the name, or none fits', async () => {
    writeFileSync(join(root, 'work', 'Summary.xlsx'), 'other')
    rmSync(join(root, KEY))
    writeFileSync(join(root, 'research', 'Summary.xlsx.bak'), 'x')
    mkdirSync(join(root, 'life'))
    writeFileSync(join(root, 'life', 'Summary.xlsx'), 'third')
    expect(await resolveEntityFile(root, KEY, memory)).toEqual({ file: null })
    rmSync(join(root, 'life', 'Summary.xlsx'))
    rmSync(join(root, 'work', 'Summary.xlsx'))
    expect(await resolveEntityFile(root, KEY, memory)).toEqual({ file: null })
  })
})

describe('renameFileMentions', () => {
  it('changes the address, and the label only when it was the old name', () => {
    const text =
      'See [Summary.xlsx](cc://file/research%2FSummary.xlsx) and [my data](cc://file/research%2FSummary.xlsx), not [x](cc://file/work%2FOther.xlsx).'
    expect(renameFileMentions(text, 'research/Summary.xlsx', 'work/Data.xlsx')).toBe(
      'See [Data.xlsx](cc://file/work%2FData.xlsx) and [my data](cc://file/work%2FData.xlsx), not [x](cc://file/work%2FOther.xlsx).'
    )
  })

  it('leaves text with no such mention as it was', () => {
    const text = 'Nothing [here](cc://person/Ann).'
    expect(renameFileMentions(text, 'research/A.xlsx', 'research/B.xlsx')).toBe(text)
  })
})

describe('moveFileMentions', () => {
  it('rewrites notes (keeping a copy) and task descriptions', async () => {
    const notes = join(root, 'research')
    const href = '[Summary.xlsx](cc://file/research%2FSummary.xlsx)'
    writeFileSync(join(notes, 'a.md'), `Look at ${href}.`)
    writeFileSync(join(notes, 'b.md'), 'No link.')
    db.prepare('INSERT INTO tasks VALUES (?, ?, NULL, ?)').run('t1', `Open ${href}`, 'old')
    const count = await moveFileMentions({
      folders: [{ kind: 'note', workspace: 'research', dir: notes }],
      db,
      backupDir: join(root, 'backup'),
      from: KEY,
      to: 'work/Data.xlsx',
      now: () => 'new'
    })
    expect(count).toBe(2)
    expect(readFileSync(join(notes, 'a.md'), 'utf8')).toBe(
      'Look at [Data.xlsx](cc://file/work%2FData.xlsx).'
    )
    expect(readFileSync(join(notes, 'b.md'), 'utf8')).toBe('No link.')
    expect(readFileSync(join(root, 'backup', '0', 'a.md'), 'utf8')).toContain('research%2FSummary')
    expect(db.prepare('SELECT description, updated_at FROM tasks').get()).toEqual({
      description: 'Open [Data.xlsx](cc://file/work%2FData.xlsx)',
      updated_at: 'new'
    })
  })
})
