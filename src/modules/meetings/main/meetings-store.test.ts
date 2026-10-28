import Database from 'better-sqlite3'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
import type { MeetingRef } from '../shared/types'
import { meetingsMigrations } from './migrations'
import { MeetingError, MeetingsStore } from './meetings-store'
import { getMeetingRow, listMeetingIds } from './repository'

let root: string
let dir: string
let db: Database.Database
let store: MeetingsStore
let trashDir: string
let trashed: string[]
let trashFails = false
const file = (id: string): string => join(dir, `${id}.md`)
const disk = (id: string): string => readFileSync(file(id), 'utf8')
const ref = (id: string): MeetingRef => ({ workspace: 'research', id })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cc-meetings-'))
  dir = join(root, 'research')
  db = new Database(':memory:')
  runMigrations(db, meetingsMigrations)
  trashDir = join(root, '.Trash')
  trashed = []
  trashFails = false
  // A stand-in for the macOS Trash: moves the file into a folder, or fails.
  store = new MeetingsStore({
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

describe('ensureUid', () => {
  it('adds a uid once without touching the rest of the file, and indexes it', async () => {
    const made = await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-09-24',
      body: 'kept\n'
    })
    const uid = await store.ensureUid(made.ref)
    expect(uid).toMatch(/^[a-z0-9]{8}$/)
    expect(await store.ensureUid(made.ref)).toBe(uid)
    const file = disk('2026-09-24 Luminos')
    expect(file).toContain(`uid: ${uid}\n`)
    expect(splitNote(file).body).toBe('kept\n')
    expect(file.replace(`uid: ${uid}\n`, '')).toBe(made.note.content)
    expect(getMeetingRow(db, 'research', '2026-09-24 Luminos')?.uid).toBe(uid)
  })

  it('survives a rename (date changed) and a move to the other workspace', async () => {
    const made = await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-09-24'
    })
    const uid = await store.ensureUid(made.ref)
    const now = await store.read(made.ref)
    const saved = await store.save(made.ref, { meta: { date: '2026-10-01' } }, now.note.hash)
    expect(saved).toMatchObject({ status: 'saved', renamedTo: '2026-10-01 Luminos' })
    const moved = await store.move({ workspace: 'research', id: '2026-10-01 Luminos' }, 'work')
    expect(getMeetingRow(db, 'work', moved.ref.id)?.uid).toBe(uid)
  })

  it('refuses a missing meeting', async () => {
    await expect(store.ensureUid(ref('missing'))).rejects.toThrow(MeetingError)
  })
})

describe('move', () => {
  it('moves a meeting, text and all, to the other workspace', async () => {
    const made = await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-09-24',
      body: 'kept text\n'
    })
    const moved = await store.move(made.ref, 'work')
    expect(moved.ref).toEqual({ workspace: 'work', id: '2026-09-24 Luminos' })
    expect(readFileSync(join(root, 'work', '2026-09-24 Luminos.md'), 'utf8')).toBe(
      made.note.content
    )
    expect(existsSync(join(root, 'research', '2026-09-24 Luminos.md'))).toBe(false)
    expect(trashed).toHaveLength(1)
    expect(getMeetingRow(db, 'research', '2026-09-24 Luminos')).toBeNull()
    expect(getMeetingRow(db, 'work', '2026-09-24 Luminos')?.series).toBe('Luminos')
  })

  it('never replaces a meeting already there: it takes the next free name', async () => {
    await store.create({
      workspace: 'work',
      series: 'Luminos',
      date: '2026-09-24',
      body: 'theirs\n'
    })
    const mine = await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-09-24',
      body: 'mine\n'
    })
    const moved = await store.move(mine.ref, 'work')
    expect(moved.ref.id).toBe('2026-09-24 Luminos 2')
    expect(splitNote(readFileSync(join(root, 'work', '2026-09-24 Luminos.md'), 'utf8')).body).toBe(
      'theirs\n'
    )
  })

  it('leaves the meeting where it was, with no copy, when the Trash is unavailable', async () => {
    const made = await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-09-24'
    })
    trashFails = true
    await expect(store.move(made.ref, 'work')).rejects.toThrow('Trash unavailable')
    expect(existsSync(join(root, 'research', '2026-09-24 Luminos.md'))).toBe(true)
    expect(existsSync(join(root, 'work', '2026-09-24 Luminos.md'))).toBe(false)
    expect(getMeetingRow(db, 'research', '2026-09-24 Luminos')).toBeDefined()
  })

  it('refuses moving to the same workspace, an unknown one, or a meeting that is gone', async () => {
    const made = await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-09-24'
    })
    await expect(store.move(made.ref, 'research')).rejects.toThrow(MeetingError)
    await expect(store.move(made.ref, 'nope' as 'work')).rejects.toThrow(MeetingError)
    await expect(store.move(ref('missing'), 'work')).rejects.toThrow(MeetingError)
  })
})

describe('create', () => {
  it('writes the template with front matter and indexes it', async () => {
    const meeting = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24',
      start: '14:00',
      end: '15:00',
      mode: 'in-person',
      attendees: ['Kathy Rastle', 'Ernesta Orlovaitė']
    })
    expect(meeting.ref).toEqual(ref('2026-09-24 Supervision'))
    expect(disk('2026-09-24 Supervision')).toBe(
      "---\nseries: Supervision\ndate: 2026-09-24\nstart: '14:00'\nend: '15:00'\nmode: in-person\nattendees: [Kathy Rastle, Ernesta Orlovaitė]\n---\n\n## Summary\n## Notes\n"
    )
    expect(meeting.meta).toMatchObject({
      series: 'Supervision',
      date: '2026-09-24',
      start: '14:00'
    })
    expect(meeting.problems).toEqual([])
    expect(meeting.note.hash).toBe(hashContent(disk('2026-09-24 Supervision')))
    expect(getMeetingRow(db, 'research', '2026-09-24 Supervision')?.series).toBe('Supervision')
  })

  it('creates the folder on first use and takes a given body verbatim', async () => {
    const m = await store.create({
      workspace: 'research',
      series: 'Other',
      date: '2026-01-02',
      body: 'custom\n'
    })
    expect(m.body).toBe('custom\n')
  })

  it('numbers a second meeting of the same series on the same day', async () => {
    const input = { workspace: 'research', series: 'Supervision', date: '2026-09-24' } as const
    await store.create(input)
    const second = await store.create(input)
    const third = await store.create(input)
    expect(second.ref.id).toBe('2026-09-24 Supervision 2')
    expect(third.ref.id).toBe('2026-09-24 Supervision 3')
  })

  it('never overwrites a file that already exists, even one the index does not know', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('2026-09-24 Supervision'), 'hand-written, unindexed')
    const m = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24'
    })
    expect(m.ref.id).toBe('2026-09-24 Supervision 2')
    expect(disk('2026-09-24 Supervision')).toBe('hand-written, unindexed')
  })

  it('does not overwrite when two creates race for the same name', async () => {
    const input = { workspace: 'research', series: 'Other', date: '2026-09-24' } as const
    const results = await Promise.all([
      store.create(input),
      store.create(input),
      store.create(input)
    ])
    expect(new Set(results.map((r) => r.ref.id)).size).toBe(3)
    expect(readdirSync(dir).filter((f) => f.endsWith('.md'))).toHaveLength(3)
  })

  it('refuses invalid input without writing anything', async () => {
    const base = { workspace: 'research', series: 'Supervision', date: '2026-09-24' } as const
    await expect(store.create({ ...base, series: '  ' })).rejects.toThrow(MeetingError)
    await expect(store.create({ ...base, date: '2026-13-01' })).rejects.toThrow('Invalid date')
    await expect(store.create({ ...base, start: '9:00' })).rejects.toThrow('Invalid start')
    await expect(store.create({ ...base, mode: 'hybrid' as never })).rejects.toThrow('Unknown mode')
    await expect(store.create({ ...base, workspace: 'life' as never })).rejects.toThrow(
      'Unknown workspace'
    )
    expect(() => readdirSync(dir)).toThrow()
  })
})

describe('read', () => {
  it('splits the file into meta and body', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file('x'),
      '---\nseries: Other\ndate: 2026-01-02\ncolour: blue\n---\n\n## Notes\r\ntext  \n'
    )
    const m = await store.read(ref('x'))
    expect(m.meta.series).toBe('Other')
    expect(m.body).toBe('## Notes\r\ntext  \n')
    expect(m.note.exists).toBe(true)
  })

  it('refuses a missing meeting and an unsafe id', async () => {
    await expect(store.read(ref('nope'))).rejects.toThrow('not found')
    await expect(store.read(ref('../secret'))).rejects.toThrow('Invalid meeting id')
  })
})

describe('save', () => {
  const original =
    '---\nseries: Supervision\ncolour: blue # keep\ndate: 2026-09-24\nattendees: [A B]\n---\n\n## Summary\r\n\r\n  odd \t\r\n## Notes\n- [ ] **TODO(EO)**: x\n'
  beforeEach(() => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('m'), original)
  })
  const hash = (): string => hashContent(original)

  it('saving a new body leaves the front matter exactly as it was', async () => {
    const result = await store.save(ref('m'), { body: 'new text\n' }, hash())
    expect(result.status).toBe('saved')
    expect(disk('m')).toBe(splitNote(original).head + 'new text\n')
  })

  it('saving metadata leaves the body byte-for-byte alone and keeps unknown keys', async () => {
    await store.save(ref('m'), { meta: { start: '10:00', mode: 'online' } }, hash())
    const after = disk('m')
    expect(splitNote(after).body).toBe(splitNote(original).body)
    expect(after).toContain('colour: blue # keep')
    expect(after).toContain("start: '10:00'")
  })

  it('keeps the index’s TODOs in step with what was saved', async () => {
    await store.save(ref('m'), { body: '## Notes\n- **TODO(EO)**: first\n' }, hash())
    expect(getMeetingRow(db, 'research', 'm')?.todos.map((t) => t.text)).toEqual(['first'])
  })

  it('returns the new hash and refreshes the index', async () => {
    const result = await store.save(ref('m'), { meta: { end: '11:00' } }, hash())
    expect(result).toEqual({ status: 'saved', hash: hashContent(disk('m')) })
    expect(getMeetingRow(db, 'research', 'm')?.end).toBe('11:00')
  })

  it('writes nothing and reports a conflict when the file changed underneath', async () => {
    writeFileSync(file('m'), original + 'added by Claude Code\n')
    const result = await store.save(ref('m'), { body: 'mine' }, hash())
    expect(result.status).toBe('conflict')
    if (result.status === 'conflict')
      expect(result.disk.content).toBe(original + 'added by Claude Code\n')
    expect(disk('m')).toBe(original + 'added by Claude Code\n')
  })

  it('does not write when nothing would change', async () => {
    const before = readdirSync(dir)
    expect((await store.save(ref('m'), {}, hash())).status).toBe('saved')
    expect(disk('m')).toBe(original)
    expect(readdirSync(dir)).toEqual(before)
  })

  it('never creates a file: saving a missing meeting is an error', async () => {
    await expect(store.save(ref('ghost'), { body: 'x' }, hashContent(''))).rejects.toThrow(
      'not found'
    )
    expect(readdirSync(dir)).toEqual(['m.md'])
  })

  it('refuses metadata it could not read back, leaving the file alone', async () => {
    await expect(store.save(ref('m'), { meta: { date: 'soon' } }, hash())).rejects.toThrow(
      'Invalid date'
    )
    await expect(store.save(ref('m'), { meta: { series: '  ' } }, hash())).rejects.toThrow(
      'Invalid series'
    )
    expect(disk('m')).toBe(original)
  })

  it('accepts a series that is not on any list', async () => {
    const result = await store.save(ref('m'), { meta: { series: 'Book Club' } }, hash())
    expect(result.status).toBe('saved')
    expect(readdirSync(dir).join()).toContain('Book Club')
  })

  it('clearing the body leaves the file with its front matter, not deleted', async () => {
    await store.save(ref('m'), { body: '' }, hash())
    expect(disk('m')).toBe(splitNote(original).head)
  })
})

describe('reindex', () => {
  it('picks up a file another tool created, and drops the row when it is removed', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('2026-02-03 Other'), '---\nseries: Other\ndate: 2026-02-03\n---\n')
    expect(await store.reindexFile('research', '2026-02-03 Other.md')).toEqual(
      ref('2026-02-03 Other')
    )
    expect(getMeetingRow(db, 'research', '2026-02-03 Other')?.date).toBe('2026-02-03')
    rmSync(file('2026-02-03 Other'))
    await store.reindexFile('research', '2026-02-03 Other.md')
    expect(getMeetingRow(db, 'research', '2026-02-03 Other')).toBeNull()
  })

  it('ignores files that are not meetings', async () => {
    expect(await store.reindexFile('research', '.x.md.tmp')).toBeNull()
    expect(await store.reindexFile('research', 'notes.txt')).toBeNull()
  })

  it('reindexAll adds, refreshes and drops rows to match the folder', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('a'), '---\nseries: Other\ndate: 2026-01-01\n---\n')
    writeFileSync(file('b'), '---\nseries: Other\ndate: 2026-01-02\n---\n')
    await store.reindexAll('research')
    expect(listMeetingIds(db, 'research').sort()).toEqual(['a', 'b'])
    rmSync(file('b'))
    writeFileSync(file('a'), '---\nseries: Luminos\ndate: 2026-01-01\n---\n')
    await store.reindexAll('research')
    expect(listMeetingIds(db, 'research')).toEqual(['a'])
    expect(getMeetingRow(db, 'research', 'a')?.series).toBe('Luminos')
  })

  it('reindexAll fills has_notes on a row whose content is unchanged', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('a'), '---\nseries: Other\ndate: 2026-01-01\n---\n## Notes\n\nWe talked.\n')
    await store.reindexAll('research')
    db.prepare('UPDATE meetings SET has_notes = 0').run() // as a row from before the migration
    expect(getMeetingRow(db, 'research', 'a')?.hasNotes).toBe(false)
    await store.reindexAll('research')
    expect(getMeetingRow(db, 'research', 'a')?.hasNotes).toBe(true)
  })

  it('pruneMissing drops rows whose file is gone, keeps the rest, and reads no file', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('a'), '---\nseries: Other\ndate: 2026-01-01\n---\n')
    writeFileSync(file('b'), '---\nseries: Other\ndate: 2026-01-02\n---\n')
    await store.reindexAll('research')
    rmSync(file('b'))
    writeFileSync(file('a'), '---\nseries: Luminos\ndate: 2026-01-01\n---\n') // changed, but not re-read by a prune
    await store.pruneMissing('research')
    expect(listMeetingIds(db, 'research')).toEqual(['a'])
    expect(getMeetingRow(db, 'research', 'a')?.series).toBe('Other')
  })

  it('reindexAll copes with a missing folder', async () => {
    await expect(store.reindexAll('work')).resolves.toBeUndefined()
  })
})

describe('delete', () => {
  const content = '---\nseries: Other\ndate: 2026-02-03\n---\n\nprecious notes\n'
  beforeEach(() => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('a'), content)
    writeFileSync(file('b'), content)
  })

  it('restore puts the file back byte for byte and indexes it, and never replaces one', async () => {
    await store.reindexAll('research')
    expect(await store.delete(ref('a'))).toBe(content)
    await store.restore(ref('a'), content)
    expect(readFileSync(file('a'), 'utf8')).toBe(content)
    expect(getMeetingRow(db, 'research', 'a')).not.toBeNull()
    await expect(store.restore(ref('a'), 'other')).rejects.toThrow(/exists now/)
    expect(readFileSync(file('a'), 'utf8')).toBe(content)
  })

  it('moves the file to the Trash (recoverable) and drops its row', async () => {
    await store.reindexAll('research')
    await store.delete(ref('a'))
    expect(existsSync(file('a'))).toBe(false)
    expect(readFileSync(join(trashDir, 'a.md'), 'utf8')).toBe(content)
    expect(trashed).toEqual([file('a')])
    expect(getMeetingRow(db, 'research', 'a')).toBeNull()
  })

  it('touches only the meeting it was asked to delete', async () => {
    await store.reindexAll('research')
    await store.delete(ref('a'))
    expect(readFileSync(file('b'), 'utf8')).toBe(content)
    expect(getMeetingRow(db, 'research', 'b')).not.toBeNull()
  })

  it('leaves the file and its row alone when the Trash move fails', async () => {
    await store.reindexAll('research')
    trashFails = true
    await expect(store.delete(ref('a'))).rejects.toThrow('Trash unavailable')
    expect(readFileSync(file('a'), 'utf8')).toBe(content)
    expect(getMeetingRow(db, 'research', 'a')).not.toBeNull()
  })

  it('reports a missing meeting, and clears a stale row for it', async () => {
    await store.reindexAll('research')
    rmSync(file('a'))
    await expect(store.delete(ref('a'))).rejects.toThrow('not found')
    expect(trashed).toEqual([])
    expect(getMeetingRow(db, 'research', 'a')).toBeNull()
  })

  it('refuses ids that could point outside the meetings folder, calling nothing', async () => {
    await expect(store.delete(ref('../a'))).rejects.toThrow('Invalid meeting id')
    await expect(store.delete({ workspace: 'life' as never, id: 'a' })).rejects.toThrow(
      'Unknown workspace'
    )
    expect(trashed).toEqual([])
  })
})

describe('Previous TODOs carry-over (switched off)', () => {
  const SUP = { workspace: 'research', series: 'Supervision' } as const
  const previousBody =
    '## Summary\n\n## Previous TODOs\n\n- [ ] **TODO(KR)**: waiting\n\n## Notes\n'

  it('a new meeting gets nothing from the previous one', async () => {
    await store.create({ ...SUP, date: '2026-09-17', body: previousBody })
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(m.body).toBe('## Summary\n## Notes\n')
  })

  it('opening a meeting writes nothing', async () => {
    await store.create({ ...SUP, date: '2026-09-17', body: previousBody })
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    const before = disk(m.ref.id)
    expect(await store.syncPreviousTodos(m.ref, m.note.hash)).toMatchObject({
      status: 'saved',
      added: 0
    })
    expect(disk(m.ref.id)).toBe(before)
  })

  it('syncPreviousTodos reports a conflict for a stale hash even when there is nothing to add', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(await store.syncPreviousTodos(m.ref, hashContent('stale'))).toMatchObject({
      status: 'conflict'
    })
  })
})

describe('a meeting with no date yet (planned)', () => {
  it('is created as "Planned Series", has no problem, and is renamed when a date is set or cleared', async () => {
    const meeting = await store.create({ workspace: 'research', series: 'Luminos' })
    expect(meeting.ref.id).toBe('Planned Luminos')
    expect(disk(meeting.ref.id)).not.toContain('date:')
    expect(meeting.problems).toEqual([])

    const dated = await store.save(meeting.ref, { meta: { date: '2026-03-04' } }, meeting.note.hash)
    expect(dated.status === 'saved' && dated.renamedTo).toBe('2026-03-04 Luminos')
    const again = await store.read(ref('2026-03-04 Luminos'))
    const cleared = await store.save(again.ref, { meta: { date: '' } }, again.note.hash)
    expect(cleared.status === 'saved' && cleared.renamedTo).toBe('Planned Luminos')
    expect(disk('Planned Luminos')).not.toContain('date:')
  })

  it('gets no Previous TODOs carried over, and is not the previous meeting of another', async () => {
    const planned = await store.create({ workspace: 'research', series: 'Supervision' })
    expect(planned.body).toBe('## Summary\n## Notes\n')
  })
})

describe('renaming when the date or series changes', () => {
  const SUP = { workspace: 'research', series: 'Supervision' } as const
  const save = (
    m: { ref: MeetingRef; note: { hash: string } },
    meta: object
  ): ReturnType<MeetingsStore['save']> => store.save(m.ref, { meta }, m.note.hash)

  it('renames the file to match a new date, keeping its content and reporting the new id', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24', body: 'my notes\n' })
    const result = await save(m, { date: '2026-10-01' })
    expect(result).toMatchObject({ status: 'saved', renamedTo: '2026-10-01 Supervision' })
    expect(existsSync(file('2026-09-24 Supervision'))).toBe(false)
    expect(disk('2026-10-01 Supervision')).toContain('date: 2026-10-01')
    expect(disk('2026-10-01 Supervision')).toContain('my notes')
    // The index follows the file: no row for the old name, a current row for the new one.
    expect(getMeetingRow(db, 'research', '2026-09-24 Supervision')).toBeNull()
    expect(getMeetingRow(db, 'research', '2026-10-01 Supervision')?.date).toBe('2026-10-01')
    // The hash returned is the hash of the file under its new name.
    if (result.status === 'saved')
      expect(result.hash).toBe(hashContent(disk('2026-10-01 Supervision')))
  })

  it('renames for a new series too', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(await save(m, { series: 'Luminos' })).toMatchObject({ renamedTo: '2026-09-24 Luminos' })
    expect(existsSync(file('2026-09-24 Luminos'))).toBe(true)
  })

  it('numbers the name when another meeting of that series already has that day', async () => {
    await store.create({ ...SUP, date: '2026-10-01' })
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(await save(m, { date: '2026-10-01' })).toMatchObject({
      renamedTo: '2026-10-01 Supervision 2'
    })
  })

  it('never replaces an existing file, even one the index does not know', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    writeFileSync(file('2026-10-01 Supervision'), 'hand-written, unindexed')
    expect(await save(m, { date: '2026-10-01' })).toMatchObject({
      renamedTo: '2026-10-01 Supervision 2'
    })
    expect(disk('2026-10-01 Supervision')).toBe('hand-written, unindexed')
  })

  it('does not rename for other edits, for a body edit, or when the name already matches', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    expect(await save(m, { start: '10:00', mode: 'online' })).not.toHaveProperty('renamedTo')
    const again = await store.read(m.ref)
    expect(await store.save(m.ref, { body: 'x\n' }, again.note.hash)).not.toHaveProperty(
      'renamedTo'
    )
    const third = await store.read(m.ref)
    expect(await save(third, { date: '2026-09-24' })).not.toHaveProperty('renamedTo')
    expect(existsSync(file('2026-09-24 Supervision'))).toBe(true)
  })

  it('a meeting whose name never matched its date is only renamed when the date or series is edited', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('old name'), '---\nseries: Other\ndate: 2026-01-02\n---\n\nbody\n')
    const m = await store.read(ref('old name'))
    expect(await store.save(m.ref, { meta: { start: '09:00' } }, m.note.hash)).not.toHaveProperty(
      'renamedTo'
    )
    const m2 = await store.read(ref('old name'))
    expect(await store.save(m2.ref, { meta: { date: '2026-01-03' } }, m2.note.hash)).toMatchObject({
      renamedTo: '2026-01-03 Other'
    })
  })

  it('a conflict renames nothing and writes nothing', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    writeFileSync(file(m.ref.id), disk(m.ref.id) + 'edited elsewhere\n')
    expect((await save(m, { date: '2026-10-01' })).status).toBe('conflict')
    expect(existsSync(file('2026-09-24 Supervision'))).toBe(true)
    expect(existsSync(file('2026-10-01 Supervision'))).toBe(false)
  })

  it('the renamed meeting can be read and saved under its new id', async () => {
    const m = await store.create({ ...SUP, date: '2026-09-24' })
    const result = await save(m, { date: '2026-10-01' })
    const moved = {
      workspace: 'research',
      id: (result as { renamedTo: string }).renamedTo
    } as const
    const read = await store.read(moved)
    expect(await store.save(moved, { body: 'later\n' }, read.note.hash)).toMatchObject({
      status: 'saved'
    })
    await expect(store.read(m.ref)).rejects.toThrow('not found')
  })
})

describe('tickTodo', () => {
  it('ticks the TODO in the file, reindexes it, and changes nothing else', async () => {
    const m = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24',
      body: 'Intro\n**TODO(EO)**: write it\n- [ ] **TODO(KR)**: read it\nOutro\n'
    })
    const ticked = await store.tickTodo(m.ref, { owners: ['EO'], text: 'write it' })
    expect(splitNote(disk('2026-09-24 Supervision')).body).toBe(
      'Intro\n- [x] **TODO(EO)**: write it\n- [ ] **TODO(KR)**: read it\nOutro\n'
    )
    // What Undo needs: the body as it was, put back under the hash the tick left.
    expect(ticked.previousBody).toBe(
      'Intro\n**TODO(EO)**: write it\n- [ ] **TODO(KR)**: read it\nOutro\n'
    )
    const back = await store.save(m.ref, { body: ticked.previousBody }, ticked.hash)
    expect(back.status).toBe('saved')
    expect(splitNote(disk('2026-09-24 Supervision')).body).toBe(ticked.previousBody)
    const stale = await store.save(m.ref, { body: 'x' }, ticked.hash)
    expect(stale.status).toBe('conflict')
    await store.tickTodo(m.ref, { owners: ['EO'], text: 'write it' })
    const row = getMeetingRow(db, 'research', '2026-09-24 Supervision')
    expect(row?.todos.filter((t) => !t.done).map((t) => t.text)).toEqual(['read it'])
  })
  it('refuses a TODO that is no longer there, and leaves the file alone', async () => {
    const m = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24',
      body: '- [x] **TODO**: a\n'
    })
    const before = disk('2026-09-24 Supervision')
    await expect(store.tickTodo(m.ref, { owners: [], text: 'a' })).rejects.toBeInstanceOf(
      MeetingError
    )
    expect(disk('2026-09-24 Supervision')).toBe(before)
  })
})

describe('a meeting task', () => {
  it('a meeting made with the marker is saved with `task: auto`, one made without has no task line', async () => {
    const marked = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-10-12',
      task: 'auto'
    })
    expect(marked.meta.task).toBe('auto')
    expect(disk(marked.ref.id)).toContain('task: auto')
    expect(getMeetingRow(db, 'research', marked.ref.id)?.task).toBe('auto')
    const plain = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-10-13'
    })
    expect(disk(plain.ref.id)).not.toContain('task:')
  })

  it('is written to the front matter and the index only when set, and the body stays as it was', async () => {
    const made = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24',
      body: '## Notes\nhello\n'
    })
    expect(made.meta.task).toBe('')
    expect(disk(made.ref.id)).not.toContain('task:')
    const saved = await store.save(made.ref, { meta: { task: 'k3f9a2x1' } }, made.note.hash)
    expect(saved.status).toBe('saved')
    expect(disk(made.ref.id)).toContain('task: k3f9a2x1')
    expect(splitNote(disk(made.ref.id)).body).toBe('## Notes\nhello\n')
    expect(getMeetingRow(db, 'research', made.ref.id)?.task).toBe('k3f9a2x1')
    const again = await store.read(made.ref)
    await store.save(made.ref, { meta: { task: '' } }, again.note.hash)
    expect(disk(made.ref.id)).not.toContain('task:')
    expect(getMeetingRow(db, 'research', made.ref.id)?.task).toBe('')
  })

  it('refuses a value that is not a task id, and leaves the file alone', async () => {
    const made = await store.create({
      workspace: 'research',
      series: 'Supervision',
      date: '2026-09-24'
    })
    const before = disk(made.ref.id)
    await expect(
      store.save(made.ref, { meta: { task: 'cc://task/x\nseries: Other' } }, made.note.hash)
    ).rejects.toThrow(MeetingError)
    expect(disk(made.ref.id)).toBe(before)
  })

  it('is found by reindexing a note that already has one, and a note without one stays without', async () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      file('2026-09-24 Supervision'),
      '---\nseries: Supervision\ndate: 2026-09-24\ntask: abc12345\n---\n## Notes\n'
    )
    writeFileSync(
      file('2026-09-25 Supervision'),
      '---\nseries: Supervision\ndate: 2026-09-25\n---\n## Notes\n'
    )
    await store.reindexAll('research')
    expect(getMeetingRow(db, 'research', '2026-09-24 Supervision')?.task).toBe('abc12345')
    expect(getMeetingRow(db, 'research', '2026-09-25 Supervision')?.task).toBe('')
    expect(disk('2026-09-25 Supervision')).not.toContain('task:')
  })
})

describe('a deleted meeting takes its own task with it', () => {
  let trashedTasks: string[]
  let restoredTasks: string[]
  beforeEach(() => {
    trashedTasks = []
    restoredTasks = []
    store = new MeetingsStore({
      db,
      dirFor: (w) => join(root, w),
      trash: async (path) => {
        mkdirSync(trashDir, { recursive: true })
        renameSync(path, join(trashDir, basename(path)))
      },
      trashTask: (uid) => trashedTasks.push(uid),
      restoreTask: (uid) => restoredTasks.push(uid)
    })
  })
  const make = async (task: string, date = '2026-10-19'): Promise<MeetingRef> =>
    (await store.create({ workspace: 'research', series: 'Supervision', date, task })).ref

  it('asks for the task named in the meeting, and Undo restores it', async () => {
    const meeting = await make('k3f9a2x1')
    const content = await store.delete(meeting)
    expect(trashedTasks).toEqual(['k3f9a2x1'])
    await store.restore(meeting, content)
    expect(restoredTasks).toEqual(['k3f9a2x1'])
  })

  it('has no task to trash for a meeting with none yet, or one still marked auto', async () => {
    await store.delete(await make('auto'))
    await store.delete(
      (await store.create({ workspace: 'research', series: 'Other', date: '2026-10-20' })).ref
    )
    expect(trashedTasks).toEqual([])
  })

  it('leaves a task another meeting names', async () => {
    const a = await make('shared01')
    await make('shared01', '2026-10-20')
    await store.delete(a)
    expect(trashedTasks).toEqual([])
  })

  it('keeps the task when the file cannot be moved to the Trash', async () => {
    const meeting = await make('k3f9a2x1')
    store = new MeetingsStore({
      db,
      dirFor: (w) => join(root, w),
      trash: async () => {
        throw new Error('Trash unavailable')
      },
      trashTask: (uid) => trashedTasks.push(uid)
    })
    await expect(store.delete(meeting)).rejects.toThrow('Trash unavailable')
    expect(trashedTasks).toEqual([])
  })
})

describe('a meeting with no series (New meeting: only today’s date)', () => {
  const NONE = { workspace: 'research', date: '2026-10-19', task: 'auto' } as const

  it('is filed as "<date> Untitled", with no series line, and repeats are numbered', async () => {
    const a = await store.create(NONE)
    const b = await store.create(NONE)
    expect(a.ref.id).toBe('2026-10-19 Untitled')
    expect(b.ref.id).toBe('2026-10-19 Untitled 2')
    expect(disk(a.ref.id)).not.toContain('series:')
    expect(a.meta).toMatchObject({ series: '', date: '2026-10-19', task: 'auto' })
    expect(a.problems).toEqual([])
    expect(getMeetingRow(db, 'research', a.ref.id)?.series).toBe('')
  })

  it('is renamed when its series is chosen, and when its date changes first', async () => {
    const m = await store.create(NONE)
    const moved = await store.save(m.ref, { meta: { date: '2026-10-20' } }, m.note.hash)
    expect(moved).toMatchObject({ status: 'saved', renamedTo: '2026-10-20 Untitled' })
    const again = await store.read({ workspace: 'research', id: '2026-10-20 Untitled' })
    const chosen = await store.save(again.ref, { meta: { series: 'Luminos' } }, again.note.hash)
    expect(chosen).toMatchObject({ renamedTo: '2026-10-20 Luminos' })
    expect(disk('2026-10-20 Luminos')).toContain('series: Luminos')
  })

  it('refuses an empty series on a save, and leaves a hand-made file with no series under its own name', async () => {
    const m = await store.create(NONE)
    await expect(store.save(m.ref, { meta: { series: '  ' } }, m.note.hash)).rejects.toThrow(
      MeetingError
    )
    mkdirSync(dir, { recursive: true })
    writeFileSync(file('my own name'), '---\ndate: 2026-10-01\n---\nhello\n')
    const own = await store.read({ workspace: 'research', id: 'my own name' })
    const result = await store.save(own.ref, { meta: { date: '2026-10-02' } }, own.note.hash)
    expect(result.status).toBe('saved')
    expect('renamedTo' in result).toBe(false)
    expect(existsSync(file('my own name'))).toBe(true)
  })
})

describe('discardIfUntouched', () => {
  let trashedTasks: string[]
  beforeEach(() => {
    trashedTasks = []
    store = new MeetingsStore({
      db,
      dirFor: (w) => join(root, w),
      trash: async (path) => {
        mkdirSync(trashDir, { recursive: true })
        renameSync(path, join(trashDir, basename(path)))
      },
      trashTask: (uid) => trashedTasks.push(uid)
    })
  })

  it('moves a meeting nothing was written in to the Trash, with its own task', async () => {
    const m = await store.create({ workspace: 'research', date: '2026-10-19', task: 'auto' })
    await store.save(m.ref, { meta: { task: 'own00001' } }, m.note.hash)
    expect(await store.discardIfUntouched(m.ref)).toBe(true)
    expect(existsSync(file(m.ref.id))).toBe(false)
    expect(existsSync(join(trashDir, `${m.ref.id}.md`))).toBe(true)
    expect(getMeetingRow(db, 'research', m.ref.id)).toBeNull()
    expect(trashedTasks).toEqual(['own00001'])
  })

  it('keeps a meeting with anything in it, judged from the file', async () => {
    const m = await store.create({ workspace: 'research', date: '2026-10-19', task: 'auto' })
    const typed = await store.read(m.ref)
    await store.save(m.ref, { body: '## Summary\n## Notes\nwe talked\n' }, typed.note.hash)
    expect(await store.discardIfUntouched(m.ref)).toBe(false)
    const named = await store.create({
      workspace: 'research',
      series: 'Luminos',
      date: '2026-10-19'
    })
    expect(await store.discardIfUntouched(named.ref)).toBe(false)
    expect(existsSync(file(m.ref.id))).toBe(true)
    expect(existsSync(file(named.ref.id))).toBe(true)
    expect(trashedTasks).toEqual([])
  })

  it('is false, not an error, for a meeting that is gone', async () => {
    expect(await store.discardIfUntouched(ref('missing'))).toBe(false)
  })
})
