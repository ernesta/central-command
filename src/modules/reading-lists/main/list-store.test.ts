import Database from 'better-sqlite3'
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { hashContent } from '../../../main/notes/guarded-file'
import type { ReadingListRef } from '../shared/types'
import { readingListsMigrations } from './migrations'
import { ReadingListError, ReadingListStore } from './list-store'
import { listListIds, listListRows, mentionsOf } from './repository'

let root: string
let dir: string
let db: Database.Database
let store: ReadingListStore
let trashDir: string
let trashed: string[]
let trashFails = false
const file = (id: string): string => join(dir, `${id}.md`)
const disk = (id: string): string => readFileSync(file(id), 'utf8')
const ref = (id: string): ReadingListRef => ({ workspace: 'research', id })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-reading-lists-'))
  dir = join(root, 'research')
  db = new Database(':memory:')
  runMigrations(db, readingListsMigrations)
  trashDir = join(root, '.Trash')
  trashed = []
  trashFails = false
  store = new ReadingListStore({
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

describe('create', () => {
  it('writes a list with front matter and indexes it', async () => {
    const list = await store.create({ workspace: 'research', title: 'Language of Instruction' })
    expect(list.ref).toEqual(ref('Language of Instruction'))
    expect(disk('Language of Instruction')).toBe('---\ntitle: Language of Instruction\n---\n\n')
    expect(list.meta).toEqual({ title: 'Language of Instruction' })
    expect(list.note.hash).toBe(hashContent(disk('Language of Instruction')))
    expect(listListRows(db, 'research')[0]?.title).toBe('Language of Instruction')
  })

  it('makes untitled lists Untitled list, Untitled list 2 and so on', async () => {
    const a = await store.create({ workspace: 'research' })
    const b = await store.create({ workspace: 'research' })
    expect([a.ref.id, b.ref.id]).toEqual(['Untitled list', 'Untitled list 2'])
  })

  it('never replaces a file, even one the index does not know', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('Shortlist'), 'a hand-written file')
    const list = await store.create({ workspace: 'research', title: 'Shortlist' })
    expect(list.ref.id).toBe('Shortlist 2')
    expect(disk('Shortlist')).toBe('a hand-written file')
  })
})

describe('reindex: sections, entries and mentions', () => {
  it('indexes section and entry counts, and one mention row per linked entry', async () => {
    const list = await store.create({ workspace: 'research', title: 'LOI' })
    await store.save(
      list.ref,
      {
        body:
          '## What do the reviews conclude?\n\n' +
          '- **[[kim2020]]** Meta-analysis of 67 studies.\n' +
          '- **Author (2020). Title.** Not yet in Zotero.\n\n' +
          '## Does it help?\n\n' +
          '- **[[taylor2016]]** Lower scores in English.\n'
      },
      list.note.hash
    )
    const row = listListRows(db, 'research')[0]
    expect(row).toMatchObject({ sectionCount: 2, entryCount: 3 })
    const mentions = mentionsOf(db, 'kim2020')
    expect(mentions).toEqual([
      {
        ref: ref('LOI'),
        listTitle: 'LOI',
        section: 'What do the reviews conclude?',
        annotation: 'Meta-analysis of 67 studies.'
      }
    ])
    expect(mentionsOf(db, 'taylor2016')).toHaveLength(1)
    expect(mentionsOf(db, 'no-such-key')).toEqual([])
  })

  it('drops a reading’s mentions once the entry naming it is edited away', async () => {
    const list = await store.create({ workspace: 'research', title: 'LOI' })
    const saved = await store.save(
      list.ref,
      { body: '## S\n\n- **[[kim2020]]** note\n' },
      list.note.hash
    )
    if (saved.status !== 'saved') throw new Error('expected saved')
    expect(mentionsOf(db, 'kim2020')).toHaveLength(1)
    await store.save(list.ref, { body: '## S\n\n- **[[other]]** note\n' }, saved.hash)
    expect(mentionsOf(db, 'kim2020')).toEqual([])
  })
})

describe('save', () => {
  it('renames the file to match a new title, keeping the body', async () => {
    const list = await store.create({ workspace: 'research', title: 'Old name' })
    const saved = await store.save(
      list.ref,
      { meta: { title: 'New name' }, body: '## S\n\n- **[[x]]** y\n' },
      list.note.hash
    )
    expect(saved).toMatchObject({ status: 'saved', renamedTo: 'New name' })
    expect(disk('New name')).toContain('## S')
    expect(listListIds(db, 'research')).toEqual(['New name'])
  })

  it('refuses to save over a change it has not seen (a conflict), writing nothing', async () => {
    const list = await store.create({ workspace: 'research', title: 'A' })
    writeFileSync(file('A'), '---\ntitle: A\n---\n\nSomeone else’s edit\n')
    const result = await store.save(list.ref, { body: 'My edit\n' }, list.note.hash)
    expect(result.status).toBe('conflict')
    expect(disk('A')).toContain('Someone else’s edit')
  })

  it('a missing file is an error, never created by save', async () => {
    await expect(store.save(ref('Ghost'), { body: 'x' }, hashContent(''))).rejects.toThrow(
      ReadingListError
    )
  })
})

describe('delete', () => {
  it('moves the file to the Trash and drops the index row and its mentions', async () => {
    const list = await store.create({ workspace: 'research', title: 'A' })
    await store.save(list.ref, { body: '## S\n\n- **[[x]]** y\n' }, list.note.hash)
    await store.delete(list.ref)
    expect(trashed).toEqual([file('A')])
    expect(listListIds(db, 'research')).toEqual([])
    expect(mentionsOf(db, 'x')).toEqual([])
  })

  it('leaves the file and its row alone if the Trash move fails', async () => {
    const list = await store.create({ workspace: 'research', title: 'A' })
    trashFails = true
    await expect(store.delete(list.ref)).rejects.toThrow('Trash unavailable')
    expect(disk('A')).toBeTruthy()
    expect(listListIds(db, 'research')).toEqual(['A'])
  })
})

// Mutation checks (CLAUDE.md: safety-critical logic should be deliberately broken to confirm a test
// catches it): these guard the two rules every note-like store in this app must keep.
describe('mutation checks', () => {
  it('a save that skipped the hash guard would overwrite a concurrent edit (guards against removing it)', async () => {
    const list = await store.create({ workspace: 'research', title: 'A' })
    writeFileSync(file('A'), '---\ntitle: A\n---\n\nSomeone else’s edit\n')
    const result = await store.save(list.ref, { body: 'Mine\n' }, list.note.hash)
    expect(result.status).toBe('conflict')
    expect(disk('A')).not.toContain('Mine')
  })

  it('create would silently replace a hand-written file if the exclusive-write guard were removed', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('Precious'), 'not to be touched')
    await store.create({ workspace: 'research', title: 'Precious' })
    expect(disk('Precious')).toBe('not to be touched')
  })
})
