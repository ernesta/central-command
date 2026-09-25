import Database from 'better-sqlite3'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { hashContent } from '../../../main/notes/guarded-file'
import { splitNote } from '../shared/front-matter'
import type { CreateTrainingInput, TrainingFile } from '../shared/api'
import type { TrainingRef } from '../shared/types'
import { trainingMigrations } from './migrations'
import { getTrainingRow, listTrainingIds } from './repository'
import { TrainingError, TrainingStore, isSafeRelativeFolder } from './training-store'

let root: string
let dir: string
let db: Database.Database
let store: TrainingStore
let trashDir: string
let trashed: string[]
let trashFails = false
const file = (id: string): string => join(dir, `${id}.md`)
const disk = (id: string): string => readFileSync(file(id), 'utf8')
const ref = (id: string): TrainingRef => ({ workspace: 'research', id })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-training-'))
  dir = join(root, 'research')
  db = new Database(':memory:')
  runMigrations(db, trainingMigrations)
  trashDir = join(root, '.Trash')
  trashed = []
  trashFails = false
  store = new TrainingStore({
    db,
    dirFor: (w) => join(root, w),
    trash: async (path) => {
      if (trashFails) throw new Error('Trash unavailable')
      mkdirSync(trashDir, { recursive: true })
      renameSync(path, join(trashDir, basename(path)))
      trashed.push(path)
    }
  })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const make = (over: Partial<CreateTrainingInput> = {}): Promise<TrainingFile> =>
  store.create({
    workspace: 'research',
    date: '2025-12-10',
    title: 'Data Management and Security',
    ...over
  })

describe('create', () => {
  it('writes the template with front matter and indexes it', async () => {
    const entry = await make({
      start: '10:00',
      end: '11:30',
      series: 'SEDarc',
      type: 'Research methods course',
      mode: 'online',
      skills: ['Data management and analysis (GS)'],
      leads: ['Robert Darby']
    })
    expect(entry.ref).toEqual(ref('2025-12-10 Data Management and Security'))
    expect(disk(entry.ref.id)).toBe(
      "---\ndate: 2025-12-10\nstart: '10:00'\nend: '11:30'\ntitle: Data Management and Security\nseries: SEDarc\ntype: Research methods course\nmode: online\nskills: [Data management and analysis (GS)]\nleads: [Robert Darby]\n---\n\n## Summary\n\n## Notes\n"
    )
    expect(getTrainingRow(db, 'research', entry.ref.id)).toMatchObject({
      title: 'Data Management and Security',
      start: '10:00',
      leads: ['Robert Darby'],
      hasNotes: false
    })
  })

  it('makes a safe file name from a title with a colon, and numbers a second entry', async () => {
    const a = await make({ title: 'SEDarc: Mixed methods' })
    const b = await make({ title: 'SEDarc: Mixed methods' })
    expect(a.ref.id).toBe('2025-12-10 SEDarc_ Mixed methods')
    expect(b.ref.id).toBe('2025-12-10 SEDarc_ Mixed methods 2')
    expect(a.meta.title).toBe('SEDarc: Mixed methods')
  })

  it('never overwrites a file that already exists, even one the index does not know', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('2025-12-10 Data Management and Security'), 'mine')
    const entry = await make()
    expect(entry.ref.id).toBe('2025-12-10 Data Management and Security 2')
    expect(disk('2025-12-10 Data Management and Security')).toBe('mine')
  })

  it('refuses invalid input without writing anything', async () => {
    for (const bad of [
      { date: '2025-13-40' },
      { type: 'Seminar' },
      { mode: 'hybrid' as never },
      { skills: ['a', 'b', 'c', 'd'] },
      { title: 'two\nlines' },
      { start: '25:00' }
    ]) {
      await expect(make(bad)).rejects.toBeInstanceOf(TrainingError)
    }
    expect(existsSync(dir)).toBe(false)
  })
})

describe('save', () => {
  it('saving metadata leaves the body byte-for-byte alone and keeps unknown keys', async () => {
    const entry = await make({ body: '## Summary\n\n  odd   spacing\t\n\n## Notes\n\nText\n' })
    const text = disk(entry.ref.id).replace('---\n\n', 'future: keep # me\n---\n\n')
    writeFileSync(file(entry.ref.id), text)
    const res = await store.save(entry.ref, { meta: { series: 'DataCamp' } }, hashContent(text))
    expect(res.status).toBe('saved')
    const after = disk(entry.ref.id)
    expect(after).toContain('series: DataCamp')
    expect(after).toContain('future: keep # me')
    expect(splitNote(after).body).toBe('## Summary\n\n  odd   spacing\t\n\n## Notes\n\nText\n')
  })

  it('saving a new body leaves the front matter exactly as it was', async () => {
    const entry = await make({ start: '10:00', end: '11:00' })
    const before = splitNote(disk(entry.ref.id)).head
    await store.save(entry.ref, { body: '## Summary\n\nNew\n' }, entry.note.hash)
    expect(splitNote(disk(entry.ref.id)).head).toBe(before)
    expect(getTrainingRow(db, 'research', entry.ref.id)?.summary).toBe('New')
  })

  it('writes nothing and reports a conflict when the file changed underneath', async () => {
    const entry = await make()
    writeFileSync(file(entry.ref.id), disk(entry.ref.id) + '\nedited elsewhere\n')
    const edited = disk(entry.ref.id)
    const res = await store.save(entry.ref, { meta: { series: 'SEDarc' } }, entry.note.hash)
    expect(res.status).toBe('conflict')
    expect(disk(entry.ref.id)).toBe(edited)
  })

  it('never creates a file: saving a missing entry is an error', async () => {
    await expect(store.save(ref('2025-01-01 Nope'), { body: 'x' }, 'h')).rejects.toBeInstanceOf(
      TrainingError
    )
    expect(existsSync(dir)).toBe(false)
  })

  it('refuses metadata it could not read back, leaving the file alone', async () => {
    const entry = await make()
    const before = disk(entry.ref.id)
    for (const meta of [
      { date: 'yesterday' },
      { type: 'Seminar' },
      { skills: ['a', 'b', 'c', 'd'] },
      { folder: '../secrets' },
      { folder: '/etc' },
      { points: 'many' }
    ]) {
      await expect(store.save(entry.ref, { meta }, entry.note.hash)).rejects.toBeInstanceOf(
        TrainingError
      )
    }
    expect(disk(entry.ref.id)).toBe(before)
  })

  it('keeps three skills and drops the key when the list is emptied', async () => {
    const entry = await make({ skills: ['Networking (RP)'] })
    const a = await store.save(
      entry.ref,
      { meta: { skills: ['Networking (RP)', 'Impact (RP)', 'Leadership (RP)'] } },
      entry.note.hash
    )
    expect(a.status).toBe('saved')
    if (a.status !== 'saved') return
    await store.save(entry.ref, { meta: { skills: [] } }, a.hash)
    expect(disk(entry.ref.id)).not.toContain('skills')
  })
})

describe('renaming when the date or title changes', () => {
  it('renames the file to match, keeping its content and reporting the new id', async () => {
    const entry = await make()
    const res = await store.save(entry.ref, { meta: { title: 'Ethics' } }, entry.note.hash)
    expect(res.status === 'saved' && res.renamedTo).toBe('2025-12-10 Ethics')
    expect(existsSync(file('2025-12-10 Data Management and Security'))).toBe(false)
    expect(disk('2025-12-10 Ethics')).toContain('title: Ethics')
    expect(listTrainingIds(db, 'research')).toEqual(['2025-12-10 Ethics'])
  })

  it('never replaces an existing file, and numbers the name', async () => {
    await make({ title: 'Ethics' })
    const other = await make({ title: 'Other' })
    const res = await store.save(other.ref, { meta: { title: 'Ethics' } }, other.note.hash)
    expect(res.status === 'saved' && res.renamedTo).toBe('2025-12-10 Ethics 2')
    expect(disk('2025-12-10 Ethics')).toContain('title: Ethics')
  })

  it('does not rename for other edits or when the title is emptied', async () => {
    const entry = await make()
    const a = await store.save(entry.ref, { meta: { series: 'SEDarc' } }, entry.note.hash)
    expect(a.status === 'saved' && a.renamedTo).toBeFalsy()
    if (a.status !== 'saved') return
    const b = await store.save(entry.ref, { meta: { title: '' } }, a.hash)
    expect(b.status === 'saved' && b.renamedTo).toBeFalsy()
    expect(existsSync(file(entry.ref.id))).toBe(true)
  })

  it('a conflict renames nothing', async () => {
    const entry = await make()
    writeFileSync(file(entry.ref.id), disk(entry.ref.id) + 'x\n')
    const res = await store.save(entry.ref, { meta: { title: 'Ethics' } }, entry.note.hash)
    expect(res.status).toBe('conflict')
    expect(existsSync(file(entry.ref.id))).toBe(true)
  })
})

describe('reindex', () => {
  it('picks up a file another tool created, and drops the row when it is removed', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file('2025-11-03 By hand'),
      '---\ndate: 2025-11-03\ntitle: By hand\nskills: [Networking (RP)]\n---\n\n## Notes\n\nSome notes\n'
    )
    expect(await store.reindexFile('research', '2025-11-03 By hand.md')).toEqual(
      ref('2025-11-03 By hand')
    )
    expect(getTrainingRow(db, 'research', '2025-11-03 By hand')).toMatchObject({
      hasNotes: true,
      skills: ['Networking (RP)']
    })
    rmSync(file('2025-11-03 By hand'))
    await store.reindexFile('research', '2025-11-03 By hand.md')
    expect(getTrainingRow(db, 'research', '2025-11-03 By hand')).toBeNull()
  })

  it('flags a file with a bad date and takes the date from its name', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('2025-11-03 Odd'), '---\ntitle: Odd\ndate: soon\n---\n\nx\n')
    await store.reindexAll('research')
    const row = getTrainingRow(db, 'research', '2025-11-03 Odd')
    expect(row?.date).toBe('2025-11-03')
    expect(row?.problems).toContain('Invalid date: soon')
  })

  it('ignores files that are not notes, and copes with a missing folder', async () => {
    await store.reindexAll('research')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.hidden.md'), 'x')
    writeFileSync(join(dir, 'a.txt'), 'x')
    await store.reindexAll('research')
    expect(listTrainingIds(db, 'research')).toEqual([])
  })

  it('pruneMissing drops rows whose file is gone and keeps the rest', async () => {
    const a = await make({ title: 'A' })
    const b = await make({ title: 'B' })
    rmSync(file(a.ref.id))
    await store.pruneMissing('research')
    expect(listTrainingIds(db, 'research')).toEqual([b.ref.id])
  })
})

describe('delete', () => {
  it('moves the file to the Trash (recoverable) and drops its row', async () => {
    const entry = await make()
    await store.delete(entry.ref)
    expect(existsSync(file(entry.ref.id))).toBe(false)
    expect(existsSync(join(trashDir, `${entry.ref.id}.md`))).toBe(true)
    expect(getTrainingRow(db, 'research', entry.ref.id)).toBeNull()
  })

  it('touches only the entry it was asked to delete', async () => {
    const a = await make({ title: 'A' })
    const b = await make({ title: 'B' })
    await store.delete(a.ref)
    expect(existsSync(file(b.ref.id))).toBe(true)
  })

  it('leaves the file and its row alone when the Trash move fails', async () => {
    const entry = await make()
    trashFails = true
    await expect(store.delete(entry.ref)).rejects.toThrow('Trash unavailable')
    expect(existsSync(file(entry.ref.id))).toBe(true)
    expect(getTrainingRow(db, 'research', entry.ref.id)).not.toBeNull()
  })

  it('refuses ids that could point outside the folder, calling nothing', async () => {
    for (const id of ['../x', '/etc/passwd', 'a/b', '.hidden', 'x.md']) {
      await expect(store.delete(ref(id))).rejects.toThrow()
    }
    expect(trashed).toEqual([])
  })
})

describe('isSafeRelativeFolder', () => {
  it('accepts paths inside the Trainings folder and refuses the rest', () => {
    expect(isSafeRelativeFolder('2025-26/SEDarc/2025 12 10 Data Management')).toBe(true)
    for (const bad of ['', '/abs', '~/x', '../up', 'a/../../b', 'a\\..\\b', 'a\u0000b']) {
      expect(isSafeRelativeFolder(bad)).toBe(false)
    }
  })
})
