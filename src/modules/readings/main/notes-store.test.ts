import Database from 'better-sqlite3'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import type { SyncedFields } from '../shared/types'
import { readingsMigrations } from './migrations'
import { getReadingByCitekey, applySync } from './repository'
import { hashContent, NotesStore } from './notes-store'

const EMPTY = hashContent('')
const entry = (citekey: string): SyncedFields => ({
  citekey,
  shortCitation: `${citekey} (2020)`,
  fullTitle: `Title ${citekey}`,
  authors: [],
  year: 2020,
  status: 'unset',
  tags: [],
  abstract: null,
  entryType: 'article',
  reference: { titleSentence: `Title ${citekey}` }
})

let dir: string
let db: Database.Database
let store: NotesStore
const file = (name: string): string => join(dir, name)
const reading = (citekey: string): NonNullable<ReturnType<typeof getReadingByCitekey>> => {
  const r = getReadingByCitekey(db, citekey)
  if (!r) throw new Error('missing')
  return r
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cc-notes-'))
  db = new Database(':memory:')
  runMigrations(db, readingsMigrations)
  applySync(db, [entry('a'), entry('b')], '2026-01-01T00:00:00.000Z')
  store = new NotesStore({ db, notesDir: dir })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('NotesStore.read', () => {
  it('reports a missing file as empty, with the hash of empty content', async () => {
    expect(await store.read('a')).toEqual({ exists: false, content: '', hash: EMPTY })
  })
  it('reads an existing file', async () => {
    writeFileSync(file('a.md'), '# Hi')
    expect(await store.read('a')).toEqual({
      exists: true,
      content: '# Hi',
      hash: hashContent('# Hi')
    })
  })
})

describe('NotesStore.write: creating and saving', () => {
  it('creates the file lazily on the first real content, and updates the caches', async () => {
    const result = await store.write('a', '## Method\n\nSome **notes**', EMPTY)
    expect(result).toEqual({ status: 'saved', hash: hashContent('## Method\n\nSome **notes**') })
    expect(readFileSync(file('a.md'), 'utf8')).toBe('## Method\n\nSome **notes**')
    expect(reading('a')).toMatchObject({ hasNotes: true, notesExcerpt: 'Method Some notes' })
  })

  it('does not create a file for empty or whitespace-only content', async () => {
    expect(await store.write('a', '', EMPTY)).toEqual({ status: 'saved', hash: EMPTY })
    expect(await store.write('a', '  \n\n ', EMPTY)).toEqual({ status: 'saved', hash: EMPTY })
    expect(existsSync(file('a.md'))).toBe(false)
    expect(reading('a').hasNotes).toBe(false)
  })

  it('round-trips Markdown exactly: unicode, CRLF, trailing newline, tables and checkboxes', async () => {
    const md =
      '# Über — café\r\n\r\n- [ ] todo\r\n- [x] done\r\n\r\n| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n\r\n```r\r\nlm(y ~ x)\r\n```\r\n'
    await store.write('a', md, EMPTY)
    expect((await store.read('a')).content).toBe(md)
  })

  it('saves repeatedly as long as each save builds on the previous hash', async () => {
    const first = await store.write('a', 'one', EMPTY)
    if (first.status !== 'saved') throw new Error('expected saved')
    const second = await store.write('a', 'one two', first.hash)
    expect(second).toEqual({ status: 'saved', hash: hashContent('one two') })
    expect(readFileSync(file('a.md'), 'utf8')).toBe('one two')
  })

  it('leaves no temp files behind', async () => {
    await store.write('a', 'x', EMPTY)
    expect(readdirSync(dir)).toEqual(['a.md'])
  })

  it('refuses to write notes for a reading that does not exist', async () => {
    await expect(store.write('nope', 'x', EMPTY)).rejects.toThrow(/Unknown reading/)
    expect(readdirSync(dir)).toEqual([])
  })
})

describe('NotesStore.write: never deleting or clobbering', () => {
  it('leaves an empty file, not a deleted one, when a note is cleared', async () => {
    const saved = await store.write('a', 'something', EMPTY)
    if (saved.status !== 'saved') throw new Error('expected saved')
    await store.write('a', '', saved.hash)
    expect(existsSync(file('a.md'))).toBe(true)
    expect(readFileSync(file('a.md'), 'utf8')).toBe('')
    expect(reading('a')).toMatchObject({ hasNotes: false, notesExcerpt: '' })
  })

  it('reports a conflict, and writes nothing, when the file changed since it was loaded', async () => {
    const saved = await store.write('a', 'mine v1', EMPTY)
    if (saved.status !== 'saved') throw new Error('expected saved')
    writeFileSync(file('a.md'), 'edited by Claude Code')
    const result = await store.write('a', 'mine v2', saved.hash)
    expect(result).toEqual({
      status: 'conflict',
      disk: {
        exists: true,
        content: 'edited by Claude Code',
        hash: hashContent('edited by Claude Code')
      }
    })
    expect(readFileSync(file('a.md'), 'utf8')).toBe('edited by Claude Code')
  })

  it('reports a conflict when a file appeared for a note the editor thought was empty', async () => {
    writeFileSync(file('a.md'), 'created elsewhere')
    const result = await store.write('a', 'typed here', EMPTY)
    expect(result.status).toBe('conflict')
    expect(readFileSync(file('a.md'), 'utf8')).toBe('created elsewhere')
  })

  it('lets the user keep their version by retrying against the disk hash', async () => {
    writeFileSync(file('a.md'), 'theirs')
    const conflict = await store.write('a', 'mine', EMPTY)
    if (conflict.status !== 'conflict') throw new Error('expected conflict')
    expect(await store.write('a', 'mine', conflict.disk.hash)).toEqual({
      status: 'saved',
      hash: hashContent('mine')
    })
    expect(readFileSync(file('a.md'), 'utf8')).toBe('mine')
  })

  it('is not a conflict when the disk already has exactly what is being saved', async () => {
    writeFileSync(file('a.md'), 'same')
    expect(await store.write('a', 'same', EMPTY)).toEqual({
      status: 'saved',
      hash: hashContent('same')
    })
  })

  it('keeps notes inside the notes folder even for a hostile citekey', async () => {
    applySync(db, [entry('../../escape')], '2026-01-02T00:00:00.000Z')
    await store.write('../../escape', 'x', EMPTY)
    expect(readdirSync(dir)).toHaveLength(1)
    expect(existsSync(join(dir, '..', '..', 'escape.md'))).toBe(false)
  })
})

describe('NotesStore reindexing', () => {
  it('picks up a note written by another tool', async () => {
    writeFileSync(file('b.md'), '# From Claude\n\n- [ ] follow up')
    expect(await store.reindexFile('b.md')).toBe('b')
    expect(reading('b')).toMatchObject({ hasNotes: true, notesExcerpt: 'From Claude follow up' })
  })

  it('ignores files that belong to no reading', async () => {
    writeFileSync(file('stray.md'), 'x')
    expect(await store.reindexFile('stray.md')).toBeNull()
  })

  it('reindexAll sets and clears caches to match the folder', async () => {
    await store.write('a', 'first note', EMPTY)
    writeFileSync(file('b.md'), 'external note')
    rmSync(file('a.md'))
    await store.reindexAll()
    expect(reading('a')).toMatchObject({ hasNotes: false, notesExcerpt: '' })
    expect(reading('b')).toMatchObject({ hasNotes: true, notesExcerpt: 'external note' })
  })

  it('reindexAll copes with a notes folder that does not exist yet', async () => {
    const missing = new NotesStore({ db, notesDir: join(dir, 'not-created') })
    await expect(missing.reindexAll()).resolves.toBeUndefined()
    expect(reading('a').hasNotes).toBe(false)
  })

  it('treats an empty file as no notes', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('a.md'), '\n\n')
    await store.reindexAll()
    expect(reading('a').hasNotes).toBe(false)
  })
})
