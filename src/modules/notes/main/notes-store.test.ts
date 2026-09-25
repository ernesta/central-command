import Database from 'better-sqlite3'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../../../main/db/migrate'
import { hashContent } from '../../../main/notes/guarded-file'
import { splitNote } from '../shared/front-matter'
import type { NoteRef } from '../shared/types'
import { notesMigrations } from './migrations'
import { NoteError, NotesStore } from './notes-store'
import { getNoteRow, listNoteIds, listNoteRows } from './repository'

let root: string
let dir: string
let db: Database.Database
let store: NotesStore
let trashDir: string
let trashed: string[]
let trashFails = false
const file = (id: string): string => join(dir, `${id}.md`)
const disk = (id: string): string => readFileSync(file(id), 'utf8')
const ref = (id: string): NoteRef => ({ workspace: 'research', id })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-notes-'))
  dir = join(root, 'research')
  db = new Database(':memory:')
  runMigrations(db, notesMigrations)
  trashDir = join(root, '.Trash')
  trashed = []
  trashFails = false
  // A stand-in for the macOS Trash: moves the file into a folder, or fails.
  store = new NotesStore({
    db,
    dirFor: (w) => join(root, w),
    today: () => '2026-09-25',
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
  it('writes a note with front matter and indexes it', async () => {
    const note = await store.create({ workspace: 'research', title: 'Methods: participants' })
    expect(note.ref).toEqual(ref('Methods participants'))
    expect(disk('Methods participants')).toBe(
      "---\ntitle: 'Methods: participants'\ncreated: 2026-09-25\n---\n\n"
    )
    expect(note.meta).toMatchObject({ title: 'Methods: participants', created: '2026-09-25' })
    expect(note.problems).toEqual([])
    expect(note.note.hash).toBe(hashContent(disk('Methods participants')))
    expect(getNoteRow(db, 'research', 'Methods participants')?.title).toBe('Methods: participants')
  })

  it('makes untitled notes Untitled, Untitled 2 and so on', async () => {
    const a = await store.create({ workspace: 'research' })
    const b = await store.create({ workspace: 'research' })
    expect([a.ref.id, b.ref.id]).toEqual(['Untitled', 'Untitled 2'])
    expect(disk('Untitled')).toBe('---\ncreated: 2026-09-25\n---\n\n')
  })

  it('files a new note in a group using the spelling already in use', async () => {
    await store.create({ workspace: 'research', title: 'A', group: 'Thesis', subgroup: 'Methods' })
    const b = await store.create({
      workspace: 'research',
      title: 'B',
      group: ' thesis ',
      subgroup: 'METHODS'
    })
    expect(b.meta).toMatchObject({ group: 'Thesis', subgroup: 'Methods' })
  })

  it('never replaces a file, even one the index does not know', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('Ideas'), 'my precious ideas')
    const note = await store.create({ workspace: 'research', title: 'Ideas' })
    expect(note.ref.id).toBe('Ideas 2')
    expect(disk('Ideas')).toBe('my precious ideas')
  })

  it('refuses an unknown workspace and invalid names', async () => {
    await expect(store.create({ workspace: 'nope' as 'research' })).rejects.toThrow(NoteError)
    await expect(store.create({ workspace: 'research', group: 'Thesis/Methods' })).rejects.toThrow(
      /Invalid group/
    )
    expect(existsSync(dir) ? readdirSync(dir) : []).toEqual([])
  })
})

describe('save', () => {
  it('changes the body and leaves the front matter alone', async () => {
    const note = await store.create({ workspace: 'research', title: 'Ideas', group: 'Thesis' })
    const head = splitNote(disk('Ideas')).head
    const result = await store.save(ref('Ideas'), { body: 'New words\n' }, note.note.hash)
    expect(result).toMatchObject({ status: 'saved', hash: hashContent(head + 'New words\n') })
    expect(disk('Ideas')).toBe(head + 'New words\n')
    expect(getNoteRow(db, 'research', 'Ideas')?.excerpt).toBe('New words')
  })

  it('changes front matter and leaves the body alone', async () => {
    const note = await store.create({ workspace: 'research', title: 'Ideas', body: 'Keep me\n' })
    await store.save(ref('Ideas'), { meta: { group: 'Analysis' } }, note.note.hash)
    expect(splitNote(disk('Ideas')).body).toBe('Keep me\n')
    expect(getNoteRow(db, 'research', 'Ideas')?.group).toBe('Analysis')
  })

  it('does not overwrite a file that changed since it was read', async () => {
    const note = await store.create({ workspace: 'research', title: 'Ideas' })
    const changed = disk('Ideas') + 'edited elsewhere\n'
    writeFileSync(file('Ideas'), changed)
    const result = await store.save(ref('Ideas'), { body: 'mine\n' }, note.note.hash)
    expect(result.status).toBe('conflict')
    expect(disk('Ideas')).toBe(changed)
    // Front matter changes are guarded too.
    const meta = await store.save(ref('Ideas'), { meta: { pinned: true } }, note.note.hash)
    expect(meta.status).toBe('conflict')
    expect(disk('Ideas')).toBe(changed)
  })

  it('does not create a missing file', async () => {
    await expect(store.save(ref('Ghost'), { body: 'x' }, hashContent(''))).rejects.toThrow(
      /not found/
    )
    expect(existsSync(file('Ghost'))).toBe(false)
  })

  it('refuses values the app cannot read back', async () => {
    const note = await store.create({ workspace: 'research', title: 'Ideas' })
    const h = note.note.hash
    for (const meta of [
      { title: 'two\nlines' },
      { group: 'a›b' },
      { created: 'yesterday' },
      { pinned: 'yes' as unknown as boolean }
    ]) {
      await expect(store.save(ref('Ideas'), { meta }, h)).rejects.toThrow(NoteError)
    }
    expect(disk('Ideas')).toContain('title: Ideas')
  })

  it('leaves the old subgroup behind when a note moves to another group', async () => {
    const note = await store.create({
      workspace: 'research',
      title: 'Ideas',
      group: 'Thesis',
      subgroup: 'Methods'
    })
    await store.save(ref('Ideas'), { meta: { group: 'Analysis' } }, note.note.hash)
    expect(getNoteRow(db, 'research', 'Ideas')).toMatchObject({ group: 'Analysis', subgroup: '' })
  })

  it('takes the group spelling from the other notes, not from itself', async () => {
    await store.create({ workspace: 'research', title: 'A', group: 'Thesis' })
    const b = await store.create({ workspace: 'research', title: 'B', group: 'Analysis' })
    await store.save(ref('B'), { meta: { group: 'THESIS' } }, b.note.hash)
    expect(getNoteRow(db, 'research', 'B')?.group).toBe('Thesis')
  })

  it('lets a lone note respell its own group', async () => {
    const a = await store.create({ workspace: 'research', title: 'A', group: 'Thesis' })
    await store.save(ref('A'), { meta: { group: 'thesis' } }, a.note.hash)
    expect(getNoteRow(db, 'research', 'A')?.group).toBe('thesis')
  })
})

describe('pinning', () => {
  it('pins up to four notes and refuses a fifth', async () => {
    for (const id of ['a', 'b', 'c', 'd', 'e'])
      await store.create({ workspace: 'research', title: id })
    for (const id of ['a', 'b', 'c', 'd']) {
      const n = await store.read(ref(id))
      await store.save(ref(id), { meta: { pinned: true } }, n.note.hash)
    }
    const e = await store.read(ref('e'))
    await expect(store.save(ref('e'), { meta: { pinned: true } }, e.note.hash)).rejects.toThrow(
      /Four notes are pinned/
    )
    expect(getNoteRow(db, 'research', 'e')?.pinned).toBe(false)
    // Unpinning frees a place, and a pinned note can be saved again while at four.
    const a = await store.read(ref('a'))
    await store.save(ref('a'), { meta: { pinned: true, title: 'a' } }, a.note.hash)
    await store.save(ref('a'), { meta: { pinned: false } }, (await store.read(ref('a'))).note.hash)
    await store.save(ref('e'), { meta: { pinned: true } }, e.note.hash)
    expect(listNoteRows(db, 'research').filter((r) => r.pinned)).toHaveLength(4)
  })
})

describe('renaming to match the title', () => {
  it('renames the file and says so', async () => {
    const note = await store.create({ workspace: 'research' })
    const result = await store.save(
      ref('Untitled'),
      { meta: { title: 'Sampling weights' } },
      note.note.hash
    )
    expect(result).toMatchObject({ status: 'saved', renamedTo: 'Sampling weights' })
    expect(existsSync(file('Untitled'))).toBe(false)
    expect(disk('Sampling weights')).toContain('title: Sampling weights')
    expect(listNoteIds(db, 'research')).toEqual(['Sampling weights'])
  })

  it('numbers the name when it is taken and never replaces a file', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('Ideas'), 'someone else')
    const note = await store.create({ workspace: 'research', title: 'Draft' })
    const result = await store.save(ref('Draft'), { meta: { title: 'Ideas' } }, note.note.hash)
    expect(result).toMatchObject({ renamedTo: 'Ideas 2' })
    expect(disk('Ideas')).toBe('someone else')
  })

  it('leaves a name alone that already fits the title', async () => {
    await store.create({ workspace: 'research', title: 'Ideas' })
    const second = await store.create({ workspace: 'research', title: 'Ideas' })
    expect(second.ref.id).toBe('Ideas 2')
    const result = await store.save(ref('Ideas 2'), { meta: { title: 'Ideas' } }, second.note.hash)
    expect(result).not.toHaveProperty('renamedTo')
    expect(existsSync(file('Ideas 2'))).toBe(true)
  })
})

describe('delete', () => {
  it('moves the file to the Trash and drops the row', async () => {
    await store.create({ workspace: 'research', title: 'Ideas', body: 'words' })
    await store.delete(ref('Ideas'))
    expect(existsSync(file('Ideas'))).toBe(false)
    expect(trashed).toEqual([file('Ideas')])
    expect(readFileSync(join(trashDir, 'Ideas.md'), 'utf8')).toContain('words')
    expect(listNoteIds(db, 'research')).toEqual([])
  })

  it('leaves the file and its row when the Trash fails', async () => {
    await store.create({ workspace: 'research', title: 'Ideas' })
    trashFails = true
    await expect(store.delete(ref('Ideas'))).rejects.toThrow('Trash unavailable')
    expect(existsSync(file('Ideas'))).toBe(true)
    expect(listNoteIds(db, 'research')).toEqual(['Ideas'])
  })

  it('refuses an id that is not a plain file name', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(root, 'outside.md'), 'x')
    await expect(store.delete(ref('../outside'))).rejects.toThrow(/Invalid note id/)
    expect(existsSync(join(root, 'outside.md'))).toBe(true)
  })
})

describe('the index follows the folder', () => {
  it('reads modified times, adds new files and drops missing ones', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('Loose'), '# Heading\n\nWords here\n')
    utimesSync(file('Loose'), 1_700_000_000, 1_700_000_000)
    await store.create({ workspace: 'research', title: 'Gone' })
    rmSync(file('Gone'))
    await store.reindexAll('research')
    expect(listNoteIds(db, 'research')).toEqual(['Loose'])
    expect(getNoteRow(db, 'research', 'Loose')).toMatchObject({
      title: '',
      firstLine: 'Heading',
      edited: 1_700_000_000_000
    })
  })

  it('reindexes one file by name and ignores other files', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('Loose'), 'hello')
    expect(await store.reindexFile('research', 'Loose.md')).toEqual(ref('Loose'))
    expect(await store.reindexFile('research', '.hidden.md')).toBeNull()
    expect(await store.reindexFile('research', 'photo.png')).toBeNull()
    expect(listNoteIds(db, 'research')).toEqual(['Loose'])
  })

  it('prunes rows for files that are gone', async () => {
    await store.create({ workspace: 'research', title: 'Gone' })
    rmSync(file('Gone'))
    await store.pruneMissing('research')
    expect(listNoteIds(db, 'research')).toEqual([])
  })
})

describe('discardIfEmpty', () => {
  it('removes a note that was never written in, without the Trash', async () => {
    await store.create({ workspace: 'research', group: 'Thesis' })
    expect(await store.discardIfEmpty(ref('Untitled'))).toBe(true)
    expect(existsSync(file('Untitled'))).toBe(false)
    expect(listNoteIds(db, 'research')).toEqual([])
    expect(trashed).toEqual([])
  })

  it('keeps a note with a title, text, a pin or front matter from another tool', async () => {
    await store.create({ workspace: 'research', title: 'Titled' })
    await store.create({ workspace: 'research', body: 'some words\n' })
    const pinned = await store.create({ workspace: 'research' })
    await store.save(ref(pinned.ref.id), { meta: { pinned: true } }, pinned.note.hash)
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('Imported'), '---\nimported-from: Ideas/X.md\n---\n\n')
    for (const id of ['Titled', 'Untitled', pinned.ref.id, 'Imported']) {
      const before = existsSync(file(id)) ? disk(id) : null
      expect(await store.discardIfEmpty(ref(id))).toBe(false)
      expect(before === null ? true : disk(id)).toBe(before === null ? true : before)
    }
  })

  it('says false for a note that is not there', async () => {
    expect(await store.discardIfEmpty(ref('Ghost'))).toBe(false)
  })
})
